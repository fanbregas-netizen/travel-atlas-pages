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
elif path.name=='v4-map-runtime.js':
 # The original V4 disabled zoom on all POI taps, and it still used the
 # legacy four-bubble corridor unless the global swipe-card flag was set.
 # The POI's own click path must opt into ONE native camera ease/zoom.
 once(
  """    const moving=window.__atlasInteractionMode==='swipe-card'
      ?focusSelectedLocation(d):focusMapPlaceIfNeeded(d);""",
  """    // A real map POI starts a native, cancellable zoom+focus, not just a
    // 1.1x SVG bounce. Other flows keep their already-approved camera logic.
    const moving=d.__poiTap
      ?focusSelectedLocation(d,true)
      :(window.__atlasInteractionMode==='swipe-card'
        ?focusSelectedLocation(d):focusMapPlaceIfNeeded(d));""",
  'real-poi-camera-opt-in')
 once(
  """    const z=Math.max(2,Number(currentZoom())||12);
    // V4 .19: the old forced +1.55 zoom/780ms flyTo reloaded whole map
    // tiles during every POI tap. Safari displayed a grey/blank basemap
    // BEFORE the delayed card reveal. Keep the current zoom. Pan only when
    // the point would otherwise be obscured or beyond the visual corridor.
    let pt=null;""",
  """    const z=Math.max(2,Number(currentZoom())||12);
    // Natural native camera zoom (NOT a CSS scale of the whole map).
    // 0.55-0.70 zoom levels is a gentle ~1.45-1.63x enlargement; old +1.55
    // flyTo caused tile thrash and grey gaps on iPhone Safari.
    if(zoomOnPoi){
      const targetZoom=Math.min(16.7,z+(z<14?0.70:z<15.7?0.56:0.38));
      const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
      userHasMovedMap=true;
      if(isVector()&&vectorMap){
        vectorMap.stop();
        // Point ends above the card; MapLibre keeps markers geo-anchored.
        const offsetY=-Math.round(Math.min(innerHeight*0.145,120));
        vectorMap.easeTo({center:[lng,lat],zoom:targetZoom,offset:[0,offsetY],
          duration:reduce?0:640,essential:true,
          easing:t=>1-Math.pow(1-t,3)});
        return true;
      }
      if(isOfficial()&&officialMap){
        const xy=wgsToGcj(lng,lat);
        try{officialMap.setZoomAndCenter(targetZoom,xy,reduce,reduce?0:600)}catch(_){return false}
        return true;
      }
      if(map){
        map.stop?.();
        map.easeTo?.({center:[lng,lat],zoom:targetZoom,
          duration:reduce?0:640,essential:true,easing:t=>1-Math.pow(1-t,3)});
        return true;
      }
    }
    // Saved stars keep the already-accepted swipe-card camera framing.
    let pt=null;""",
  'native-tap-zoom')
 once(
  "  function focusSelectedLocation(place){",
  "  function focusSelectedLocation(place,zoomOnPoi=false){",
  'poi-camera-mode-arg')
 once(
  "      showDestination(point);return;",
  "      showDestination({...point,__poiTap:true});return;",
  'native-vector-feature-poi')
 once(
  "    select:(place)=>showDestination(place),",
  "    select:(place)=>showDestination({...place,__poiTap:true}),",
  'drawn-svg-poi-bridge')
 once(
  "document.body.classList.remove('destination-selected')}",
  "document.body.classList.remove('destination-selected');document.dispatchEvent(new Event('atlas:poi-cleared'))}",
  'clear-original-selected-icon')
 once(
  "    if(isVector()){vectorMap[animated?'flyTo':'jumpTo']({center:[lng,lat],zoom:zoom??vectorMap.getZoom(),essential:true,duration:animated?duration:0});return;}",
  """    if(isVector()){
      const current=vectorMap.getZoom(),requested=zoom??current;
      // A same-zoom POI pan is an ease, NOT a fly/zoom tile reload.
      vectorMap.stop();
      if(animated&&Math.abs(requested-current)<.05)
        vectorMap.easeTo({center:[lng,lat],zoom:current,duration:Math.min(duration,440),essential:true,easing:t=>1-Math.pow(1-t,3)});
      else vectorMap[animated?'flyTo':'jumpTo']({center:[lng,lat],zoom:requested,essential:true,duration:animated?duration:0});
      return;
    }""",
  'poi-avoid-zoom-ghost')
 once(
  "  function showVectorSelection(place){\n    if(!isVector())return;\n    if(vectorSelectionMarker)vectorSelectionMarker.remove();",
  """  function showVectorSelection(place){
     if(!isVector())return;
     // POI has its OWN stable, animated hand-drawn SVG in the DOM overlay.
     // Never paint an extra MapLibre icon at the identical coordinate.
     const node=Array.from(document.querySelectorAll('#atlasPoiOverlay > .fp-poi')).find(el=>
       el.dataset.poiId===String(place.id||'')&&
       Math.abs(Number(el.dataset.poiLat)-Number(place.lat))<.00001&&
       Math.abs(Number(el.dataset.poiLng)-Number(place.lng))<.00001);
     if(node){
       vectorSelectionMarker?.remove();vectorSelectionMarker=null;
       node.classList.add('is-selected');
       return;
     }
     if(vectorSelectionMarker)vectorSelectionMarker.remove();""",
  'single-poi-animation-owner')
else: raise SystemExit('unexpected map repair target: '+str(path))
path.write_text(source,encoding='utf-8')
print('map smooth repair:',path)
