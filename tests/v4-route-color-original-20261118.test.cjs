'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('playwright');
const kind=process.env.BROWSER||'chromium';
const base='http://127.0.0.1:8765/v4-route-color-original-20261118/';
const fixture=[
 {id:'qa-coast-a',title:'海边 A',lat:30.0,lng:120.0,note:'真实收藏 Brief A',starred:true,photos:[]},
 {id:'qa-coast-c',title:'海边 C',lat:30.0,lng:121.0,note:'真实收藏 Brief C',starred:true,photos:[]},
 {id:'qa-coast-b',title:'海边 B',lat:30.0,lng:120.2,note:'真实收藏 Brief B',starred:true,photos:[]},
 {id:'qa-coast-d',title:'海边 D',lat:30.0,lng:121.2,note:'真实收藏 Brief D',starred:true,photos:[]}
];
async function seed(page){
 await page.goto(base+'icon.svg',{waitUntil:'domcontentloaded'});
 await page.evaluate(async data=>{
  await new Promise((resolve,reject)=>{
   const req=indexedDB.open('atlas-v4-review-20261116-private-travel-footprints-v1',1);
   req.onupgradeneeded=()=>{const db=req.result;
    if(!db.objectStoreNames.contains('places'))db.createObjectStore('places',{keyPath:'id'});
    if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
   };
   req.onerror=()=>reject(req.error);
   req.onsuccess=()=>{
    const db=req.result,tx=db.transaction('places','readwrite');
    for(const p of data)tx.objectStore('places').put(p);
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onerror=()=>reject(tx.error);
   };
  })
 },fixture);
}
async function testWidth(width){
 const browser=await ({chromium,webkit})[kind].launch({headless:true,...(kind==='chromium'?{args:['--no-sandbox']}:{})});
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(15000);
 try{
  console.log(kind,width,'seed');
  await seed(page);
  console.log(kind,width,'open product route');
  await page.goto(base+'index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('#dockRoute').click({timeout:18000});
  await page.waitForURL(/\/journey\.html$/, {timeout:18000});
  await page.waitForFunction(()=>Boolean(window.__fpRouteLogicUI?.getState)&&document.body.classList.contains('fp-route-minimal'),null,{timeout:22000});
  const color=await page.evaluate(()=>{
   const v=getComputedStyle(document.body);
   return {paper:v.getPropertyValue('--route-paper').trim(),sage:v.getPropertyValue('--route-sage').trim(),
    ink:v.getPropertyValue('--route-ink').trim(),gold:v.getPropertyValue('--route-gold').trim()};
  });
  assert.deepEqual(color,{paper:'#fffefa',sage:'#edf1e9',ink:'#27342f',gold:'#b59a62'});
  for(const href of ['route-logic-review-v1.css','route-minimal-review-v2.css','route-color-parity-v3.css']){
   assert.ok(await page.locator('link[href*="'+href+'"]').count(),'missing exact approved layer '+href);
  }
  assert.equal((await page.evaluate(()=>window.__fpRoutePreviewData)).length,4,'Real starred places only');
  assert.ok(!(await page.locator('body').textContent()).includes('演示地点'),'Demo fixture leaked');
  const sheet=page.locator('#fpRoutePanel');
  assert.equal(await sheet.count(),1,'one accepted route panel');
  console.log(kind,width,'select real favorites');
  await page.locator('#fpRouteTools [data-open="pick"]').click();
  for(const id of ['qa-coast-c','qa-coast-b','qa-coast-d'])
   await page.locator('#fpRoutePanelBody [data-pick="'+id+'"]').click();
  let state=await page.evaluate(()=>window.__fpRouteLogicUI.getState());
  assert.equal(state.order.length,4);
  await page.locator('#fpRoutePanelBack').click();
  await page.locator('#fpRoutePanelBody [data-action="recommend"]').click();
  assert.ok(await page.locator('#fpRoutePanelBody').textContent().then(t=>t.includes('推荐访问顺序')));
  await page.locator('#fpRoutePanelSettings').click();
  await page.locator('#fpRoutePanelBody [data-mode="bike"]').click();
  state=await page.evaluate(()=>window.__fpRouteLogicUI.getState());
  assert.equal(state.mode,'bike');
  await page.locator('#fpRoutePanelBody details.fp-simple-details summary').click();
  await page.locator('#fpRoutePanelBody select[data-leg]').first().selectOption('walk');
  await page.waitForFunction(()=>!!window.__fpRouteLiveBridge?.savedId,null,{timeout:12000});
  await page.waitForTimeout(450);
  const before=await page.evaluate(async()=>{
   const id=window.__fpRouteLiveBridge.savedId;
   const r=await FootprintMediaCore.createRepository(indexedDB).listRoutes();
   return {id,record:r.find(x=>x.id===id)};
  });
  assert.ok(before.id&&before.record,'Route must be saved in real MediaCore repository');
  assert.equal(before.record.transportMode,'bike');
  assert.equal(before.record.stops.length,4);
  assert.deepEqual(before.record.stops.map(x=>String(x.placeId)),state.order);
  assert.ok(Object.values(before.record.legModes||{}).includes('walk'));
  fs.mkdirSync('route-v4-color-evidence',{recursive:true});
  await page.screenshot({path:'route-v4-color-evidence/'+kind+'-'+width+'-settings.png'});
  console.log(kind,width,'reopen saved route');
  await page.goto(base+'journey.html?saved='+encodeURIComponent(before.id),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>Boolean(window.__fpRouteLogicUI?.getState&&window.__fpRouteLiveInitial?.id),null,{timeout:22000});
  const reopened=await page.evaluate(()=>window.__fpRouteLogicUI.getState());
  assert.equal(reopened.mode,'bike');
  assert.deepEqual(reopened.order,before.record.placeIds);
  assert.ok(Object.values(reopened.legs).includes('walk'));
  // Saving a route must not touch the original favorite/Brief.
  const brief=await page.evaluate(async()=>new Promise((resolve,reject)=>{
   const r=indexedDB.open('private-travel-footprints-v1',1);
   r.onerror=()=>reject(r.error);
   r.onsuccess=()=>{const db=r.result,q=db.transaction('places','readonly').objectStore('places').get('qa-coast-a');
    q.onsuccess=()=>{resolve(q.result?.note);db.close()};
    q.onerror=()=>reject(q.error);
   };
  }));
  assert.equal(brief,'真实收藏 Brief A');
  assert.ok(!errors.some(e=>/ReferenceError|TypeError|SyntaxError/.test(e)),errors.join('\n'));
  console.log('PASS',kind,width,'original CSS, real favorites, arrange, transport, per-leg, persisted route, Brief intact');
 }catch(err){
  fs.mkdirSync('route-v4-color-evidence',{recursive:true});
  await page.screenshot({path:'route-v4-color-evidence/'+kind+'-'+width+'-failure.png'}).catch(()=>{});
  console.error('pageerrors:',errors.join(' | '));
  throw err;
 }finally{await browser.close()}
}
(async()=>{for(const width of [375,390])await testWidth(width)})().catch(e=>{console.error(e.stack||e);process.exit(1)});
