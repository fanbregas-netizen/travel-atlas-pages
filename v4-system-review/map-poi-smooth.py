#!/usr/bin/env python3
"""Scope-limited map surface fixes for V4 Safari: index POI overlay and runtime."""
from pathlib import Path
import sys
path=Path(sys.argv[1])
source=path.read_text(encoding='utf-8')
def once(old,new,label):
 global source
 count=source.count(old)
 if count!=1: raise SystemExit(f'{label}: expected 1 anchor, got {count}')
 source=source.replace(old,new,1)

if path.name=='index.html':
 once(
  "      window.setTimeout(()=>{if(b.isConnected)bridge?.select?.(selected)},220);",
  "      // The selected icon already animates in place; the card opens in the SAME tap frame.\n      // Delaying 220ms spawned another selected marker over it, visible as ghosting.\n      if(b.isConnected)bridge?.select?.(selected);",
  'poi-tap-no-220ms-gap')
 once(
  "for(const l of labels){try{map.setPaintProperty(l.id,'icon-opacity',0)}catch(_){}}",
  "for(const l of labels){try{if(map.getPaintProperty(l.id,'icon-opacity')!==0)map.setPaintProperty(l.id,'icon-opacity',0)}catch(_){}}",
  'stop-styledata-endless-repaint')
 once(
  "   if(activePointer===id)b.classList.add('is-selected');",
  "   b.classList.toggle('is-selected',activePointer===id&&document.body.classList.contains('destination-selected'));",
  'never-leave-stale-highlight')
 once(
  " function schedule(){if(queued)return;queued=window.setTimeout(doRender,140)}",
  """ // Reposition EXISTING georeferenced SVG buttons with the map on every visual
 // frame. Never detach nodes or replay SVG motion while the camera eases.
 let anchorFrame=0;
 function queueAnchorSync(){
  if(anchorFrame||document.hidden)return;
  anchorFrame=requestAnimationFrame(()=>{
   anchorFrame=0;
   const m=bridge?.vector?.(),pane=$('atlasPoiOverlay');
   if(!m||!pane)return;
   for(const b of pane.querySelectorAll(':scope > .fp-poi')){
    const lng=Number(b.dataset.poiLng),lat=Number(b.dataset.poiLat);
    if(!Number.isFinite(lng)||!Number.isFinite(lat))continue;
    const p=m.project([lng,lat]);
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    b.style.left=p.x+'px';b.style.top=p.y+'px';
   }
  });
 }
 document.addEventListener('atlas:poi-cleared',()=>{
  activePointer='';
  $('atlasPoiOverlay')?.querySelectorAll('.fp-poi.is-selected').forEach(n=>n.classList.remove('is-selected'));
 });
 function schedule(){if(queued)return;queued=window.setTimeout(doRender,140)}""",
  'map-poi-anchor-sync')
 once(
  "map.__fpPoi29Bound=true;map.on?.('moveend',schedule);",
  "map.__fpPoi29Bound=true;map.on?.('move',queueAnchorSync);map.on?.('moveend',schedule);",
  'sync-during-map-pan')
 once(
  "  for(const [id,node] of prior)if(!visibleIds.has(id))node.remove();",
  "  // Keep the selected SVG attached even when the POI density grid changes\n  // during centering: replacing it would truncate the accepted spring.\n  for(const [id,node] of prior)if(!visibleIds.has(id)&&id!==activePointer)node.remove();",
  'retain-selected-geographic-icon')
 once(
  "      window.AtlasPOIMotion?.play(b.querySelector('.fp-poi-token'),b.dataset.poiCategory,b.dataset.poiName);",
  """      // The pictogram pops while the camera smoothly pans at a CONSTANT zoom.
      window.AtlasPOIMotion?.popSelected?.(b.querySelector('.fp-poi-token'));
      window.AtlasPOIMotion?.play(b.querySelector('.fp-poi-token'),b.dataset.poiCategory,b.dataset.poiName);""",
  'existing-poi-apple-scale')
