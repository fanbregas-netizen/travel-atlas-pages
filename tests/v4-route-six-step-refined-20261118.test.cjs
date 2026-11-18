'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('playwright');
const kind=process.env.BROWSER||'chromium';
const width=Number(process.env.WIDTH)||390;
const base='http://127.0.0.1:8765/v4-route-six-step-refined-20261118/';
const fixture=[
 {id:'rv-a',title:'沿海 A',address:'海岸 A',lat:29.27,lng:121.408,starred:true,note:'A 的 Brief 不可修改',photos:[]},
 {id:'rv-b',title:'沿海 B',address:'海岸 B',lat:29.76,lng:121.583,starred:true,note:'B 的 Brief',photos:[]},
 {id:'rv-c',title:'沿海 C',address:'海岸 C',lat:28.856,lng:121.119,starred:true,note:'C 的 Brief',photos:[]},
 {id:'rv-d',title:'沿海 D',address:'海岸 D',lat:28.37,lng:121.061,starred:true,note:'D 的 Brief',photos:[]}
];
(async()=>{
 const engine=({chromium,webkit})[kind];
 const browser=await engine.launch({headless:true,...(kind==='chromium'?{args:['--no-sandbox']}:{})});
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(17000);
 fs.mkdirSync('route-six-step-refined-evidence',{recursive:true});
 const shot=async tag=>page.screenshot({path:'route-six-step-refined-evidence/'+kind+'-'+width+'-'+tag+'.png'});
 const state=()=>page.evaluate(()=>window.__fpSixStepRoute?.state);
 const action=n=>page.locator('#fpRouteFlowSheet [data-action="'+n+'"]').click();
 try{
  await page.goto(base+'icon.svg',{waitUntil:'domcontentloaded'});
  await page.evaluate(async records=>{
   await new Promise((resolve,reject)=>{
    const req=indexedDB.open('atlas-v4-review-20261116-private-travel-footprints-v1',1);
    req.onupgradeneeded=()=>{const db=req.result;
      if(!db.objectStoreNames.contains('places'))db.createObjectStore('places',{keyPath:'id'});
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
    };
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>{const db=req.result,t=db.transaction('places','readwrite');
      for(const p of records)t.objectStore('places').put(p);
      t.oncomplete=()=>{db.close();resolve()};
      t.onerror=()=>reject(t.error);
    };
   })
  },fixture);
  console.log('OPEN HOME');
  await page.goto(base+'index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('#dockRoute').click();
  await page.waitForURL(/\/journey\.html$/,{timeout:22000});
  await page.waitForFunction(()=>window.__fpSixStepRoute?.state?.step==='entry',null,{timeout:26000});
  assert.equal(await page.locator('#fpRouteFlowSheet').count(),1);
  const css=await page.evaluate(()=>{
   const c=getComputedStyle(document.body);
   return ['--rs-paper','--rs-sage','--rs-green','--rs-gold'].map(x=>c.getPropertyValue(x).trim());
  });
  assert.deepEqual(css,['#fffefa','#edf1e9','#304b3b','#b59a62']);
  assert.equal(await page.locator('body.fp-step-route #pinLayer').evaluate(n=>getComputedStyle(n).display),'none');
  assert.equal(await page.locator('#fpRoutePointCard').count(),0);
  await shot('01-entry');
  // The map tap opens the single approved drawer, never a second floating card.
  await page.evaluate(()=>window.__fpSixStepRoute.openPoint('rv-a'));
  assert.equal(await page.locator('#fpRouteStepTitle').textContent(),'地点详情');
  assert.equal(await page.locator('#fpRoutePointCard').count(),0);
  assert.equal(await page.locator('#fpRouteFlowSheet').count(),1);
  await action('closepoint');
  await action('start');
  assert.equal((await state()).step,'pick');
  await shot('02-pick');
  await page.locator('#fpRoutePlaceSearch').fill('沿海 B');
  assert.equal(await page.locator('#fpRoutePlaceRows .fp-route-place-row').count(),1);
  await page.locator('#fpRoutePlaceSearch').fill('');
  for(const id of ['rv-a','rv-c','rv-b','rv-d']){
   await page.locator('[data-action="toggle"][data-id="'+id+'"]').click();
  }
  assert.equal((await state()).order.length,4);
  assert.equal(await page.locator('#fpRouteSheetContent .fp-route-place-row img').count(),0);
  await action('nextpick');
  assert.equal((await state()).step,'order');
  await page.waitForTimeout(650);
  const half=await page.locator('#fpRouteFlowSheet').evaluate(n=>({y:n.getBoundingClientRect().top,h:n.offsetHeight}));
  assert.ok(half.y>=180,'Half-height sheet must preserve map: '+JSON.stringify(half));
  await shot('03-order');
  await page.locator('[data-action="day"][data-id="rv-c"]').click();
  assert.equal((await state()).days['rv-c'],2);
  await action('undo');
  assert.equal((await state()).days['rv-c'],1);
  // Peek must always show primary button and leave the map visible.
  await page.evaluate(()=>window.__fpSixStepRoute.snap('peek'));
  await page.waitForTimeout(650);
  const button=await page.locator('#fpRouteSheetFoot .fp-route-main-btn').evaluate(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,viewport:innerHeight}});
  assert.ok(button.top>0&&button.bottom<=button.viewport,'Primary CTA must remain onscreen: '+JSON.stringify(button));
  await page.evaluate(()=>window.__fpSixStepRoute.snap('half'));
  await page.waitForTimeout(450);
  await action('nextorder');
  assert.equal((await state()).step,'settings');
  await shot('04-settings');
  assert.equal(await page.locator('#fpRouteSheetContent input[type="date"]').count(),0,'Safari modal date picker replaced by inline card calendar');
  await page.locator('[data-action="calendar"][data-field="start"]').click();
  assert.equal(await page.locator('#fpRouteSheetContent .fp-route-calendar').count(),1);
  const selected=await page.locator('#fpRouteSheetContent .fp-route-calendar-grid button[data-selected="true"]').count();
  assert.equal(selected,1);
  await page.locator('[data-action="calendar"][data-field="start"]').click();
  await page.locator('[data-mode="bike"]').click();
  assert.equal((await state()).mode,'bike');
  assert.ok((await page.locator('#fpRouteSheetContent .fp-route-day-warning').textContent()).includes('暂无安排'));
  await page.locator('[data-action="spread"]').click();
  assert.ok(new Set(Object.values((await state()).days)).size>1);
  await action('undo');
  assert.ok(Object.values((await state()).days).every(x=>x===1));
  await action('nextsettings');
  assert.equal((await state()).step,'recommend');
  await shot('05-recommend');
  const adopt=page.locator('#fpRouteSheetContent [data-action="adopt"]');
  if(await adopt.count())await adopt.click();
  await action('save');
  await page.waitForFunction(()=>window.__fpSixStepRoute?.state?.step==='done'&&window.__fpSixStepRoute?.state?.savedId,null,{timeout:25000});
  const done=await state();
  await shot('06-done');
  const record=await page.evaluate(async()=>{
   const id=window.__fpSixStepRoute.state.savedId;
   return (await FootprintMediaCore.createRepository(indexedDB).listRoutes()).find(x=>x.id===id)
  });
  assert.equal(record.stops.length,4);
  assert.equal(record.transportMode,'bike');
  assert.deepEqual(record.stops.map(s=>s.placeId),done.order);
  assert.ok(!record.title?.includes('演示'));
  await action('view');
  assert.equal((await state()).step,'preview');
  assert.ok(page.url().endsWith('/journey.html'),'Saved preview must stay in one map');
  await shot('07-view-same-map');
  const savedUrl=base+'route-view.html?saved='+encodeURIComponent(record.id);
  await page.goto(savedUrl,{waitUntil:'domcontentloaded',timeout:60000}).catch(()=>{});
  await page.waitForURL(/journey\.html\?saved=.*view=1/,{timeout:22000});
  await page.waitForFunction(()=>window.__fpSixStepRoute?.state?.step==='preview',null,{timeout:26000});
  assert.deepEqual((await state()).order,done.order);
  const note=await page.evaluate(async()=>new Promise((resolve,reject)=>{
    const r=indexedDB.open('private-travel-footprints-v1',1);r.onerror=()=>reject(r.error);
    r.onsuccess=()=>{const db=r.result,q=db.transaction('places','readonly').objectStore('places').get('rv-a');
      q.onsuccess=()=>{resolve(q.result?.note);db.close()};q.onerror=()=>reject(q.error)
    };
  }));
  assert.equal(note,'A 的 Brief 不可修改');
  const bad=errors.filter(x=>/ReferenceError|TypeError|SyntaxError/.test(x));
  assert.deepEqual(bad,[]);
  console.log('PASS',kind,width,'single card, compact stars, map room, spring, inline calendar, per-day, undo, persist, one-map saved preview');
 }catch(e){
  await shot('failure').catch(()=>{});
  console.log('JS ERRORS:',errors.join('\n'));
  throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
