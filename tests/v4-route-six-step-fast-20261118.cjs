'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const {chromium}=require('playwright-core');
function locate(){for(const x of ['google-chrome','google-chrome-stable','chromium','chromium-browser'])try{return cp.execFileSync('which',[x],{encoding:'utf8'}).trim()}catch{}throw Error('No system Chromium installed')}
const base='http://127.0.0.1:8765/v4-route-six-step-20261118/';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:locate(),args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const cx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'});
  const pg=await cx.newPage(),errors=[];pg.on('pageerror',e=>errors.push(e.message));pg.setDefaultTimeout(18000);
  await pg.goto(base+'icon.svg');
  await pg.evaluate(async()=>{
   const p=[{id:'fast-p1',title:'沿海 A',lat:30,lng:120,starred:true,note:'保存原收藏 Brief'},
    {id:'fast-p2',title:'沿海 B',lat:30.2,lng:120.5,starred:true,note:'B Brief'},
    {id:'fast-p3',title:'沿海 C',lat:30.1,lng:121,starred:true,note:'C Brief'}];
   await new Promise((resolve,reject)=>{
    const r=indexedDB.open('atlas-v4-review-20261116-private-travel-footprints-v1',1);
    r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('places'))r.result.createObjectStore('places',{keyPath:'id'});if(!r.result.objectStoreNames.contains('meta'))r.result.createObjectStore('meta',{keyPath:'key'})};
    r.onsuccess=()=>{const db=r.result,t=db.transaction('places','readwrite');for(const x of p)t.objectStore('places').put(x);t.oncomplete=()=>{db.close();resolve()};t.onerror=()=>reject(t.error)};r.onerror=()=>reject(r.error)
   })
  });
  console.log('HOME');await pg.goto(base+'index.html',{waitUntil:'domcontentloaded'});await pg.locator('#dockRoute').click();
  await pg.waitForURL(/journey\.html$/,{timeout:18000});
  await pg.waitForFunction(()=>window.__fpSixStepRoute?.state?.step==='entry',null,{timeout:20000});
  const stage=()=>pg.evaluate(()=>window.__fpSixStepRoute.state.step);
  console.log('ENTRY');assert.equal(await stage(),'entry');
  await pg.locator('[data-action="start"]').click();
  console.log('PICK');assert.equal(await stage(),'pick');
  console.log('BEFORE PICK',JSON.stringify(await pg.evaluate(()=>({places:window.__fpRoutePreviewData?.map(x=>x.id),state:window.__fpSixStepRoute?.state,buttons:[...document.querySelectorAll('#fpRouteFlowSheet [data-action=toggle]')].map(x=>x.dataset.id)}))));
  for(const id of ['fast-p1','fast-p2','fast-p3']){await pg.locator('[data-action="toggle"][data-id="'+id+'"]').click();console.log('PICK RESULT',id,JSON.stringify(await pg.evaluate(()=>window.__fpSixStepRoute.state)));}
  assert.equal((await pg.evaluate(()=>window.__fpSixStepRoute.state.order)).length,3);
  await pg.locator('[data-action="nextpick"]').click();assert.equal(await stage(),'order');
  console.log('ORDER');await pg.locator('[data-action="day"][data-id="fast-p2"]').click();
  assert.equal((await pg.evaluate(()=>window.__fpSixStepRoute.state.days['fast-p2'])),2);
  await pg.locator('[data-action="undo"]').click();
  assert.equal((await pg.evaluate(()=>window.__fpSixStepRoute.state.days['fast-p2'])),1);
  await pg.locator('[data-action="nextorder"]').click();assert.equal(await stage(),'settings');
  console.log('SETTINGS');await pg.locator('[data-mode="bike"]').click();
  assert.equal((await pg.evaluate(()=>window.__fpSixStepRoute.state.mode)),'bike');
  await pg.locator('[data-action="nextsettings"]').click();assert.equal(await stage(),'recommend');
  console.log('RECOMMEND');await pg.locator('[data-action="adopt"]').click();
  await pg.locator('[data-action="save"]').click();
  await pg.waitForFunction(()=>window.__fpSixStepRoute?.state?.step==='done'&&window.__fpSixStepRoute.state.savedId,null,{timeout:18000});
  const route=await pg.evaluate(async()=>{
   const id=window.__fpSixStepRoute.state.savedId;
   return (await FootprintMediaCore.createRepository(indexedDB).listRoutes()).find(x=>x.id===id)
  });
  assert.equal(route?.stops?.length,3);assert.equal(route?.transportMode,'bike');
  console.log('SAVED',route.id);
  await pg.goto(base+'journey.html?saved='+encodeURIComponent(route.id),{waitUntil:'domcontentloaded'});
  await pg.waitForFunction(()=>window.__fpSixStepRoute?.state?.step==='done',null,{timeout:20000});
  assert.equal((await pg.evaluate(()=>window.__fpSixStepRoute.state.mode)),'bike');
  assert.ok(!errors.some(e=>/TypeError|ReferenceError|SyntaxError/.test(e)),errors.join('\n'));
  console.log('SUCCESS: SIX-STEP LIVE CHROME');await cx.close()
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
