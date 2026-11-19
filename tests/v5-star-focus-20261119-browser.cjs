'use strict';
/* Browser-level interaction verification of current V5 staged Pages product
 * route JS/CSS. Projection and saved-place repository are test fixtures;
 * this is not a true iPhone Safari or remote map-tile performance test. */
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const {chromium}=require('playwright-core');
const binary=['google-chrome','google-chrome-stable','chromium'].map(x=>{try{return cp.execFileSync('which',[x],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!binary)throw Error('Chromium missing');
const folder='v5-star-focus-evidence';
(async()=>{
 const browser=await chromium.launch({executablePath:binary,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 fs.mkdirSync(folder,{recursive:true});
 try{
  for(const width of [375,390]){
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const root='v5-pr53-one-map-20261119/';
   const manifest=JSON.parse(fs.readFileSync(root+'QA_BUILD.json','utf8'));
   assert.equal(manifest.source_commit,'1941da107ca5e008e440f0abea9c00c2dd3642e6','staged source not latest');
   const route=fs.readFileSync(root+'src/route/route-single-map-v1.js','utf8');
   const css=fs.readFileSync(root+'src/visual/v5-single-map-route.css','utf8');
   await page.setContent('<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;background:#789189}.map-controls{position:fixed;right:12px;bottom:124px;display:flex;flex-direction:column;gap:8px}.map-controls button{width:48px;height:48px}</style></head><body><div id="atlasVectorMap"><canvas class="maplibregl-canvas" style="width:100vw;height:100vh;background:#769285"></canvas></div><div id="atlasPoiOverlay"><button class="fp-poi" data-poi-id="ordinary">普通POI</button></div><div id="atlasBookmarkOverlay"><button class="atlas-bookmark-hit" data-place-id="a" style="position:fixed;left:100px;top:220px;width:43px;height:43px;background:#e6c268;border-radius:50%">★</button><button class="atlas-bookmark-hit" data-place-id="b" style="position:fixed;left:215px;top:300px;width:43px;height:43px;background:#e6c268;border-radius:50%">★</button><button class="atlas-bookmark-hit" data-place-id="c" style="position:fixed;left:250px;top:180px;width:43px;height:43px;background:#e6c268;border-radius:50%">★</button></div><div class="map-controls"><button id="btnLayers">◫</button><button id="btnLocate">⌖</button><button id="btnZoomIn">＋</button><button id="btnZoomOut">－</button></div></body></html>');
   await page.addStyleTag({content:css});
   await page.evaluate(()=>{
    const stored={};
    Object.defineProperty(window,'sessionStorage',{configurable:true,value:{setItem(k,v){stored[k]=v},getItem(k){return stored[k]??null},removeItem(k){delete stored[k]}}});
    window.__qaSession=stored;
    const placeData=[
     {id:'a',title:'长寿路',lat:31.24,lng:121.45,starred:true},
     {id:'b',title:'静安公园',lat:31.23,lng:121.46,starred:true},
     {id:'c',title:'苏州河',lat:31.22,lng:121.47,starred:true},
     {id:'d',title:'非收藏咖啡馆',lat:31.215,lng:121.48,starred:false}
    ];
    const savedRoutes=[],layers=new Map(),sources=new Map(),listeners={};
    const map={
     on(type,a,b){(listeners[type]??=[]).push(typeof b==='function'?b:a)},
     off(){},getZoom(){return 14.4},
     getStyle(){return {layers:[]}},isStyleLoaded(){return true},
     addSource(name,opts){sources.set(name,{data:opts.data,setData(v){this.data=v}})},
     getSource(name){return sources.get(name)||null},
     getLayer(name){return layers.get(name)||null},
     addLayer(obj){layers.set(obj.id,obj)},removeLayer(name){layers.delete(name)},removeSource(name){sources.delete(name)},
     easeTo(opts){window.__qaCamera.push({type:'easeTo',padding:opts.padding,zoom:opts.zoom})},
     fitBounds(bounds,opts){window.__qaCamera.push({type:'fitBounds',padding:opts.padding,bounds})},
     getPaintProperty(){return .8},setPaintProperty(){}
    };
    window.__qaMap=map;window.__qaCamera=[];window.__qaSources=sources;
    window.__atlasPOIBridge={vector:()=>map};
    window.FootprintMediaCore={createRepository:()=>({
     list:async()=>placeData.map(p=>({...p})),
     listRoutes:async()=>savedRoutes.map(x=>structuredClone(x)),
     saveRoute:async(x)=>{savedRoutes.push(structuredClone(x))}
    })};
   });
   await page.addScriptTag({content:route});
   await page.evaluate(()=>window.FootprintUnifiedRoute.open());
   await page.waitForFunction(()=>window.FootprintUnifiedRoute?.state.step==='saved');
   await page.locator('[data-command="new"]').click();
   await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.step==='pick');
   // Downward card gesture leaves the planning session active and exposes the map.
   const head=await page.locator('#fpUnifiedRoute .fp-route-heading').boundingBox();
   const x=head.x+95,y=head.y+head.height*.5;
   await page.mouse.move(x,y);await page.mouse.down();
   for(let i=1;i<=15;i++){await page.mouse.move(x,y+i*13);await page.waitForTimeout(12)}
   await page.mouse.up();
   await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.mapFocus===true);
   assert.equal(await page.evaluate(()=>window.FootprintUnifiedRoute.state.open),true,'card down must not close route');
   assert.ok(await page.evaluate(()=>document.body.classList.contains('fp-route-map-focus')),'focus body class missing');
   await page.waitForTimeout(450); // allow a physical spring to reach its new equilibrium
   const backdrop=await page.locator('#fpUnifiedRoute .fp-route-sheet').evaluate(el=>getComputedStyle(el).transform);
   assert.notEqual(backdrop,'none','sheet did not slide off screen');
   const ui=await page.locator('.map-controls').evaluate(el=>({scale:getComputedStyle(el).scale,layers:getComputedStyle(document.querySelector('#btnLayers')).display}));
   assert.equal(ui.layers,'none','focus must show only 3 right map buttons');
   assert.ok(parseFloat(ui.scale)>=.98,'right tools must expand at full-map focus: '+JSON.stringify(ui));
   await page.locator('#atlasPoiOverlay .fp-poi').dispatchEvent('click');
   await page.evaluate(()=>window.__qaMap.getSource('fp-single-route')?.setData({type:'FeatureCollection',features:[]}));
   assert.equal((await page.evaluate(()=>window.FootprintUnifiedRoute.state.order)).length,0,'ordinary POI incorrectly selected');
   await page.locator('#atlasBookmarkOverlay [data-place-id="a"]').dispatchEvent('click');
   await page.waitForTimeout(110);
   assert.deepEqual(await page.evaluate(()=>window.FootprintUnifiedRoute.state.order),['a']);
   const label=page.locator('#atlasBookmarkOverlay [data-place-id="a"] .fp-route-stop-order');
   assert.equal(await label.textContent(),'1');
   assert.equal(await label.evaluate(el=>getComputedStyle(el).top),'-7px','ordinal badge should be in star top-right');
   assert.equal(await page.evaluate(()=>window.__qaMap.getSource('fp-single-route')?.data.features.length),0,'selecting stars must not draw route lines');
   await page.screenshot({path:folder+'/'+width+'-focus-star1.png'});
   await page.locator('#atlasBookmarkOverlay [data-place-id="b"]').dispatchEvent('click');
   await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.order.length===2);
   assert.equal(await page.locator('#atlasBookmarkOverlay [data-place-id="b"] .fp-route-stop-order').textContent(),'2');
   assert.equal(await page.evaluate(()=>window.__qaMap.getSource('fp-single-route')?.data.features.length),0,'no line before sorting');
   await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.mapFocus===false,null,{timeout:4000});
   await page.waitForTimeout(490);
   const toolbarScale=await page.locator('.map-controls').evaluate(el=>parseFloat(getComputedStyle(el).scale));
   assert.ok(toolbarScale<.995,'tools should shrink as the sheet comes up');
   await page.screenshot({path:folder+'/'+width+'-auto-sheet.png'});
   // X exits while preserving a resumable in-tab draft.
   await page.locator('.fp-route-close').click();
   await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.open===false,null,{timeout:2500});
   assert.ok(await page.evaluate(()=>!!window.__qaSession['fp-v5-route-draft']),'route draft not preserved');
   await page.evaluate(()=>window.FootprintUnifiedRoute.open());
   await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.open&&window.FootprintUnifiedRoute.state.step==='pick');
   assert.deepEqual(await page.evaluate(()=>window.FootprintUnifiedRoute.state.order),['a','b'],'reopening lost planning steps');
   await page.locator('[data-command="settings"]').click();
   assert.equal(await page.evaluate(()=>window.FootprintUnifiedRoute.state.step),'settings');
   assert.ok((await page.evaluate(()=>window.__qaMap.getSource('fp-single-route')?.data.features.length))>0,'line should appear after picking step');
   assert.deepEqual(errors,[],'uncaught JS errors');
   console.log('PASS V5 star-only focus and resumable X',width,{chosen:2,cardFocused:true,noLinesInPick:true,controlsScale:toolbarScale,restored:true});
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
