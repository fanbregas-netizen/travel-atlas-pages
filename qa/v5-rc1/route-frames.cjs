/* Footprint V5 RC1 -- WebKit/Chromium frame-by-frame route switch forensic QA.
   Capture the RENDERED source alongside loaded GeoJSON; simulated street geometry,
   disposable IndexedDB, no source code or production change. */
'use strict';
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const ROOT=process.env.RC_URL||'https://fanbregas-netizen.github.io/travel-atlas-pages/v5-route-touch-elastic-20261120/';
const candidate=process.env.RC2_CANDIDATE||'';
const OUT=candidate?'qa/v5-rc1/evidence/route-frame-rc2':'qa/v5-rc1/evidence/route-frame';
fs.mkdirSync(OUT,{recursive:true});
const results=[];
function report(engine,scenario,status,data){
 const value={engine,scenario,status,detail:data};
 results.push(value);
 console.log('['+engine+'] '+status+' '+scenario+' '+JSON.stringify(data).slice(0,700));
}
const P=[
{id:'frame-a',title:'逐帧A',lat:31.2244,lng:121.4679,starred:true,stage:'plan',photos:[],videos:[]},
{id:'frame-b',title:'逐帧B',lat:31.2338,lng:121.4845,starred:true,stage:'plan',photos:[],videos:[]},
{id:'frame-c',title:'逐帧C',lat:31.2156,lng:121.5020,starred:true,stage:'plan',photos:[],videos:[]}
];
const R=[
{id:'frame-r1',title:'逐帧路线甲',startDate:'2026-11-21',endDate:'2026-11-23',transportMode:'car',stops:[{placeId:'frame-a',day:1},{placeId:'frame-b',day:2},{placeId:'frame-c',day:3}],updatedAt:'2026-11-20T09:45:00Z'},
{id:'frame-r2',title:'逐帧路线乙',startDate:'2026-11-28',endDate:'2026-11-29',transportMode:'car',stops:[{placeId:'frame-c',day:1},{placeId:'frame-a',day:2}],updatedAt:'2026-11-19T09:45:00Z'}
];
async function seed(page){
 return page.evaluate(async({places,routes})=>{
  const lib=window.FootprintMediaCore;
  if(!lib?.createRepository)throw Error('repo unavailable');
  const repo=lib.createRepository(indexedDB);
  await repo.list();
  await new Promise((resolve,reject)=>{
   const r=indexedDB.open(lib.DB_NAME,1);
   r.onerror=()=>reject(r.error);
   r.onsuccess=()=>{
    const db=r.result,tx=db.transaction('places','readwrite');
    places.forEach(p=>tx.objectStore('places').add(p));
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onabort=()=>{db.close();reject(tx.error||Error('abort'))};
   };
  });
  for(const r of routes)await repo.saveRoute(r);
  return {places:(await repo.list()).length,routes:(await repo.listRoutes()).length};
 },{places:P,routes:R});
}
function mock(req){
 const x=new URL(req.request().url()),raw=decodeURIComponent(x.pathname.split('/').pop());
 const [a,b]=raw.split(';').map(c=>c.split(',').map(Number));
 const dx=b[0]-a[0],dy=b[1]-a[1];
 const coords=[a,[a[0]+dx*.23-.0015,a[1]+dy*.22+.0011],[a[0]+dx*.47+.001,a[1]+dy*.51-.001],[a[0]+dx*.73-.0008,a[1]+dy*.74+.001],b];
 return req.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
  body:JSON.stringify({code:'Ok',routes:[{distance:1800,duration:480,geometry:{type:'LineString',coordinates:coords}}]})});
}
const selectors={
 list:'#fpUnifiedRoute [data-command="saved"]',
 open:'#fpUnifiedRoute [data-command="open-saved"]',
 exit:'#fpUnifiedRoute [data-command="exit"]',
 grip:'#fpUnifiedRoute .fp-route-grip'
};
async function waitState(page,id,legs){
 await page.waitForFunction(({id,legs})=>{
  const r=window.FootprintUnifiedRoute;
  if(!r?.state.open||r.state.routeId!==id)return false;
  const s=r.map?.getSource?.('fp-single-route');
  let d=s?._data;if(typeof d==='string'){try{d=JSON.parse(d)}catch(e){}}
  const f=(d?.features||[]).filter(x=>x.properties?.kind==='road');
  return f.length===legs && f.every(x=>id==='frame-r2'
   ?(x.properties.from==='frame-c'&&x.properties.to==='frame-a')
   :(x.properties.from==='frame-a'&&x.properties.to==='frame-b')||(x.properties.from==='frame-b'&&x.properties.to==='frame-c'));
 },{id,legs},{timeout:22000});
}
async function installFrameRecorder(page){
 return page.evaluate(()=>{
  if(window.__rc1FrameTrace?.cancel)window.__rc1FrameTrace.cancel();
  let keep=true,recording=false,frame=0,rows=[];
  const read=()=>{
   const route=window.FootprintUnifiedRoute,map=route?.map;
   if(!map)return null;
   const source=map.getSource?.('fp-single-route');
   let raw=source?._data;
   if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch(e){}}
   const from=(x)=>String(x?.properties?.from||'')+'>'+String(x?.properties?.to||'');
   const sourceRoads=[...new Set((raw?.features||[]).filter(x=>x.properties?.kind==='road').map(from))];
   let rendered=[],visibleError='';
   try{
    if(map.getLayer?.('fp-single-road')){
     const el=map.getCanvas(),w=el.clientWidth||390,h=el.clientHeight||844;
     const features=map.queryRenderedFeatures([[0,0],[w,h]],{layers:['fp-single-road']});
     rendered=[...new Set(features.map(from))];
    }
   }catch(e){visibleError=String(e.message).slice(0,100)}
   return {ms:performance.now(),routeId:route.state.routeId,step:route.state.step,
     sourceRoads,rendered,visibleError,moving:!!map.isMoving?.(),zoom:Number(map.getZoom?.()||0).toFixed(2)};
  };
  const loop=()=>{
   if(!keep)return;
   if(recording){const p=read();if(p)rows.push(p);frame++;}
   requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__rc1FrameTrace={
   start:()=>{recording=true;rows=[];frame=0;},
   stop:()=>{recording=false;return rows;},
   cancel:()=>{keep=false;recording=false;},
   capture:read
  };
  return true;
 });
}
async function run(name,browserType){
 let browser;
 try{browser=await browserType.launch({headless:true,args:name==='chromium'?['--no-sandbox']:[]})}
 catch(e){report(name,'launch','BLOCKED',e.message);return}
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'zh-CN'});
 const page=await ctx.newPage(),errors=[];
 if(candidate){
  const patch=fs.readFileSync(candidate,'utf8');
  await page.route('**/src/route/route-single-map-v1.js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:patch}));
 }
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/routed-car/route/v1/driving/**',mock);
 const shot=async n=>{try{await page.screenshot({path:OUT+'/'+name+'-'+n+'.png',timeout:10000})}catch(e){report(name,'screenshot '+n,'BLOCKED',e.message)}};
 try{
  const response=await page.goto(ROOT,{waitUntil:'domcontentloaded',timeout:46000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.FootprintMediaCore?.createRepository&&window.FootprintUnifiedRoute,{timeout:21000});
  assert.deepEqual(await seed(page),{places:3,routes:2});
  assert.notEqual(await page.evaluate(()=>window.FootprintUnifiedRoute.open()),false);
  await page.waitForFunction(()=>window.FootprintUnifiedRoute?.state?.usableRoutes===2,{timeout:16000});
  await page.locator(selectors.open).first().click({force:true});
  await waitState(page,'frame-r1',2);
  await shot('01-first-route');
  report(name,'R1 saved itinerary opens fully','PASS','2 bent roads');
  let observed=[];
  for(let cycle=0;cycle<5;cycle++){
   // Route R1 is currently active. Return to list with source still showing R1,
   // then tap R2. Playback must not show R1 after R2 owns the state.
   await page.locator(selectors.list).first().click({force:true});
   await page.waitForFunction(()=>window.FootprintUnifiedRoute?.state?.step==='saved',{timeout:8000});
   await installFrameRecorder(page);
   await page.evaluate(()=>window.__rc1FrameTrace.start());
   await page.locator(selectors.open).nth(1).click({force:true});
   await page.waitForTimeout(1000);
   const rows=await page.evaluate(()=>window.__rc1FrameTrace.stop());
   await waitState(page,'frame-r2',1);
   const post=rows.filter(x=>x.routeId==='frame-r2');
   const oldFrom=x=>x==='frame-a>frame-b'||x==='frame-b>frame-c';
   const sourceOld=post.filter(x=>x.sourceRoads.some(oldFrom));
   const renderedOld=post.filter(x=>x.rendered.some(oldFrom));
   const firstPost=post[0]?.ms||0;
   const lastRenderOld=renderedOld.at(-1)?.ms||0;
   const uniqueRendered=[...new Set(post.flatMap(x=>x.rendered))];
   const result={cycle,frames:rows.length,postFrames:post.length,sourceOldFrames:sourceOld.length,
    oldRenderedFrames:renderedOld.length,oldRenderedDurationMs:lastRenderOld>firstPost?Math.round(lastRenderOld-firstPost):0,
    firstPost:post[0]||null,lastPost:post.at(-1)||null,uniqueRendered};
   observed.push(result);
   if(cycle===0){await shot('02-second-route-settled');fs.writeFileSync(OUT+'/'+name+'-switch-trace.json',JSON.stringify(rows,null,2));}
   const s=renderedOld.length?'OBSERVED':'PASS';
   report(name,'R1→R2 viewport frame audit '+(cycle+1),s,result);
   // Switch back to R1 for next cycle, with a stable source before retry.
   if(cycle<4){
    await page.locator(selectors.list).first().click({force:true});
    await page.locator(selectors.open).first().click({force:true});
    await waitState(page,'frame-r1',2);
   }
  }
  const summary={cycles:observed.length,renderedOldInCycles:observed.filter(x=>x.oldRenderedFrames>0).length,
   maxOldFrames:Math.max(...observed.map(x=>x.oldRenderedFrames)),maxOldMs:Math.max(...observed.map(x=>x.oldRenderedDurationMs))};
  report(name,'frame-level route-switch summary',summary.renderedOldInCycles?'OBSERVED':'PASS',summary);
  // Stress closing/reopening the exact route sheet; stop labels and old roads
  // must not survive. This is simulated, not actual rubber-band finger feel.
  for(let i=0;i<6;i++){
   await page.evaluate(()=>window.FootprintUnifiedRoute.close());
   await page.waitForFunction(()=>window.FootprintUnifiedRoute?.state?.open===false,{timeout:7000});
   await page.waitForTimeout(60);
   const leftover=await page.evaluate(()=>{
    const map=window.__atlasRV?.currentMap;
    return {routeLayer:!!map?.getLayer?.('fp-single-road'),
      routeSource:!!map?.getSource?.('fp-single-route'),labels:document.querySelectorAll('#atlasBookmarkOverlay .fp-route-stop-order').length};
   });
   assert(!leftover.routeLayer&&!leftover.routeSource&&!leftover.labels,'close residual: '+JSON.stringify(leftover));
   assert.notEqual(await page.evaluate(()=>window.FootprintUnifiedRoute.open()),false);
   await page.waitForFunction(()=>window.FootprintUnifiedRoute?.state?.open===true,{timeout:8000});
  }
  report(name,'six consecutive close/open operations','PASS','No zombie route layers, source or numbered markers');
  await shot('03-after-stress');
  if(errors.length)report(name,'uncaught application exceptions','FAIL',errors);
  else report(name,'uncaught application exceptions','PASS','none');
  report(name,'physical Safari swipe comfort','NOT_TESTED','Cannot infer rubber-band comfort from WebKit automation');
 }catch(err){report(name,'forensic script execution','FAIL',err.stack||err.message)}
 finally{await ctx.close();await browser.close()}
}
(async()=>{
 await run('webkit',webkit);await run('chromium',chromium);
 const total={};for(const r of results)total[r.status]=(total[r.status]||0)+1;
 fs.writeFileSync(OUT+'/frame-summary.json',JSON.stringify({rc1:'4de6a6bb04c7dfdffa6ae6f6fe3f799375b7d634',
   scenarios:'5 back-and-forth switches x WebKit + Chromium; 6 close/reopen x2',
   caveats:'MapLibre queryRenderedFeatures samples map screen content but are not physical iPhone pixels; road geometry mocked',results,total},null,2));
 console.log((candidate?'V5 RC2 CANDIDATE FRAMES ':'V5 RC1 FRAMES ')+JSON.stringify(total));
 if(total.FAIL||(candidate&&results.some(x=>x.scenario==='frame-level route-switch summary'&&x.status==='OBSERVED')))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2});