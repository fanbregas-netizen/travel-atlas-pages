'use strict';
/* Tests exactly the current v4-review-20261116 real product without touching
 * public GitHub Pages. All storage is preview-namespaced in the app itself.
 * This is browser-level evidence, not a simulated formula-only spring test. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const { chromium,webkit }=require('playwright');
const which=process.env.BROWSER||'webkit';
const ROOT=path.resolve(__dirname,'..'), OUT=path.resolve('v4-clean-ui-evidence',which);
fs.mkdirSync(OUT,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const u=decodeURIComponent((req.url||'/').split('?')[0]);
 const file=path.resolve(ROOT,u.replace(/^\/travel-atlas-pages\//,'').replace(/^\//,''));
 if(!file.startsWith(ROOT+path.sep)){res.writeHead(403).end();return}
 fs.readFile(file,(err,bytes)=>{
  if(err){res.writeHead(404).end();return}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.writeHead(200).end(bytes);
 });
});
const pause=n=>new Promise(r=>setTimeout(r,n));
const state=async page=>page.evaluate(()=>{
 const e=document.querySelector('#drawer'),d=document.querySelector('#destinationCard'),
   p=document.querySelector('#fpPlaceCard'),s=document.querySelector('#fpSearchSheet');
 const rect=(n)=>{const r=n?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,height:r.height}:null};
 return {
  drawer: {visible:!!e?.classList.contains('visible'),phase:window.__atlasCollectionSheet?.getState()?.phase,
   height:rect(e)?.height,translate:e?getComputedStyle(e).translate:null,header:rect(e?.querySelector('.drawer-head')),
   list:rect(document.querySelector('#spotList'))},
  poi: {visible:!!d?.classList.contains('visible'),title:document.querySelector('#destinationTitle')?.textContent,
   spring:d?.dataset.fpElasticState,translate:d?getComputedStyle(d).translate:null,
   actionOpacity:d?Number(getComputedStyle(d.querySelector('.destination-actions')).opacity):null,
   uniformScale:d?getComputedStyle(d).scale:null},
  detail: {visible:!!p&&!p.hidden,snap:window.__atlasSheetIntegration?.card?.getState()?.sheet,
   height:rect(p)?.height,title:p?.querySelector('.fp-card-name')?.textContent},
  search: {visible:!!s&&!s.hidden,anchored:s?.dataset.searchLayout,open:document.body.classList.contains('fp-search-open')}
 }
});
const sample=async(page,n=18,step=27)=>{const result=[];for(let i=0;i<n;i++){result.push(await state(page));await pause(step)}return result};
(async()=>{
 await new Promise(resolve=>server.listen(8765,'127.0.0.1',resolve));
 const browser=await ({chromium,webkit})[which].launch({headless:true,...(which==='chromium'?{args:['--no-sandbox']}:{})});
 const ctx=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,serviceWorkers:'block',
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1'
 });
 const page=await ctx.newPage(),errors=[],diagnostics={browser:which};
 page.setDefaultTimeout(16000);
 page.on('pageerror',e=>errors.push(String(e.stack||e)));
 const origin='http://127.0.0.1:8765/travel-atlas-pages/v4-review-20261116/';
 const response=await page.goto(origin+'index.html',{waitUntil:'domcontentloaded',timeout:75000});
 assert.equal(response?.status(),200,'candidate local page failed to serve: '+response?.status());
 await page.waitForSelector('#appDock',{timeout:30000});
 await page.waitForFunction(()=>!!window.__atlasCollectionSheet && !!window.__atlasDemo && !!window.__atlasSheetIntegration,null,{timeout:45000});
 diagnostics.start=await page.evaluate(()=>({
  ns:window.__atlasPreviewNamespace,owner:window.__atlasSheetIntegration?.version,
  styleLinks:document.querySelectorAll('link[rel=stylesheet]').length,
  inlineStyles:document.querySelectorAll('style').length,
  routeOwner:document.body.classList.contains('fp-single-route-owner'),
  retiredPickerDom:document.querySelectorAll('#tpBar,#routeBarPop,#favTray,#drawerSaveBox').length,
  oldPickerAPI:typeof window.__atlasTripPicker
 }));
 assert.equal(diagnostics.start.ns,'atlas-v4-review-20261116-','preview namespace differs');
 assert.equal(diagnostics.start.retiredPickerDom,0,'old route-picker still renders hidden controls');
 assert.equal(diagnostics.start.oldPickerAPI,'undefined','old route controller still active');
 await page.screenshot({path:path.join(OUT,'01-home.png')});
 // Collection must animate the real #drawer and not leave an old second heading.
 await page.locator('#dockStars').click({timeout:15000});
 await page.waitForFunction(()=>document.getElementById('drawer')?.classList.contains('visible'),null,{timeout:12000});
 diagnostics.collectionOpenFrames=await sample(page,18,27);
 await page.screenshot({path:path.join(OUT,'02-collection.png')});
 diagnostics.collection=await page.evaluate(()=>{
  const drawer=document.getElementById('drawer'),tabs=document.getElementById('fpvCollectionTabs'),
   extra=document.getElementById('fp30DetailHead'),list=document.getElementById('spotList');
  const hidden=n=>!n||n.hidden||getComputedStyle(n).display==='none';
  const header=drawer.querySelector('.drawer-head'),h=header.getBoundingClientRect(),l=list.getBoundingClientRect();
  return {visible:drawer.classList.contains('visible'),className:drawer.className,
    tabsHidden:hidden(tabs),repeatTitleHidden:hidden(extra),gap:l.top-h.bottom,
    physical:window.__atlasCollectionSheet?.getState(),grip:!!header.querySelector('.sheet-grab')};
 });
 assert.equal(diagnostics.collection.visible,true);
 if(diagnostics.start.routeOwner){
  assert.equal(diagnostics.collection.tabsHidden,true,'single-route collection still reserves segmented bar');
  assert.equal(diagnostics.collection.repeatTitleHidden,true,'second collection heading still reserves space');
  assert.ok(diagnostics.collection.gap<55,'collection still has a large dead gap: '+diagnostics.collection.gap);
 }
 // Drag one actual sheet by the header: the height must follow the gesture.
 const grab=await page.locator('#drawer .drawer-head .sheet-grab').boundingBox();
 assert.ok(grab,'collection grip unavailable');
 const x=grab.x+grab.width/2,y=grab.y+grab.height/2;
 const before=(await state(page)).drawer.height;
 // Real mouse drags in Chromium and true DOM TouchEvent fallback in
 // WebKit. Headless WebKit's page.mouse does not emit intermediate
 // pointermove when isMobile+hasTouch, even though it dispatches pointerup.
 // Explicit touch events exercise the iPhone path that B05 actually handles.
 const useNativeTouchPath=which==='webkit';
 const touchEvent=async(type,cx,cy,selector='#drawer .drawer-head')=>page.evaluate(({type,cx,cy,selector})=>{
  const header=document.querySelector(selector);
  // Headless WebKit disallows constructing Touch/TouchEvent (Illegal
  // constructor), despite real iPhone Safari delivering them normally.
  // Model the same public TouchEvent fields on a cancelable DOM event.
  const touch={identifier:77,target:header,clientX:cx,clientY:cy,screenX:cx,screenY:cy,pageX:cx,pageY:cy};
  const ended=type==='touchend',ev=new Event(type,{bubbles:true,cancelable:true});
  Object.defineProperties(ev,{
   touches:{value:ended?[]:[touch]},targetTouches:{value:ended?[]:[touch]},
   changedTouches:{value:[touch]}
  });
  header.dispatchEvent(ev);
  return {defaultPrevented:ev.defaultPrevented,driver:'touch'};
 },{type,cx,cy,selector});
 if(useNativeTouchPath)await touchEvent('touchstart',x,y);
 else{await page.mouse.move(x,y);await page.mouse.down()}
 for(let i=1;i<=12;i++){
  const py=y-115*i/12;
  if(useNativeTouchPath)await touchEvent('touchmove',x,py);
  else await page.mouse.move(x,py);
  await pause(19);
 }
 await pause(45);
 const duringState=await state(page),during=duringState.drawer.height;
 const livePhysics=await page.evaluate(()=>window.__atlasCollectionSheet.getState());
 if(useNativeTouchPath)await touchEvent('touchend',x,y-115);
 else await page.mouse.up();
 await pause(950);
 diagnostics.collectionDrag={before,during,live:duringState.drawer,physics:livePhysics,driver:useNativeTouchPath?'dom-touch':'mouse-pointer',after:(await state(page)).drawer.height};
 console.log('V4_DRAG_DEBUG '+which+' '+JSON.stringify(diagnostics.collectionDrag));
 assert.ok(during>before+18,'B05 sheet did not follow upward drag: '+JSON.stringify(diagnostics.collectionDrag));
 // Closing must have nonzero visible travel rather than class-disappearing.
 await page.locator('#closeDrawer').click({timeout:15000});
 diagnostics.collectionExitFrames=await sample(page,17,30);
 await page.waitForFunction(()=>!document.getElementById('drawer')?.classList.contains('visible'),null,{timeout:5000});
 const exitValues=diagnostics.collectionExitFrames.map(q=>q.drawer.header?.top).filter(Number.isFinite);
 const uniquePositions=new Set(exitValues.map(x=>Math.round(x/5)*5));
 assert.ok(Math.max(...exitValues)-Math.min(...exitValues)>40&&uniquePositions.size>=3,
  'collection close had no multi-frame composited travel '+JSON.stringify(exitValues));
 await page.screenshot({path:path.join(OUT,'03-collection-closed.png')});
 // Real destination card: consecutive POI must hand off old and new content.
 const map=await page.evaluate(()=>window.__atlasCameraQA?.()||{lat:31.23,lng:121.47});
 await page.evaluate(({lat,lng})=>window.__atlasDemo.select('测试地点甲',lat+0.0001,lng+0.0001),map);
 await page.waitForFunction(()=>document.querySelector('#destinationCard.visible #destinationTitle')?.textContent==='测试地点甲',null,{timeout:10000});
 await pause(950);
 await page.evaluate(({lat,lng})=>window.__atlasDemo.select('测试地点乙',lat+0.0003,lng+0.0003),map);
 diagnostics.poiSwitchFrames=await sample(page,28,22);
 await page.screenshot({path:path.join(OUT,'04-poi-handoff.png')});
 await page.waitForFunction(()=>document.querySelector('#destinationCard.visible #destinationTitle')?.textContent==='测试地点乙',null,{timeout:6000});
 const titles=diagnostics.poiSwitchFrames.map(q=>q.poi.title);
 const offsets=diagnostics.poiSwitchFrames.map(q=>parseFloat(q.poi.translate?.split(' ')[1]||0)).filter(Number.isFinite);
 assert.ok(titles.includes('测试地点甲')&&titles.includes('测试地点乙'),'POI swaps title without visual handoff '+JSON.stringify(titles));
 assert.ok(Math.max(...offsets)>15,'POI sheet did not sink/rebound '+JSON.stringify(offsets));
 const actionOpacity=diagnostics.poiSwitchFrames.map(q=>q.poi.actionOpacity).filter(Number.isFinite);
 assert.ok(Math.min(...actionOpacity)<.45,'POI action labels flashed during card text handoff '+JSON.stringify(actionOpacity));
 // Interrupt an unfinished handoff with another POI; only the final
 // selection may commit, and the outgoing motion must not leave a
 // stretched/inert card or stale action labels behind.
 await page.evaluate(({lat,lng})=>window.__atlasDemo.select('快速切点丙',lat+.0004,lng+.0004),map);
 await pause(92);
 diagnostics.poiBeforeRapid=await state(page);
 await page.evaluate(({lat,lng})=>window.__atlasDemo.select('快速切点丁',lat+.0005,lng+.0005),map);
 diagnostics.poiRapidFrames=await sample(page,28,22);
 await page.waitForFunction(()=>document.querySelector('#destinationTitle')?.textContent==='快速切点丁',null,{timeout:7000});
 await pause(900);
 diagnostics.poiAfterRapid=await state(page);
 assert.equal(diagnostics.poiAfterRapid.poi.title,'快速切点丁');
 assert.equal(diagnostics.poiAfterRapid.poi.spring,'idle','interrupted POI spring did not release ownership');
 assert.equal(await page.locator('#destinationCard').evaluate(el=>el.inert),false,'POI card stayed inert after rapid selections');
 assert.ok(diagnostics.poiRapidFrames.every(q=>Number.isFinite(q.poi.actionOpacity)),'POI fading produced invalid opacity');
 await page.locator('#destinationClose').click({timeout:10000});
 // Search history must really render and animate (an empty search deliberately
 // leaves the anchored dropdown hidden, so it is not a valid spring probe).
 await page.evaluate(()=>localStorage.setItem('fp-search-history-v1',
  JSON.stringify([{q:'上海',name:'上海'}])));
 await page.locator('#dockSearch').click({timeout:14000});
 await page.waitForFunction(()=>document.body.classList.contains('fp-search-open'),null,{timeout:10000});
 diagnostics.searchOpen=await state(page);
 assert.equal(diagnostics.searchOpen.search.anchored,'anchored');
 await page.waitForSelector('#fpSearchSheet:not([hidden]) .fp-search-row',{timeout:8500});
 const ghost=await page.evaluate(()=>getComputedStyle(document.getElementById('destinationCard')).visibility);
 assert.equal(ghost,'hidden','old POI still visible through foreground search');
 await pause(1000);
 diagnostics.searchHistory=await page.evaluate(()=>{
  const e=document.getElementById('fpSearchSheet');
  return {rows:e.querySelectorAll('.fp-search-row').length,
   settled:e.dataset.fpElasticHistorySettled,peak:Number(e.dataset.fpElasticHistoryPeak||0),
   scale:e.style.scale,visible:!e.hidden};
 });
 assert.ok(diagnostics.searchHistory.visible&&diagnostics.searchHistory.rows>0,'actual search-history dropdown not shown');
 assert.ok(diagnostics.searchHistory.peak>1.01&&diagnostics.searchHistory.settled==='1',
  'search history C V5 spring did not rebound and settle '+JSON.stringify(diagnostics.searchHistory));
 await page.screenshot({path:path.join(OUT,'05-search.png')});
 // Anchored search moves the functional "取消" control into the real top portal;
 // the legacy nested header X is intentionally hidden by the accepted layout.
 await page.locator('#fpSearchActiveTop .fp-search-cancel').click({timeout:12000});
 await page.waitForFunction(()=>!document.body.classList.contains('fp-search-open'),null,{timeout:9000});
 // Real business action: save an ordinary POI, then open its physical detail.
 await page.evaluate(({lat,lng})=>window.__atlasDemo.select('测试收藏地点',lat+0.0002,lng+0.0002),map);
 await page.waitForFunction(()=>document.querySelector('#destinationCard.visible #destinationTitle')?.textContent==='测试收藏地点',null,{timeout:10000});
 // Test actual local image ingestion and IndexedDB association, not only
 // the map star/Brief. The screenshot is created in this disposable browser,
 // never borrowed from user media or the formal site.
 const localPhoto=await page.screenshot({type:'png'});
 await page.locator('#destinationStar').click({timeout:14000});
 await page.locator('#placeName').fill('测试收藏地点',{timeout:10000});
 await page.locator('#photoUpload').setInputFiles({
  name:'qa-memory.png',mimeType:'image/png',buffer:localPhoto
 });
 await page.waitForFunction(()=>document.querySelectorAll('#editPhotos .photo-thumb').length>0,null,{timeout:18000});
 await page.locator('#savePlace').click({timeout:15000});
 await page.waitForFunction(()=>window.__atlasDemo.getSaved().some(x=>x.title==='测试收藏地点'),null,{timeout:16000});
 const id=await page.evaluate(()=>window.__atlasDemo.getSaved().find(x=>x.title==='测试收藏地点').id);
 await page.evaluate(id=>window.__atlasDemo.openSaved(id),id);
 await page.waitForFunction(()=>{const p=document.getElementById('fpPlaceCard');return p&&!p.hidden&&p.querySelector('.fp-card-name')?.textContent==='测试收藏地点'},null,{timeout:15000});
 await pause(850);
 // The first peek is intentionally 270px. Explicitly test the approved
 // half-sheet state that must expose real Brief/Media/Guide scrolling.
 await page.evaluate(()=>window.__atlasSheetIntegration.card.snapTo('half'));
 await pause(900);
 diagnostics.place=await state(page);
 await page.screenshot({path:path.join(OUT,'06-place-detail.png')});
 assert.ok(diagnostics.place.detail.height>175,'real place detail invisible');
 await page.waitForSelector('#fpPlaceCard .fp-media-mosaic img',{timeout:15000});
 const actualMedia=await page.locator('#fpPlaceCard .fp-media-mosaic img').count();
 assert.ok(actualMedia>=1,'saved photo not restored inside the real place card');
 await page.locator('#fpPlaceCard .fp-media-mosaic button').first().click({timeout:10000});
 await page.waitForSelector('#fpMediaViewer',{state:'visible',timeout:10000});
 diagnostics.media={photoTiles:actualMedia,viewerOpened:true};
 await page.locator('#fpMediaViewer .fp-viewer-close').click({timeout:10000});
 await page.waitForFunction(()=>!document.getElementById('fpMediaViewer'),null,{timeout:10000});
 const cardLayout=await page.evaluate(()=>{
  const p=document.getElementById('fpPlaceCard'),header=p.querySelector('.fp-card-header'),
    scroll=p.querySelector('.fp-card-scroll'),r=p.getBoundingClientRect(),h=header.getBoundingClientRect(),s=scroll.getBoundingClientRect();
  const grip=p.querySelector('.atlas-card-grip')?.getBoundingClientRect();
  const title=p.querySelector('.fp-card-name')?.getBoundingClientRect();
  return {card:r.height,header:h.height,scroll:s.height,scrollHeight:scroll.scrollHeight,
    overflow:getComputedStyle(scroll).overflowY,gripTop:grip?.top,titleTop:title?.top};
 });
 diagnostics.placeLayout=cardLayout;
 assert.ok(cardLayout.card>400&&cardLayout.scroll>120&&cardLayout.overflow==='auto','detail half-sheet content clipped '+JSON.stringify(cardLayout));
 assert.ok(cardLayout.titleTop-cardLayout.gripTop>27,'visible grip overlaps the Chinese place title: '+JSON.stringify(cardLayout));
 await page.locator('#fpPlaceCard .fp-card-close').click({timeout:12000});
 await page.waitForFunction(()=>document.getElementById('fpPlaceCard')?.hidden,null,{timeout:9000});
 // The saved collection must work with REAL populated place rows, not only
 // the empty-state header. Test vertical drag from inside an interactive row.
 await page.locator('#dockStars').click({timeout:14000});
 await page.waitForSelector('#drawer.visible #spotList .spotrow',{timeout:14000});
 await pause(800);
 const row=page.locator('#spotList .spotrow').first();
 assert.ok((await row.innerText()).includes('测试收藏地点'),'saved place missing from collection list');
 await page.screenshot({path:path.join(OUT,'06b-collection-saved.png')});
 const rb=await row.boundingBox();
 const rowX=rb.x+Math.min(30,rb.width/3),rowY=rb.y+rb.height/2;
 const rowBefore=(await state(page)).drawer.height;
 await touchEvent('touchstart',rowX,rowY,'#spotList .spotrow');
 for(let i=1;i<=10;i++){
  await touchEvent('touchmove',rowX,rowY-i*10,'#spotList .spotrow');
  await pause(20);
 }
 const rowDuring=(await state(page)).drawer.height;
 await touchEvent('touchend',rowX,rowY-100,'#spotList .spotrow');
 diagnostics.collectionSavedRowDrag={before:rowBefore,during:rowDuring};
 assert.ok(rowDuring>rowBefore+15,
  'saved place row did not hand vertical touch to B05 sheet '+JSON.stringify(diagnostics.collectionSavedRowDrag));
 await pause(650);
 await page.locator('#closeDrawer').click({timeout:14000});
 await page.waitForFunction(()=>!document.getElementById('drawer')?.classList.contains('visible'),null,{timeout:9000});
 // Refresh is the real IndexedDB/media persistence contract. If the same
 // collection/detail+photo does not survive reload, passing the initial
 // editor save is not a valid integration success.
 await page.reload({waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__atlasDemo?.getSaved?.().some(x=>x.title==='测试收藏地点'),null,{timeout:25000});
 const restored=await page.evaluate(()=>window.__atlasDemo.getSaved().find(x=>x.title==='测试收藏地点'));
 const restoredMetadata={id:restored?.id,photosArray:restored?.photos?.length||0,
   keys:restored?Object.keys(restored).slice(0,18):[]};
 console.log('V4_RELOAD_METADATA '+which+' '+JSON.stringify(restoredMetadata));
 await page.evaluate(id=>window.__atlasDemo.openSaved(id),restored.id);
 try{await page.waitForSelector('#fpPlaceCard .fp-media-mosaic img',{timeout:15000})}
 catch(error){
  const ui=await page.evaluate(()=>({
   placeVisible:!document.getElementById('fpPlaceCard')?.hidden,
   mediaLabel:document.getElementById('fpPlaceCard')?.querySelector('.fp-media-empty')?.innerText,
   mediaCount:document.getElementById('fpPlaceCard')?.querySelector('.fp-photo-count')?.innerText,
   mediaTiles:document.querySelectorAll('#fpPlaceCard .fp-media-mosaic img').length
  }));
  throw new Error('saved photo not rendered after reload: '+JSON.stringify({restoredMetadata,ui}));
 }
 diagnostics.persistence={savedId:restored.id,photos:restored.photos?.length||0,afterReload:true,rendered:true};
 await page.screenshot({path:path.join(OUT,'06c-reloaded-photo.png')});
 await page.locator('#fpPlaceCard .fp-card-close').click({timeout:15000});
 await page.waitForFunction(()=>document.getElementById('fpPlaceCard')?.hidden,null,{timeout:12000});
 // The only route entry must hand off to the actual C V5 route page; verify
 // existing controls, real route state and spring motor on 375/390/430px.
 assert.ok(await page.locator('#dockRoute').count(),'approved C V5 route Dock missing');
 await page.locator('#dockRoute').click({timeout:15000});
 await page.waitForURL(/\/journey\.html/,{timeout:20000});
 await page.waitForSelector('#rc-main',{timeout:18000});
 await page.waitForFunction(()=>!!window.__atlasRouteV5Live?.ready,null,{timeout:18000});
 const readyCardHeight=await page.evaluate(()=>document.querySelector('#rc-main')?.getBoundingClientRect().height||0);
 assert.ok(readyCardHeight>=280,
  'C V5 startup announced ready before its real card was fully mounted '+readyCardHeight);
 diagnostics.route=await page.evaluate(()=>({
  owner:window.__atlasRouteV5Live?.originalV5Sha,
  ready:window.__atlasRouteV5Live?.ready,
  sharedMotor:window.FootprintV5Spring?.version,
  routeSheets:document.querySelectorAll('#rc-main').length,
  oldPlanner:document.querySelectorAll('#tpBar').length,
  stage:window.__atlasRouteV5Live?.state?.stage
 }));
 assert.ok(diagnostics.route.ready&&diagnostics.route.sharedMotor&&
  diagnostics.route.routeSheets===1&&diagnostics.route.oldPlanner===0,
  'C V5 route not sole active owner '+JSON.stringify(diagnostics.route));
 const routeWidths=[];
 for(const width of [375,390,430]){
  await page.setViewportSize({width,height:844});
  await pause(330);
  const layout=await page.evaluate(()=>{
   const card=document.querySelector('#rc-main'),h=card.getBoundingClientRect();
   const e=document.querySelector('#rc-title'),t=e?.getBoundingClientRect();
   return {innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,
    card:h.height,title:e?.textContent,titleWidth:t?.width,cardWidth:h.width};
  });
  routeWidths.push(layout);
  assert.ok(layout.overflow<6&&layout.card>100&&layout.cardWidth<=width+2,
   'route responsive overflow or missing sheet '+JSON.stringify(layout));
  await page.screenshot({path:path.join(OUT,'07-route-'+width+'.png')});
 }
 diagnostics.routeWidths=routeWidths;
 const fatal=errors.filter(e=>/TypeError|ReferenceError|SyntaxError|Uncaught/.test(e));
 diagnostics.errors=errors.slice(0,15);
 assert.deepEqual(fatal,[],'uncaught product runtime errors: '+JSON.stringify(fatal));
 fs.writeFileSync(path.join(OUT,'evidence.json'),JSON.stringify(diagnostics,null,2));
 console.log('PASS V4 CLEAN UI REAL BROWSER '+which+' '+JSON.stringify({collection:diagnostics.collection,drag:diagnostics.collectionDrag,poiOffsets:Math.max(...offsets),place:cardLayout,errors:fatal}));
 await browser.close();
})().catch(e=>{
 console.error('FAIL V4 CLEAN UI '+which+' '+e.stack);
 // A failed assertion must not leave WebKit/Chromium children alive for the
 // full 18-minute job timeout. The upload step still runs with if:always().
 process.exit(1);
}).finally(()=>{server.close()});
