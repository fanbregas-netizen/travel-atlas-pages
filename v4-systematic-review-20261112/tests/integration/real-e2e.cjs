'use strict';
/* Real full-product acceptance: no mocks for browser DOM/IndexedDB/media/route storage.
 * The map routing remote service is separately classified; do not claim driving ETA. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit,devices}=require('playwright-core');
const browserName=process.env.ATLAS_TEST_BROWSER==='webkit'?'webkit':'chromium';
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.cwd(),'v4-real-e2e-evidence');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html;charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const url=new URL(req.url||'/','http://127.0.0.1'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 try{res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file))}
 catch{res.writeHead(404);res.end('Not found')}});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(fs.existsSync);
 let browser,context,page;const report={checks:[],errors:[],base,network:[],media:{},route:{}};
 const ok=(name,detail)=>{report.checks.push({name,detail});console.log('PASS '+name+(detail?' '+JSON.stringify(detail).slice(0,350):''))};
 try{
  browser=browserName==='webkit'
    ?await webkit.launch({headless:true})
    :await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']});
  const browserOptions=browserName==='webkit'
    ?{...devices['iPhone 13'],locale:'zh-CN',acceptDownloads:true}
    :{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'zh-CN',acceptDownloads:true};
  context=await browser.newContext(browserOptions);
  console.log('BROWSER_ENGINE '+browserName);
  page=await context.newPage();
  page.on('domcontentloaded',()=>console.log('DOM_READY',page.url()));
  page.on('request',r=>{if(r.url().startsWith(base)&&r.resourceType()==='document')console.log('NAV_START',r.url())});
  page.on('response',r=>{if(r.request().resourceType()==='document')console.log('NAV_RESPONSE',r.status(),r.url())});
  page.on('dialog',async d=>{console.log('DIALOG',d.type(),d.message());await d.dismiss()});
  page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(String(e).slice(0,300)));
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!window.__atlasDemo?.select&&!!window.FootprintMediaCore,null,{timeout:25000});
  async function tapVisible(selector){
    const locator=page.locator(selector);
    await locator.waitFor({state:'visible'});
    const point=await locator.evaluate(node=>{
      const box=node.getBoundingClientRect(),x=box.left+box.width/2,y=box.top+box.height/2;
      if(!node.contains(document.elementFromPoint(x,y))||node.disabled)throw Error('Touch target covered: '+node.outerHTML.slice(0,180));
      return {x,y};
    });
    await page.touchscreen.tap(point.x,point.y);
  }
  const add=async(name,lat,lng,note)=>{
   if(await page.locator('#fpPlaceCard').isVisible()){
    const state=await page.evaluate(()=>({motion:window.__atlasSheetIntegration?.motion?.state(),controller:window.__atlasSheetIntegration?.card?.getState(),rect:(()=>{const r=document.querySelector('#fpPlaceCard .fp-card-close')?.getBoundingClientRect();return r&&{x:r.x,y:r.y,w:r.width,h:r.height}})()}));
    console.log('PRE_CLOSE_PHYSICAL',JSON.stringify(state));
    await page.waitForFunction(()=>!window.__atlasSheetIntegration?.motion?.state()?.animating,null,{timeout:9000});
    await page.locator('#fpPlaceCard .fp-card-close').click();
   }
   await page.evaluate(({name,lat,lng})=>window.__atlasDemo.select(name,lat,lng),{name,lat,lng});
   await tapVisible('#destinationStar');
   await page.locator('#placeName').fill(name);
   await page.locator('#placeNote').fill(note);
   // iOS virtual keyboard can leave the bottom action outside the stable viewport.
   // Close the keyboard and scroll only the editor's own pane (never the map).
   await page.locator('#placeNote').evaluate(node=>node.blur());
   await page.locator('#editor .editor-scroll').evaluate(node=>{node.scrollTop=node.scrollHeight});
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
  console.log('SHEET_STATE',JSON.stringify(await page.evaluate(()=>({bridge:!!window.__atlasSheetIntegration,ctrl:window.__atlasSheetIntegration?.card.getState(),card:{id:document.getElementById('fpPlaceCard')?.dataset.placeId,hidden:document.getElementById('fpPlaceCard')?.hidden,grip:!!document.querySelector('#fpPlaceCard .atlas-card-grip')},errors:window.__atlasSheetBridgeError||null}))));
  console.log('SHEET_PAGE_ERRORS',JSON.stringify(report.errors));
  await page.waitForFunction(id=>window.__atlasSheetIntegration?.card.getState().selectedPlaceId===id&&window.__atlasSheetIntegration?.card.getState().sheet!=='closed',first);
  assert.equal(await page.locator('#fpPlaceCard .atlas-card-grip').count(),1,'only one live card grip');
  ok('real sheet controller owns existing card and reuses geographic star');
  const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=4;canvas.height=4;canvas.getContext('2d').fillRect(0,0,4,4);return canvas.toDataURL('image/png').split(',')[1]});
  const picker=page.locator('#fpPlaceCard input[type="file"]');
  await picker.setInputFiles([{name:'sample.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')},{name:'sample.mp4',mimeType:'video/mp4',buffer:Buffer.from('AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAOxbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAZAAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAtx0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAZAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAEAAAABAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAGQAAAEAAABAAAAAAJUbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAyAAAAFABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAAB/21pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAb9zdGJsAAAAv3N0c2QAAAAAAAAAAQAAAK9hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAEAAQABIAAAASAAAAAAAAAABFUxhdmM2MS4xOS4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANWF2Y0MBZAAK/+EAGGdkAAqs2UQmwEQAAAMABAAAAwDIPEiWWAEABmjr48siwP34+AAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAABDMAAAAAAAAAAYc3R0cwAAAAAAAAABAAAACgAAAgAAAAAUc3RzcwAAAAAAAAABAAAAAQAAAGBjdHRzAAAAAAAAAAoAAAABAAAEAAAAAAEAAAoAAAAAAQAABAAAAAABAAAAAAAAAAEAAAIAAAAAAQAACgAAAAABAAAEAAAAAAEAAAAAAAAAAQAAAgAAAAABAAAEAAAAABxzdHNjAAAAAAAAAAEAAAABAAAACgAAAAEAAAA8c3RzegAAAAAAAAAAAAAACgAAAtwAAAAOAAAADAAAAAwAAAAMAAAAFAAAAA4AAAAMAAAADAAAABQAAAAUc3RjbwAAAAAAAAABAAAD4QAAAGF1ZHRhAAAAWW1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALGlsc3QAAAAkqXRvbwAAABxkYXRhAAAAAQAAAABMYXZmNjEuNy4xMDMAAAAIZnJlZQAAA2RtZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzEwOCAzMWUxOWY5IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTIgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAJmWIhAA3//7hA/gU1uRQY49KFQETFcuRtxKOnyANbxOb/5ExAzXXAAAACkGaJGxDf/6nj4gAAAAIQZ5CeIX/CbkAAAAIAZ5hdEK/DDgAAAAIAZ5jakK/DDkAAAAQQZpoSahBaJlMCF///ozTYQAAAApBnoZFESwv/wm5AAAACAGepXRCvww5AAAACAGep2pCvww4AAAAEEGaqUmoQWyZTAhX//44jcA=','base64')}]);
  await page.waitForFunction(async id=>{
   const p=await window.FootprintMediaCore.createRepository(indexedDB).read(id);
   return p?.photos?.length===1;
  },first,{timeout:20000});
  const card=page.locator('#fpPlaceCard');
  await card.locator('.fp-edit-toggle').click(); // existing app: enter editing mode before secondary link actions
  await card.getByRole('button',{name:'＋ 链接'}).click(); // saved sources editor
  await card.locator('input[type="url"]').fill('https://example.com/guide-for-place-a');
  await card.locator('button', {hasText:'保存链接'}).click();
  await page.waitForFunction(async id=>{
   const p=await window.FootprintMediaCore.createRepository(indexedDB).read(id);
   return !!(p?.references?.length||p?.guides?.length);
  },first);
  const repoState=await page.evaluate(async id=>{
   const media=window.FootprintMediaCore.createRepository(indexedDB);
   const p=await media.read(id);
   return {photos:p.photos.length,videos:p.videos.length,references:(p.references?.length||0)+(p.guides?.length||0),guideCount:p.guides?.length||0,videoLength:p.videos[0]?.bytes?.byteLength||0,
     brief:p.note,originId:p.id};
  },first);
  assert.equal(repoState.photos,1);assert.equal(repoState.videos,1);
  assert.equal(repoState.references,1);assert.ok(repoState.videoLength>0);
  assert.match(repoState.brief,/甲地点 Brief/);report.media=repoState;ok('photo/video/reference/Brief bind to one place ID',repoState);
  // B real-world unified card ownership: assert only one controller is mounted
  // and moving between the three approved snap levels preserves the actual place ID.
  const sheetCheck=await page.evaluate(id=>{
    const adapter=window.__atlasSheetIntegration?.card;
    if(!adapter)throw Error('B real product card controller missing');
    const levels=[],capture=()=>levels.push(adapter.getState().sheet);
    capture();adapter.snapTo('half');capture();adapter.snapTo('full');capture();
    adapter.snapTo('peek');capture();
    return {levels,placeId:adapter.getState().selectedPlaceId,legacy:window.AtlasPhase1?.version};
  },first);
  assert.deepEqual(sheetCheck.levels,['peek','half','full','peek']);
  assert.equal(sheetCheck.placeId,first);
  assert.match(sheetCheck.legacy||'',/unified-sheet-B/);
  ok('B unified sheet is sole real place card owner',sheetCheck);
  const physical=await page.evaluate(()=>window.__atlasSheetIntegration?.motion?.state());
  assert.ok(physical,'final B V3 physical motor missing');
  assert.equal(physical.placeId,first);
  assert.equal(physical.sheet,'peek');
  ok('real card uses final B V3 spring motor',physical);
  await card.locator('.fp-media-mosaic button').first().click();
  await page.waitForSelector('#fpMediaViewer img');
  assert.equal(await page.locator('#fpMediaViewer').count(),1);
  assert.ok(await page.locator('#fpMediaViewer img').evaluate(x=>x.getAttribute('src')?.startsWith('data:image/')));
  await tapVisible('#fpMediaViewer .fp-viewer-close');
  await page.waitForFunction(()=>!document.getElementById('fpMediaViewer'),null,{timeout:7000});
  ok('real place photo opens and returns through source-aware full-screen transition');
  await page.screenshot({path:path.join(out,'01-real-place-card.png'),fullPage:false});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(id=>window.__atlasDemo?.getSaved?.()?.some(x=>x.id===id),first);
  const preserved=await page.evaluate(async id=>{
   const p=await window.FootprintMediaCore.createRepository(indexedDB).read(id);
   return {photos:p.photos.length,videos:p.videos.length,refs:(p.references?.length||0)+(p.guides?.length||0),guides:p.guides?.length||0,brief:p.note};
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
  await page.waitForFunction(()=>document.querySelector('#places')?.querySelectorAll('button.place').length>=3,null,{timeout:15000});
  await page.waitForFunction(()=>window.__atlasJourneyRealV5?.state?.sheet==='half',null,{timeout:10000});
  const cV5=await page.evaluate(()=>({level:window.__atlasJourneyRealV5.state.sheet,physical:!!window.__atlasJourneyRealV5.physical,realPlaces:document.querySelectorAll('#places button.place').length}));
  assert.equal(cV5.level,'half');assert.ok(cV5.physical);assert.ok(cV5.realPlaces>=3);
  await page.evaluate(()=>window.__atlasJourneyRealV5.snapTo('full'));
  await page.waitForFunction(()=>window.__atlasJourneyRealV5?.state?.sheet==='full');
  await page.evaluate(()=>window.__atlasJourneyRealV5.snapTo('half'));
  await page.waitForFunction(()=>!window.__atlasJourneyRealV5.physical?.animating,null,{timeout:6000});
  ok('C V5 iPhone-style route sheet runs on real selected place data',cV5);
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
  const beforeOrder=await page.locator('#chosen .choice').evaluateAll(nodes=>nodes.map(node=>node.dataset.stopId));
  await page.locator('#chosen select.day-picker').last().selectOption('1');
  await page.locator('#chosen button[title="上移站点"]').last().click();
  assert.deepEqual(await page.locator('#chosen .choice').evaluateAll(nodes=>nodes.map(node=>node.dataset.stopId)),beforeOrder.slice().reverse());
  ok('two real stops reorder through planner controls');
  await page.locator('#planTitle').fill('联调测试路线');
  await page.locator('#origin').fill('出发地');
  await page.locator('#destination').fill('目的地');
  await page.locator('#savePlan').click();
  await page.waitForFunction(()=>document.querySelector('#savedPlans')?.querySelectorAll('option').length>=2,null,{timeout:12000});
  const route=await page.evaluate(async()=>{
   const rows=await window.FootprintMediaCore.createRepository(indexedDB).listRoutes();
   return rows.find(r=>r.title==='联调测试路线');
  });
  assert.ok(route?.id);assert.equal(route.stops.length,2);
  assert.equal(route.startDate,start);assert.equal(route.endDate,end);
  report.route={id:route.id,days:route.stops.map(x=>x.day),stops:route.stops.map(x=>x.placeId)};
  ok('real journey saved to shared IndexedDB plan store',report.route);
  await page.screenshot({path:path.join(out,'02-real-journey.png'),fullPage:false});
  await page.goto(base+'/route-view.html?saved='+encodeURIComponent(route.id),{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>document.querySelector('#stopRail')?.querySelectorAll('.stop-chip').length===2,null,{timeout:22000});
  assert.equal(await page.locator('#stopRail .stop-chip').count(),2);
  await page.locator('#addStop').click();
  await page.waitForFunction(()=>document.querySelector('#addStopList')?.querySelectorAll('button.add-stop-item').length>=1,null,{timeout:12000});
  await page.locator('#addStopList button.add-stop-item').first().click();
  await page.locator('#addStopDay').selectOption('2');
  await page.locator('#addStopConfirm').click();
  await page.waitForFunction(()=>document.querySelector('#stopRail')?.querySelectorAll('.stop-chip').length===3,null,{timeout:8000});
  assert.equal(await page.locator('#stopRail .stop-chip').count(),3);
  await page.locator('#saveRoute').click();
  const shortEnd=new Date(baseDate);shortEnd.setDate(shortEnd.getDate()+1);
  await page.locator('#routeSaveEnd').evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}))},fmt(shortEnd)); // existing route-view calendar is readonly with its own date-picker
  await page.locator('#routeSaveConfirm').click();
  await page.waitForFunction(()=>!document.getElementById('saveRouteDialog').open,null,{timeout:12000});
  const checkRoute=await page.evaluate(async id=>{
   const rows=await window.FootprintMediaCore.createRepository(indexedDB).listRoutes();
   const plan=rows.find(r=>r.id===id);
   return {count:plan.stops.length,days:plan.stops.map(s=>s.day),end:plan.endDate,ids:plan.stops.map(s=>s.placeId)};
  },route.id);
  assert.equal(checkRoute.count,3);assert.ok(checkRoute.days.every(x=>x<=2));assert.equal(checkRoute.end,fmt(shortEnd));
  ok('route add stop + date shortening persists proper D labels',checkRoute);
  // C04 approved route location detail with real place/media and B three-level state.
  // The map may finish styling after the rail appears; wait for the real place-pin.
  await page.waitForFunction(()=>!!window.__atlasRouteDetailSheet&&document.querySelectorAll('.route-pin').length>0,null,{timeout:20000});
  await page.locator('#stopRail .stop-chip').first().click();
  await page.waitForFunction(()=>!document.getElementById('stopBubble').hidden,null,{timeout:9000});
  const selectedRouteId=await page.locator('#stopBubble').getAttribute('data-place-id');
  assert.ok(selectedRouteId,'route bubble has no stable placeId');
  await page.locator('.rv-callout').click();
  await page.waitForFunction(()=>document.querySelector('#rvDetail')?.classList.contains('open'),null,{timeout:9000});
  const detailCheck=await page.evaluate(()=>{
    const c=window.__atlasRouteDetailSheet;
    const levels=[],capture=()=>levels.push(c.state().sheet);
    capture();c.snapTo('half');capture();c.snapTo('full');capture();c.snapTo('peek');capture();
    const d=document.getElementById('rvDetail'),videos=d.querySelectorAll('.rv-media video').length,
      imgs=d.querySelectorAll('.rv-media img').length;
    const id=c.state().selectedPlaceId;
    c.close();
    return {levels,placeId:id,hasPhotos:imgs,hasVideo:videos,closed:!d.classList.contains('open')};
  });
  assert.deepEqual(detailCheck.levels,['peek','half','full','peek']);
  assert.equal(detailCheck.placeId,selectedRouteId);
  assert.equal(detailCheck.closed,true);
  ok('route detail true placeId + shared B three-stage controller + media',detailCheck);
  // Verify the location that actually has saved image/video; a zero-media stop
  // cannot prove that the route detail has real Blob media wired correctly.
  const mediaStopIndex=checkRoute.ids.indexOf(first);
  assert.ok(mediaStopIndex>=0,'saved media location must be in route');
  await page.locator('#stopRail .stop-chip').nth(mediaStopIndex).click();
  await page.waitForFunction(id=>document.querySelector('#stopBubble')?.dataset.placeId===id,first,{timeout:9000});
  await page.locator('.rv-callout').click();
  await page.waitForFunction(id=>window.__atlasRouteDetailSheet?.state().selectedPlaceId===id&&document.querySelector('#rvDetail')?.classList.contains('open'),first,{timeout:9000});
  const realMedia=await page.evaluate(()=>{
    const d=document.querySelector('#rvDetail');
    return {photos:d.querySelectorAll('.rv-media .photos img').length,videos:d.querySelectorAll('.rv-media .photos video').length};
  });
  assert.ok(realMedia.photos>=1,'route detail must render saved photos of selected placeId');
  assert.ok(realMedia.videos>=1,'route detail must render saved videos of selected placeId');
  ok('route detail displays real persisted photo and video for the correct place ID',realMedia);
  await page.screenshot({path:path.join(out,'03-real-route-view.png'),fullPage:false});
  // A damaged archive must be rejected without destroying the three original saved places.
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.FootprintMediaCore,null,{timeout:12000});
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
