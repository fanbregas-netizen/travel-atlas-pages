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
   spring:d?.dataset.fpElasticState,translate:d?getComputedStyle(d).translate:null},
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
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:75000});
 await page.waitForSelector('#appDock',{timeout:30000});
 await page.waitForFunction(()=>!!window.__atlasCollectionSheet && !!window.__atlasDemo && !!window.__atlasSheetIntegration,null,{timeout:45000});
 diagnostics.start=await page.evaluate(()=>({
  ns:window.__atlasPreviewNamespace,owner:window.__atlasSheetIntegration?.version,
  styleLinks:document.querySelectorAll('link[rel=stylesheet]').length,
  inlineStyles:document.querySelectorAll('style').length,
  routeOwner:document.body.classList.contains('fp-single-route-owner')
 }));
 assert.equal(diagnostics.start.ns,'atlas-v4-review-20261116-','preview namespace differs');
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
 await page.mouse.move(x,y);await page.mouse.down();
 await page.mouse.move(x,y-115,{steps:14});const during=(await state(page)).drawer.height;
 await page.mouse.up();await pause(950);
 diagnostics.collectionDrag={before,during,after:(await state(page)).drawer.height};
 assert.ok(during>before+18,'B05 sheet did not follow upward drag: '+JSON.stringify(diagnostics.collectionDrag));
 // Closing must have nonzero visible travel rather than class-disappearing.
 await page.locator('#closeDrawer').click({timeout:15000});
 diagnostics.collectionExitFrames=await sample(page,17,30);
 await page.waitForFunction(()=>!document.getElementById('drawer')?.classList.contains('visible'),null,{timeout:5000});
 const exitValues=diagnostics.collectionExitFrames.map(q=>parseFloat(q.drawer.translate?.split(' ')[1]||0)).filter(Number.isFinite);
 assert.ok(Math.max(...exitValues)>40,'collection close had no composited travel '+JSON.stringify(exitValues));
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
 await page.locator('#destinationClose').click({timeout:10000});
 // Search must stay usable as an anchored real result sheet.
 await page.locator('#dockSearch').click({timeout:14000});
 await page.waitForFunction(()=>document.body.classList.contains('fp-search-open'),null,{timeout:10000});
 diagnostics.searchOpen=await state(page);
 assert.equal(diagnostics.searchOpen.search.anchored,'anchored');
 await page.screenshot({path:path.join(OUT,'05-search.png')});
 await page.locator('#fpSearchSheet .fp-search-close').click({timeout:12000});
 await page.waitForFunction(()=>!document.body.classList.contains('fp-search-open'),null,{timeout:9000});
 // Real business action: save an ordinary POI, then open its physical detail.
 await page.evaluate(({lat,lng})=>window.__atlasDemo.select('测试收藏地点',lat+0.0002,lng+0.0002),map);
 await page.waitForFunction(()=>document.querySelector('#destinationCard.visible #destinationTitle')?.textContent==='测试收藏地点',null,{timeout:10000});
 await page.locator('#destinationStar').click({timeout:14000});
 await page.locator('#placeName').fill('测试收藏地点',{timeout:10000});
 await page.locator('#savePlace').click({timeout:15000});
 await page.waitForFunction(()=>window.__atlasDemo.getSaved().some(x=>x.title==='测试收藏地点'),null,{timeout:16000});
 const id=await page.evaluate(()=>window.__atlasDemo.getSaved().find(x=>x.title==='测试收藏地点').id);
 await page.evaluate(id=>window.__atlasDemo.openSaved(id),id);
 await page.waitForFunction(()=>{const p=document.getElementById('fpPlaceCard');return p&&!p.hidden&&p.querySelector('.fp-card-name')?.textContent==='测试收藏地点'},null,{timeout:15000});
 await pause(850);
 diagnostics.place=await state(page);
 await page.screenshot({path:path.join(OUT,'06-place-detail.png')});
 assert.ok(diagnostics.place.detail.height>175,'real place detail invisible');
 const cardLayout=await page.evaluate(()=>{
  const p=document.getElementById('fpPlaceCard'),header=p.querySelector('.fp-card-header'),
    scroll=p.querySelector('.fp-card-scroll'),r=p.getBoundingClientRect(),h=header.getBoundingClientRect(),s=scroll.getBoundingClientRect();
  return {card:r.height,header:h.height,scroll:s.height,scrollHeight:scroll.scrollHeight,overflow:getComputedStyle(scroll).overflowY};
 });
 diagnostics.placeLayout=cardLayout;
 assert.ok(cardLayout.scroll.height>30&&cardLayout.overflow==='auto','detail half-sheet content clipped '+JSON.stringify(cardLayout));
 await page.locator('#fpPlaceCard .fp-card-close').click({timeout:12000});
 await page.waitForFunction(()=>document.getElementById('fpPlaceCard')?.hidden,null,{timeout:9000});
 // Route entry must still exist; do not install a second routing system.
 assert.ok(await page.locator('#dockRoute').count(),'approved C V5 route Dock missing');
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
