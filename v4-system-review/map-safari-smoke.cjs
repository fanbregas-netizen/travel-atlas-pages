/* WebKit iPhone-sized independent V4 map review, no changes to product state outside this browser context. */
const {webkit,devices}=require('playwright');
const assert=require('node:assert/strict');
const URL=process.env.MAP_REVIEW_URL||'https://fanbregas-netizen.github.io/travel-atlas-pages/v4-map-system-review-20261117/';
(async()=>{
 const browser=await webkit.launch({headless:true});
 try{
  for(const width of [375,390,430]){
   const context=await browser.newContext({...devices['iPhone 13'],viewport:{width,height:844},deviceScaleFactor:2,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>typeof window.__atlasMapHealth==='function'&&typeof window.__atlasCameraQA==='function'&&typeof window.__atlasPOIBridge?.select==='function',{timeout:45000});
    await page.waitForFunction(()=>window.__atlasMapHealth().ready,{timeout:48000}).catch(async()=>{
     throw Error('Map tiles not ready: '+JSON.stringify(await page.evaluate(()=>window.__atlasMapHealth())));
    });
    const base=await page.evaluate(()=>window.__atlasCameraQA());
    const health=await page.evaluate(()=>window.__atlasMapHealth());
    assert.equal(health.ready,true);
    assert.equal(health.warning,false);
    await page.locator('#btnZoomIn').click({timeout:12000});
    await page.waitForFunction(z=>window.__atlasCameraQA().zoom>z+0.3,base.zoom,{timeout:15000});
    await page.locator('#btnZoomOut').click({timeout:12000});
    await page.waitForFunction(z=>window.__atlasCameraQA().zoom<z+0.3,base.zoom,{timeout:15000});
    // Create a real saved location in the throwaway test browser, not just a zero-marker assertion.
    if((await page.evaluate(()=>window.__atlasCameraQA().zoom))<11.7){
     await page.evaluate(c=>window.__atlasPickMapAPI.zoomTo(c.lat,c.lng,13.6),base);
     await page.waitForFunction(()=>window.__atlasCameraQA().zoom>=13,{timeout:12000});
    }
    await page.evaluate(async c=>{
     await window.__atlasPlaceStore.save({id:'webkit-map-one-star',title:'地图黄色星标验收',lat:c.lat,lng:c.lng,starred:true,stage:'plan',date:'',rank:2,note:'',photos:[],videos:[]});
     await window.__atlasFlowRefresh();
    },base);
    await page.waitForFunction(()=>document.querySelectorAll('#atlasBookmarkOverlay [data-place-id="webkit-map-one-star"]').length===1,{timeout:15000});
    const first={name:'海浪动效测试',category:'sea',lat:base.lat,lng:base.lng};
    await page.evaluate(p=>window.__atlasPOIBridge.select(p),first);
    await page.waitForFunction(()=>document.querySelector('#destinationCard.visible #destinationTitle')?.textContent==='海浪动效测试',{timeout:17000});
    await page.waitForFunction(()=>!!document.querySelector('.fp-internal-poi-svg'),{timeout:17000});
    await page.evaluate(p=>window.__atlasPOIBridge.select(p),{...first,name:'公园切点测试',category:'park'});
    await page.waitForFunction(()=>document.querySelector('#destinationCard.visible #destinationTitle')?.textContent==='公园切点测试',{timeout:17000});
    const layers=await page.evaluate(()=>{
     const visible=id=>{const el=document.getElementById(id);if(!el||el.hidden)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
     const marks=[...document.querySelectorAll('#atlasBookmarkOverlay [data-place-id]')];
     return {visibleSurfaces:['map','atlasVectorMap','amapSurface'].filter(visible),duplicateStarIds:marks.length-new Set(marks.map(n=>n.dataset.placeId)).size,health:window.__atlasMapHealth(),actualZoom:window.__atlasCameraQA().zoom};
    });
    assert.equal(layers.duplicateStarIds,0,'A saved place must have only one yellow star hit target');
    assert.equal((await page.locator('#atlasBookmarkOverlay [data-place-id="webkit-map-one-star"]').count()),1,'Expected the real test place to own exactly one yellow star');
    assert.equal(layers.visibleSurfaces.length,1,'No duplicate visible basemap surfaces');
    assert.equal(layers.health.ready,true,'Map remains ready after POI switching');
    if(errors.some(e=>/SyntaxError|ReferenceError|TypeError/.test(e)))throw Error('Uncaught map JS: '+JSON.stringify(errors));
    console.log('PASS WebKit simulated iPhone '+JSON.stringify({width,provider:health.provider,visibleSurfaces:layers.visibleSurfaces,duplicateStarIds:layers.duplicateStarIds}));
    // The recording shows the C V5 route picker opening to a blank map, then
    // switching to oversized black building silhouettes. Test the map surface
    // only; route state and card gestures are not modified.
    await page.goto(new (require('node:url').URL)('./journey.html',URL).href,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>window.__atlasLivePlannerMap?.isStyleLoaded?.()===true,{timeout:55000});
    await page.waitForFunction(()=>{const c=document.querySelector('#rc-live-map-canvas canvas');return !!c&&c.width>50&&c.height>50},{timeout:18000});
    const picker=await page.evaluate(()=>{
      const m=window.__atlasLivePlannerMap;
      const st=m?.getStyle?.();
      return {visible:!!m&&!!document.querySelector('#rc-live-map-canvas canvas'),
        mapStyleUrl:window.FootprintSharedMap?.routeFigureStyle?.(),
        hasOldBlackBuildingOverlay:!!st?.layers?.some(x=>x.id==='footprint-buildings-black'),
        sourceCount:Object.keys(st?.sources||{}).length};
    });
    assert.equal(picker.visible,true);
    assert.equal(picker.mapStyleUrl,'https://tiles.openfreemap.org/styles/bright');
    assert.equal(picker.hasOldBlackBuildingOverlay,false);
    assert.ok(picker.sourceCount>0,'Real vector basemap layers should load');
    console.log('PASS WebKit V4 shared route picker basemap '+JSON.stringify({width,...picker}));
   }finally{await context.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
