'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const variant=process.env.BROWSER||'chromium',base=process.env.BASE||'https://fanbregas-netizen.github.io/travel-atlas-pages/v4-approved-four-systems-live-20261113/';
const originalId='id-a2',secondId='id-b9',thirdId='id-c8';
(async()=>{
 const browser=await ({chromium,webkit})[variant].launch({headless:true,...(variant==='chromium'?{args:['--no-sandbox']}:{})});
 const context=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1'
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 try{
  await page.goto(base+'journey.html',{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.loaded===true,null,{timeout:20000});
  const seed=await page.evaluate(async()=>{
   const rec=[
    {id:'id-a2',title:'平江路',lat:31.327,lng:120.629,starred:true,note:'保留真实 Brief'},
    {id:'id-b9',title:'金鸡湖',lat:31.309,lng:120.699,starred:true,note:'沿湖慢行'},
    {id:'id-c8',title:'苏州博物馆',lat:31.325,lng:120.634,starred:true,note:'记录建筑'}
   ];
   const db=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('private-travel-footprints-v1',1);
    request.onupgradeneeded=()=>{
     if(!request.result.objectStoreNames.contains('places'))request.result.createObjectStore('places',{keyPath:'id'});
     if(!request.result.objectStoreNames.contains('meta'))request.result.createObjectStore('meta',{keyPath:'key'})
    };
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)
   });
   await new Promise((resolve,reject)=>{
    const tx=db.transaction('places','readwrite');
    rec.forEach(p=>tx.objectStore('places').put(p));
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)
   });db.close();
   return rec.map(x=>x.id);
  });
  await page.reload({waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.loaded===true,null,{timeout:20000});
  let st=await page.evaluate(()=>window.__atlasRouteV5Live.state);
  assert.deepEqual(st.selected,[]);
  assert.equal(st.stage,'select');
  await page.locator('#rc-body [data-rc="pick-live0"]').click({timeout:14000});
  await page.locator('#rc-body [data-rc="pick-live1"]').click({timeout:14000});
  st=await page.evaluate(()=>window.__atlasRouteV5Live.state);
  assert.deepEqual(st.order.map(p=>p.id),[originalId,secondId]);
  await page.locator('#rc-footer [data-rc="stage-order"]').click({timeout:14000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live.state.stage==='order',null,{timeout:12000});
  await page.locator('#rc-body [data-rc="mini-date"]').click({timeout:14000});
  await page.waitForFunction(()=>!!document.querySelector('#rc-mini-layer.is-open'),null,{timeout:10000});
  const pre=await page.evaluate(()=>window.__atlasRouteV5Live.state);
  await page.locator('#rc-mini [data-rc="date-weekend"]').click({timeout:12000});
  await page.locator('#rc-mini [data-rc="date-cancel"]').click({timeout:12000});
  const cancelled=await page.evaluate(()=>window.__atlasRouteV5Live.state);
  assert.equal(cancelled.start,pre.start);
  assert.equal(cancelled.end,pre.end);
  await page.locator('#rc-body [data-rc="mini-date"]').click({timeout:14000});
  await page.locator('#rc-mini [data-rc="date-weekend"]').click({timeout:14000});
  await page.locator('#rc-mini [data-rc="date-commit"]').click({timeout:14000});
  await page.waitForFunction(()=>!document.querySelector('#rc-mini-layer.is-open'),null,{timeout:12000});
  await page.locator('#rc-body [data-drag="0"]').focus();
  await page.keyboard.press('ArrowDown');
  st=await page.evaluate(()=>window.__atlasRouteV5Live.state);
  assert.deepEqual(st.order.map(x=>x.id),[secondId,originalId]);
  await page.locator('#rc-footer [data-rc="stage-preview"]').click({timeout:14000});
  await page.locator('#rc-footer [data-rc="mini-save"]').click({timeout:14000});
  await page.locator('#rc-save-name').fill('C V5 真实存储验收');
  await page.locator('#rc-mini [data-rc="save-confirm"]').click({timeout:14000});
  await page.waitForFunction(()=>!!window.__atlasRouteV5Live.state.savedId,null,{timeout:18000});
  const saved=await page.evaluate(async()=>{
   const id=window.__atlasRouteV5Live.state.savedId;
   const route=(await FootprintMediaCore.createRepository(indexedDB).listRoutes()).find(r=>r.id===id);
   return {id,stored:route,ui:window.__atlasRouteV5Live.state};
  });
  assert.ok(saved.stored?.stops?.length===2,'Media D repository did not persist');
  assert.deepEqual(saved.stored.stops.map(x=>x.placeId),[secondId,originalId]);
  const sid=saved.id;
  await page.goto(base+'journey.html?saved='+encodeURIComponent(sid),{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.loaded===true,null,{timeout:18000});
  const reopened=await page.evaluate(()=>window.__atlasRouteV5Live.state);
  assert.deepEqual(reopened.order.map(x=>x.id),[secondId,originalId]);
  assert.equal(reopened.savedId,sid);
  await page.locator('#rc-footer [data-rc="stage-preview"]').click({timeout:14000});
  await page.locator('#rc-footer [data-rc="open-real-map"]').click({timeout:14000});
  await page.waitForURL('**/route-view.html?saved=*',{timeout:19000});
  await page.waitForFunction(()=>window.__atlasRV?.places?.length===2,null,{timeout:22000});
  const route=await page.evaluate(()=>window.__atlasRV.places.map(p=>String(p.id)));
  assert.deepEqual(route,[secondId,originalId]);
  console.log('FOUR_SYSTEMS_CV5_LIVE_PASS '+variant+' '+JSON.stringify({seed,selectedBefore:st.order,savedId:sid,dates:[saved.stored.startDate,saved.stored.endDate],reopened,route,errorCount:errors.length}));
  assert.equal(errors.filter(x=>/TypeError|ReferenceError|SyntaxError|Uncaught/.test(x)).length,0,'Unexpected runtime errors: '+errors.join('; '));
 }finally{await browser.close()}
})().catch(e=>{console.error('FOUR_SYSTEMS_CV5_LIVE_FAIL '+variant+' '+e.stack);process.exit(1)});
