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
  // A real user must be able to reorder a station without opening a second
  // planner. Keyboard ArrowDown on the approved drag grip is the accessible
  // equivalent of the pointer gesture; the same state/order is persisted.
  await page.locator('#rc-order-list [data-drag="0"]').focus();
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(id=>window.__atlasRouteV5Live.state.order[0]?.id===id,ids[1]);
  await page.locator('#rc-order-list [data-drag="1"]').focus();
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(id=>window.__atlasRouteV5Live.state.order[0]?.id===id,ids[0]);
  // Move the last stop to D3, shorten the trip to two days, verify the
  // out-of-range D3 is clamped and the explicit undo restores BOTH date
  // range and its original D3 assignment.
  const initialRange=await page.evaluate(()=>window.__atlasRouteV5Live.state);
  await page.locator('#rc-order-list [data-rc^="mini-day-"]').last().click();
  await page.locator('#rc-mini-body [data-rc="day-set-3"]').click();
  await page.waitForFunction(()=>window.__atlasRouteV5Live.state.order[1].day===3);
  await page.locator('#rc-body [data-rc="mini-date"]').first().click();
  await page.locator('#rc-mini-body [data-rc="date-weekend"]').click();
  assert.equal((await page.evaluate(()=>window.__atlasRouteV5Live.state.start)),initialRange.start,
   'uncommitted date draft changed the actual itinerary');
  await page.locator('#rc-mini-bottom [data-rc="date-cancel"]').click();
  assert.equal((await page.evaluate(()=>window.__atlasRouteV5Live.state.end)),initialRange.end,
   'date cancel changed original end date');
  await page.locator('#rc-body [data-rc="mini-date"]').first().click();
  await page.locator('#rc-mini-body [data-rc="date-weekend"]').click();
  await page.locator('#rc-mini-bottom [data-rc="date-commit"]').click();
  await page.waitForFunction(()=>window.__atlasRouteV5Live.state.order[1].day===2);
  const shortened=await page.evaluate(()=>window.__atlasRouteV5Live.state);
  assert.notEqual(shortened.end,initialRange.end,'weekend shortcut failed to apply');
  await page.locator('#rc-body [data-rc="date-undo"]').click();
  const undone=await page.evaluate(()=>window.__atlasRouteV5Live.state);
  assert.deepEqual({start:undone.start,end:undone.end,d:undone.order[1].day},
    {start:initialRange.start,end:initialRange.end,d:3},
    'date undo failed to restore route day and dates');
  await page.locator('#rc-body [data-rc="mini-date"]').first().click();
  await page.locator('#rc-mini-body [data-rc="date-weekend"]').click();
  await page.locator('#rc-mini-bottom [data-rc="date-commit"]').click();
  await page.waitForFunction(()=>window.__atlasRouteV5Live.state.order[1].day===2);
  const committedDate=await page.evaluate(()=>window.__atlasRouteV5Live.state);
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
  assert.equal(route.startDate,committedDate.start);
  assert.equal(route.endDate,committedDate.end);
  assert.equal(route.stops[1].day,2,'clamped D2 itinerary was not persisted');
  await page.screenshot({path:path.join(OUT,'02-saved-route.png')});
  // Unstarring a real place MUST retain its saved C V5 route reference, its
  // Brief and media. This was previously lost by two starred-only read filters.
  await page.goto(url+'index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__atlasSetBookmarkStarred&&!!window.FootprintMediaCore?.createRepository,
    null,{timeout:26000});
  await page.evaluate(()=>window.__atlasSetBookmarkStarred('qa-real-route-A',false));
  const unstarred=await page.evaluate(async()=>{
    const p=await window.FootprintMediaCore.createRepository(indexedDB).read('qa-real-route-A');
    return {starred:p.starred,photoCount:p.photos?.length,videoCount:p.videos?.length};
  });
  assert.deepEqual(unstarred,{starred:false,photoCount:1,videoCount:1},
    'unstarring lost a real saved place or its local photo/video');
  // Route map is a READ-ONLY view of the sole C V5 itinerary. It must still
  // load real-place cards when both third-party map engine CDNs are blocked.
  // This exercises the actual failed-map route, not a JS stub that bypasses it.
  const mapCdnBlock=/https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com)\/.*maplibre-gl.*\.js(?:\\?|$)/;
  await page.route(mapCdnBlock,request=>request.abort('failed'));
  await page.goto(url+'route-view.html?saved='+encodeURIComponent(savedId),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.querySelectorAll('#stopRail .stop-chip').length===2,
    null,{timeout:16000});
  await page.waitForFunction(()=>document.querySelector('#routeBootRetry')?.hidden===false,
    null,{timeout:20000});
  await page.waitForSelector('#rvDetail',{state:'attached',timeout:15000});
  assert.equal(await page.locator('#saveRoute,#addStop,#saveRouteDialog,#addStopDialog').count(),0,
    'read-only route map still contains the second hidden planner');
  assert.equal(await page.locator('#routeEditV5').getAttribute('href'),
    './journey.html?saved='+encodeURIComponent(savedId),
    'route preview edit button must return to the ONE approved route planner');
  const unavailable=await page.evaluate(()=>({
    retryVisible:!!document.querySelector('#routeBootNotice:not([hidden]) #routeBootRetry:not([hidden])'),
    railCount:document.querySelectorAll('#stopRail .stop-chip').length,
    noMap:!window.__atlasMap
  }));
  assert.deepEqual(unavailable,{retryVisible:true,railCount:2,noMap:true},
    'map download failure covered valid place records');
  await page.locator('#stopRail .stop-chip').first().click();
  await page.waitForSelector('#rvDetail.open',{timeout:12000});
  const detail=await page.evaluate(()=>({
    title:document.querySelector('#rvDetail h2')?.textContent,
    brief:document.querySelector('#rvDetail .brief')?.textContent,
    photos:document.querySelectorAll('#rvDetail .photos img').length,
    destination:document.querySelector('#backToSource')?.getAttribute('href')
  }));
  assert.ok(detail.title==='回归地点甲'||detail.title==='回归地点乙',
    'route card did not open its actual saved place by ID');
  assert.match(detail.destination,/^\.\/index\.html\?openPlace=qa-real-route-[AB]$/,
    'route card has broken Saved Place deep link');
  await page.screenshot({path:path.join(OUT,'02a-map-offline-still-has-real-place.png')});
  // Its saved-place entry must actually open the home place card and retain
  // the Brief+photo; never point at an unserved directory-relative route.
  await page.locator('#rvDetail [data-op="src"]').click();
  await page.waitForURL(/\/index\.html\?openPlace=qa-real-route-[AB]/,{timeout:15000});
  await page.waitForSelector('#fpPlaceCard:not([hidden]) .fp-card-name',{timeout:20000});
  const homeLink=await page.evaluate(()=>({
    title:document.querySelector('#fpPlaceCard .fp-card-name')?.textContent,
    media:document.querySelectorAll('#fpPlaceCard .fp-media-mosaic img').length
  }));
  assert.equal(homeLink.title,detail.title,'route-to-place deep link opened a different record');
  await page.unroute(mapCdnBlock);
  await page.goto(url+'journey.html?saved='+encodeURIComponent(savedId),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.ready,null,{timeout:25000});
  const reopened=await page.evaluate(()=>window.__atlasRouteV5Live.state);
  assert.equal(reopened.savedId,savedId);
  assert.deepEqual(new Set(reopened.order.map(x=>x.id)),new Set(ids));
  assert.equal(reopened.order.length,2,'unstarring a route stop silently deleted it from C V5');
  // Reopening a saved route must let the user explicitly remove a stop even
  // if they cancelled its bookmark star after originally saving that route.
  await page.locator('#rc-body [data-rc="stage-select"]').click();
  await page.waitForFunction(()=>window.__atlasRouteV5Live.state.stage==='select');
  const shown=await page.locator('#rc-body [data-rc^="pick-"]').evaluateAll(nodes=>
    nodes.map(n=>({title:n.querySelector('.rc-name strong')?.textContent,
      selected:n.getAttribute('aria-pressed')==='true',placeId:n.dataset.placeId})));
  assert.equal(shown.length,2,'unstarred active stop disappeared from C V5 selection editor');
  const retained=shown.find(s=>s.title==='回归地点甲');
  assert.ok(retained?.selected,'unstarred route stop no longer editable '+JSON.stringify(shown));
  // The live, approved C V5 selection uses an entire .rc-stop-pick button,
  // aria-pressed + "selected", not the retired .rc-select.is-on/aria-label.
  const toggler=page.locator('#rc-body [data-place-id]').filter({hasText:'回归地点甲'});
  await toggler.click();
  assert.equal((await page.evaluate(()=>window.__atlasRouteV5Live.state.selected)).length,1,
    'user cannot intentionally remove the unstarred route stop');
  await toggler.click();
  assert.equal((await page.evaluate(()=>window.__atlasRouteV5Live.state.selected)).length,2,
    'user cannot restore the same saved route stop');
  await page.locator('#rc-footer [data-rc="stage-order"]').click();
  await page.waitForFunction(()=>window.__atlasRouteV5Live.state.stage==='order');
  assert.deepEqual({start:reopened.start,end:reopened.end,days:reopened.order.map(x=>x.day)},
   {start:committedDate.start,end:committedDate.end,days:committedDate.order.map(x=>x.day)},
   'reopened route dates, D labels or order differ from saved itinerary');
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
  // A duplicate pending map-point ID must abort the route and ALL new
  // points together. Reusing a saved place ID may NEVER overwrite its photos.
  const atomic=await page.evaluate(async()=>{
   const r=window.FootprintMediaCore.createRepository(indexedDB);
   const good={id:'qa-temporary-new-point',title:'新临时点',lat:31.25,lng:121.49,
     starred:false,routeOnly:true,photos:[],videos:[],guides:[]};
   const bad={id:'qa-real-route-A',title:'不应覆盖原点',lat:31.222,lng:121.463,
     starred:false,routeOnly:true,photos:[],videos:[]};
   const row={id:'qa-will-rollback',title:'原子失败测试',
     stops:[{placeId:good.id,day:1},{placeId:bad.id,day:1}]};
   let rejected=false;
   try{await r.saveRoute(row,{places:[good,bad]})}catch(e){rejected=true}
   const orphan=await r.read(good.id),original=await r.read(bad.id);
   const routes=await r.listRoutes();
   return {rejected,orphan:!!orphan,originalPhoto:original.photos?.length,
     incorrectlySaved:routes.some(x=>x.id===row.id)};
  });
  assert.deepEqual(atomic,{rejected:true,orphan:false,originalPhoto:1,incorrectlySaved:false},
   'route save/temporary points not atomic '+JSON.stringify(atomic));
  await page.reload({waitUntil:'domcontentloaded',timeout:55000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.ready,null,{timeout:26000});
  const after=await page.evaluate(async()=>{
   const r=window.FootprintMediaCore.createRepository(indexedDB);
   const p=await r.read('qa-real-route-A');
   return {photos:p.photos.length,videos:p.videos.length,routeId:window.__atlasRouteV5Live.state.savedId};
  });
  assert.deepEqual(after,{photos:1,videos:1,routeId:savedId});
  // Exercise the ACTUAL collection-backup controls (not only Media D API).
  // The original main-site ZIP belongs to this isolated user-data namespace.
  await page.goto(url+'index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__atlasDemo?.getSaved&&!!window.FootprintMediaCore?.createRepository,null,{timeout:30000});
  await page.locator('#dockStars').click({timeout:15000});
  await page.waitForSelector('#drawer.visible',{timeout:10000});
  await page.waitForFunction(()=>document.querySelector('#drawer .backuprow')?.hidden===false,null,{timeout:12000});
  const downloadEvent=page.waitForEvent('download',{timeout:20000});
  await page.locator('#exportBtn').click({timeout:15000});
  const downloaded=await downloadEvent;
  const zipPath=path.join(OUT,'05-user-export.zip');
  await downloaded.saveAs(zipPath);
  const zipBuffer=fs.readFileSync(zipPath);
  assert.ok(zipBuffer.length>100&&downloaded.suggestedFilename().endsWith('.zip'),
    'export control generated no valid local ZIP');
  const fromUi=await page.evaluate(async bytes=>{
    const snapshot=await window.FootprintMediaCore.readBackup(new Uint8Array(bytes));
    const first=snapshot.records.find(x=>x.id==='qa-real-route-A');
    const route=snapshot.routes.find(x=>x.title==='真实路线保存回归');
    return {photo:first?.photos?.length,video:first?.videos?.length,routeId:route?.id};
  },[...zipBuffer]);
  assert.deepEqual(fromUi,{photo:1,video:1,routeId:savedId},
    'export button ZIP lost media or route');
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#importFile').setInputFiles({
    name:'qa-restorable.zip',mimeType:'application/zip',buffer:zipBuffer
  });
  await page.waitForFunction(()=>document.getElementById('toast')?.textContent.includes('已完整恢复'),
    null,{timeout:16000});
  const uiImport=await page.evaluate(async()=>{
    const r=window.FootprintMediaCore.createRepository(indexedDB);
    const a=await r.read('qa-real-route-A'),routes=await r.listRoutes();
    return {photo:a?.photos?.length,video:a?.videos?.length,
      saved:routes.some(x=>x.title==='真实路线保存回归')};
  });
  assert.deepEqual(uiImport,{photo:1,video:1,saved:true},
    'import button altered existing media or route');
  // Deleting a referenced place is distinct from unstarring it. A still-saved
  // itinerary with a missing PlaceId MUST never be overwritten with fewer
  // stops by an ordinary "Save route" click. Show a persistent user warning.
  await page.evaluate(async()=>{
    const repo=window.FootprintMediaCore.createRepository(indexedDB);
    await repo.saveRoute({id:'qa-route-missing-reference',title:'缺失地点的路线',
      startDate:'2026-11-19',endDate:'2026-11-20',
      stops:[{placeId:'qa-real-route-A',day:1},
             {placeId:'qa-real-route-B',day:2},
             {placeId:'qa-no-longer-exists',day:2}]});
  });
  await page.goto(url+'journey.html?saved=qa-route-missing-reference',
    {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.ready,null,{timeout:26000});
  assert.deepEqual(await page.evaluate(()=>window.__atlasRouteV5Live.state.missingRouteIds),
    ['qa-no-longer-exists'],'missing saved PlaceId silently disappeared');
  await page.locator('#rc-footer [data-rc="stage-preview"]').click();
  await page.locator('#rc-footer [data-rc="mini-save"]').click();
  await page.locator('#rc-save-name').fill('不允许覆盖的路线');
  await page.locator('#rc-mini-bottom [data-rc="save-confirm"]').click();
  await page.waitForSelector('#rc-route-missing-warning',{state:'visible',timeout:12000});
  const preserved=await page.evaluate(async()=>{
    const list=await window.FootprintMediaCore.createRepository(indexedDB).listRoutes();
    const row=list.find(x=>x.id==='qa-route-missing-reference');
    return {title:row?.title,stops:row?.stops?.length,
      missingId:row?.stops?.some(x=>x.placeId==='qa-no-longer-exists')};
  });
  assert.deepEqual(preserved,{title:'缺失地点的路线',stops:3,missingId:true},
    'ordinary route save destroyed a missing but recoverable PlaceId reference');
  assert.deepEqual(errors.filter(x=>/TypeError|SyntaxError|ReferenceError/.test(x)),[],'runtime errors');
  const evidence={browserName,before,ordering,initialRange,shortened,undone,committedDate,savedId,reopened,backup,after,fromUi,uiImport,errors};
  fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify(evidence,null,2));
  console.log('PASS REAL V4 ROUTE SAVE + MEDIA BACKUP '+browserName+' '+JSON.stringify({savedId,backup,after}));
  await ctx.close();
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL REAL V4 SYSTEM '+browserName+' '+e.stack);process.exit(1)}).finally(()=>server.close());
