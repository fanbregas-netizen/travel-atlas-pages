/* RC1 fixtures: synthetic data in a disposable browser context.
   OSRM returns deterministic MOCK bends; never claim road accuracy. */
'use strict';
const {chromium,webkit}=require('playwright');
const fs=require('fs'),assert=require('node:assert/strict');
const ROOT=process.env.RC_URL||'https://fanbregas-netizen.github.io/travel-atlas-pages/v5-route-touch-elastic-20261120/';
const DIR='qa/v5-rc1/evidence/fixtures';fs.mkdirSync(DIR,{recursive:true});
const results=[];
function log(engine,label,status,detail=''){
 results.push({engine,label,status,detail:String(detail).slice(0,700)});
 console.log('['+engine+'] '+status+' '+label+(detail?' — '+String(detail).slice(0,200):''));
}
async function probe(engine,label,fn){
 try{const v=await fn();log(engine,label,'PASS',v||'');return true}
 catch(e){log(engine,label,'FAIL',e.message||e);return false}
}
const P=[
 {id:'qa-p1',title:'测试点一',lat:31.2244,lng:121.4679,starred:true,stage:'plan',photos:[],videos:[],note:'点一'},
 {id:'qa-p2',title:'测试点二',lat:31.2338,lng:121.4845,starred:true,stage:'plan',photos:[],videos:[],note:'点二'},
 {id:'qa-p3',title:'测试点三',lat:31.2156,lng:121.5020,starred:true,stage:'visited',photos:[],videos:[],note:'点三'}
];
const R=[
 {id:'qa-r1',title:'我的旅行路线',startDate:'2026-11-21',endDate:'2026-11-23',transportMode:'car',stops:[{placeId:'qa-p1',day:1},{placeId:'qa-p2',day:2},{placeId:'qa-p3',day:3}],updatedAt:'2026-11-20T09:45:00Z'},
 {id:'qa-r2',title:'我的旅行路线',startDate:'2026-11-28',endDate:'2026-11-29',transportMode:'car',stops:[{placeId:'qa-p3',day:1},{placeId:'qa-p1',day:2}],updatedAt:'2026-11-19T09:45:00Z'}
];
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/B5kAAAAASUVORK5CYII=';
function mockedRoute(route){
 const url=new URL(route.request().url()),raw=decodeURIComponent(url.pathname.split('/').pop());
 const [a,b]=raw.split(';').map(c=>c.split(',').map(Number));
 if(!a||!b||a.some(x=>!Number.isFinite(x))||b.some(x=>!Number.isFinite(x)))return route.abort();
 const dx=b[0]-a[0],dy=b[1]-a[1];
 const geometry=[a,[a[0]+dx*.24-.0015,a[1]+dy*.24+.0012],[a[0]+dx*.51+.0013,a[1]+dy*.48-.001],[a[0]+dx*.74-.0008,a[1]+dy*.76+.001],b];
 const distance=Math.round(Math.hypot(dx*100000,dy*100000)*1.3);
 return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({code:'Ok',routes:[{distance,duration:Math.max(240,distance/8),geometry:{type:'LineString',coordinates:geometry}}]})});
}
async function seed(page){
 return page.evaluate(async({places,routes,png})=>{
  const lib=window.FootprintMediaCore,repo=lib.createRepository(indexedDB);
  await repo.list();
  await new Promise((resolve,reject)=>{
   const r=indexedDB.open(lib.DB_NAME,1);
   r.onerror=()=>reject(r.error);
   r.onsuccess=()=>{
    const db=r.result,tx=db.transaction('places','readwrite');
    places.forEach(p=>tx.objectStore('places').add(p));
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onabort=()=>{db.close();reject(tx.error||Error('seed abort'))};
   };
  });
  for(const r of routes)await repo.saveRoute(r);
  await repo.saveBrief('qa-p1','RC1 简报测试，不是真实用户内容');
  await repo.addMedia('qa-p1',[{kind:'photo',name:'fixture.png',src:png}]);
  return {places:(await repo.list()).length,routes:(await repo.listRoutes()).length};
 },{places:P,routes:R,png:PNG});
}
async function snapshot(page){
 return page.evaluate(()=>{
  const m=window.FootprintUnifiedRoute?.map,s=m?.getSource?.('fp-single-route');
  let d=s?._data;if(typeof d==='string'){try{d=JSON.parse(d)}catch(e){}}
  const f=d?.features||[];
  return {road:f.filter(x=>x.properties?.kind==='road').length,
   sequence:f.filter(x=>x.properties?.kind==='sequence').length,
   dim:f.filter(x=>x.properties?.dim).length,
   selected:f.filter(x=>x.properties?.selected).length,
   features:f.filter(x=>x.properties?.kind==='road'),
   route:window.FootprintUnifiedRoute?.state};
 });
}
async function waitRoad(page,n){
 await page.waitForFunction(count=>{
  const map=window.FootprintUnifiedRoute?.map,src=map?.getSource?.('fp-single-route');
  let d=src?._data;if(typeof d==='string'){try{d=JSON.parse(d)}catch(e){}}
  return (d?.features||[]).filter(f=>f.properties?.kind==='road').length===count;
 },n,{timeout:23000});
 return snapshot(page);
}
async function run(engine,launcher){
 const browser=await launcher.launch({headless:true,args:engine==='chromium'?['--no-sandbox']:[]});
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'zh-CN'});
 const page=await ctx.newPage(),errs=[];let requests=0;
 page.on('pageerror',e=>errs.push(e.message));
 await page.route('**/routed-car/route/v1/driving/**',route=>{requests++;return mockedRoute(route)});
 const screenshot=async name=>{try{await page.screenshot({path:DIR+'/'+engine+'-'+name+'.png',timeout:10000})}catch(e){log(engine,'screenshot '+name,'BLOCKED',e.message)}};
 try{
  const ok=await probe(engine,'Initialize disposable QA profile',async()=>{
   const r=await page.goto(ROOT,{waitUntil:'domcontentloaded',timeout:45000});assert.equal(r.status(),200);
   await page.waitForFunction(()=>window.FootprintMediaCore&&window.FootprintUnifiedRoute,{timeout:20000});
   const s=await seed(page);assert.equal(s.places,3);assert.equal(s.routes,2);
   return JSON.stringify(s);
  });
  if(!ok)return;
  const opened=await probe(engine,'Open saved route list with 2 fixture routes',async()=>{
   assert.notEqual(await page.evaluate(()=>window.FootprintUnifiedRoute.open()),false);
   await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.usableRoutes===2,{timeout:10000});
   assert.equal(await page.locator('#fpUnifiedRoute [data-command="open-saved"]').count(),2);
   return JSON.stringify(await page.evaluate(()=>window.FootprintUnifiedRoute.state));
  });
  if(!opened)return;
  await screenshot('01-saved');
  await probe(engine,'BEFORE 全部: saved list has all 2 road segments',async()=>{
   const x=await waitRoad(page,2);assert.equal(x.sequence,0);assert(requests>=2);
   return '2 simulated OSRM geometry legs requested '+requests+' times';
  });
  await screenshot('02-first-roads');
  const viewed=await probe(engine,'Click saved itinerary; no road segment is lost',async()=>{
   await page.locator('#fpUnifiedRoute [data-command="open-saved"]').first().click({force:true});
   await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.step==='view');
   const x=await waitRoad(page,2);assert.equal(x.route.routeId,'qa-r1');
   return 'route qa-r1, '+x.road+' legs';
  });
  if(viewed){
   await screenshot('03-view');
   await probe(engine,'D1 fades some roads; 全部 immediately restores all roads',async()=>{
    await page.locator('#fpUnifiedRoute [data-command="dayview"][data-value="1"]').click({force:true});
    await page.waitForFunction(()=>{
      const src=window.FootprintUnifiedRoute?.map?.getSource?.('fp-single-route');
      return (src?._data?.features||[]).filter(f=>f.properties?.kind==='road').length===2 &&
       (src?._data?.features||[]).some(f=>f.properties?.dim);
    },{timeout:4500});
    const a=await snapshot(page);assert.equal(a.road,2,'D1 road count: '+JSON.stringify(a));assert(a.dim>0,'D1 missing dim: '+JSON.stringify(a));
    await page.locator('#fpUnifiedRoute [data-command="dayview"][data-value="0"]').click({force:true});
    await page.waitForFunction(()=>{
      const src=window.FootprintUnifiedRoute?.map?.getSource?.('fp-single-route');
      const f=(src?._data?.features||[]).filter(f=>f.properties?.kind==='road');
      return f.length===2&&f.every(x=>!x.properties?.dim);
    },{timeout:4500});
    const b=await snapshot(page);assert.equal(b.road,2,'全部 road count: '+JSON.stringify(b));assert.equal(b.dim,0);
    return 'D1 faded '+a.dim+', 全部 displays '+b.road;
   });
   await probe(engine,'User taps road segment: bubble and selected line',async()=>{
    await page.waitForTimeout(500);
    const pt=await page.evaluate(()=>{
     const m=window.FootprintUnifiedRoute.map,src=m.getSource('fp-single-route');
     const rect=m.getCanvas().getBoundingClientRect(),sheet=document.querySelector('#fpUnifiedRoute .fp-route-sheet').getBoundingClientRect();
     for(const f of src?._data?.features||[])if(f.properties?.kind==='road')
      for(const c of f.geometry.coordinates){const p=m.project(c);
       if(p.x>25&&p.x<rect.width-25&&p.y>150&&p.y<sheet.top-rect.top-35)return {x:p.x+rect.left,y:p.y+rect.top};
      }
     return null;
    });
    assert(pt,'no visible route touch point in map viewport');
    await page.mouse.click(pt.x,pt.y);
    await page.locator('.fp-route-segment-pill-button').waitFor({state:'visible',timeout:7500});
    await page.waitForFunction(()=>{
      const src=window.FootprintUnifiedRoute?.map?.getSource?.('fp-single-route');
      return (src?._data?.features||[]).filter(f=>f.properties?.selected).length===1;
    },{timeout:5500});
    const x=await snapshot(page);assert.equal(x.selected,1,'Tap had popup but no selected geometry: '+JSON.stringify(x));
    await page.locator('.fp-route-segment-pill-button').click({force:true});
    await page.locator('.fp-route-line-bubble').waitFor({state:'visible',timeout:4500});
    return 'one selected segment with expanded bubble';
   });
   await screenshot('04-bubble');
   await probe(engine,'Back to route list preserves geometry; reopening is stable',async()=>{
    await page.locator('#fpUnifiedRoute [data-command="saved"]').first().click({force:true});
    await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.step==='saved');
    assert.equal((await waitRoad(page,2)).road,2);
    await page.locator('#fpUnifiedRoute [data-command="open-saved"]').first().click({force:true});
    assert.equal((await waitRoad(page,2)).route.routeId,'qa-r1');
    return 'kept road cache across list/detail';
   });
   await probe(engine,'Switch to another saved route without stray old segment',async()=>{
    await page.locator('#fpUnifiedRoute [data-command="saved"]').first().click({force:true});
    await page.locator('#fpUnifiedRoute [data-command="open-saved"]').nth(1).click({force:true});
    const x=await waitRoad(page,1);assert.equal(x.route.routeId,'qa-r2');
    assert(x.features.every(f=>!['qa-p2'].includes(f.properties?.from)&&!['qa-p2'].includes(f.properties?.to)));
    return 'only one new route segment, no previous qa-p2';
   });
   await screenshot('05-switch');
  }
  await probe(engine,'Exit erases line and temporary route markers',async()=>{
   await page.locator('#fpUnifiedRoute [data-command="exit"]').first().click({force:true});
   await page.waitForTimeout(700);
   const a=await snapshot(page);
   assert.equal(a.route.open,false);assert.equal(a.road,0);
   assert.equal(await page.locator('#atlasBookmarkOverlay .fp-route-stop-order').count(),0);
   assert.equal(await page.locator('.fp-route-segment-popup').count(),0);
   return 'home route layers cleared';
  });
  await probe(engine,'Refresh retains saved routes and media brief',async()=>{
   await page.reload({waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>window.FootprintMediaCore?.createRepository,{timeout:15000});
   const v=await page.evaluate(async()=>{
    const r=window.FootprintMediaCore.createRepository(indexedDB),p=await r.list(),routes=await r.listRoutes();
    return {places:p.length,routes:routes.length,brief:p.find(x=>x.id==='qa-p1')?.note,photos:p.find(x=>x.id==='qa-p1')?.photos?.length};
   });
   assert.equal(v.places,3);assert.equal(v.routes,2);assert.equal(v.photos,1);assert(v.brief.includes('RC1'));
   return JSON.stringify(v);
  });
  await probe(engine,'Backup ZIP restores only into a second disposable DB',async()=>{
   return JSON.stringify(await page.evaluate(async()=>{
    const lib=window.FootprintMediaCore,repo=lib.createRepository(indexedDB);
    const bytes=await repo.backup();assertNotNeeded();
    function assertNotNeeded(){if((bytes.size||bytes.length||bytes.byteLength||0)<100)throw Error('Empty backup')}
    const parsed=await lib.readBackup(bytes);
    if(parsed.records.length!==3||parsed.routes.length!==2)throw Error('Backup not complete');
    const other=lib.createRepository(indexedDB,'rc1-import-test-only');
    await other.restore(bytes,{conflict:'merge'});
    const p=await other.list(),r=await other.listRoutes();
    if(p.length!==3||r.length!==2||p.find(x=>x.id==='qa-p1')?.photos?.length!==1)throw Error('Restore data mismatch');
    await other.restore(bytes,{conflict:'merge'});
    if((await other.list()).length!==3)throw Error('Merge duplicated places');
    return {zipBytes:bytes.size||bytes.length||bytes.byteLength,places:p.length,routes:r.length,photos:1,idempotent:true};
   }));
  });
  await screenshot('06-refreshed');
  if(errs.length)log(engine,'uncaught JavaScript errors','FAIL',errs.join('; '));
  else log(engine,'uncaught JavaScript errors','PASS','none');
  log(engine,'Real OSRM geometry accuracy','NOT_TESTED','Only deterministic mock geometry; real road service must be validated separately.');
  log(engine,'Physical iPhone Safari gestures','NOT_TESTED','Needs physical device acceptance.');
 }catch(e){log(engine,'test harness unexpected error','FAIL',e.stack||e)}
 finally{await ctx.close();await browser.close()}
}
(async()=>{
 await run('chromium',chromium);await run('webkit',webkit);
 fs.writeFileSync(DIR+'/summary.json',JSON.stringify({rc:'4de6a6bb04c7dfdffa6ae6f6fe3f799375b7d634',data:'synthetic fixtures only',road:'mock',results},null,2));
 const count={};results.forEach(x=>count[x.status]=(count[x.status]||0)+1);
 console.log('RC1 FIXTURE TOTAL '+JSON.stringify(count));
 if(count.FAIL)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2});