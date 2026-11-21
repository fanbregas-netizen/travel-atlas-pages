'use strict';
// Real Chromium/WebKit test of old v1 IndexedDB + legacy route migration.
// Seeds synthetic records in an ephemeral browser profile BEFORE V5 loads.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const ROOT='http://127.0.0.1:8765/';
async function run(engineName,engine,width){
 const browser=await engine.launch({headless:true,args:engineName==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true,serviceWorkers:'block'});
 const page=await context.newPage();
 try {
  await page.goto(ROOT+'tests/v5-fixture-seed.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{
   const open=(name,init)=>new Promise((resolve,reject)=>{
    const req=indexedDB.open(name,1);
    req.onupgradeneeded=()=>init(req.result);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   const db=await open('private-travel-footprints-v1',db=>{
    db.createObjectStore('places',{keyPath:'id'});
    db.createObjectStore('meta',{keyPath:'key'});
   });
   const tx=db.transaction(['places','meta'],'readwrite');
   const p=tx.objectStore('places'),m=tx.objectStore('meta');
   p.put({
    id:'v4-legacy-a',title:'旧站·上海旅行',lat:31.23,lng:121.47,starred:true,
    stage:'visited',note:'2025年V4原有Brief内容，不得丢失',date:'2025-10-01',
    photos:[{id:'ph1',name:'旧站照片',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAwMCAO+/FQkAAAAASUVORK5CYII='}],
    videos:[{id:'vi1',name:'旧站视频',type:'video/mp4',size:3,bytes:new Uint8Array([10,20,30])}]
   });
   p.put({id:'v4-legacy-b',title:'旧站·温州旅行',lat:27.99,lng:120.7,starred:true,
    stage:'plan',note:'未来想去',date:'2025-10-04',photos:[],videos:[]});
   m.put({key:'journey/route-existing',value:{
    id:'route-existing',title:'新的已保存路线',schema:'travel-atlas-journey-v1',
    stops:[{placeId:'v4-legacy-a',day:1,time:''},{placeId:'v4-legacy-b',day:2,time:''}],
    updatedAt:'2026-11-20'
   }});
   await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
   db.close();
   const old=await open('travel-atlas-journeys-v1',db=>db.createObjectStore('plans',{keyPath:'id'}));
   const oldTx=old.transaction('plans','readwrite');
   oldTx.objectStore('plans').put({id:'route-existing',title:'陈旧同 ID 路线，不应覆盖',placeIds:['v4-legacy-a','v4-legacy-b'],updatedAt:'2025-01-01'});
   oldTx.objectStore('plans').put({id:'route-old-only',title:'V4 独有旧路线',placeIds:['v4-legacy-b','v4-legacy-a'],updatedAt:'2025-01-01'});
   await new Promise((resolve,reject)=>{oldTx.oncomplete=resolve;oldTx.onerror=()=>reject(oldTx.error);oldTx.onabort=()=>reject(oldTx.error)});
   old.close();
  });
  await page.goto(ROOT,{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>typeof window.__atlasPlaceStore?.readAll==='function'&&
    typeof window.FootprintMediaCore?.createRepository==='function',null,{timeout:22000});
  const state=await page.evaluate(async()=>{
   const repo=window.FootprintMediaCore.createRepository(indexedDB);
   const [records,routes]=await Promise.all([window.__atlasPlaceStore.readAll(),repo.listRoutes()]);
   const backup=await repo.backup();
   const archive=await window.FootprintMediaCore.readBackup(backup);
   const a=records.find(x=>x.id==='v4-legacy-a');
   const orig=archive.records.find(x=>x.id==='v4-legacy-a');
   return{
    ids:records.map(x=>x.id),notes:a?.note,photoCount:a?.photos?.length,
    videoBytes:a?.videos?.[0]?.bytes?.length,videoBlobBytes:a?.videos?.[0]?.blob?.size,
    routes:routes.map(x=>({id:x.id,title:x.title,stops:x.stops?.length})),
    archiveCount:archive.records.length,archiveRoutes:archive.routes.length,
    archiveVideoBytes:orig?.videos?.[0]?.bytes?.byteLength,backupSize:backup.size,
    db:window.FootprintMediaCore.DB_NAME,
    preview:window.__fpStorageNamespace
   };
  });
  assert.equal(state.db,'private-travel-footprints-v1');
  assert.equal(state.preview,undefined);
  assert.deepEqual(state.ids.sort(),['v4-legacy-a','v4-legacy-b']);
  assert.equal(state.notes,'2025年V4原有Brief内容，不得丢失');
  assert.equal(state.photoCount,1);
  assert.equal(state.videoBlobBytes,3);
  assert.equal(state.archiveVideoBytes,3);
  assert.equal(state.routes.length,2);
  assert.equal(state.routes.find(x=>x.id==='route-existing')?.title,'新的已保存路线');
  assert.equal(state.routes.find(x=>x.id==='route-old-only')?.title,'V4 独有旧路线');
  assert.equal(state.archiveCount,2);
  assert.equal(state.archiveRoutes,2);
  assert(state.backupSize>100,'backup ZIP must contain real binary data');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.__atlasPlaceStore?.readAll==='function',null,{timeout:16000});
  assert.equal((await page.evaluate(()=>window.__atlasPlaceStore.readAll())).length,2);
  console.log(JSON.stringify({engine:engineName,width,result:'PASS',places:2,legacyRoutes:2,
   mediaVideoBytes:3,backupBytes:state.backupSize,originalSameIdRoutePreserved:true}));
 }finally{await context.close();await browser.close()}
}
(async()=>{for(const [name,engine] of [['chromium',chromium],['webkit',webkit]])
 for(const width of [390,430])await run(name,engine,width)})()
 .catch(e=>{console.error(e.stack||e);process.exitCode=1});
