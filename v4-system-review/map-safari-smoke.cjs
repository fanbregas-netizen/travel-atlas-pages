/* WebKit iPhone-sized independent V4 map review, no changes to product state outside this browser context. */
const {webkit,devices}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
fs.mkdirSync('map-evidence',{recursive:true});
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
    await page.waitForFunction(()=>!window.__atlasPOIBridge.vector()?.isMoving(),{timeout:15000});
    // Start the real POI visibly AWAY from the screen center. The tap must
    // move it back to the center without increasing the basemap zoom.
    await page.evaluate(p=>{
      const m=window.__atlasPOIBridge.vector();
      m.jumpTo({center:[p.lng+0.020,p.lat+0.008],zoom:m.getZoom()});
    },first);
    await page.waitForFunction(()=>!window.__atlasPOIBridge.vector()?.isMoving(),{timeout:12000});
    const beforePoiCamera=await page.evaluate(()=>window.__atlasCameraQA());
    const initiallyOffCenter=await page.evaluate(p=>{
      const m=window.__atlasPOIBridge.vector(),at=m.project([p.lng,p.lat]);
      const size=m.getContainer();
      return Math.hypot(at.x-size.clientWidth/2,at.y-size.clientHeight/2);
    },first);
    assert.ok(initiallyOffCenter>50,'Test point must begin visibly away from screen center');
    // A real MapLibre marker with one animated SVG token. No artificial
    // POI DOM is inserted into the asynchronous POI renderer (which prunes it).
    const selected=await page.evaluate(p=>{
      window.__atlasPOIBridge.select({...p,id:'ci-native-poi-one'});
      const tok=document.querySelector('.atlas-vector-selection .fp-vector-token');
      window.__mapTestFirstToken=tok;
      return {transform:tok?.style.transform,motion:tok?.dataset.poiPopMotion,
        markerCount:document.querySelectorAll('.atlas-vector-selection').length,
        moving:window.__atlasPOIBridge.vector().isMoving()};
    },first);
    assert.equal(selected.transform,'scale(1)','Selected geographic POI must enlarge itself');
    assert.equal(selected.motion,'running','The POI icon itself must be animating');
    assert.equal(selected.markerCount,1,'Exactly one selected POI marker');
    assert.equal(selected.moving,true,'Map must smoothly PAN to center while the POI artwork grows');
    // The previous important inline scale blocked WebKit's animation completely.
    // Require a measured scale ABOVE the 1.34 settled marker size.
    await page.waitForFunction(()=>{
      const tok=document.querySelector('.atlas-vector-selection .fp-vector-token');
      const m=tok&&getComputedStyle(tok).transform;
      return !!m&&m.startsWith('matrix(')&&parseFloat(m.slice(7))>1.42;
    },null,{timeout:1800}).catch(async()=>{
      throw Error('POI pop did not exceed 1.42 during camera pan: '+JSON.stringify(
       await page.evaluate(()=>{
        const tok=document.querySelector('.atlas-vector-selection .fp-vector-token');
        const m=window.__atlasPOIBridge.vector();
        return {exists:!!tok,computed:tok?getComputedStyle(tok).transform:null,
          inline:tok?.style.transform,request:tok?.dataset.poiPopMotion,
          selectedMarkerCount:document.querySelectorAll('.atlas-vector-selection').length,
          moving:m?.isMoving(),center:m?.getCenter().toArray(),
          allSelectionClasses:[...document.querySelectorAll('.atlas-vector-selection')].map(x=>x.className)};
       })
      ));
    });
    await page.waitForTimeout(65);
    const mid=await page.evaluate(()=>{
      const tok=document.querySelector('.atlas-vector-selection .fp-vector-token');
      return {scale:tok?getComputedStyle(tok).transform:null,
        moving:window.__atlasPOIBridge.vector().isMoving()};
    });
    assert.ok(mid.scale&&mid.scale.startsWith('matrix(')&&parseFloat(mid.scale.slice(7))>1.04,'The POI itself must visibly grow: '+JSON.stringify(mid));
    assert.equal(mid.moving,true,'Camera centering continues while POI grows');
    // Each moving frame must use the SAME compositor translation for the
    // POI and saved-star planes. A separate rAF per marker caused the
    // visible jump / flicker seen in the iPhone Safari recording.
    const surfaces=await page.evaluate(()=>{
      const map=window.__atlasPOIBridge.vector();
      const a=document.getElementById('atlasPoiOverlay'),
            b=document.getElementById('atlasBookmarkOverlay');
      const pos=a.style.translate.trim().split(/\s+/);
      const marker=a.querySelector('.fp-poi[data-poi-lng][data-poi-lat]');
      let drift=null;
      if(marker&&pos.length===2){
        const p=map.project([+marker.dataset.poiLng,+marker.dataset.poiLat]);
        drift=Math.hypot(+parseFloat(marker.style.left)+parseFloat(pos[0])-p.x,
          +parseFloat(marker.style.top)+parseFloat(pos[1])-p.y);
      }
      return {moving:map.isMoving(),poiPlane:a.style.translate,
        starPlane:b.style.translate,poiOpacity:a.style.opacity,drift,
        poiCount:a.querySelectorAll('.fp-poi').length};
    });
    assert.equal(surfaces.moving,true,'Inspect overlays during the active camera pan');
    assert.ok(surfaces.poiPlane.includes('px'),'POI plane must move on compositor');
    assert.equal(surfaces.poiPlane,surfaces.starPlane,
      'POIs and saved stars must track ONE camera transform, not two asynchronous frames');
    assert.equal(surfaces.poiOpacity,'1','Do not fade POIs during auto recenter');
    await page.screenshot({path:`map-evidence/poi-pan-${width}-mid.png`,animations:'allow'});
    if(surfaces.drift!=null)assert.ok(surfaces.drift<3,
      'Rendered on-map SVG must stay geographically aligned: '+JSON.stringify(surfaces));

    await page.waitForFunction(()=>!window.__atlasPOIBridge.vector()?.isMoving(),{timeout:12000});
    const afterPoiCamera=await page.evaluate(()=>window.__atlasCameraQA());
    assert.ok(Math.abs(afterPoiCamera.zoom-beforePoiCamera.zoom)<0.005,'POI tap must not zoom the MAP');
    const centered=await page.evaluate(p=>{
      const m=window.__atlasPOIBridge.vector(),at=m.project([p.lng,p.lat]),box=m.getContainer();
      return {pixelError:Math.hypot(at.x-box.clientWidth/2,at.y-box.clientHeight/2),
        moving:m.isMoving(),lat:m.getCenter().lat,lng:m.getCenter().lng};
    },first);
    assert.ok(centered.pixelError<2,
      'Tapped POI must land at TRUE center of the map viewport: '+JSON.stringify(centered));
    const afterMotionSurfaces=await page.evaluate(()=>({
      poi:document.getElementById('atlasPoiOverlay')?.style.translate,
      star:document.getElementById('atlasBookmarkOverlay')?.style.translate
    }));
    assert.equal(afterMotionSurfaces.poi,'','POI overlay translation must atomically clear on moveend');
    assert.equal(afterMotionSurfaces.star,'','Star overlay translation must atomically clear on moveend');
    await page.screenshot({path:`map-evidence/poi-pan-${width}-settled.png`,animations:'disabled'});
    assert.ok(Math.abs(beforePoiCamera.lat-afterPoiCamera.lat)>.002||
              Math.abs(beforePoiCamera.lng-afterPoiCamera.lng)>.003,
      'Map must visibly PAN to clicked POI, not remain stationary');
    await page.waitForFunction(()=>document.querySelector('.atlas-vector-selection .fp-vector-token')?.dataset.poiPopMotion==='settled',{timeout:1400});
    assert.equal(await page.locator('.atlas-vector-selection .fp-vector-token' ).evaluate(el=>el.style.transform),'scale(1.34)',
      'POI stays enlarged after gentle overshoot and settle');
    await page.waitForFunction(()=>document.querySelector('#destinationCard.visible #destinationTitle')?.textContent==='海浪动效测试',{timeout:17000});
    await page.waitForFunction(()=>!!document.querySelector('.fp-internal-poi-svg'),{timeout:17000});
    const switched=await page.evaluate(p=>{
      window.__atlasPOIBridge.select({...p,name:'公园切点测试',category:'park',id:'ci-native-poi-two',lat:p.lat+0.009,lng:p.lng+0.014});
      return {prevScale:window.__mapTestFirstToken?.style.transform,
        currentScale:document.querySelector('.atlas-vector-selection .fp-vector-token')?.style.transform,
        selectedMarkers:document.querySelectorAll('.atlas-vector-selection').length};
    },first);
    assert.equal(switched.prevScale,'','Old selected POI must shrink back on switching');
    assert.equal(switched.currentScale,'scale(1)','New selected POI grows in its place');
    assert.equal(switched.selectedMarkers,1,'No duplicate map marker after rapid POI switch');
    await page.waitForFunction(()=>!window.__atlasPOIBridge.vector()?.isMoving(),{timeout:12000});
    const secondCentered=await page.evaluate(p=>{
      const m=window.__atlasPOIBridge.vector(),pos=m.project([p.lng+0.014,p.lat+0.009]),box=m.getContainer();
      return {distance:Math.hypot(pos.x-box.clientWidth/2,pos.y-box.clientHeight/2),zoom:m.getZoom()};
    },first);
    assert.ok(secondCentered.distance<2,'Second POI must also center without a camera jump');
    assert.ok(Math.abs(secondCentered.zoom-beforePoiCamera.zoom)<.005,'Rapid POI switch must retain zoom');
    await page.waitForFunction(()=>document.querySelector('#destinationCard.visible #destinationTitle')?.textContent==='公园切点测试',{timeout:17000});
    const existing=await page.evaluate(p=>{
      const pane=document.getElementById('atlasPoiOverlay');
      const b=document.createElement('button'),token=document.createElement('span');
      b.className='fp-poi';token.className='fp-poi-token';
      b.dataset.poiId='ci-existing-poi';b.dataset.poiLat=String(p.lat);b.dataset.poiLng=String(p.lng);
      b.append(token);pane.append(b);
      window.__atlasPOIBridge.select({...p,id:'ci-existing-poi'});
      const result={isSelected:b.classList.contains('is-selected'),scale:token.style.transform,
        duplicateMarkers:document.querySelectorAll('.atlas-vector-selection').length};
      b.remove();return result;
    },first);
    assert.equal(existing.isSelected,true,'Reuse the original on-map POI marker');
    assert.equal(existing.scale,'scale(1)','Existing marker also enlarges');
    assert.equal(existing.duplicateMarkers,0,'Never create a second icon over an existing geographic POI');
    console.log('PASS POI pictogram enlarges as map pans to true center at constant zoom, no overlapping markers '+JSON.stringify({
      width,selectedScale:selected.transform,midScale:mid.scale,
      cameraZoomBefore:beforePoiCamera.zoom,cameraZoomAfter:afterPoiCamera.zoom,initialOffsetPx:initiallyOffCenter,finalCenterErrorPx:centered.pixelError,secondCenterErrorPx:secondCentered.distance
    }));
    // A rapid third tap may trigger one more camera motion while the saved
    // star overlay awaits its scheduled moveend repaint. Assert only after
    // the native move and its overlay render have settled.
    await page.waitForFunction(()=>!window.__atlasPOIBridge.vector()?.isMoving(),{timeout:12000});
    await page.waitForFunction(()=>document.querySelectorAll('#atlasBookmarkOverlay [data-place-id="webkit-map-one-star"]').length===1,{timeout:16000});
    const layers=await page.evaluate(()=>{
     const visible=id=>{const el=document.getElementById(id);if(!el||el.hidden)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
     const marks=[...document.querySelectorAll('#atlasBookmarkOverlay [data-place-id]')];
     return {visibleSurfaces:['map','atlasVectorMap','amapSurface'].filter(visible),duplicateStarIds:marks.length-new Set(marks.map(n=>n.dataset.placeId)).size,health:window.__atlasMapHealth(),actualZoom:window.__atlasCameraQA().zoom};
    });
    assert.equal(layers.duplicateStarIds,0,'A saved place must have only one yellow star hit target');
    assert.equal((await page.locator('#atlasBookmarkOverlay [data-place-id="webkit-map-one-star"]').count()),1,'Expected the real test place to own exactly one yellow star');
    assert.equal(layers.visibleSurfaces.length,1,'No duplicate visible basemap surfaces');
    await page.waitForFunction(()=>window.__atlasMapHealth()?.ready,{timeout:20000});
    assert.equal((await page.evaluate(()=>window.__atlasMapHealth())).ready,true,'Map remains ready after POI switching');
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
    assert.ok(await page.evaluate(()=>!!window.AtlasFigureGround?.palette),'Route needs the exact home map paint palette');
    await page.locator('[data-rc="source-map"]').first().click({timeout:12000});
    await page.waitForFunction(()=>document.querySelector('#rc-map')?.classList.contains('rc-map-picking'),{timeout:15000});
    await page.evaluate(()=>{
      const m=window.__atlasLivePlannerMap,c=m.getCenter();
      m.fire('click',{lngLat:c,point:m.project([c.lng,c.lat])});
    });
    await page.waitForFunction(()=>window.__atlasRouteV5Live?.state?.selected?.length>=1,{timeout:15000});
    await page.waitForFunction(()=>document.querySelector('#rc-map-pins [data-place-id^="live-map-"]'),{timeout:12000});
    await page.waitForTimeout(570);
    const initialPin=await page.locator('#rc-map-pins [data-place-id^="live-map-"]').first().evaluate(el=>parseFloat(el.style.left));
    await page.evaluate(()=>{
      const m=window.__atlasLivePlannerMap,c=m.getCenter();
      m.easeTo({center:[c.lng+0.005,c.lat],duration:800,essential:true});
    });
    // A busy software WebKit renderer may not paint at exactly 265 ms;
    // verify a measurable position shift during the live camera transition.
    await page.waitForFunction(initial=>{
      const m=window.__atlasLivePlannerMap,pin=document.querySelector('#rc-map-pins [data-place-id^="live-map-"]');
      const now=pin?parseFloat(pin.style.left):NaN;
      return m?.isMoving?.()&&Number.isFinite(now)&&Math.abs(now-initial)>0.1;
    },initialPin,{timeout:9000});
    const midPin=await page.locator('#rc-map-pins [data-place-id^="live-map-"]').first().evaluate(el=>parseFloat(el.style.left));
    assert.ok(Math.abs(initialPin-midPin)>0.1,'Selected route pin must follow camera while it is moving; initial='+initialPin+', mid='+midPin);
    assert.equal(await page.locator('#rc-map-pins [data-place-id^="live-map-"]').count(),1,'One selected route marker only');
    await page.waitForFunction(()=>!window.__atlasLivePlannerMap.isMoving(),{timeout:12000});
    console.log('PASS WebKit V4 shared route picker basemap '+JSON.stringify({width,...picker}));
   }finally{await context.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
