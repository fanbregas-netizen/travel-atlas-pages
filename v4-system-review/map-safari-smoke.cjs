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
    if(process.env.MAP_ROUTE_ONLY!=='1'){
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
    // Count destructive calls during the actual map gesture. A legacy
    // vector renderer previously called replaceChildren() on EVERY moveend.
    await page.evaluate(()=>{
      const pane=document.getElementById('atlasPoiOverlay');
      pane.__destructiveClearCount=0;
      const original=pane.replaceChildren.bind(pane);
      pane.replaceChildren=(...args)=>{
        pane.__destructiveClearCount++;return original(...args);
      };
    });
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
    const destructiveClearCount=await page.evaluate(()=>
      document.getElementById('atlasPoiOverlay').__destructiveClearCount);
    assert.equal(destructiveClearCount,0,
      'Legacy POI renderer must never destroy all hand-drawn SVGs on moveend');
    await page.screenshot({path:`map-evidence/poi-pan-${width}-settled.png`,animations:'disabled'});
    assert.ok(Math.abs(beforePoiCamera.lat-afterPoiCamera.lat)>.002||
              Math.abs(beforePoiCamera.lng-afterPoiCamera.lng)>.003,
      'Map must visibly PAN to clicked POI, not remain stationary');
    await page.waitForFunction(()=>document.querySelector('.atlas-vector-selection .fp-vector-token')?.dataset.poiPopMotion==='settled',{timeout:1400});
    assert.equal(await page.locator('.atlas-vector-selection .fp-vector-token' ).evaluate(el=>el.style.transform),'scale(1.34)',
      'POI stays enlarged after gentle overshoot and settle');
    // Native POI must finish on a persistent foreground plane ABOVE both
    // ordinary POIs and yellow saved stars, without a duplicate marker.
    const front=await page.evaluate(p=>{
      const map=window.__atlasPOIBridge.vector();
      const poi=document.getElementById('atlasPoiOverlay'),star=document.getElementById('atlasBookmarkOverlay'),
            top=document.getElementById('atlasSelectedPoiTop'),
            pin=top?.querySelector('.atlas-vector-selection');
      const point=map.project([p.lng,p.lat]),mapBox=map.getContainer().getBoundingClientRect(),
            rect=pin?.getBoundingClientRect();
      return {hasTop:!!top,markerCount:top?.querySelectorAll('.atlas-vector-selection').length||0,
        nativeParent:pin?.parentElement?.id,
        topZ:Number(getComputedStyle(top).zIndex),poiZ:Number(getComputedStyle(poi).zIndex),
        starZ:Number(getComputedStyle(star).zIndex),
        errorPx:rect?Math.hypot(rect.left+rect.width/2-mapBox.left-point.x,
          rect.top+rect.height/2-mapBox.top-point.y):null};
    },first);
    assert.equal(front.markerCount,1,'Tapped native POI must retain one original DOM marker on top');
    assert.equal(front.nativeParent,'atlasSelectedPoiTop','Native selected POI was hidden below overlay');
    assert.ok(front.topZ>front.poiZ&&front.topZ>front.starZ,'Selected POI not above other POIs and stars: '+JSON.stringify(front));
    assert.ok(front.errorPx!==null&&front.errorPx<3,'Promoted marker lost geographic anchor: '+JSON.stringify(front));
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
    const switchFront=await page.evaluate(()=>({
      count:document.querySelectorAll('#atlasSelectedPoiTop > .atlas-vector-selection').length,
      connected:!!document.querySelector('#atlasSelectedPoiTop > .atlas-vector-selection'),
      oldDetached:!window.__mapTestFirstToken?.isConnected
    }));
    assert.equal(switchFront.count,1,'POI switching left duplicate foreground markers');
    assert.equal(switchFront.oldDetached,true,'Previous selected POI must leave top plane');
    // The actual iPhone recording at 17:26 revealed a near-white card
    // mid-switch. Measure the real rendered label while the native camera
    // is still centering; this must never fade the existing sheet to zero.
    const continuity=await page.evaluate(async()=>{
      const card=document.getElementById('destinationCard');
      const title=document.getElementById('destinationTitle');
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const immediateName=title.textContent.trim();
      let minOpacity=1,hiddenFrames=0,frames=0;
      const start=performance.now();
      await new Promise(resolve=>{
        const sample=()=>{
          const opacity=parseFloat(getComputedStyle(title).opacity);
          if(Number.isFinite(opacity))minOpacity=Math.min(minOpacity,opacity);
          if(!card.classList.contains('visible')||!card.isConnected||card.inert)hiddenFrames++;
          frames++;
          if(performance.now()-start<380)requestAnimationFrame(sample);
          else resolve();
        };
        requestAnimationFrame(sample);
      });
      return {immediateName,minOpacity,hiddenFrames,frames,cardConnected:card.isConnected};
    });
    assert.equal(continuity.immediateName,'公园切点测试',
      'POI card must show newest selection within two visual frames: '+JSON.stringify(continuity));
    assert.ok(continuity.minOpacity>=.97,
      'POI-to-POI switch faded the live card to white: '+JSON.stringify(continuity));
    assert.equal(continuity.hiddenFrames,0,
      'Same card disappeared, went inert or became unclickable during switch');
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
        zIndex:Number(getComputedStyle(b).zIndex),
        duplicateMarkers:document.querySelectorAll('.atlas-vector-selection').length};
      b.remove();return result;
    },first);
    assert.equal(existing.isSelected,true,'Reuse the original on-map POI marker');
    assert.equal(existing.scale,'scale(1)','Existing marker also enlarges');
    assert.ok(existing.zIndex>=90,'Existing reused POI must remain foreground after motion');
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
    }
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
    // Screenshot regression: C V5 card can move through three heights
    // without ever changing or scaling the geographic map/WebGL canvas.
    const invariant=await page.evaluate(async()=>{
      const map=document.getElementById('rc-map'),
        canvas=document.querySelector('#rc-live-map-canvas canvas'),
        sheet=document.getElementById('rc-main');
      const previous=sheet.style.height;
      const sample=()=>({mapWidth:map.getBoundingClientRect().width,
        mapHeight:map.getBoundingClientRect().height,
        canvasWidth:canvas.getBoundingClientRect().width,
        canvasHeight:canvas.getBoundingClientRect().height,
        sheetTop:sheet.getBoundingClientRect().top});
      const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const initial=sample();
      sheet.style.height='77%';await tick();const expanded=sample();
      sheet.style.height='32%';await tick();const collapsed=sample();
      sheet.style.height=previous;await tick();const restored=sample();
      return {initial,expanded,collapsed,restored,
        viewportHeight:document.getElementById('rc-shell').getBoundingClientRect().height};
    });
    assert.ok(Math.abs(invariant.expanded.sheetTop-invariant.collapsed.sheetTop)>100,
      'Route sheet did not change height as simulated: '+JSON.stringify(invariant));
    for(const phase of ['expanded','collapsed','restored']){
      const b=invariant[phase],a=invariant.initial;
      assert.ok(Math.abs(b.mapHeight-a.mapHeight)<1&&Math.abs(b.mapWidth-a.mapWidth)<1,
        'The map viewport resized when sheet moved: '+JSON.stringify(invariant));
      assert.ok(Math.abs(b.canvasHeight-a.canvasHeight)<1&&Math.abs(b.canvasWidth-a.canvasWidth)<1,
        'MapLibre canvas was stretched when sheet moved: '+JSON.stringify(invariant));
    }
    assert.ok(Math.abs(invariant.initial.mapHeight-invariant.viewportHeight)<2,
      'Route map must fill the unscaled full screen behind card: '+JSON.stringify(invariant));
    await page.locator('[data-rc="source-map"]').first().click({timeout:12000});
    await page.waitForFunction(()=>document.querySelector('#rc-map')?.classList.contains('rc-map-picking'),{timeout:15000});
    // The route selection should use the EXACT homepage Stage1.29 renderer,
    // not another POI icon set or the map provider's colored glyphs.
    const homeOverlay=await page.evaluate(()=>({
      hasRenderer:/function candidatesFromVector\(map\)/.test(
        document.getElementById('atlas-route-home-poi-renderer')?.textContent||''),
      hasDOMPlane:!!document.querySelector('#rc-map > #atlasPoiOverlay'),
      sameMap:window.__atlasPOIBridge?.vector?.()===window.__atlasLivePlannerMap,
      handdrawnMap:window.AtlasPOIIcons?.icons?.hospital==='51_hospital',
      hasNativeIconSuppression:/icon-opacity',0/.test(
        document.getElementById('atlas-route-home-poi-renderer')?.textContent||'')
    }));
    assert.ok(homeOverlay.hasRenderer&&homeOverlay.hasDOMPlane&&homeOverlay.sameMap&&
      homeOverlay.handdrawnMap&&homeOverlay.hasNativeIconSuppression,
      'Route map did not use the exact homepage source POI renderer: '+JSON.stringify(homeOverlay));
    // A real user cannot tap the map before the accepted C V5 sheet spring
    // finishes its 530ms transition to peek. Reproduce the settled UI.
    await page.waitForTimeout(620);
    await page.evaluate(()=>{
      const m=window.__atlasLivePlannerMap,c=m.getCenter();
      m.fire('click',{lngLat:c,point:m.project([c.lng,c.lat])});
    });
    await page.waitForFunction(()=>window.__atlasRouteV5Live?.state?.selected?.length>=1,{timeout:15000});
    await page.waitForFunction(()=>document.querySelector('#rc-map-pins [data-place-id^="live-map-"]'),{timeout:12000});
    await page.waitForFunction(()=>document.querySelector('#rc-map-pins [data-place-id^="live-map-"].fp-route-tapped'),{timeout:10000});
    await page.waitForFunction(()=>!!window.__atlasRouteCameraTargetQA?.centerTo?.length,{timeout:12000});
    await page.waitForFunction(()=>{
      const m=window.__atlasLivePlannerMap,pin=document.querySelector('#rc-map-pins [data-place-id^="live-map-"]'),
        area=window.__atlasRouteViewportQA?.();
      return !!m&&!m.isMoving()&&!!pin&&!!area&&
        Math.abs((parseFloat(pin.style.top)||0)*area.height/100-area.targetY)<12;
    },null,{timeout:16000}).catch(async()=>{
      throw Error('Route tapped location failed visible-map center: '+JSON.stringify(
        await page.evaluate(()=>{
          const m=window.__atlasLivePlannerMap,p=document.querySelector('#rc-map-pins [data-place-id^="live-map-"]'),
            a=window.__atlasRouteViewportQA?.();
          return {mapCenter:m?.getCenter()?.toArray(),moving:m?.isMoving?.(),
            pinPercent:p?.style.top,pinId:p?.dataset.placeId,view:a,
            selected:window.__atlasRouteV5Live?.state?.selected,
            camera:window.__atlasRouteCameraTargetQA,
            focus:window.__atlasRouteFocusQA?.(),
            geo:window.__atlasRouteGeoSyncQA};
        })
      ));
    });
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const routePoi=await page.evaluate(()=>{
      const map=window.__atlasLivePlannerMap,pin=document.querySelector('#rc-map-pins [data-place-id^="live-map-"]'),
        frame=document.getElementById('rc-map').getBoundingClientRect(),img=pin?.querySelector('.fp-route-poi-art');
      const visible=window.__atlasRouteViewportQA?.();
      const x=(parseFloat(pin?.style.left)||0)*frame.width/100,
        y=(parseFloat(pin?.style.top)||0)*frame.height/100;
      return {
        pinCount:document.querySelectorAll('#rc-map-pins [data-place-id^="live-map-"]').length,
        foreground:pin?.classList.contains('fp-route-tapped'),zIndex:Number(getComputedStyle(pin).zIndex),
        homeGlyph:!!img&&!!pin?.classList.contains('fp-route-home-generic')&&
          /^data:image\/svg\+xml;base64,/.test(img.getAttribute('src')||''),
        usesPlusGlyph:!!img&&/16_add_place\.svg/.test(img.getAttribute('src')||''),
        homeCategoryMapReady:typeof window.AtlasPOIIcons?.categoryFor==='function',
        semanticHospital:window.AtlasPOIIcons?.categoryFor?.('hospital','上海市嘉定区南翔医院')==='hospital',
        semanticIconSrc:window.AtlasPOIIcons?.fileFor?.('hospital','医院'),
        centerErrorPx:Math.hypot(x-frame.width/2,y-(visible?.targetY??frame.height/2)),
        visibleAboveSheet:y<(visible?.sheetTop??frame.height)-16,
        mapUncoveredBottom:visible?.visibleBottom,
        targetY:visible?.targetY,sheetTop:visible?.sheetTop,
        zoom:map.getZoom(),
        frameSize:[frame.width,frame.height],
        canvasSize:[map.getContainer().clientWidth,map.getContainer().clientHeight],
        mapProjectedCenter:[map.project(map.getCenter()).x,map.project(map.getCenter()).y],
        pinPercent:[parseFloat(pin?.style.left),parseFloat(pin?.style.top)],
        cameraTargetQA:window.__atlasRouteCameraTargetQA||null,
        routePoiQA:window.__atlasRoutePoiQA?.(),routeGeoSyncQA:window.__atlasRouteGeoSyncQA||null,
        selectedNodeId:pin?.dataset.placeId,topMapEl:document.querySelector('#rc-map-pins')?.getBoundingClientRect()?.top
      };
    });
    assert.equal(routePoi.pinCount,1,'Route map point created duplicate pins');
    assert.equal(routePoi.foreground,true,'Route POI lost selected foreground after motion');
    assert.ok(routePoi.zIndex>=16,'Selected route POI not in top map layer');
    assert.equal(routePoi.homeGlyph,true,'Unclassified route map tap did not reuse the approved homepage selected-location glyph');
    assert.equal(routePoi.usesPlusGlyph,false,'Route map still displays the old generic plus-location tile');
    assert.equal(routePoi.homeCategoryMapReady,true,'Route page did not reuse the exact homepage 22-category POI classifier');
    assert.equal(routePoi.semanticHospital,true,'Homepage semantic category mapping was not preserved');
    assert.ok(/51_hospital\.svg$/.test(routePoi.semanticIconSrc||''),
      'Home POI semantic asset mismatch: '+JSON.stringify(routePoi));
    assert.ok(routePoi.centerErrorPx<12,'Selected route POI not centered in exposed map above card: '+JSON.stringify(routePoi));
    assert.equal(routePoi.visibleAboveSheet,true,
      'C V5 card covers the selected map point: '+JSON.stringify(routePoi));
    await page.screenshot({path:`map-evidence/route-map-poi-home-parity-${width}.png`,animations:'disabled'});

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
    // Dedicated route-page contract: ordinary POIs only assist during
    // explicit map selection, while the entire itinerary remains above
    // every approved C V5 card position on the unchanging vector canvas.
    const selectingLayers=await page.evaluate(()=>window.__atlasRouteFocusQA?.());
    assert.equal(selectingLayers.mode,'select','Route picker must enable nearby POIs only while selecting');
    assert.equal(selectingLayers.visiblePoiLayers.length,selectingLayers.poiLayers.filter(Boolean).length,
      'Map-select mode must restore the ordinary POI symbol layers');

    await page.evaluate(()=>{
      const m=window.__atlasLivePlannerMap,c=m.getCenter(),
        v=[c.lng+0.013,c.lat+0.009];
      m.fire('click',{lngLat:{lng:v[0],lat:v[1]},point:m.project(v)});
    });
    await page.waitForFunction(()=>window.__atlasRouteV5Live?.state?.selected?.length>=2,{timeout:12000});
    await page.evaluate(()=>window.__atlasRouteV5Live.stage('preview'));
    await page.waitForFunction(()=>{
      const r=window.__atlasRouteFocusQA?.();
      return r?.stage==='preview'&&r.mode==='route'&&r.fit?.stops>=2;
    },{timeout:15000});
    const sampleFullRoute=()=>page.evaluate(()=>{
      const m=window.__atlasLivePlannerMap,r=window.__atlasRouteFocusQA(),
        pane=m.getContainer().getBoundingClientRect(),card=document.getElementById('rc-main').getBoundingClientRect(),
        top=Math.max(0,card.top-pane.top);
      const pts=r.stops.map(p=>m.project([+p.lng,+p.lat]));
      return {stage:r.stage,mode:r.mode,poiLayers:r.poiLayers.length,
        visiblePoiLayers:r.visiblePoiLayers.length,fit:r.fit,
        mapHeight:pane.height,cardTop:top,
        canvasHeight:document.querySelector('#rc-live-map-canvas canvas').getBoundingClientRect().height,
        cardHeight:card.height,points:pts.map(p=>({x:p.x,y:p.y})),
        allVisible:pts.length>=2&&pts.every(p=>p.x>8&&p.x<pane.width-8&&p.y>10&&p.y<top-10),
        routeLineCount:document.querySelectorAll('#rc-map svg.rc-route polyline').length};
    });
    await page.waitForTimeout(1000);
    const initialRoute=await sampleFullRoute();
    assert.equal(initialRoute.mode,'route','Entering preview must end POI-picking mode');
    assert.equal(initialRoute.visiblePoiLayers,0,'Ordinary POI labels remained in route preview');
    await page.waitForTimeout(260);
    assert.equal(await page.locator('#rc-map #atlasPoiOverlay .fp-poi').count(),0,
      'Homepage semantic POI symbols must disappear outside map selection');
    assert.ok(initialRoute.routeLineCount>=2,'Route connecting polyline missing from preview');
    assert.equal(initialRoute.allVisible,true,'Entire preview route must stay above C V5 card: '+JSON.stringify(initialRoute));
    const grab=await page.locator('#rc-grab').boundingBox();
    assert.ok(grab,'Route preview grip missing');
    await page.mouse.move(grab.x+grab.width*.52,grab.y+20);
    await page.mouse.down();
    await page.mouse.move(grab.x+grab.width*.52,grab.y-142,{steps:12});
    await page.mouse.up();
    await page.waitForTimeout(1100);
    const movedRoute=await sampleFullRoute();
    assert.ok(movedRoute.cardHeight>initialRoute.cardHeight+48,
      'C V5 card drag did not expand: '+JSON.stringify({initialRoute,movedRoute}));
    assert.equal(movedRoute.allVisible,true,
      'Expanded card covered part of planned route: '+JSON.stringify(movedRoute));
    assert.ok(Math.abs(movedRoute.mapHeight-initialRoute.mapHeight)<1 &&
      Math.abs(movedRoute.canvasHeight-initialRoute.canvasHeight)<1,
      'Card drag resized or stretched underlying map: '+JSON.stringify({initialRoute,movedRoute}));
    console.log('PASS route always visible above card; map fixed; POIs contextual '+JSON.stringify({
      width,poiLayers:movedRoute.poiLayers,preview:initialRoute.cardHeight,
      expanded:movedRoute.cardHeight,mapHeight:movedRoute.mapHeight,
      initialPoints:initialRoute.points,expandedPoints:movedRoute.points}));
    console.log('PASS WebKit V4 shared route picker basemap '+JSON.stringify({width,...picker}));
   }finally{await context.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
