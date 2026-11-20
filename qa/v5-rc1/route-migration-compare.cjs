/* Safe V4 plans migration contrast: frozen RC1 vs isolated production candidate.
 * Fresh browser context for each run; NO real visitor IndexedDB touched. */
'use strict';
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const ROOT='https://fanbregas-netizen.github.io/travel-atlas-pages/';
const URL0=ROOT+'v5-route-touch-elastic-20261120/';
const OUT='qa/v5-rc1/evidence/route-migration';
fs.mkdirSync(OUT,{recursive:true});
const candidate=fs.readFileSync('qa/v5-rc1/candidate-media-core.js','utf8');
const reports=[];
async function run(engine,browserType,variant){
 const name=engine+'-'+variant;
 let browser;
 try{browser=await browserType.launch({headless:true,args:engine==='chromium'?['--no-sandbox']:[]})}
 catch(e){reports.push({name,status:'BLOCKED',reason:e.message});return}
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await ctx.newPage();
 try{
  // Establish correct origin without ever loading the current users' DB.
  const r=await page.goto(ROOT,{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(r.status(),200);
  await page.evaluate(async()=>{
   const open=(name,store)=>{
    return new Promise((ok,fail)=>{
     const r=indexedDB.open(name,1);
     r.onupgradeneeded=()=>{
      if(name==='private-travel-footprints-v1'){
       if(!r.result.objectStoreNames.contains('places'))r.result.createObjectStore('places',{keyPath:'id'});
       if(!r.result.objectStoreNames.contains('meta'))r.result.createObjectStore('meta',{keyPath:'key'});
      }else if(!r.result.objectStoreNames.contains(store))r.result.createObjectStore(store,{keyPath:'id'});
     };
     r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error);
    });
   };
   const legacy=await open('travel-atlas-journeys-v1','plans');
   const record=id=>({schema:'travel-atlas-journey-v1',id,title:id==='qa-clash'?'旧版冲突路线':'旧版独有路线',
     startDate:'2026-11-21',endDate:'2026-11-22',transportMode:'car',stops:[{placeId:'qa-old-place',day:1,time:'09:00'}],updatedAt:'2026-11-20T08:00:00Z'});
   await new Promise((ok,fail)=>{
    const tx=legacy.transaction('plans','readwrite'),st=tx.objectStore('plans');
    st.put(record('qa-clash'));st.put(record('qa-legacy-only'));
    tx.oncomplete=ok;tx.onabort=()=>fail(tx.error);
   });legacy.close();
   const current=await open('private-travel-footprints-v1','places');current.close();
   const req=indexedDB.open('private-travel-footprints-v1',1);
   const db=await new Promise((ok,fail)=>{
    req.onsuccess=()=>ok(req.result);req.onerror=()=>fail(req.error);
   });
   if(!db.objectStoreNames.contains('meta'))throw Error('missing meta store');
   await new Promise((ok,fail)=>{
    const tx=db.transaction(['places','meta'],'readwrite');
    tx.objectStore('places').put({id:'qa-old-place',title:'历史星标',lat:31.2,lng:121.4,starred:true,photos:[],videos:[]});
    tx.objectStore('meta').put({key:'journey/qa-clash',value:{...record('qa-clash'),title:'新版已保存路线（必须保留）'}});
    tx.oncomplete=ok;tx.onabort=()=>fail(tx.error);
   });db.close();
  });
  // Generate a NON-PUBLIC in-memory production-mode index; no preview namespaces.
  const raw=await (await fetch(URL0+'index.html',{signal:AbortSignal.timeout(20000)})).text();
  const html=raw.replace(/<script id="fp-qa-storage-contract">[\s\S]*?<\/script>/,'')
                .replace(/<script id="atlas-preview-storage-isolation">[\s\S]*?<\/script>/,'');
  assert(html!==raw && !html.includes('atlas-preview-storage-isolation'));
  await page.route('**/v5-route-touch-elastic-20261120/index.html*',q=>q.fulfill({status:200,contentType:'text/html',body:html}));
  if(variant==='candidate')await page.route('**/src/media/media-core.js*',q=>q.fulfill({status:200,contentType:'application/javascript',body:candidate}));
  await page.goto(URL0+'index.html?compare='+variant,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.FootprintMediaCore?.createRepository,{timeout:19000});
  const result=await page.evaluate(async()=>{
   const repo=window.FootprintMediaCore.createRepository(indexedDB);
   const first=await repo.listRoutes(),again=await repo.listRoutes();
   const clash=first.find(x=>x.id==='qa-clash');
   const legacy=first.find(x=>x.id==='qa-legacy-only');
   const oldDb=await new Promise((ok,fail)=>{
    const q=indexedDB.open('travel-atlas-journeys-v1',1);
    q.onerror=()=>fail(q.error);q.onsuccess=()=>{
     const db=q.result,tx=db.transaction('plans','readonly'),r=tx.objectStore('plans').getAll();
     r.onsuccess=()=>{const data=r.result;db.close();ok(data)};
     r.onerror=()=>fail(r.error);
    };
   });
   return {count:first.length,second:again.length,
     clashTitle:clash?.title,legacyOnly:legacy?.title,oldDbCount:oldDb.length,
     placeCount:(await repo.list()).length};
  });
  assert.equal(result.count,2);assert.equal(result.second,2);
  assert.equal(result.oldDbCount,2);assert.equal(result.placeCount,1);
  assert(result.legacyOnly==='旧版独有路线');
  const preserved=result.clashTitle==='新版已保存路线（必须保留）';
  const observedOverwrite=result.clashTitle==='旧版冲突路线';
  if(variant==='candidate')assert(preserved,'Existing V5 route was overwritten: '+JSON.stringify(result));
  else assert(observedOverwrite,'Original RC1 expected known collision behavior for control');
  reports.push({name,status:variant==='candidate'?'PASS':'OBSERVED',...result});
  console.log('['+name+'] '+(variant==='candidate'?'PASS':'OBSERVED')+' '+JSON.stringify(result));
 }catch(e){reports.push({name,status:'FAIL',error:String(e.stack||e)});console.error('['+name+'] FAIL '+e.stack)}
 finally{await ctx.close();await browser.close()}
}
(async()=>{
 await run('chromium',chromium,'baseline');
 await run('chromium',chromium,'candidate');
 await run('webkit',webkit,'baseline');
 await run('webkit',webkit,'candidate');
 const totals={};for(const r of reports)totals[r.status]=(totals[r.status]||0)+1;
 fs.writeFileSync(OUT+'/collision-report.json',JSON.stringify({totals,reports},null,2));
 console.log('V5 SAFE ROUTE MIGRATION '+JSON.stringify(totals));
 if(totals.FAIL)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2});