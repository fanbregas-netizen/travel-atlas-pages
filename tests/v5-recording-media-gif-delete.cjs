'use strict';
/* Real Chromium/WebKit: independent blank V5 demo, two-frame GIF + PNG upload,
 * animated-byte preservation, persistent preview, full-screen delete,
 * ZIP round-trip and stale-delete guard. Never visits production data. */
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base='http://127.0.0.1:8765/v5-recording-clean-20261123/';
const gif64='R0lGODlhAgACAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQADAAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQBDAABACwAAAAAAgACAIEAAP8AAAAAAAAAAAAIBgABCAQQEAA7';
const png64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+6r4AAAAASUVORK5CYII=';
const out=path.resolve(__dirname,'../v5-recording-media-evidence');fs.mkdirSync(out,{recursive:true});
async function run(name,engine){
 const browser=await engine.launch({headless:true,args:name==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
 const page=await context.newPage();
 try{
  const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>!!window.FootprintMediaCore?.createRepository&&!!window.__footprintHome?.openSaved,null,{timeout:30000});
  const initial=await page.evaluate(async()=>{
   const repo=window.FootprintMediaCore.createRepository(indexedDB);
   return {places:(await repo.list()).length,routes:(await repo.listRoutes()).length,ns:window.__fpStorageNamespace};
  });
  assert.equal(initial.places,0);assert.equal(initial.routes,0);
  assert.equal(initial.ns,'private-travel-footprints-v5-recording-clean-20261123');
  await page.evaluate(async()=>{
   const repo=window.FootprintMediaCore.createRepository(indexedDB);
   await repo.read('gif-media-qa');
   const db=await new Promise((resolve,reject)=>{
     const r=indexedDB.open('private-travel-footprints-v5-recording-clean-20261123',1);
     r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
   });
   await new Promise((resolve,reject)=>{
     const tx=db.transaction('places','readwrite');
     tx.objectStore('places').put({id:'gif-media-qa',title:'动图录屏验证地点',lat:31.23,lng:121.47,
       starred:true,stage:'plan',note:'原有内容需保留',photos:[],videos:[]});
     tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
   });db.close();
  });
  await page.evaluate(()=>window.__footprintHome.openSaved('gif-media-qa'));
  await page.waitForSelector('#fpPlaceCard input[type="file"]',{timeout:15000});
  await page.locator('#fpPlaceCard input[type="file"]').setInputFiles([
   {name:'two-frame.gif',mimeType:'image/gif',buffer:Buffer.from(gif64,'base64')},
   {name:'still.png',mimeType:'image/png',buffer:Buffer.from(png64,'base64')}
  ]);
  await page.waitForFunction(async()=>{
   const p=await window.FootprintMediaCore.createRepository(indexedDB).read('gif-media-qa');
   return p?.photos?.length===2;
  },null,{timeout:22000});
  const before=await page.evaluate(async()=>{
   const c=window.FootprintMediaCore,repo=c.createRepository(indexedDB);
   const p=await repo.read('gif-media-qa'),zip=await repo.backup(),parsed=await c.readBackup(zip);
   const gif=p.photos.find(x=>x.name==='two-frame.gif'),png=p.photos.find(x=>x.name==='still.png');
   return {gifSrc:gif?.src,pngSrc:png?.src,zipGif:parsed.records[0].photos.find(x=>x.name==='two-frame.gif')?.src,
     photos:p.photos.length,brief:p.note};
  });
  assert.equal(before.gifSrc,'data:image/gif;base64,'+gif64);
  assert.equal(before.zipGif,before.gifSrc);
  assert(before.pngSrc?.startsWith('data:image/png;base64,'));
  assert.equal(before.photos,2);assert.equal(before.brief,'原有内容需保留');
  await page.reload({waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!window.FootprintMediaCore?.createRepository&&!!window.__footprintHome?.openSaved,null,{timeout:30000});
  const persisted=await page.evaluate(async()=>(await window.FootprintMediaCore.createRepository(indexedDB).read('gif-media-qa'))?.photos.length);
  assert.equal(persisted,2,'GIF and PNG should survive reload');
  await page.evaluate(()=>window.__footprintHome.openSaved('gif-media-qa'));
  const mosaics=page.locator('#fpPlaceCard .fp-media-mosaic img');
  await mosaics.first().waitFor({state:'visible',timeout:15000});
  assert.equal(await mosaics.count(),2);
  await page.screenshot({path:path.join(out,name+'-gif-card.png')});
  await page.locator('#fpPlaceCard .fp-media-mosaic button').first().click();
  const trash=page.locator('#fpMediaViewer .fp-viewer-delete');
  await trash.waitFor({state:'visible',timeout:10000});
  await page.screenshot({path:path.join(out,name+'-gif-viewer.png')});
  let confirmed=0;
  page.on('dialog',async dialog=>{confirmed++;await dialog.accept()});
  await trash.click();
  await page.waitForFunction(async()=>{
   const p=await window.FootprintMediaCore.createRepository(indexedDB).read('gif-media-qa');
   return p?.photos?.length===1&&p.photos[0].name==='still.png';
  },null,{timeout:15000});
  assert.equal(confirmed,1);
  const after=await page.evaluate(async()=>{
   const c=window.FootprintMediaCore,repo=c.createRepository(indexedDB);
   const p=await repo.read('gif-media-qa');
   let staleRejected=false;
   try{await repo.removeMedia(p.id,{kind:'photo',index:0,expectedId:'wrong-id'})}
   catch(e){staleRejected=e?.code==='MEDIA_CHANGED'}
   const current=await repo.read(p.id),zip=await repo.backup(),parsed=await c.readBackup(zip);
   return {count:current.photos.length,first:current.photos[0]?.name,brief:current.note,
     backupCount:parsed.records.find(x=>x.id===p.id)?.photos.length,staleRejected};
  });
  assert.deepEqual(after,{count:1,first:'still.png',brief:'原有内容需保留',backupCount:1,staleRejected:true});
  await page.reload({waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!window.FootprintMediaCore?.createRepository,null,{timeout:30000});
  const afterReload=await page.evaluate(async()=>(await window.FootprintMediaCore.createRepository(indexedDB).read('gif-media-qa')).photos.length);
  assert.equal(afterReload,1);
  console.log(JSON.stringify({browser:name,result:'PASS',initialPlaces:0,initialRoutes:0,gifFramesKept:true,
    backupRoundTrip:true,cardAndViewer:true,deletedOne:true,otherImageAndBriefPreserved:true,staleDeleteRejected:true}));
 }finally{await context.close();await browser.close()}
}
(async()=>{for(const [name,engine] of [['chromium',chromium],['webkit',webkit]])await run(name,engine)})()
 .catch(e=>{console.error(e.stack||e);process.exitCode=1});
