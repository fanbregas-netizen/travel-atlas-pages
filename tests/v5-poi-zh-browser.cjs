'use strict';
/* Real iPhone-size Chromium/WebKit regression for an isolated V5 QA product.
 * All browser storage is ephemeral; never touches a user browser profile. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..','v5-poi-zh-20261121');
const base='http://127.0.0.1:8765/v5-poi-zh-20261121/';
const evidence=path.resolve(__dirname,'..','v5-poi-zh-20261121-browser-evidence');
fs.mkdirSync(evidence,{recursive:true});
function productFile(p){return path.join(root,p)}
async function inspectProduct(browser,kind,width){
 const ctx=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.message).slice(0,180)));
 try{
  const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:35000});
  assert.equal(response.status(),200,kind+' real QA HTML HTTP');
  await page.waitForTimeout(1800);
  await page.waitForFunction(()=>Boolean(window.__atlasCardDockMotion?.sync),null,{timeout:12000});
  for(const selector of ['#fpTopSearch','#appDock','#dockStars','#dockMap','#dockRoute','#btnLocate','#btnZoomIn','#btnZoomOut'])
   assert(await page.locator(selector).count()===1,kind+' missing '+selector);
  assert(await page.locator('#appDock').isVisible(),kind+' bottom Dock should be visible at boot');
  assert(await page.locator('#fpTopSearch').isVisible(),kind+' top search should be visible at boot');
  for(const selector of ['#btnLocate','#btnZoomIn','#btnZoomOut'])
   assert(await page.locator(selector).isVisible(),kind+' map tool hidden at boot '+selector);
  assert.equal(await page.evaluate(()=>window.__fpStorageNamespace),'private-travel-footprints-v5-poi-zh-qa-20261121');
  assert(await page.evaluate(()=>window.__atlasPreviewNamespace)==='fp-v5-poi-zh-qa-20261121-');
  // BFCache/map-view return, with an orphan body route class but no route sheet.
  await page.evaluate(()=>{
   const route=document.getElementById('fpUnifiedRoute');
   if(route)route.hidden=true;
   document.body.classList.add('fp-unified-route','fp-route-map-focus');
   window.dispatchEvent(new Event('pageshow'));
  });
  await page.waitForFunction(()=>!document.body.classList.contains('fp-unified-route')&&
   !document.body.classList.contains('fp-route-map-focus'),null,{timeout:4000});
  await page.waitForTimeout(150);
  const restored=await page.evaluate(()=>({
   dock:getComputedStyle(document.querySelector('#appDock')).visibility,
   top:getComputedStyle(document.querySelector('#fpTopSearch')).visibility,
   orphan:document.body.classList.contains('fp-unified-route'),
   mapFocus:document.body.classList.contains('fp-route-map-focus')
  }));
  assert(!restored.orphan&&!restored.mapFocus,kind+' orphan route CSS leaked '+JSON.stringify(restored));
  assert(restored.dock==='visible'&&restored.top==='visible',kind+' dock restoration failed '+JSON.stringify(restored));
  // Video 2026-11-21: V4 full-screen glass must not blur the route map,
  // numbered stars or underlying route sheet when the V5 place card opens.
  // Exercise the actual complete-product stylesheet, not a standalone mock CSS.
  const routePlaceGlass=await page.evaluate(()=>{
   const cover=document.querySelector('#cover');
   const legacy=document.querySelector('#memorySheet');
   const map=document.querySelector('#atlasVectorMap');
   const stars=document.querySelector('#atlasBookmarkOverlay');
   if(!cover||!legacy||!map||!stars)return {missing:true};
   const outside=document.body.classList.contains('fp-unified-route');
   document.body.classList.add('fp-unified-route','fp-place-open');
   cover.classList.add('visible');
   legacy.classList.add('visible','journal-open');
   const before=getComputedStyle(legacy,'::before');
   const check={
    isV5:document.documentElement.classList.contains('fp-v5-single-place'),
    cover:getComputedStyle(cover).display,
    memory:getComputedStyle(legacy).display,
    pseudoOpacity:before.opacity,
    pseudoBlur:before.backdropFilter||before.webkitBackdropFilter||'',
    vectorFilter:getComputedStyle(map).filter,
    starsFilter:getComputedStyle(stars).filter
   };
   cover.classList.remove('visible');
   legacy.classList.remove('visible','journal-open');
   document.body.classList.remove('fp-place-open');
   if(!outside)document.body.classList.remove('fp-unified-route');
   return check;
  });
  assert.equal(routePlaceGlass.isV5,true,kind+' missing V5 single card mode');
  assert.equal(routePlaceGlass.cover,'none',kind+' legacy fullscreen cover still visible '+JSON.stringify(routePlaceGlass));
  assert.equal(routePlaceGlass.memory,'none',kind+' retired memory journal still visible '+JSON.stringify(routePlaceGlass));
  assert.equal(routePlaceGlass.pseudoOpacity,'0',kind+' legacy journal blur overlay not suppressed');
  assert.equal(routePlaceGlass.pseudoBlur,'none',kind+' legacy journal backdrop blur still active');
  assert.equal(routePlaceGlass.vectorFilter,'none',kind+' V5 route map should not be blurred');
  assert.equal(routePlaceGlass.starsFilter,'none',kind+' route star overlay should not be blurred');
  console.log(JSON.stringify({kind,width,mode:'route-to-place-no-legacy-blur',result:'PASS',glass:routePlaceGlass}));
  // Actual 2026-11-21 iPhone recording regression: a saved-place card is
  // open above a route, and its header direction icon must show a *tappable*
  // navigation chooser ABOVE the card, not a hidden sheet and blurred map.
  await page.waitForFunction(()=>typeof window.__footprintHome?.openSaved==='function'&&
   typeof window.__atlasOpenNavigation==='function'&&
   Boolean(window.FootprintNavigationSheet?.open),null,{timeout:15000});
  await page.evaluate(async()=>{
   const p={id:'qa-route-nav-hit',title:'宁波工程学院前湾校区',lat:30.2401,lng:121.3097,
    starred:true,stage:'plan',note:'导航功能测试',photos:[],videos:[],references:[]};
   // Read-only mock store in this ephemeral browser context. No real IndexedDB
   // or user data is ever overwritten, even inside the isolated QA namespace.
   window.__atlasPlaceStore={readAll:async()=>[p]};
   await window.__footprintHome.openSaved(p.id);
   // Keep the ACTUAL route shell present: the approved Dock controller
   // removes fp-unified-route if it sees a hidden/orphaned route sheet.
   const route=document.getElementById('fpUnifiedRoute');
   if(!route)throw new Error('Missing V5 route shell');
   route.hidden=false;
   document.body.classList.add('fp-unified-route','fp-place-open');
  });
  await page.waitForFunction(()=>!document.querySelector('#fpPlaceCard')?.hidden&&
   !!document.querySelector('#fpPlaceCard .fp-place-navigation'),null,{timeout:8000});
  await page.locator('#fpPlaceCard .fp-place-navigation').click();
  await page.waitForFunction(()=>document.querySelector('#navigationChooser')?.classList.contains('visible')&&
   !document.querySelector('#navigationChooser')?.hidden&&
   document.querySelectorAll('#navLinks a').length>=2,null,{timeout:6500});
  await page.waitForTimeout(950);
  const nav=await page.evaluate(()=>{
   const modal=document.querySelector('#navigationChooser');
   const card=document.querySelector('#fpPlaceCard');
   const a=document.querySelector('#navLinks a');
   const rect=a.getBoundingClientRect();
   const above=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
   return {modalZ:parseInt(getComputedStyle(modal).zIndex)||0,
    cardZ:parseInt(getComputedStyle(card).zIndex)||0,
    modalVisible:getComputedStyle(modal).display!=='none',
    navLinkAtTop:!!above?.closest('#navLinks'),
    labels:[...document.querySelectorAll('#navLinks a')].map(x=>x.textContent),
    amapUrl:a.href,cardVisible:!card.hidden,
    routeActive:document.body.classList.contains('fp-unified-route'),
    placeActive:document.body.classList.contains('fp-place-open')}
  });
  assert(nav.modalVisible&&nav.cardVisible,kind+' navigation or original place card missing');
  assert(nav.routeActive&&nav.placeActive,kind+' failed to reproduce full route/place card stack '+JSON.stringify(nav));
  assert(nav.cardZ>=3600,kind+' V5 route-place z-index must be 3600+ '+JSON.stringify(nav));
  assert(nav.modalZ>nav.cardZ,kind+' navigation is below place card '+JSON.stringify(nav));
  assert(nav.navLinkAtTop,kind+' navigation hit target hidden behind place card '+JSON.stringify(nav));
  assert(nav.labels.some(x=>x.includes('高德'))&&nav.labels.some(x=>x.includes('Apple')),kind+' map app links missing');
  assert(nav.amapUrl.startsWith('https://uri.amap.com/navigation?'),kind+' destination URI invalid');
  await page.screenshot({path:path.join(evidence,kind+'-'+width+'-NAV-ABOVE-PLACE.png'),fullPage:false});
  // Exercise a REAL pointer click, not dispatchEvent() which would bypass
  // the very hit-testing bug reported on the user's iPhone.
  await page.evaluate(()=>{
   window.__qaNavigationClicked='';
   document.querySelectorAll('#navLinks a').forEach(a=>
    a.addEventListener('click',e=>{
     e.preventDefault();window.__qaNavigationClicked=a.href;
    },{capture:true,once:true})
   )
  });
  await page.locator('#navLinks a').first().click({timeout:10000});
  assert((await page.evaluate(()=>window.__qaNavigationClicked)).startsWith('https://uri.amap.com/navigation?'),
   kind+' nav link did not receive the actual click');
  await page.waitForTimeout(1050);
  assert(await page.locator('#navigationChooser').isHidden(),kind+' chooser did not close after external map choice');
  assert(await page.locator('#fpPlaceCard').isVisible(),kind+' returning from nav destroyed original place');
  console.log(JSON.stringify({kind,width,mode:'real-saved-place-header-navigation-click',result:'PASS',navigation:nav}));
  // Restore page state before other independent checks.
  await page.evaluate(()=>{
   window.__atlasClosePlace?.(true);
   const route=document.getElementById('fpUnifiedRoute');
   if(route)route.hidden=true;
   document.body.classList.remove('fp-unified-route','fp-place-open');
  });

  const iconCategories=await page.evaluate(()=>Object.keys(window.AtlasPOIIcons?.icons||{}));
  assert.equal(iconCategories.length,22,kind+' icon catalog must retain 22 V3 categories');
  await page.screenshot({path:path.join(evidence,kind+'-'+width+'-real-v5-home.png'),fullPage:false});
  console.log(JSON.stringify({kind,width,mode:'live-full-product',result:'PASS',mapCanvas:await page.locator('#atlasVectorMap canvas').count(),
   dock:restored,iconCategories:iconCategories.length,pageErrors:errors.slice(0,8)}));
 }finally{await ctx.close()}
}
async function inspectCollision(browser,kind,width){
 const ctx=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
 const page=await ctx.newPage();
 try{
  await page.setContent('<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#485d6b}#atlasVectorMap,#atlasPoiOverlay{position:fixed;inset:0}#atlasPoiOverlay{pointer-events:none}.fp-poi{position:absolute;transform:translate(-50%,-50%);width:44px;height:44px;border:0;background:transparent;pointer-events:auto;display:grid;place-items:center}.fp-poi-token{width:31px;height:31px;background:#fafaf8;border-radius:10px;display:grid;place-items:center}.fp-poi-token img{width:20px;height:20px}</style></head><body class="vector-active"><div id="atlasVectorMap"></div><div id="atlasPoiOverlay"></div><div id="appDock" style="position:fixed;top:810px"></div><div id="atlasBookmarkOverlay"></div></body></html>');
  await page.addScriptTag({path:productFile('src/map/poi-identity-v5.js')});
  await page.addScriptTag({path:productFile('src/map/poi-label-avoidance-v1.js')});
  await page.evaluate(()=>{
   const rows=[
    {id:1001,name:'奉城医院',cat:'hospital',lng:121.4,lat:31.2},
    {id:1002,name:'奉城第二小学',cat:'school',lng:121.410,lat:31.195}
   ];
   window.__qaShift=0;window.__qaSelect=[];window.__qaSaved=[];window.__qaEvents={};
   window.__atlasSavedPOIAnchors=()=>window.__qaSaved;
   window.AtlasPOIMotion={popSelected(){},play(){}};
   const map={
    getZoom:()=>16,isStyleLoaded:()=>true,
    getStyle:()=>({layers:[{id:'poi_label',source:'vector',type:'symbol','source-layer':'poi',layout:{'text-field':['get','name'],visibility:'visible'}}]}),
    querySourceFeatures:()=>rows.map(p=>({id:p.id,properties:{name:p.name,class:p.cat},geometry:{type:'Point',coordinates:[p.lng,p.lat]}})),
    queryRenderedFeatures:(box,opt)=>{
     if(!box||!Array.isArray(box))return [];
     // A real map glyph occupies the center of the hospital POI.
     const x0=170,y0=285,x1=210,y1=315;
     return box[1][0]>=x0&&box[0][0]<=x1&&box[1][1]>=y0&&box[0][1]<=y1?[{id:'native-Chinese-label'}]:[];
    },
    getPaintProperty:()=>0,setPaintProperty(){},
    project:([lng,lat])=>({x:190+(lng-121.4)*13000+window.__qaShift,y:300-(lat-31.2)*13000}),
    on:(event,fn)=>{(window.__qaEvents[event]??=[]).push(fn)}
   };
   window.__qaMap=map;
   window.__atlasPOIBridge={vector:()=>map,official:()=>null,select:p=>{
     window.__qaSelect.push(p);document.body.classList.add('destination-selected')
   }};
  });
  await page.addScriptTag({path:productFile('stage1-29-poi.js')});
  await page.waitForFunction(()=>document.querySelectorAll('#atlasPoiOverlay .fp-poi').length===2,null,{timeout:9500});
  const before=await page.evaluate(()=>{
   const nodes=[...document.querySelectorAll('#atlasPoiOverlay .fp-poi')];
   return nodes.map(el=>({name:el.dataset.poiName,
    x:parseFloat(el.style.left),y:parseFloat(el.style.top),
    dx:Number(el.dataset.poiLabelDx),dy:Number(el.dataset.poiLabelDy),
    category:el.dataset.poiCategory,hasExtraName:!!el.querySelector('.fp-poi-label')}))
  });
  const hospital=before.find(p=>p.name==='奉城医院'),school=before.find(p=>p.name==='奉城第二小学');
  assert(hospital&&school,kind+' missing facility POI');
  assert(hospital.dx!==0||hospital.dy!==0,kind+' hospital icon covers native map label');
  assert.equal(hospital.category,'hospital');assert.equal(school.category,'school');
  assert(before.every(x=>!x.hasExtraName),kind+' duplicate DOM labels present');
  await page.locator('#atlasPoiOverlay .fp-poi').filter({has:page.locator('.fp-poi-token')}).first().locator('.fp-poi-token').click();
  assert.equal(await page.evaluate(()=>window.__qaSelect.length),1,kind+' tap to card must work');
  await page.evaluate(()=>{
   const p=document.querySelector('#atlasPoiOverlay .fp-poi[data-poi-name]');
   window.__qaFirst=p;
   window.__qaShift=18;
   (window.__qaEvents.move||[]).forEach(fn=>fn());
  });
  await page.waitForTimeout(200);
  await page.evaluate(()=>window.__atlasPOICommitCurrent?.());
  assert(await page.evaluate(()=>window.__qaFirst?.isConnected),kind+' camera pan recreated selected POI');
  await page.evaluate(()=>{
   window.__qaSaved=[{id:'saved-hospital',lat:31.2,lng:121.4,title:'奉城医院'}];
   document.dispatchEvent(new Event('atlas:saved-stars-changed'))
  });
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#atlasPoiOverlay .fp-poi').count(),1,kind+' yellow saved star must replace duplicate POI');
  await page.evaluate(()=>{
   window.__qaSaved=[];
   document.dispatchEvent(new Event('atlas:saved-stars-changed'))
  });
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#atlasPoiOverlay .fp-poi').count(),2,kind+' unstar should restore normal source pictogram');
  await page.screenshot({path:path.join(evidence,kind+'-'+width+'-POI-vs-label.png')});
  console.log(JSON.stringify({kind,width,mode:'actual-POI-controller-mocked-MapLibre-labels',result:'PASS',icons:before}));
 }finally{await ctx.close()}
}
(async()=>{
 for(const [kind,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true,args:kind==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
  try{for(const width of [390,430]){
   await inspectProduct(browser,kind,width);
   await inspectCollision(browser,kind,width);
  }}finally{await browser.close()}
 }
 console.log('PASS 8 QA browser sequences (Chromium/WebKit × 390/430 × live home/collision fixture)');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
