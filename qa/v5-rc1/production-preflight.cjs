/* V5 production-readiness migration rehearsal.
 * Runs only in EMPTY isolated Playwright browser contexts on live public
 * V4/RC1 assets. The "production-mode RC1" is intercepted in memory and
 * NEVER published or served to real users. No deletion or real user data. */
'use strict';
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const ROOT='https://fanbregas-netizen.github.io/travel-atlas-pages/';
const QA=ROOT+'v5-route-touch-elastic-20261120/';
const OUT='qa/v5-rc1/evidence/production-preflight';
fs.mkdirSync(OUT,{recursive:true});
const all=[];
async function run(engine,kind){
 let browser;
 const record=(name,status,info='')=>{
  const v={engine,name,status,details:String(info).slice(0,900)};
  all.push(v);console.log('['+engine+'] '+status+' '+name+' '+v.details);
 };
 const attempt=async (name,fn)=>{
  try{const ret=await fn();record(name,'PASS',typeof ret==='string'?ret:JSON.stringify(ret));return true}
  catch(e){record(name,'FAIL',e.message||e);return false}
 };
 try{browser=await kind.launch({headless:true,args:engine==='chromium'?['--no-sandbox']:[]})}
 catch(e){record('launch','BLOCKED',e.message);return}
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',locale:'zh-CN'});
 const page=await ctx.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const synthetic={id:'qa-migration-stable-01',title:'兼容性测试收藏',name:'兼容性测试收藏',
   lat:31.2244,lng:121.4679,starred:true,stage:'visited',note:'旧版存储中的测试 Brief',
   photos:[{kind:'photo',name:'test.png',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/B5kAAAAASUVORK5CYII='}],videos:[]};
 try{
  const started=await attempt('Open deployed V4 root and initialize existing DB',async()=>{
   const r=await page.goto(ROOT,{waitUntil:'domcontentloaded',timeout:55000});assert.equal(r.status(),200);
   await page.waitForFunction(()=>window.__atlasPlaceStore?.save&&window.__atlasPlaceStore?.readAll,{timeout:25000});
   return {url:page.url(),db:'private-travel-footprints-v1'};
  });
  if(!started)return;
  const seeded=await attempt('V4 writes synthetic bookmark to its original IndexedDB',async()=>{
   const result=await page.evaluate(async p=>{
    await window.__atlasPlaceStore.save(p);
    const stored=await window.__atlasPlaceStore.readAll();
    return {count:stored.length,hasFixture:stored.some(x=>x.id===p.id),photo:stored.find(x=>x.id===p.id)?.photos?.length||0};
   },synthetic);
   assert(result.hasFixture&&result.photo===1);
   return result;
  });
  if(!seeded)return;
  await attempt('Raw V4 record preserved without namespaces',async()=>{
   const dbs=await page.evaluate(async()=>indexedDB.databases());
   assert(dbs.some(x=>x.name==='private-travel-footprints-v1'));
   return dbs.map(x=>x.name);
  });
  const qaOpens=await attempt('Current isolated RC1 preview cannot silently read V4 data',async()=>{
   const r=await page.goto(QA,{waitUntil:'domcontentloaded',timeout:55000});assert.equal(r.status(),200);
   await page.waitForFunction(()=>window.FootprintMediaCore?.createRepository,{timeout:20000});
   const data=await page.evaluate(async()=>{
    const repo=window.FootprintMediaCore.createRepository(indexedDB);
    const places=await repo.list();
    return {namespace:window.__atlasPreviewNamespace,dbName:window.FootprintMediaCore.DB_NAME,legacyFound:places.some(x=>x.id==='qa-migration-stable-01')};
   });
   assert.equal(data.legacyFound,false);
   assert(data.namespace?.includes('atlas-v4-map-a-integration'));
   return data;
  });
  if(!qaOpens)return;
  await attempt('Seed preview-only bookmark and produce export ZIP',async()=>{
   const result=await page.evaluate(async()=>{
    const repo=window.FootprintMediaCore.createRepository(indexedDB);
    const dbName=window.FootprintMediaCore.DB_NAME;
    const request=indexedDB.open(dbName,1);
    await new Promise((resolve,reject)=>{
     request.onerror=()=>reject(request.error);
     request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('places','readwrite');
      tx.objectStore('places').put({id:'qa-migration-preview-02',title:'预览版测试收藏',lat:31.2,lng:121.5,starred:true,photos:[],videos:[]});
      tx.oncomplete=()=>{db.close();resolve()};
      tx.onabort=()=>{db.close();reject(tx.error)};
     };
    });
    const back=await repo.backup();
    const bytes=[...new Uint8Array(await back.arrayBuffer())];
    return {namespaced:window.__atlasPreviewNamespace,places:(await repo.list()).length,backupBytes:bytes};
   });
   assert(result.places===1);
   ctx._rc1PreviewBackup=result.backupBytes;
   return {places:result.places,zipBytes:result.backupBytes.length};
  });
  // Keep the HTML unchanged except the exact two preview storage shims.
  // The new product is not publicly accessible in this sanitized form.
  const raw=await (await fetch(QA+'index.html?preflight='+Date.now(),{signal:AbortSignal.timeout(25000)})).text();
  const patched=raw
   .replace(/<script id="fp-qa-storage-contract">[\s\S]*?<\/script>/,'')
   .replace(/<script id="atlas-preview-storage-isolation">[\s\S]*?<\/script>/,'');
  if(patched===raw||patched.includes('id="atlas-preview-storage-isolation"')||patched.includes('id="fp-qa-storage-contract"'))
   throw Error('Refusing to run: cannot safely remove preview storage shims');
  await page.route('**/v5-route-touch-elastic-20261120/index.html*',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:patched}));
  await page.route('**/v5-route-touch-elastic-20261120/?*',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:patched}));
  const prod=await attempt('In-memory production-mode V5 reads ORIGINAL V4 place',async()=>{
   const r=await page.goto(QA+'index.html?preflight=prod',{waitUntil:'domcontentloaded',timeout:48000});
   assert.equal(r.status(),200);
   await page.waitForFunction(()=>window.FootprintMediaCore?.createRepository,{timeout:22000});
   const info=await page.evaluate(async()=>{
    const repo=window.FootprintMediaCore.createRepository(indexedDB);
    const entries=await repo.list();
    const old=entries.find(x=>x.id==='qa-migration-stable-01');
    const preview=entries.find(x=>x.id==='qa-migration-preview-02');
    return {dbName:window.FootprintMediaCore.DB_NAME,previewPrefix:window.__atlasPreviewNamespace,
     records:entries.length,old:{found:!!old,photo:old?.photos?.length||0,note:old?.note||''},previewFound:!!preview};
   });
   assert.equal(info.dbName,'private-travel-footprints-v1');
   assert(!info.previewPrefix);
   assert(info.old.found&&info.old.photo===1&&info.old.note==='旧版存储中的测试 Brief');
   assert.equal(info.previewFound,false);
   return info;
  });
  if(!prod)return;
  await attempt('V5 can edit V4 data and V4 can read same record',async()=>{
   const saved=await page.evaluate(async()=>{
    const repo=window.FootprintMediaCore.createRepository(indexedDB);
    const modified=await repo.saveBrief('qa-migration-stable-01','新版写回测试内容');
    const p=await repo.read('qa-migration-stable-01');
    return {note:p.note,photo:p.photos?.length||0,returned:!!modified};
   });
   assert(saved.note.includes('新版写回')&&saved.photo===1);
   await page.unroute('**/v5-route-touch-elastic-20261120/index.html*');
   await page.unroute('**/v5-route-touch-elastic-20261120/?*');
   await page.goto(ROOT,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>window.__atlasPlaceStore?.readAll,{timeout:20000});
   const old=await page.evaluate(async()=>{const l=await window.__atlasPlaceStore.readAll();const p=l.find(x=>x.id==='qa-migration-stable-01');return {note:p?.note,photo:p?.photos?.length||0}});
   assert.equal(old.note,'新版写回测试内容');assert.equal(old.photo,1);
   return {new:saved,old};
  });
  if(ctx._rc1PreviewBackup){
   await attempt('Preview ZIP can be imported explicitly into production-compatible V5 DB',async()=>{
    await page.route('**/v5-route-touch-elastic-20261120/index.html*',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:patched}));
    await page.goto(QA+'index.html?preflight=import',{waitUntil:'domcontentloaded',timeout:48000});
    await page.waitForFunction(()=>window.FootprintMediaCore?.createRepository,{timeout:22000});
    const result=await page.evaluate(async buffer=>{
     const repo=window.FootprintMediaCore.createRepository(indexedDB);
     const before=(await repo.list()).map(x=>x.id);
     const blob=new Blob([new Uint8Array(buffer)],{type:'application/zip'});
     await repo.restore(blob,{conflict:'merge'});
     const after=(await repo.list()).map(x=>x.id);
     return {before,after,prevPreserved:after.includes('qa-migration-stable-01'),previewMigrated:after.includes('qa-migration-preview-02')};
    },ctx._rc1PreviewBackup);
    assert(result.prevPreserved&&result.previewMigrated);
    return result;
   });
  }
  if(errors.length)record('uncaught page exceptions','OBSERVED',errors.slice(0,8).join('; '));
  else record('uncaught page exceptions','PASS','none');
 }catch(e){record('unexpected preflight failure','FAIL',e.stack||e)}
 finally{await ctx.close();await browser.close()}
}
(async()=>{
 await run('chromium',chromium);
 await run('webkit',webkit);
 const counts={};for(const r of all)counts[r.status]=(counts[r.status]||0)+1;
 fs.writeFileSync(OUT+'/report.json',JSON.stringify({purpose:'compatibility rehearsal, original user data never touched',run:new Date().toISOString(),counts,results:all},null,2));
 console.log('V5 RELEASE PREFLIGHT '+JSON.stringify(counts));
 if(counts.FAIL)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2});