elif path.name=='v4-map-runtime.js':
 # The user-approved POI pictogram pop runs IN PLACE; map camera should
 # smoothly PAN (not ZOOM) to put the same geographic location at the
 # actual center of the iPhone screen. Rapid taps cancel the prior pan.
 once(
  """  let destinationRevealToken=0,destinationRevealTimer=null;
  function showDestination(d){""",
  """  let destinationRevealToken=0,destinationRevealTimer=null;
  function centerTappedPOI(d){
    const lat=Number(d?.lat),lng=Number(d?.lng);
    if(d?.lat==null||d?.lng==null||!Number.isFinite(lat)||!Number.isFinite(lng)||
        Math.abs(lat)>85.05||Math.abs(lng)>180)return false;
    const prefersStill=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
    const duration=prefersStill?0:500;
    const easing=t=>1-Math.pow(1-t,3);
    // Use the renderer's camera (not CSS-translation of raster tiles):
    // vector canvas and georeferenced POI SVGs must move as one surface.
    if(isVector()&&vectorMap){
      const p=vectorMap.project([lng,lat]);
      const canvas=vectorMap.getContainer();
      if(!p||Math.hypot(p.x-canvas.clientWidth/2,p.y-canvas.clientHeight/2)<2)return false;
      userHasMovedMap=true;
      vectorMap.stop();
      vectorMap.easeTo({center:[lng,lat],zoom:vectorMap.getZoom(),
        duration,easing,essential:true});
      return true;
    }
    if(isOfficial()&&officialMap){
      userHasMovedMap=true;
      officialMap.setZoomAndCenter(officialMap.getZoom(),wgsToGcj(lng,lat),
        prefersStill,duration);
      return true;
    }
    if(map){
      const p=map.project?.([lng,lat]),container=map.getContainer?.();
      if(p&&container&&Math.hypot(p.x-container.clientWidth/2,p.y-container.clientHeight/2)<2)return false;
      userHasMovedMap=true;
      map.stop?.();
      map.easeTo({center:[lng,lat],zoom:map.getZoom(),duration,easing,essential:true});
      return true;
    }
    return false;
  }
  function showDestination(d){""",
  'poimap-pan-center-function')
 once(
  """    const moving=window.__atlasInteractionMode==='swipe-card'
      ?focusSelectedLocation(d):focusMapPlaceIfNeeded(d);""",
  """    const moving=d.__poiTap?centerTappedPOI(d):
      (window.__atlasInteractionMode==='swipe-card'
       ?focusSelectedLocation(d):focusMapPlaceIfNeeded(d));""",
  'poi-icon-pop-plus-map-pan-to-center')

 once(
  "      vectorMap.stop();\n      vectorMap.easeTo({center:[lng,lat],zoom:vectorMap.getZoom(),",
  "      vectorMap.stop();\n      window.__atlasPOICentering=true;\n      vectorMap.easeTo({center:[lng,lat],zoom:vectorMap.getZoom(),",
  'poi-center-overlay-motion-flag')
 once(
  "      vectorMap.on('move',()=>{userHasMovedMap=true;scheduleVectorBookmarkRender();if(selectedId)relayoutMemoryOpen();const pane=$('atlasPoiOverlay');if(pane)pane.style.opacity='0'});",
  "      vectorMap.on('move',()=>{userHasMovedMap=true;scheduleVectorBookmarkRender();if(selectedId)relayoutMemoryOpen();const pane=$('atlasPoiOverlay');if(pane)pane.style.opacity=window.__atlasPOICentering?'1':'0'});",
  'do-not-fade-selected-poi-during-center-pan')
 once(
  "      vectorMap.on('moveend',()=>{rememberMapView();renderVectorBookmarks();scheduleVectorPOIs();const pane=$('atlasPoiOverlay');if(pane)pane.style.opacity='1';/* Legacy raster camera synchronizes once on provider fallback, not on every vector gesture. */});",
  "      vectorMap.on('moveend',()=>{window.__atlasPOICentering=false;rememberMapView();renderVectorBookmarks();scheduleVectorPOIs();const pane=$('atlasPoiOverlay');if(pane)pane.style.opacity='1';/* Legacy raster camera synchronizes once on provider fallback, not on every vector gesture. */});",
  'reset-overlay-motion-after-center')

 once(
  "      showDestination(point);return;",
  "      showDestination({...point,__poiTap:true});return;",
  'vector-feature-poi-tap')
 once(
  "    select:(place)=>showDestination(place),",
  "    select:(place)=>showDestination({...place,__poiTap:true}),",
  'overlay-poi-tap')
 once(
  """  function showVectorSelection(place){
    if(!isVector())return;
    if(vectorSelectionMarker)vectorSelectionMarker.remove();""",
  """  function showVectorSelection(place){
    if(!isVector())return;
    // Reuse the existing georeferenced POI instead of painting a duplicate.
    const node=Array.from(document.querySelectorAll('#atlasPoiOverlay > .fp-poi')).find(el=>
      el.dataset.poiId===String(place.id||'')&&
      Math.abs(Number(el.dataset.poiLat)-Number(place.lat))<.00001&&
      Math.abs(Number(el.dataset.poiLng)-Number(place.lng))<.00001);
    if(node){
      vectorSelectionMarker?.remove();vectorSelectionMarker=null;
      node.classList.add('is-selected');
      window.AtlasPOIMotion?.popSelected?.(node.querySelector('.fp-poi-token'));
      return;
    }
    if(vectorSelectionMarker)vectorSelectionMarker.remove();""",
  'one-existing-poi-owner')

 once(
  """    vectorSelectionMarker=new window.maplibregl.Marker({element:pin,anchor:'center'}).setLngLat([+place.lng,+place.lat]).addTo(vectorMap);
    if(window.AtlasPOIMotion?.categoryId(place.category,place.name))""",
  """    vectorSelectionMarker=new window.maplibregl.Marker({element:pin,anchor:'center'}).setLngLat([+place.lng,+place.lat]).addTo(vectorMap);
    window.AtlasPOIMotion?.popSelected?.(token);
    if(window.AtlasPOIMotion?.categoryId(place.category,place.name))""",
  'enlarge-native-map-poi')

else: raise SystemExit('unexpected map repair target: '+str(path))
path.write_text(source,encoding='utf-8')
print('map smooth repair:',path)
