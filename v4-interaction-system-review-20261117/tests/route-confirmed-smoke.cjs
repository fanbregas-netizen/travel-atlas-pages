'use strict';
const assert=require('node:assert/strict'),cp=require('node:child_process'),fs=require('node:fs');
const {chromium}=require('playwright-core');
const chrome=['google-chrome','chromium'].map(n=>{try{return cp.execFileSync('which',[n],{encoding:'utf8'}).trim()}catch{return ''}}).find(Boolean);
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'});
  const page=await ctx.newPage();page.setDefaultTimeout(8000);
  page.on('pageerror',e=>console.log('PAGEERROR',e.stack));
  page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,250))});
  const base='http://127.0.0.1:8765/v4-interaction-system-review-20261117/';
  console.log('SMOKE 1 seed');
  await page.goto(base+'index.html',{waitUntil:'domcontentloaded',timeout:15000});
  await page.evaluate(async()=>{
    const fixtures=[{id:'qa-smoke-a',title:'沿海 A',lat:30,lng:120,starred:true,note:'A Brief',photos:[]},{id:'qa-smoke-c',title:'沿海 C',lat:30,lng:121,starred:true,note:'C Brief',photos:[]},{id:'qa-smoke-b',title:'沿海 B',lat:30,lng:120.2,starred:true,note:'B Brief',photos:[]},{id:'qa-smoke-d',title:'沿海 D',lat:30,lng:121.2,starred:true,note:'D Brief',photos:[]}];
    await new Promise((resolve,reject)=>{
      const req=indexedDB.open('private-travel-footprints-v1',1);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('places'))db.createObjectStore('places',{keyPath:'id'});
        if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
      };
      req.onerror=()=>reject(req.error);
      req.onsuccess=()=>{
        const db=req.result,tx=db.transaction('places','readwrite');
        fixtures.forEach(p=>tx.objectStore('places').put(p));
        tx.oncomplete=()=>{db.close();resolve()};
        tx.onerror=()=>reject(tx.error);
      };
    });
  });
  console.log('SMOKE 2 journey navigation');
  await page.goto(base+'journey-real-confirmed-20261118.html',{waitUntil:'domcontentloaded',timeout:15000});
  console.log('SMOKE 3 waiting app state');
  await page.waitForFunction(()=>!!window.__atlasJourneyRoute?.getState&&document.querySelectorAll('#places .place').length===4,null,{timeout:10000});
  const st=await page.evaluate(()=>({selected:window.__atlasJourneyRoute.getState().selected.length,sections:document.querySelectorAll('.builder>section.block').length,visual:!!window.__atlasJourneyVisual,rows:document.querySelectorAll('#places .place').length,tool:!!window.FootprintRouteEngine,media:!!window.FootprintMediaCore}));
  console.log('SMOKE READY',JSON.stringify(st));assert.equal(st.rows,4);assert.equal(st.visual,true);
  console.log('SMOKE 4 activate place list');
  await page.evaluate(()=>window.__atlasJourneyVisual?.setStep('places'));
  await page.waitForTimeout(450);
  console.log('SMOKE 5 add four real points');
  for(const title of ['沿海 A','沿海 C','沿海 B','沿海 D']){
    console.log('SMOKE click',title);
    await page.locator('#places .place').filter({hasText:title}).click({timeout:8000});
  }
  const selected=await page.evaluate(()=>window.__atlasJourneyRoute.getState().selected.map(s=>s.id));
  console.log('SMOKE SELECTED',JSON.stringify(selected));
  assert.deepEqual(selected,['qa-smoke-a','qa-smoke-c','qa-smoke-b','qa-smoke-d']);
  console.log('SMOKE 5b set same-day itinerary');
  await page.evaluate(()=>{
    for(const id of ['qa-smoke-a','qa-smoke-c','qa-smoke-b','qa-smoke-d']){
      const row=document.querySelector('#chosen [data-stop-id="'+id+'"]'),select=row?.querySelector('.day-picker');
      if(!select)throw new Error('Missing day selector '+id);
      select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  await page.evaluate(()=>window.__atlasJourneyVisual.setStep('order'));
  const before=await page.evaluate(()=>window.__atlasJourneyRoute.getState().selected.map(s=>s.id));
  console.log('SMOKE 5c preview-only recommendation');
  await page.locator('#autoArrange').click({timeout:8000});
  assert.equal(await page.locator('#routeSuggestion:not([hidden])').count(),1);
  assert.deepEqual(await page.evaluate(()=>window.__atlasJourneyRoute.getState().selected.map(s=>s.id)),before);
  await page.locator('#routeSuggestion button').filter({hasText:'采用建议'}).click({timeout:8000});
  const optimized=await page.evaluate(()=>window.__atlasJourneyRoute.getState().selected.map(s=>s.id));
  console.log('SMOKE RECOMMENDED',JSON.stringify(optimized));
  assert.deepEqual(optimized,['qa-smoke-a','qa-smoke-b','qa-smoke-c','qa-smoke-d']);
  await page.locator('#undoProposal').click({timeout:8000});
  assert.deepEqual(await page.evaluate(()=>window.__atlasJourneyRoute.getState().selected.map(s=>s.id)),before);
  console.log('SMOKE 6 open real settings');
  await page.evaluate(()=>window.__atlasJourneyVisual.setStep('settings'));
  await page.locator('#originPlaceId').selectOption('qa-smoke-a',{timeout:8000});
  await page.locator('#destinationPlaceId').selectOption('qa-smoke-d',{timeout:8000});
  await page.locator('[data-route-mode="bike"]').click({timeout:8000});
  const state=await page.evaluate(()=>window.__atlasJourneyRoute.getState());
  console.log('SMOKE SETTINGS',JSON.stringify({origin:state.originPlaceId,destination:state.destinationPlaceId,mode:state.transportMode}));
  assert.equal(state.transportMode,'bike');
  console.log('SMOKE 7 save');
  await page.locator('#savePlan').click({timeout:8000});
  await page.waitForFunction(()=>!!window.__atlasJourneyRoute?.getState().id,null,{timeout:12000});
  const savedId=await page.evaluate(()=>window.__atlasJourneyRoute.getState().id);
  console.log('SMOKE SAVED',savedId);
  console.log('SMOKE 8 open route map');
  await page.evaluate(()=>window.__atlasJourneyVisual.setStep('order'));
  await page.locator('#generate').click({timeout:10000});
  await page.waitForURL(/route-view-real-confirmed-20261118\.html\?saved=/,{timeout:18000});
  console.log('SMOKE 9 map loaded');
  await page.waitForFunction(()=>!!document.querySelector('#editRouteLink:not([hidden])'),null,{timeout:12000});
  console.log('SMOKE 10 editor return');
  await page.locator('#editRouteLink').click({timeout:10000});
  await page.waitForURL(/journey-real-confirmed-20261118\.html\?edit=/,{timeout:18000});
  await page.waitForFunction(id=>window.__atlasJourneyRoute?.getState().id===id,savedId,{timeout:15000});
  const restored=await page.evaluate(()=>window.__atlasJourneyRoute.getState());
  console.log('SMOKE RESTORED',JSON.stringify({id:restored.id,mode:restored.transportMode,order:restored.selected.map(s=>s.id)}));
  assert.equal(restored.transportMode,'bike');
  assert.equal(restored.selected.length,4);
  fs.mkdirSync('route-smoke-evidence',{recursive:true});await page.screenshot({path:'route-smoke-evidence/real-journey-390.png'});
  await ctx.close();
 }finally{await browser.close()}
})().catch(e=>{console.error('SMOKE FAILED',e.stack||e);process.exitCode=1});
