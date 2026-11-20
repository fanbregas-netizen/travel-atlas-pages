/* V5 RC1 third-round pre-release QA. Real OSRM network and product media UI.
 * ALL browser state is disposable; does NOT alter frozen RC1, production, or user data.
 * Public backend accuracy and physical iPhone Safari MUST be assessed separately.
 */
'use strict';
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const ROOT=process.env.RC_URL||'https://fanbregas-netizen.github.io/travel-atlas-pages/v5-route-touch-elastic-20261120/';
const OUT='qa/v5-rc1/evidence/real-env';fs.mkdirSync(OUT,{recursive:true});
const list=[],note=(engine,caseName,status,detail='')=>{
 const p={engine,case:caseName,status,detail:String(detail).slice(0,1050)};
 list.push(p);console.log('['+engine+'] '+status+' '+caseName+(detail?' — '+p.detail.slice(0,210):''));
};
async function check(e,n,fn,failed='FAIL'){
 try{const v=await fn();note(e,n,'PASS',v||'');return true}
 catch(err){note(e,n,failed,err.message||String(err));return false}
}
const places=[
{id:'qa-env-a',title:'虚构地点甲',lat:31.2244,lng:121.4679,starred:true,stage:'visited',photos:[],videos:[],note:'环境测试记录'},
{id:'qa-env-b',title:'虚构地点乙',lat:31.2338,lng:121.4845,starred:true,stage:'plan',photos:[],videos:[],note:'环境测试记录'}
];
const routes=[{id:'qa-env-r',title:'弱网测试路线',startDate:'2026-11-21',endDate:'2026-11-22',transportMode:'car',stops:[{placeId:'qa-env-a',day:1},{placeId:'qa-env-b',day:2}],updatedAt:'2026-11-20T09:00:00Z'}];
const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/B5kAAAAASUVORK5CYII=';
function cutoffPromise(promise,millis){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout after '+millis+'ms')),millis))])}
async function testRealBackend(){
 const samples=[
  ['car-Berlin','https://routing.openstreetmap.de/routed-car/route/v1/driving/13.38886,52.51704;13.39763,52.529407?overview=full&geometries=geojson&steps=false'],
  ['walk-Berlin','https://routing.openstreetmap.de/routed-foot/route/v1/driving/13.38886,52.51704;13.39763,52.529407?overview=full&geometries=geojson&steps=false'],
  ['bike-Berlin','https://routing.openstreetmap.de/routed-bike/route/v1/driving/13.38886,52.51704;13.39763,52.529407?overview=full&geometries=geojson&steps=false'],
  ['car-Shanghai','https://routing.openstreetmap.de/routed-car/route/v1/driving/121.4679,31.2244;121.4845,31.2338?overview=full&geometries=geojson&steps=false']
 ];
 for(const [name,url] of samples){
  const started=Date.now();
  await check('real-OSRM',name,async()=>{
   const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
   const body=await r.text();
   if(r.status!==200)throw Error('HTTP '+r.status+' '+body.slice(0,100));
   const doc=JSON.parse(body),road=doc.routes?.[0],coords=road?.geometry?.coordinates;
   if(doc.code!=='Ok'||!Array.isArray(coords)||coords.length<2||!Number.isFinite(road.distance)||!Number.isFinite(road.duration))
    throw Error('Invalid or absent route geometry: '+JSON.stringify(doc).slice(0,120));
   const bounds=coords.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]));
   assert(bounds);
   return JSON.stringify({http:r.status,points:coords.length,km:+(road.distance/1000).toFixed(2),minutes:+(road.duration/60).toFixed(1),elapsedMs:Date.now()-started,cors:r.headers.get('access-control-allow-origin')||'not advertised'});
  },'BLOCKER');
  await new Promise(resolve=>setTimeout(resolve,1550)); // Observe public endpoint rate limits.
 }
}
async function fill(page,videoBytes,videoMime){
 return page.evaluate(async({places,routes,photo,videoB64,videoMime})=>{
  const lib=window.FootprintMediaCore,repo=lib.createRepository(indexedDB);
  await repo.list();
  await new Promise((resolve,reject)=>{
   const request=indexedDB.open(lib.DB_NAME,1);
   request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{
    const db=request.result,tx=db.transaction('places','readwrite');
    places.forEach(x=>tx.objectStore('places').add(x));
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onabort=()=>{db.close();reject(tx.error||Error('seed abort'))};
   };
  });
  await repo.saveRoute(routes[0]);
  await repo.addMedia('qa-env-a',[{kind:'photo',src:photo,name:'qa-tiny.png'}]);
  if(videoB64){
   const raw=atob(videoB64),bin=new Uint8Array(raw.length);
   for(let i=0;i<raw.length;i++)bin[i]=raw.charCodeAt(i);
   await repo.addMedia('qa-env-a',[{kind:'video',name:videoMime==='video/webm'?'qa-only-vp8.webm':'qa-only-h264.mp4',type:videoMime,bytes:bin.buffer}]);
  }
  const p=(await repo.list()).find(x=>x.id==='qa-env-a');
  return {count:(await repo.list()).length,routes:(await repo.listRoutes()).length,photos:p.photos?.length||0,videos:p.videos?.length||0};
 },{places,routes,photo,videoB64:videoBytes?.toString('base64')||null,videoMime});
}
async function auditData(page){
 return page.evaluate(async()=>{
  const repo=window.FootprintMediaCore.createRepository(indexedDB);
  const [p,r]=await Promise.all([repo.list(),repo.listRoutes()]);
  const a=p.find(x=>x.id==='qa-env-a');
  return {places:p.length,routes:r.length,photo:a?.photos?.length||0,video:a?.videos?.length||0,note:a?.note||''};
 });
}
async function browserQA(name,browserType,videoBytes,videoMime){
 const launchArgs=name==='chromium'?['--no-sandbox','--autoplay-policy=no-user-gesture-required']:[];
 const browser=await browserType.launch({headless:true,args:launchArgs});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'zh-CN'});
 const page=await context.newPage();
 const err=[];page.on('pageerror',e=>err.push(e.message));
 const snapshot=async n=>{try{await page.screenshot({path:OUT+'/'+name+'-'+n+'.png',timeout:13000})}catch(e){note(name,'screenshot '+n,'BLOCKED',e.message)}};
 try{
  const ok=await check(name,'isolated RC1 app shell / browser media repository',async()=>{
   const response=await page.goto(ROOT,{waitUntil:'domcontentloaded',timeout:48000});
   assert.equal(response?.status(),200);
   await page.waitForFunction(()=>window.FootprintMediaCore&&window.FootprintUnifiedRoute&&window.__atlasPOIBridge?.selectSaved,{timeout:24000});
   return 'fresh browser DB, no user files';
  });
  if(!ok)return;
  await check(name,'seed photo and actual video bytes (isolated)',async()=>{
   const x=await fill(page,videoBytes,videoMime);
   assert.equal(x.count,2);assert.equal(x.routes,1);assert.equal(x.photos,1);
   if(videoBytes)assert.equal(x.videos,1);
   return JSON.stringify(x);
  });
  await check(name,'return-to-home data survives forced offline without writing',async()=>{
   await context.setOffline(true);
   const b=await auditData(page);
   assert.equal(b.places,2);assert.equal(b.routes,1);assert.equal(b.photo,1);
   // State read only; do not mutate the offline browser's records.
   assert(await page.locator('#appDock #dockRoute').count());
   await context.setOffline(false);
   return JSON.stringify(b);
  });
  await check(name,'malformed ZIP rejected atomically, source DB unchanged',async()=>{
   const baseline=await auditData(page);
   const msg=await page.evaluate(async()=>{
    const repo=window.FootprintMediaCore.createRepository(indexedDB);
    try{await repo.restore(new Blob(['not a ZIP']),{conflict:'merge'});return {accepted:true}}
    catch(e){return {accepted:false,error:e.code||e.message}}
   });
   assert(!msg.accepted,'malformed ZIP silently accepted');
   const after=await auditData(page);
   assert.deepEqual(after,baseline,'invalid backup unexpectedly mutated source');
   return msg.error;
  });
  await check(name,'reload online after offline: preserved fixture media and route',async()=>{
   await page.reload({waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>window.FootprintMediaCore?.createRepository&&window.__atlasPOIBridge?.selectSaved,{timeout:18000});
   const s=await auditData(page);
   assert.equal(s.places,2);assert.equal(s.routes,1);assert.equal(s.photo,1);
   if(videoBytes)assert.equal(s.video,1);
   return JSON.stringify(s);
  });
  const galleryOpen=await check(name,'V5 real place card opens photo and navigates to video',async()=>{
   await page.waitForFunction(()=>window.__footprintHome?.openSaved,{timeout:11000});
   assert(await page.evaluate(()=>window.__footprintHome.openSaved('qa-env-a'))!==false);
   const photoButton=page.locator('#fpPlaceCard .fp-media-mosaic [data-fp-media-index="0"]');
   await photoButton.waitFor({state:'attached',timeout:12000});
   await photoButton.evaluate(el=>el.click());
   await page.locator('#fpMediaViewer[open]').waitFor({state:'visible',timeout:8000});
   const before=await page.locator('#fpMediaViewer').getAttribute('data-item-index');
   assert.equal(before,'0','expected first gallery photo index');
   if(videoBytes){
    await page.locator('#fpMediaViewer').focus();
    await page.locator('#fpMediaViewer').press('ArrowRight');
    await page.waitForFunction(()=>document.querySelector('#fpMediaViewer')?.dataset.itemIndex==='1',{timeout:6500});
   }
   return JSON.stringify({first:before,next:await page.locator('#fpMediaViewer').getAttribute('data-item-index'),hasVideoFixture:!!videoBytes});
  });
  await snapshot('01-gallery-video');
  if(videoBytes&&galleryOpen)await check(name,'V5 video metadata and decoding in actual fullscreen viewer',async()=>{
   await page.waitForFunction(()=>document.querySelector('#fpMediaViewer .fp-gallery-cell video')?.src,{timeout:8000});
   const info=await page.locator('#fpMediaViewer .fp-gallery-cell video').first().evaluate(async (v,mime)=>{
    let ev='';await new Promise(resolve=>{
     if(v.readyState>=1){resolve();return}
     const t=setTimeout(()=>{ev='timeout';resolve()},6000);
     v.addEventListener('loadedmetadata',()=>{clearTimeout(t);resolve()},{once:true});
     v.addEventListener('error',()=>{clearTimeout(t);ev='error';resolve()},{once:true});
    });
    return {event:ev,ready:v.readyState,duration:v.duration,src:v.currentSrc?.slice(0,30)||'',error:v.error?.message,canPlay:v.canPlayType(mime)};
   },videoMime);
   if(info.ready<1)throw Error(videoMime+' cannot decode: '+JSON.stringify(info));
   assert(Number.isFinite(info.duration)&&info.duration>0);
   return JSON.stringify(info);
  },'BLOCKER');
  if(galleryOpen)await check(name,'V5 fullscreen gallery closes and releases the video decoder',async()=>{
   await page.locator('#fpMediaViewer .fp-viewer-close').evaluate(el=>el.click());
   await page.waitForFunction(()=>!document.querySelector('#fpMediaViewer'),null,{timeout:7000});
   assert.equal(await page.locator('#fpMediaViewer video[src]').count(),0);
   return 'V5 gallery closed and its transient video DOM disposed';
  });
  await snapshot('02-gallery-closed');
  // Test route provider outage separately. This app has a 15-min error cache,
  // so a recovery requires a new context; avoid asserting automatic retry.
  await page.route('**/routed-car/route/v1/driving/**',r=>r.abort('failed'));
  await check(name,'failed road provider reports error and never fabricates straight road',async()=>{
   const opened=await page.evaluate(async()=>window.FootprintUnifiedRoute.open());
   assert.notEqual(opened,false);
   await page.waitForFunction(()=>window.FootprintUnifiedRoute?.state?.step==='saved',{timeout:7000});
   await page.waitForFunction(()=>{
    const t=document.querySelector('#fpUnifiedRoute [data-route-road-status]')?.textContent||'';
    return t.includes('不可用')||t.includes('暂无')||t.includes('无法');
   },{timeout:21000});
   const s=await page.evaluate(()=>{
    const src=window.FootprintUnifiedRoute?.map?.getSource?.('fp-single-route');
    let raw=src?._data;if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch(e){}}
    return {roads:(raw?.features||[]).filter(f=>f.properties.kind==='road').length,
      lines:(raw?.features||[]).filter(f=>f.properties.kind==='sequence').length,
      label:document.querySelector('#fpUnifiedRoute [data-route-road-status]')?.textContent||''};
   });
   assert.equal(s.roads,0);assert.equal(s.lines,0);
   return JSON.stringify(s);
  });
  await check(name,'route close during failure leaves UI interactive',async()=>{
   await page.evaluate(()=>window.FootprintUnifiedRoute.close());
   await page.waitForTimeout(650);
   const s=await page.evaluate(()=>window.FootprintUnifiedRoute.state);
   assert.equal(s.open,false);assert(await page.locator('#appDock #dockRoute').count());
   return 'route closed, Dock available';
  });
  await snapshot('03-offline-route');
  if(err.length)note(name,'uncaught JS exceptions','FAIL',err.join(' | '));
  else note(name,'uncaught JS exceptions','PASS','none');
  note(name,'physical iPhone real gesture fluidity','NOT_TESTED','Requires real Safari device, simulated WebKit is not a physical iPhone.');
 }catch(e){note(name,'unexpected test exception','FAIL',e.stack||String(e))}
 finally{await context.close();await browser.close()}
}
(async()=>{
 await testRealBackend();
 const mp4='qa/v5-rc1/generated-video.mp4',webm='qa/v5-rc1/generated-video.webm';
 const mp4Bytes=fs.existsSync(mp4)?fs.readFileSync(mp4):null;
 const webmBytes=fs.existsSync(webm)?fs.readFileSync(webm):null;
 if(!mp4Bytes||!webmBytes)note('media','generated fixtures','BLOCKED','missing mp4 or WebM, decode verification incomplete');
 else note('media','generated fixtures','PASS','H264 MP4 '+mp4Bytes.length+' bytes + VP8 WebM '+webmBytes.length+' bytes');
 // Playwright's open-source Chromium may omit H264 decoding. The PRODUCT
 // supports both MP4 and WebM; verify a supported codec in each browser.
 await browserQA('chromium',chromium,webmBytes,'video/webm');
 await browserQA('webkit',webkit,mp4Bytes,'video/mp4');
 const totals={};for(const x of list)totals[x.status]=(totals[x.status]||0)+1;
 fs.writeFileSync(OUT+'/summary.json',JSON.stringify({
  version:'V5 RC1 frozen 4de6a6bb04c7dfdffa6ae6f6fe3f799375b7d634',
  realProvider:'FOSSGIS public OSRM best-effort, direct HTTP checks not mocked',
  video:'H264 generated fixture; WebKit and Chromium are not physical Safari',
  network:'offline browser storage and forced failed route provider',
  noProductionChanges:true,totals,checks:list
 },null,2));
 console.log('V5 RC1 REAL ENV TOTAL '+JSON.stringify(totals));
 // In CI, real external provider unavailability is a documented release
 // BLOCKER but must not be misreported as a product-code test failure.
 if(totals.FAIL)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2});