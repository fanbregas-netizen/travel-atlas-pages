'use strict';
/* Real full-product acceptance: no mocks for browser DOM/IndexedDB/media/route storage.
 * The map routing remote service is separately classified; do not claim driving ETA. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.cwd(),'v4-real-e2e-evidence');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html;charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const url=new URL(req.url||'/','http://127.0.0.1');
 const routed=decodeURIComponent(url.pathname).replace(/^\/travel-atlas-pages\/integration-v4-real-e2e-review(?=\/|$)/,'')||'/';
 const file=path.resolve(root,'.'+(routed==='/'?'/index.html':routed));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 try{const data=fs.readFileSync(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(data)}
 catch{res.writeHead(404);res.end('Not found')}});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
 let browser,context,page;const report={checks:[],errors:[],base,network:[],media:{},route:{}};
 const ok=(name,detail)=>{report.checks.push({name,detail});console.log('PASS '+name+(detail?' '+JSON.stringify(detail).slice(0,350):''))};
 try{
  browser=await chromium.launch({headless:true,executablePath:chrome||undefined,channel:chrome?undefined:'chrome',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']});
  context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'zh-CN',acceptDownloads:true});
  page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(String(e).slice(0,300)));
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!window.__atlasDemo?.select&&!!window.FootprintMediaCore,{timeout:25000});
  const add=async(name,lat,lng,note)=>{
   if(await page.locator('#fpPlaceCard').isVisible())await page.locator('#fpPlaceCard .fp-card-close').click();
   await page.evaluate(({name,lat,lng})=>window.__atlasDemo.select(name,lat,lng),{name,lat,lng});
   await page.locator('#destinationStar').evaluate(el=>el.click()); // invoke real action; previous saved-place card may cover the test helper's destination overlay
   await page.locator('#placeName').fill(name);
   await page.locator('#placeNote').fill(note);
   await page.locator('#savePlace').click();
   await page.waitForFunction(name=>window.__atlasDemo.getSaved().some(p=>p.title===name),name,{timeout:12000});
   return await page.evaluate(name=>window.__atlasDemo.getSaved().find(p=>p.title===name).id,name);
  };
  const first=await add('路线联调地点甲',29.492,121.905,'甲地点 Brief · 实际数据库');
  const second=await add('路线联调地点乙',29.512,121.927,'乙地点 Brief · 实际数据库');
  const third=await add('路线联调地点丙',29.525,121.948,'丙地点 Brief · 实际数据库');
  assert.equal(new Set([first,second,third]).size,3);ok('three original geolocated places persisted',{first,second,third});
  await page.evaluate(id=>window.__atlasDemo.openSaved(id),first);
  await page.waitForFunction(id=>document.querySelector('#fpPlaceCard')?.dataset.placeId===id&&document.querySelector('#fpPlaceCard')?.hidden===false,first);
  const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=4;canvas.height=4;canvas.getContext('2d').fillRect(0,0,4,4);return canvas.toDataURL('image/png').split(',')[1]});
  const picker=page.locator('#fpPlaceCard input[type="file"]');
  await picker.setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(async id=>{
   const p=await window.FootprintMediaCore.createRepository(indexedDB).read(id);
   return p?.photos?.length===1;
  },first,{timeout:20000});
  const card=page.locator('#fpPlaceCard');
  await card.locator('.fp-edit-toggle').click(); // existing app: enter editing mode before secondary link actions
  await card.locator('.fp-subheading button').last().click(); // saved sources editor
  await card.locator('input[type="url"]').fill('https://example.com/guide-for-place-a');
  await card.locator('button', {hasText:'保存链接'}).click();
  await page.waitForFunction(async id=>{
   const p=await window.FootprintMediaCore.createRepository(indexedDB).read(id);
   return !!p?.references?.length;
  },first);
  const repoState=await page.evaluate(async id=>{
   const media=window.FootprintMediaCore.createRepository(indexedDB);
   await media.addMedia(id,[{kind:'video',name:'sample.mp4',type:'video/mp4',bytes:new Uint8Array([0,0,0,24,102,116,121,112,109,112,52,50,0,0,0,0])}]);
   const p=await media.read(id);
   return {photos:p.photos.length,videos:p.videos.length,references:p.references?.length||0,videoLength:p.videos[0]?.bytes?.byteLength||0,
     brief:p.note,originId:p.id};
  },first);
  assert.equal(repoState.photos,1);assert.equal(repoState.videos,1);
  assert.equal(repoState.references,1);assert.ok(repoState.videoLength>0);
  assert.match(repoState.brief,/甲地点 Brief/);report.media=repoState;ok('photo/video/reference/Brief bind to one place ID',repoState);
  await page.screenshot({path:path.join(out,'01-real-place-card.png'),fullPage:false});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(id=>window.__atlasDemo?.getSaved?.()?.some(x=>x.id===id),first);
  const preserved=await page.evaluate(async id=>{
   const p=await window.FootprintMediaCore.createRepository(indexedDB).read(id);
   return {photos:p.photos.length,videos:p.videos.length,refs:p.references.length,brief:p.note};
  },first);
  assert.equal(preserved.photos,1);assert.equal(preserved.videos,1);assert.equal(preserved.refs,1);
  ok('media and Brief persist after reload',preserved);
  const backed=await page.evaluate(async()=>{
    const api=window.FootprintMediaCore.createRepository(indexedDB);
    const blob=await api.backup();
    const items=await window.FootprintMediaCore.readBackup(blob);
    return {size:blob.size,count:items.records.length,videoBytes:items.records.find(x=>x.title==='路线联调地点甲')?.videos?.[0]?.bytes?.byteLength||0};
  });
  assert.ok(backed.size>200);assert.equal(backed.count,3);assert.equal(backed.videoBytes,repoState.videoLength);
  ok('ZIP CRC-backed export roundtrip retains video bytes',backed);
  await page.goto(base+'/journey.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>document.querySelector('#places')?.querySelectorAll('button.place').length>=3,{timeout:15000});
  await page.locator('#places button.place:not([disabled])').first().click();
  await page.locator('#places button.place:not([disabled])').first().click();
  assert.equal(await page.locator('#chosen .choice').count(),2);
  const baseDate=new Date();baseDate.setHours(12,0,0,0);baseDate.setDate(baseDate.getDate()+3);
  const fmt=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const start=fmt(baseDate),endDate=new Date(baseDate);endDate.setDate(endDate.getDate()+2);const end=fmt(endDate);
  await page.locator('#startDate').click();await page.locator('#atlasDateDraftStart').fill(start);
  await page.locator('#atlasDateDraftEnd').fill(end);await page.locator('#atlasDateCancel').click();
  assert.notEqual(await page.locator('#startDate').inputValue(),start,'cancel must not mutate dates');
  await page.locator('#startDate').click();
  await page.locator('#atlasDateDraftStart').fill(start);await page.locator('#atlasDateDraftEnd').fill(end);
  await page.locator('#atlasDateApply').click();
  assert.equal(await page.locator('#startDate').inputValue(),start);
  assert.equal(await page.locator('#endDate').inputValue(),end);
  await page.locator('#planTitle').fill('联调测试路线');
  await page.locator('#origin').fill('出发地');
  await page.locator('#destination').fill('目的地');
  await page.locator('#savePlan').click();
  await page.waitForFunction(()=>document.querySelector('#savedPlans')?.querySelectorAll('option').length>=2,{timeout:12000});
  const route=await page.evaluate(async()=>{
   const db=await new Promise((res,rej)=>{const r=indexedDB.open('travel-atlas-journeys-v1-v4-real-e2e-review',1);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
   const rows=await new Promise((res,rej)=>{const tx=db.transaction('plans','readonly');const r=tx.objectStore('plans').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
   db.close();return rows.find(r=>r.title==='联调测试路线');
  });
  assert.ok(route?.id);assert.equal(route.stops.length,2);
  assert.equal(route.startDate,start);assert.equal(route.endDate,end);
  report.route={id:route.id,days:route.stops.map(x=>x.day),stops:route.stops.map(x=>x.placeId)};
  ok('real journey saved to shared IndexedDB plan store',report.route);
  await page.screenshot({path:path.join(out,'02-real-journey.png'),fullPage:false});
  await page.goto(base+'/route-view.html?saved='+encodeURIComponent(route.id),{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>document.querySelector('#stopRail')?.querySelectorAll('.stop-chip').length===2,{timeout:22000});
  assert.equal(await page.locator('#stopRail .stop-chip').count(),2);
  await page.locator('#addStop').click();
  await page.waitForFunction(()=>document.querySelector('#addStopList')?.querySelectorAll('button.add-stop-item').length>=1,{timeout:12000});
  await page.locator('#addStopList button.add-stop-item').first().click();
  await page.locator('#addStopDay').selectOption('2');
  await page.locator('#addStopConfirm').click();
  await page.waitForFunction(()=>document.querySelector('#stopRail')?.querySelectorAll('.stop-chip').length===3,{timeout:8000});
  assert.equal(await page.locator('#stopRail .stop-chip').count(),3);
  await page.locator('#saveRoute').click();
  const shortEnd=new Date(baseDate);shortEnd.setDate(shortEnd.getDate()+1);
  await page.locator('#routeSaveEnd').evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}))},fmt(shortEnd)); // existing route-view calendar is readonly with its own date-picker
  await page.locator('#routeSaveConfirm').click();
  await page.waitForFunction(()=>!document.getElementById('saveRouteDialog').open,{timeout:12000});
  const checkRoute=await page.evaluate(async id=>{
   const db=await new Promise((res,rej)=>{const x=indexedDB.open('travel-atlas-journeys-v1-v4-real-e2e-review',1);x.onsuccess=()=>res(x.result);x.onerror=()=>rej(x.error)});
   const plan=await new Promise((res,rej)=>{const tx=db.transaction('plans','readonly'),req=tx.objectStore('plans').get(id);req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});
   db.close();return {count:plan.selected?.length,days:plan.selected?.map(s=>s.day),end:plan.endDate,ids:plan.selected?.map(s=>s.id)};
  },route.id);
  assert.equal(checkRoute.count,3);assert.ok(checkRoute.days.every(x=>x<=2));assert.equal(checkRoute.end,fmt(shortEnd));
  ok('route add stop + date shortening persists proper D labels',checkRoute);
  await page.screenshot({path:path.join(out,'03-real-route-view.png'),fullPage:false});
  // A damaged archive must be rejected without destroying the three original saved places.
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.FootprintMediaCore,{timeout:12000});
  const rejected=await page.evaluate(async()=>{
   const api=window.FootprintMediaCore.createRepository(indexedDB);
   const pre=await api.list();
   let error=null;try{await api.restore(new Blob([new Uint8Array([1,2,3,4,5])],{type:'application/zip'}))}catch(e){error=e.code||e.message}
   const after=await api.list();
   return {before:pre.length,after:after.length,error};
  });
  assert.ok(rejected.error);assert.equal(rejected.before,rejected.after);
  ok('damaged ZIP rejected atomically without deleting user places',rejected);
  report.errors.forEach(e=>console.error('PAGEERROR '+e));
  assert.equal(report.errors.length,0,'uncaught browser page errors');
  console.log('PASS real V4 integration E2E '+report.checks.length+' functional groups');
 } finally{
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
  try{if(page)await page.screenshot({path:path.join(out,'final-state.png'),fullPage:false})}catch(_){}
  await browser?.close();await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(e=>{console.error('FAIL REAL E2E:',e.stack||e);process.exitCode=1});
