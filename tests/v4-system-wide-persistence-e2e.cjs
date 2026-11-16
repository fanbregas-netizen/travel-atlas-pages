'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const browserName=process.env.BROWSER||'chromium';
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve('v4-system-evidence',browserName);
fs.mkdirSync(OUT,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const n=decodeURIComponent((req.url||'').split('?')[0]).replace(/^\/travel-atlas-pages\//,'').replace(/^\//,'');
 const file=path.resolve(ROOT,n);
 if(!file.startsWith(ROOT+path.sep)){res.writeHead(403).end();return}
 fs.readFile(file,(e,b)=>{
  if(e){res.writeHead(404).end();return}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.writeHead(200).end(b);
 });
});
const url='http://127.0.0.1:8766/travel-atlas-pages/v4-review-20261116/';
(async()=>{
 await new Promise(resolve=>server.listen(8766,'127.0.0.1',resolve));
 const browser=await ({chromium,webkit})[browserName].launch({headless:true,...(browserName==='chromium'?{args:['--no-sandbox']}:{})});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__atlasPlaceStore?.save&&!!window.FootprintMediaCore?.createRepository,null,{timeout:35000});
  const ids=['qa-real-route-A','qa-real-route-B'];
  await page.evaluate(async([a,b])=>{
   const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==';
   const first={id:a,title:'回归地点甲',lat:31.222,lng:121.463,starred:true,stage:'plan',note:'原文保留',photos:[{src:png,name:'a.png'}],videos:[{id:'v1',name:'clip.mp4',type:'video/mp4',size:8,blob:new Blob([new Uint8Array([0,0,0,20,102,116,121,112])],{type:'video/mp4'})}],guides:[],references:[]};
   const second={id:b,title:'回归地点乙',lat:31.224,lng:121.476,starred:true,stage:'visited',photos:[],videos:[],guides:[],references:[]};
   await window.__atlasPlaceStore.save(first);await window.__atlasPlaceStore.save(second);
  },ids);
  const before=await page.evaluate(async()=>{
   const r=window.FootprintMediaCore.createRepository(indexedDB);
   const a=await r.read('qa-real-route-A');
   return {photo:a?.photos?.length,video:a?.videos?.length,note:a?.note};
  });
  assert.deepEqual(before,{photo:1,video:1,note:'原文保留'});
  await page.locator('#dockRoute').click({timeout:16000});
  await page.waitForURL(/\/journey\.html/,{timeout:20000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.ready,null,{timeout:25000});
  assert.equal(await page.locator('#rc-body [data-rc^="pick-"]').count(),2,'real saved route candidates missing');
  await page.locator('#rc-body [data-rc^="pick-"]').nth(0).click();
  await page.locator('#rc-body [data-rc^="pick-"]').nth(1).click();
  await page.waitForFunction(()=>window.__atlasRouteV5Live.state.selected.length===2);
  await page.locator('#rc-footer [data-rc="stage-order"]').click();
  await page.waitForFunction(()=>window.__atlasRouteV5Live.state.stage==='order');
  const ordering=await page.evaluate(()=>window.__atlasRouteV5Live.state.order);
  assert.deepEqual(new Set(ordering.map(x=>x.id)),new Set(ids));
  await page.screenshot({path:path.join(OUT,'01-order.png')});
  await page.locator('#rc-footer [data-rc="stage-preview"]').click();
  await page.locator('#rc-footer [data-rc="mini-save"]').click();
  await page.locator('#rc-save-name').fill('真实路线保存回归');
  await page.locator('#rc-mini-bottom [data-rc="save-confirm"]').click();
  await page.waitForFunction(()=>!!window.__atlasRouteV5Live.state.savedId,null,{timeout:16000});
  const savedId=await page.evaluate(()=>window.__atlasRouteV5Live.state.savedId);
  const route=await page.evaluate(async()=>{
   const list=await window.FootprintMediaCore.createRepository(indexedDB).listRoutes();
   return list.find(x=>x.title==='真实路线保存回归');
  });
  assert.equal(route?.id,savedId);
  assert.deepEqual(new Set(route.stops.map(x=>x.placeId)),new Set(ids));
  await page.screenshot({path:path.join(OUT,'02-saved-route.png')});
  await page.goto(url+'journey.html?saved='+encodeURIComponent(savedId),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.ready,null,{timeout:25000});
  const reopened=await page.evaluate(()=>window.__atlasRouteV5Live.state);
  assert.equal(reopened.savedId,savedId);
  assert.deepEqual(new Set(reopened.order.map(x=>x.id)),new Set(ids));
  const backup=await page.evaluate(async()=>{
   const core=window.FootprintMediaCore,r=core.createRepository(indexedDB);
   const zip=await r.backup(),snapshot=await core.readBackup(zip);
   const first=snapshot.records.find(x=>x.id==='qa-real-route-A');
   const route=snapshot.routes.find(x=>x.id===window.__atlasRouteV5Live.state.savedId);
   if(!first||!route)throw Error('backup omitted real place or route');
   const video=new Uint8Array(first.videos[0].bytes);
   const result=await r.restore(zip,{conflict:'merge'});
   const restored=await r.read(first.id);
   const afterRoutes=await r.listRoutes();
   const corrupt=new Uint8Array(await zip.arrayBuffer());
   // Last non-directory byte in the first local entry; ZIP CRC must fail.
   const start=30+(corrupt[26]|corrupt[27]<<8);
   corrupt[start+10]^=0x8;
   let checksumRejected=false;
   try{await core.readBackup(corrupt)}catch(e){checksumRejected=true}
   return {bytes:zip.size,placeCount:snapshot.records.length,routeCount:snapshot.routes.length,videoLength:video.length,
    restored:result,photoCount:restored.photos?.length,videoCount:restored.videos?.length,routeCountAfter:afterRoutes.length,checksumRejected};
  });
  assert.ok(backup.bytes>100&&backup.placeCount>=2&&backup.routeCount>=1);
  assert.equal(backup.photoCount,1);assert.equal(backup.videoCount,1);
  assert.equal(backup.videoLength,8);assert.ok(backup.checksumRejected,'corrupt backup accepted');
  await page.reload({waitUntil:'domcontentloaded',timeout:55000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.ready,null,{timeout:26000});
  const after=await page.evaluate(async()=>{
   const r=window.FootprintMediaCore.createRepository(indexedDB);
   const p=await r.read('qa-real-route-A');
   return {photos:p.photos.length,videos:p.videos.length,routeId:window.__atlasRouteV5Live.state.savedId};
  });
  assert.deepEqual(after,{photos:1,videos:1,routeId:savedId});
  assert.deepEqual(errors.filter(x=>/TypeError|SyntaxError|ReferenceError/.test(x)),[],'runtime errors');
  const evidence={browserName,before,ordering,savedId,reopened,backup,after,errors};
  fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify(evidence,null,2));
  console.log('PASS REAL V4 ROUTE SAVE + MEDIA BACKUP '+browserName+' '+JSON.stringify({savedId,backup,after}));
  await ctx.close();
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL REAL V4 SYSTEM '+browserName+' '+e.stack);process.exit(1)}).finally(()=>server.close());
