'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('playwright');
const base='http://127.0.0.1:8765/v4-approved-route-20261118/';
const names=['chromium','webkit'];
async function testKind(kind){
 const browser=await ({chromium,webkit})[kind].launch({headless:true,...(kind==='chromium'?{args:['--no-sandbox']}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,serviceWorkers:'block',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1'});
 const page=await context.newPage();let errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try {
  await page.goto(base+'index.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('#dockRoute',{timeout:30000});
  assert.equal(await page.locator('#dockRoutePop').evaluate(n=>getComputedStyle(n).display),'none');
  await page.locator('#dockRoute').click({timeout:16000});
  await page.waitForURL('**/journey.html',{timeout:20000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.loaded===true,null,{timeout:28000});
  assert.equal(await page.locator('#rc-main').count(),1);
  assert.equal(await page.locator('#rc-mini').count(),1);
  assert.equal(await page.locator('#rc-live-map-canvas').count(),1);
  const grip=await page.locator('#rc-grab .rc-handle').boundingBox();
  const sheet=await page.locator('#rc-main').boundingBox();
  assert.ok(grip&&sheet&&Math.abs(grip.x+grip.width/2-(sheet.x+sheet.width/2))<5,'Card grip not centered');
  await page.evaluate(async()=>{
   const req=indexedDB.open('private-travel-footprints-v1',1);
   const db=await new Promise((resolve,reject)=>{
    req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains('places'))d.createObjectStore('places',{keyPath:'id'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'})};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)
   });
   await new Promise((resolve,reject)=>{
    const tx=db.transaction('places','readwrite');const store=tx.objectStore('places');
    [{id:'qa-route-p1',title:'海边一',lat:31.2,lng:121.4,starred:true,note:'保留 Brief 一'},
     {id:'qa-route-p2',title:'海边二',lat:31.3,lng:121.9,starred:true,note:'保留 Brief 二'},
     {id:'qa-route-p3',title:'海边三',lat:31.4,lng:121.5,starred:true,note:'保留 Brief 三'},
     {id:'qa-route-p4',title:'海边四',lat:31.5,lng:121.8,starred:true,note:'保留 Brief 四'}].forEach(p=>store.put(p));
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)
   });db.close();
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.loaded===true,null,{timeout:28000});
  const rows=page.locator('#rc-body [data-rc^="pick-"]');
  await rows.first().waitFor({timeout:15000});
  for(let i=0;i<4;i++)await rows.nth(i).click({timeout:18000});
  await page.locator('#rc-footer [data-rc="stage-order"]').click({timeout:15000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.state.stage==='order');
  assert.ok(await page.locator('#rc-body [data-rc="route-suggest"]').isVisible(),'Order recommendation missing');
  await page.locator('#rc-body [data-rc="mini-transport"]').click();
  await page.locator('#rc-mini [data-rc="transport-bike"]').click();
  await page.locator('#rc-mini .rc-transport-legs summary').click();
  await page.locator('#rc-mini select[data-leg-index="1"]').selectOption('transit');
  const before=await page.evaluate(()=>window.__atlasRouteV5Live.state);
  assert.equal(before.transportMode,'bike');
  assert.ok(Object.values(before.legModes).includes('transit'),'Per-leg transport not stored in state');
  await page.locator('#rc-mini [data-rc="mini-close"]').last().click();
  await page.locator('#rc-footer [data-rc="stage-preview"]').click();
  await page.waitForFunction(()=>window.__atlasRouteV5Live.state.stage==='preview');
  assert.ok(await page.locator('#rc-body [data-rc="mini-transport"]').isVisible());
  await page.locator('#rc-footer [data-rc="mini-save"]').click();
  await page.locator('#rc-mini #rc-save-name').fill('新版真实路线验收');
  await page.locator('#rc-mini [data-rc="save-confirm"]').click();
  await page.waitForFunction(()=>Boolean(window.__atlasRouteV5Live?.state.savedId),null,{timeout:20000});
  const saved=await page.evaluate(async()=>{
   const s=window.__atlasRouteV5Live.state;const db=FootprintMediaCore.createRepository(indexedDB);
   return {id:s.savedId,record:(await db.listRoutes()).find(x=>x.id===s.savedId)};
  });
  assert.equal(saved.record.transportMode,'bike');
  assert.ok(Object.values(saved.record.legModes).includes('transit'));
  assert.equal(saved.record.stops.length,4);
  assert.equal(saved.record.stops[0].placeId,'qa-route-p1');
  await page.goto(base+'journey.html?saved='+encodeURIComponent(saved.id),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.loaded===true,null,{timeout:28000});
  const reopened=await page.evaluate(()=>window.__atlasRouteV5Live.state);
  assert.equal(reopened.transportMode,'bike');
  assert.ok(Object.values(reopened.legModes).includes('transit'));
  assert.equal(reopened.order.length,4);
  assert.ok(!errors.some(s=>/ReferenceError|TypeError/.test(s)),errors.join('\n'));
  console.log(kind+' PASS: full-product dock, physical C V5 sheet, 4 stops, transport save/reopen and stable PlaceId');
 }catch(e){
  fs.mkdirSync('route-v4-evidence',{recursive:true});
  await page.screenshot({path:'route-v4-evidence/'+kind+'-failure.png',fullPage:true}).catch(()=>{});
  console.error(kind+' page errors: '+errors.join('\n'));
  throw e;
 }finally{await browser.close()}
}
(async()=>{for(const k of names)await testKind(k)})().catch(e=>{console.error(e);process.exit(1)});
