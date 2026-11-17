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
  "      window.AtlasPOIMotion?.play(b.querySelector('.fp-poi-token'),b.dataset.poiCategory,b.dataset.poiName);",
  """      // Instantly pop the SINGLE POI pictogram; the geographic map stays fixed.
      window.AtlasPOIMotion?.popSelected?.(b.querySelector('.fp-poi-token'));
      window.AtlasPOIMotion?.play(b.querySelector('.fp-poi-token'),b.dataset.poiCategory,b.dataset.poiName);""",
  'existing-poi-apple-scale')
elif path.name=='v4-map-runtime.js':
 # The selected map pictogram grows. The MAP never zooms as a side effect
 # of a POI tap. Other approved searches, saved stars, route camera flows
 # keep their original behavior.
 once(
  """    const moving=window.__atlasInteractionMode==='swipe-card'
      ?focusSelectedLocation(d):focusMapPlaceIfNeeded(d);""",
  """    const moving=d.__poiTap?false:
      (window.__atlasInteractionMode==='swipe-card'
       ?focusSelectedLocation(d):focusMapPlaceIfNeeded(d));""",
  'poi-tap-does-not-zoom-map')
 once(
  "      showDestination(point);return;",
  "      showDestination({...point,__poiTap:true});return;",
  'vector-feature-poi-tap')
 once(
  "    select:(place)=>showDestination(place),",
  "    select:(place)=>showDestination({...place,__poiTap:true}),",
  'overlay-poi-tap')
 once(
  """     if(node){
       vectorSelectionMarker?.remove();vectorSelectionMarker=null;
       node.classList.add('is-selected');
       return;
     }""",
  """     if(node){
       vectorSelectionMarker?.remove();vectorSelectionMarker=null;
       node.classList.add('is-selected');
       window.AtlasPOIMotion?.popSelected?.(node.querySelector('.fp-poi-token'));
       return;
     }""",
  'enlarge-one-existing-poi')
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
