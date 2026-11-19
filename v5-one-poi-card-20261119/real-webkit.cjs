'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {webkit}=require('playwright');
const root='http://127.0.0.1:8765/v5-one-poi-card-full-product-20261119/';
(async()=>{
 const browser=await webkit.launch({headless:true});
 try{
  for(const width of [375,390]){
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(root+'index.html',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.__atlasMapHealth?.().ready===true && typeof window.__atlasSavedPOIAnchors==='function' && window.__atlasPlaceStore && window.FootprintMediaCore, null,{timeout:60000});
   const nav=await page.evaluate(()=>{
    window.__atlasOpenNavigation({title:'长寿路',lat:31.241,lng:121.456});
    const dlg=document.getElementById('navigationChooser');
    return {visible:dlg.classList.contains('visible'),title:dlg.querySelector('.nav-target')?.textContent,
      links:[...dlg.querySelectorAll('#navLinks a')].map(a=>({text:a.textContent,url:a.href})),
      style:getComputedStyle(dlg.querySelector('.nav-panel')).backgroundColor};
   });
   assert.equal(nav.visible,true);
   assert.equal(nav.title,'前往 长寿路');
   assert.equal(nav.links.length,3);
   assert.ok(nav.links.every(x=>!x.text.startsWith('↗ ') && x.url.startsWith('https://')));
   assert.ok(nav.style && nav.style!=='rgba(0, 0, 0, 0)');
   await page.locator('#closeNavigationChooser').click();
   // Use one deterministic POI fixture through the ACTUAL MapLibre source
   // query. Real map canvas, camera, DOM/selection and source code are unmocked.
   // A public vector tile may legitimately have zero restaurants in this area.
   const fixture=await page.evaluate(()=>{
     const map=window.__atlasPOIBridge?.vector?.();
     if(!map)throw Error('No real MapLibre canvas');
     const c=map.getCenter(),id='qa-restaurant|'+c.lng.toFixed(5)+','+c.lat.toFixed(5);
     const geo=[c.lng,c.lat];
     const synthetic={id:'qa-restaurant',geometry:{type:'Point',coordinates:geo},
       properties:{name:'本地餐厅测试点',class:'restaurant',type:'restaurant'}};
     const originalSource=map.querySourceFeatures.bind(map);
     const originalRendered=map.queryRenderedFeatures.bind(map);
     map.querySourceFeatures=()=>[synthetic];
     map.queryRenderedFeatures=()=>[{...synthetic,layer:{id:'poi-fixture',type:'symbol'}}];
     window.__fpRestorePOIFeatureQueries=()=>{
       map.querySourceFeatures=originalSource;map.queryRenderedFeatures=originalRendered;
       window.__atlasPOICommitCurrent?.();
     };
     window.__atlasPOICommitCurrent?.();
     return {id,lat:c.lat,lng:c.lng,name:'本地餐厅测试点'};
   });
   await page.waitForFunction(id=>[...document.querySelectorAll('#atlasPoiOverlay > .fp-poi')].some(x=>x.dataset.poiId===id),fixture.id,{timeout:12000});
   const selected=await page.locator('#atlasPoiOverlay > .fp-poi').first().evaluate(x=>({
     id:x.dataset.poiId,lat:Number(x.dataset.poiLat),lng:Number(x.dataset.poiLng),
     name:x.dataset.poiName
   }));
   assert.ok(Number.isFinite(selected.lat)&&Number.isFinite(selected.lng)&&selected.id);
   await page.evaluate(spot=>{
    const before=window.__atlasSavedPOIAnchors;
    window.__fpQARestoreSavedPOIAnchors=()=>{window.__atlasSavedPOIAnchors=before;document.dispatchEvent(new Event('atlas:saved-stars-changed'));};
    window.__atlasSavedPOIAnchors=()=>[...before(),{id:'qa-saved-anchor',poiId:spot.id,lat:spot.lat,lng:spot.lng,title:spot.name}];
    document.dispatchEvent(new Event('atlas:saved-stars-changed'));
   },selected);
   await page.waitForFunction(id=>![...document.querySelectorAll('#atlasPoiOverlay > .fp-poi')].some(el=>el.dataset.poiId===id),selected.id,{timeout:15000});
   await page.evaluate(()=>window.__fpQARestoreSavedPOIAnchors());
   await page.waitForFunction(id=>[...document.querySelectorAll('#atlasPoiOverlay > .fp-poi')].some(el=>el.dataset.poiId===id),selected.id,{timeout:15000});
   await page.evaluate(()=>window.__fpRestorePOIFeatureQueries());
   const a='single-poi-a-'+width,b='single-poi-b-'+width,trip='single-poi-route-'+width;
   await page.evaluate(async({a,b,trip})=>{
    await window.__atlasPlaceStore.save({id:a,title:'长寿路',lat:31.241,lng:121.456,starred:true,stage:'plan',note:'V5 统一卡片',photos:[]});
    await window.__atlasPlaceStore.save({id:b,title:'北岸路',lat:31.248,lng:121.464,starred:true,stage:'plan',note:'V5 路线地图',photos:[]});
    await window.FootprintMediaCore.createRepository(indexedDB).saveRoute({
     id:trip,title:'黄星与路线视觉',startDate:'2026-11-20',endDate:'2026-11-21',
     stops:[{placeId:a,order:1,day:1},{placeId:b,order:2,day:1}],placeIds:[a,b]
    });
   },{a,b,trip});
   await page.goto(root+'journey.html',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.__footprintV5ProductReady===true&&window.__footprintV5Demo && window.FootprintRouteV5Real?.ready,null,{timeout:60000});
   assert.equal(await page.locator('.v5-saved-route-toggle').count(),1,'No direct saved route entry');
   await page.locator('.v5-saved-route-toggle').click();
   await page.waitForFunction(id=>document.querySelector('#v5-saved-route-list [data-id="'+id+'"]'),trip,{timeout:20000});
   assert.ok((await page.locator('#v5-saved-route-list').textContent()).includes('黄星与路线视觉'));
   await page.locator('#v5-saved-route-list [data-id="'+trip+'"]').click();
   await page.waitForTimeout(2200);
   console.log('PR53_ROUTE_OPEN '+JSON.stringify(await page.evaluate(()=>({
      url:location.href,
      ready:window.__footprintV5ProductReady,
      state:window.__footprintV5Demo?.state?.(),
      mode:document.getElementById('stage')?.dataset.routeMode,
      mapReady:window.FootprintRouteV5Real?.ready,
      styleReady:window.FootprintRouteV5Real?.map?.isStyleLoaded?.(),
      errors:[...document.querySelectorAll('.v5-map-error')].map(x=>x.textContent)
   })))+' pageerrors='+JSON.stringify(errors.slice(-8)));
   await page.waitForFunction(()=>window.__footprintV5Demo?.state().step==='view' && document.getElementById('stage')?.dataset.routeMode==='preview',null,{timeout:60000});
   const preview=await page.evaluate(()=>{
    const map=window.FootprintRouteV5Real.map;
    const ids=(map.getStyle()?.layers||[]).filter(x=>x.type==='symbol'&&!x.id.startsWith('fp-v5-')).map(x=>x.id);
    return {
      markerCount:document.querySelectorAll('#pins .fp-route-map-star').length,
      stage:document.getElementById('stage').dataset.routeMode,
      line:map.getPaintProperty('fp-v5-road-main','line-opacity'),
      nativeIcons:ids.slice(0,20).map(id=>map.getPaintProperty(id,'icon-opacity')),
      canvasCount:document.querySelectorAll('#atlasMap .maplibregl-canvas').length,
      cardBackground:getComputedStyle(document.getElementById('sheet')).backgroundColor,
      css:!![...document.styleSheets].find(x=>x.href?.includes('v5-card-reference.css'))
    };
   });
   assert.equal(preview.markerCount,2);
   assert.equal(preview.canvasCount,1);
   assert.equal(preview.stage,'preview');
   assert.ok(preview.nativeIcons.some(x=>x===0),'Did not dim native POIs during preview');
   assert.ok(preview.css,'Did not load shared card stylesheet');
   await page.locator('#pins .fp-route-map-star').first().dispatchEvent('click');
   await page.locator('#v12-place-bubble').dispatchEvent('click');
   await page.waitForFunction(()=>document.querySelector('.v12-route-sections'),null,{timeout:16000});
   assert.equal(await page.locator('.v12-route-sections .fp-block').count(),4);
   assert.equal(await page.locator('#stage').getAttribute('data-route-mode'),'planning','Detail should restore full map legibility');
   fs.mkdirSync('v5-one-poi-webkit-evidence',{recursive:true});
   await page.screenshot({path:'v5-one-poi-webkit-evidence/'+width+'-route-detail.png'});
   assert.deepEqual(errors.filter(s=>/ReferenceError|SyntaxError|TypeError/.test(s)),[]);
   console.log('PASS WebKit '+width+'px: selected POI icon replaced/restored, navigation card, saved journey entry and legible route preview');
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
