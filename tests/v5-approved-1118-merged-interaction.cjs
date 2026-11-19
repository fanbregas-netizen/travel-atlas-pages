'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const {chromium}=require('playwright-core');
const exe=['google-chrome','google-chrome-stable','chromium'].map(n=>{try{return cp.execFileSync('which',[n],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!exe)throw Error('Chromium executable not found');
const root='https://fanbregas-netizen.github.io/travel-atlas-pages/v5-pr53-one-map-20261119/';
(async()=>{
 const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const folder='v5-merged-1118-flow-evidence';fs.mkdirSync(folder,{recursive:true});
 try{
 for(const width of [375,390]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const files=await Promise.all(['QA_BUILD.json','src/route/route-single-map-v1.js','src/visual/v5-single-map-route.css'].map(p=>page.request.get(root+p)));
  for(const res of files)assert.equal(res.status(),200,'live candidate asset');
  const [manifest,route,css]=await Promise.all(files.map((r,i)=>i===0?r.json():r.text()));
  assert.equal(manifest.source_commit,'96628ca11d6d7623f2dbf366a07b73dded4156a1','candidate build source');
  await page.setContent('<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>.map-controls{position:fixed;right:12px;bottom:124px;display:flex;flex-direction:column}.map-controls button{width:48px;height:48px}</style></head><body style="margin:0;background:#7a9488"><div id="atlasBookmarkOverlay"></div><div id="atlasVectorMap"></div><div class="map-controls"><button>⌖</button><button>+</button><button>-</button></div></body></html>');
  await page.addStyleTag({content:css});
  await page.evaluate(()=>{
   const listeners={};const routes=[];
   const places=[
    {id:'a',title:'长寿路',lat:31.24,lng:121.45,starred:true},
    {id:'b',title:'静安公园',lat:31.23,lng:121.46,starred:true},
    {id:'c',title:'苏州河',lat:31.22,lng:121.47,starred:true}
   ];
   window.__qaStore={routes,places};
   const map={
    on(event,a,b){(listeners[event]??=[]).push(typeof b==='function'?b:a)},
    off(){},getZoom(){return 13},getStyle(){return {layers:[]}},isStyleLoaded(){return false},
    easeTo(){},fitBounds(){},getLayer(){return null},getSource(){return null},removeLayer(){},removeSource(){}
   };
   window.__qaMap=map;
   window.__qaMapFire=(event,value)=>{for(const fn of listeners[event]||[])fn(value)};
   window.__atlasPOIBridge={vector:()=>map};
   window.FootprintMediaCore={createRepository:()=>({
    list:async()=>places.map(p=>({...p})),listRoutes:async()=>routes.map(r=>structuredClone(r)),
    saveRoute:async(r,opts)=>{const ix=routes.findIndex(x=>x.id===r.id);if(ix<0)routes.push(structuredClone(r));else routes[ix]=structuredClone(r);for(const p of opts?.places||[])places.push({...p})}
   })};
  });
  await page.addScriptTag({content:route});
  await page.evaluate(()=>window.FootprintUnifiedRoute.open());await page.waitForFunction(()=>window.FootprintUnifiedRoute?.state.step==='saved');
  await page.locator('[data-command="new"]').click();
  assert.equal(await page.evaluate(()=>window.FootprintUnifiedRoute.state.step),'pick');
  assert.ok(await page.getByRole('button',{name:'收藏列表'}).count());
  assert.ok(await page.getByRole('button',{name:'地图选点'}).count());
  await page.getByRole('button',{name:'地图选点'}).click();
  assert.ok((await page.locator('.fp-route-body').innerText()).includes('点击地图'));
  await page.getByRole('button',{name:'收藏列表'}).click();
  await page.locator('[data-command="toggle"]').nth(0).click();
  await page.locator('[data-command="undo"]').click();
  assert.equal((await page.evaluate(()=>window.FootprintUnifiedRoute.state.order)).length,0);
  await page.locator('[data-command="toggle"]').nth(0).click();
  await page.locator('[data-command="toggle"]').nth(1).click();
  await page.locator('[data-command="settings"]').click();
  assert.equal(await page.evaluate(()=>window.FootprintUnifiedRoute.state.step),'settings');
  await page.locator('#fpUnifiedTitle').fill('2026 城市散步');
  await page.locator('[data-command="endpoint"][data-value="origin"]').click();
  await page.locator('[data-command="endpoint-choice"][data-value="map"]').click();
  assert.ok((await page.locator('.fp-route-heading h2').innerText()).includes('地图选点'));
  await page.evaluate(()=>window.__qaMapFire('click',{lngLat:{lng:121.44,lat:31.245},originalEvent:{target:document.getElementById('atlasVectorMap')}}));
  await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.step==='settings');
  await page.locator('[data-command="endpoint"][data-value="dest"]').click();
  await page.locator('[data-command="endpoint-choice"][data-value="loop"]').click();
  assert.ok((await page.locator('.fp-route-body').innerText()).includes('返回起点'));
  await page.locator('[data-command="main-travel"][data-value="walk"]').click();
  await page.screenshot({path:folder+'/'+width+'-step2.png'});
  await page.locator('[data-command="order"]').click();
  assert.equal(await page.evaluate(()=>window.FootprintUnifiedRoute.state.step),'order');
  assert.equal(await page.locator('[data-grab]').count(),2);
  await page.locator('[data-command="day"]').nth(1).click();
  const legs=page.locator('[data-command="leg"]');assert.ok(await legs.count()>=2);
  await legs.first().click();
  await page.locator('[data-command="segment-choice"][data-value="bike"]').click();
  await page.screenshot({path:folder+'/'+width+'-step3.png'});
  await page.locator('[data-command="confirm"]').click();
  assert.ok((await page.locator('.fp-route-dialog-summary').innerText()).includes('2026 城市散步'));
  await page.locator('[data-command="confirm-save"]').click();
  await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.step==='view');
  const saved=await page.evaluate(()=>window.__qaStore.routes[0]);
  assert.equal(saved.title,'2026 城市散步');
  assert.equal(saved.routeOrigin.type,'point');
  assert.equal(saved.routeDestination.type,'loop');
  assert.equal(saved.transportMode,'walk');
  assert.equal(saved.stops.length,2);
  assert.ok(Object.values(saved.legModes).includes('bike'));
  assert.ok(await page.locator('[data-command="dayview"]').count()>=2);
  await page.screenshot({path:folder+'/'+width+'-saved-preview.png'});
  await page.evaluate(()=>window.FootprintUnifiedRoute.close());
  await page.waitForTimeout(500);
  await page.evaluate(()=>window.FootprintUnifiedRoute.open());
  await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.step==='saved');
  assert.ok((await page.locator('.fp-route-body').innerText()).includes('2026 城市散步'));
  await page.locator('[data-command="open-saved"]').first().click();
  await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.step==='view');
  assert.ok((await page.locator('.fp-route-body').innerText()).includes('返回起点'));
  assert.deepEqual(errors,[],'uncaught exceptions');
  console.log('PASS merged 2026-11-18 approved 3-step route',width,{savedId:saved.id,origin:saved.routeOrigin.type,dest:saved.routeDestination.type,mode:saved.transportMode,legs:saved.legModes});
  await context.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
