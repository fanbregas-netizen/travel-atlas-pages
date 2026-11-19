'use strict';
/* Actual V5 PR53 published sheet JS/CSS in Chromium iPhone viewports.
 * Injects a deterministic map API stub to isolate card gesture/camera behavior
 * from third-party map tile/CDN availability. NOT a full real-map Safari QA.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const {chromium}=require('playwright-core');
const chrome=['google-chrome','google-chrome-stable','chromium'].map(n=>{try{return cp.execFileSync('which',[n],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!chrome)throw Error('Chromium not available');
const base='https://fanbregas-netizen.github.io/travel-atlas-pages/v5-pr53-one-map-20261119/';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 const evidence='v5-pr53-card-gesture-evidence';fs.mkdirSync(evidence,{recursive:true});
 try{
  for(const width of [375,390,430]){
   const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const jsRes=await page.request.get(base+'src/route/route-single-map-v1.js?v=route-swipe-2');
   const cssRes=await page.request.get(base+'src/visual/v5-single-map-route.css?v=route-swipe-2');
   assert.equal(jsRes.status(),200,'route JS asset must be live');
   assert.equal(cssRes.status(),200,'route CSS asset must be live');
   const script=await jsRes.text(),style=await cssRes.text();
   assert.ok(script.includes('beginSheetGesture')&&script.includes('queueRouteCamera'),'new real gesture/camera source missing');
   await page.setContent('<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>.map-controls{position:fixed;right:12px;bottom:124px;display:flex;flex-direction:column;gap:9px}.map-controls button{width:48px;height:48px}</style></head><body style="margin:0;background:#729185"><div id="atlasBookmarkOverlay"></div><div id="atlasVectorMap"></div><div class="map-controls"><button aria-label="定位">⌖</button><button aria-label="放大">＋</button><button aria-label="缩小">－</button></div></body></html>');
   await page.addStyleTag({content:style});
   await page.evaluate(()=>{
    window.__qaCameraCalls=[];
    const recorder=(type,padding)=>window.__qaCameraCalls.push({type,padding:padding?{...padding}:null,t:performance.now()});
    const map={
     on(){},off(){},getStyle(){return {layers:[]}},isStyleLoaded(){return false},
     getZoom(){return 13},getLayer(){return null},getSource(){return null},
     easeTo(opts){recorder('easeTo',opts.padding)},fitBounds(_bounds,opts){recorder('fitBounds',opts.padding)},
     removeLayer(){},removeSource(){}
    };
    window.__atlasPOIBridge={vector:()=>map};
    window.FootprintMediaCore={createRepository:()=>({
     list:async()=>[
      {id:'qa-a',lat:31.240,lng:121.452,title:'长寿路',starred:true},
      {id:'qa-b',lat:31.236,lng:121.463,title:'静安公园',starred:true}],
     listRoutes:async()=>[],saveRoute:async()=>{}
    })};
   });
   await page.addScriptTag({content:script});
   const toolsRest=await page.locator('.map-controls').boundingBox();
   await page.evaluate(()=>window.FootprintUnifiedRoute.open());
   await page.waitForTimeout(720);
   assert.equal(await page.evaluate(()=>window.FootprintUnifiedRoute.state.step),'saved');
   assert.equal(await page.locator('#fpUnifiedRoute .fp-route-top').count(),0,'no redundant route nav above map');
   const savedPeek=await page.locator('#fpUnifiedRoute .fp-route-sheet').boundingBox();
   assert.ok(savedPeek.x>=11&&Math.abs((width-savedPeek.width-savedPeek.x)-savedPeek.x)<2,'both sides of route card must match place card');
   const toolsAtSaved=await page.locator('.map-controls').boundingBox();
   assert.ok(toolsAtSaved.y+toolsAtSaved.height<savedPeek.y-7,'all 3 right map tools must clear saved-route card');
   await page.locator('#fpUnifiedRoute [data-command="new"]').first().click();
   await page.waitForTimeout(680);
   assert.equal(await page.evaluate(()=>window.FootprintUnifiedRoute.state.step),'pick');
   const pickPeek=await page.locator('#fpUnifiedRoute .fp-route-sheet').boundingBox();
   assert.ok(Math.abs(pickPeek.height-savedPeek.height)<2,'saved list and initial planning must open at SAME height');
   const toolsAtPick=await page.locator('.map-controls').boundingBox();
   assert.ok(toolsAtPick.y+toolsAtPick.height<pickPeek.y-7,'map controls overlap the initial picking card');
   const titleStyle=await page.locator('#fpUnifiedRoute .fp-route-heading h2').evaluate(e=>getComputedStyle(e).fontSize);
   assert.equal(titleStyle,'24px','route title must match approved Changshou card');
   const xStyle=await page.locator('#fpUnifiedRoute .fp-route-close').evaluate(e=>({border:getComputedStyle(e).borderTopWidth,bg:getComputedStyle(e).backgroundColor}));
   assert.equal(xStyle.border,'0px','route X must be unboxed like place card');
   const toggles=page.locator('#fpUnifiedRoute [data-command="toggle"]');
   await toggles.nth(0).click();await page.waitForTimeout(480);
   await toggles.nth(1).click();await page.waitForTimeout(630);
   let initial=await page.locator('#fpUnifiedRoute .fp-route-sheet').boundingBox();
   const padsBefore=await page.evaluate(()=>window.__qaCameraCalls.filter(x=>x.padding).map(x=>x.padding.bottom));
   const header=await page.locator('#fpUnifiedRoute .fp-route-heading').boundingBox();
   const cx=header.x+Math.min(header.width*.42,165),startY=header.y+header.height*.48;
   await page.mouse.move(cx,startY);await page.mouse.down();
   for(let n=1;n<=17;n++){await page.mouse.move(cx,startY-n*14);await page.waitForTimeout(13)}
   await page.mouse.up();await page.waitForTimeout(760);
   const expanded=await page.locator('#fpUnifiedRoute .fp-route-sheet').boundingBox();
   assert.ok(expanded.height>initial.height+65,'header swipe should expand the route sheet by at least 65px');
   const toolsAtFull=await page.locator('.map-controls').boundingBox();
   assert.ok(toolsAtFull.y+toolsAtFull.height<expanded.y-7,'tools must avoid fully expanded route sheet');
   const actual=await page.evaluate(()=>window.FootprintUnifiedRoute.state);
   assert.equal(actual.open,true);
   const padsAfter=await page.evaluate(()=>window.__qaCameraCalls.filter(x=>x.padding).map(x=>x.padding.bottom));
   assert.ok(padsAfter.length>padsBefore.length,'map camera should update when the card expands');
   assert.ok(Math.max(...padsAfter)>Math.max(...padsBefore)+45,'map bottom padding should follow the card height');
   await page.screenshot({path:evidence+'/'+width+'-expanded.png'});
   // Drag title DOWN again; card should yield the map and keep in one overlay.
   const head2=await page.locator('#fpUnifiedRoute .fp-route-heading').boundingBox();
   const y2=head2.y+head2.height*.5;
   await page.mouse.move(cx,y2);await page.mouse.down();
   for(let n=1;n<=15;n++){await page.mouse.move(cx,y2+n*13);await page.waitForTimeout(14)}
   await page.mouse.up();await page.waitForTimeout(700);
   const contracted=await page.locator('#fpUnifiedRoute .fp-route-sheet').boundingBox();
   assert.ok(contracted.height<expanded.height-45,'downward swipe should restore more map space');
   await page.screenshot({path:evidence+'/'+width+'-contracted.png'});
   // The regression shown in the actual iPhone screenshot: the body itself
   // must pass an upward touch/pointer drag to the shared sheet, not swallow it.
   const bodyBox=await page.locator('#fpUnifiedRoute .fp-route-body').boundingBox();
   assert.ok(bodyBox.height>20,'collapsed card must leave a usable body touch region');
   const bodyX=bodyBox.x+Math.min(18,bodyBox.width*.2);
   const bodyY=bodyBox.y+Math.min(14,bodyBox.height*.27);
   await page.mouse.move(bodyX,bodyY);await page.mouse.down();
   for(let n=1;n<=15;n++){await page.mouse.move(bodyX,bodyY-n*15);await page.waitForTimeout(14)}
   await page.mouse.up();await page.waitForTimeout(720);
   const bodyExpanded=await page.locator('#fpUnifiedRoute .fp-route-sheet').boundingBox();
   assert.ok(bodyExpanded.height>contracted.height+55,'swiping from actual card content must expand the sheet');
   await page.screenshot({path:evidence+'/'+width+'-body-swipe-expanded.png'});
   await page.locator('#fpUnifiedRoute .fp-route-close').click();
   await page.waitForTimeout(480);
   assert.equal(await page.evaluate(()=>window.FootprintUnifiedRoute.state.open),false);
   await page.waitForTimeout(250);
   const toolsReturned=await page.locator('.map-controls').boundingBox();
   assert.ok(Math.abs(toolsReturned.y-toolsRest.y)<3,'the right-map tools must spring back after route closes');
   assert.deepEqual(errors,[],'no JS exceptions');
   console.log('PASS v5 PR53 route swipe card',width,{initial:Math.round(initial.height),expanded:Math.round(expanded.height),contracted:Math.round(contracted.height),cameraCalls:padsAfter.length});
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
