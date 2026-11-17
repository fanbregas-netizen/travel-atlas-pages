#!/usr/bin/env python3
"""Only the C V5 route MAP surface: fixed canvas and visible-point camera.
No sheet gestures, route data, media or order are changed.
Apply after map-route-parity-v9.py.
"""
from pathlib import Path
import sys
p=Path(sys.argv[1])
assert p.name=="route-cards-v5-live.js",p
s=p.read_text(encoding="utf-8")
def once(old,new,label):
 global s
 n=s.count(old)
 if n!=1:raise SystemExit(f"{label}: anchor count {n}")
 s=s.replace(old,new,1)

once(
""" window.__atlasLivePlannerMap=liveMap;
 window.__atlasRoutePoiQA=()=>{""",
""" window.__atlasLivePlannerMap=liveMap;
 // The map stays full-viewport, independently of the C V5 spring sheet.
 // Center a tapped point in the actual EXPOSED portion of the map; moving
 // the sheet does not resize tiles or enlarge road strokes.
 function routeVisibleArea(){
  const rect=liveMap.getContainer().getBoundingClientRect();
  const card=main.getBoundingClientRect();
  const visibleBottom=Math.max(155,Math.min(rect.height,card.top-rect.top-12));
  const protectedTop=Math.min(visibleBottom-50,Math.max(100,Math.min(155,rect.height*.15)));
  const y=Math.max(46,Math.min(visibleBottom-22,(protectedTop+visibleBottom)/2));
  const overlayPx=Math.max(0,Math.min(rect.height,rect.bottom-card.top));
  routeMap.style.setProperty('--fp-route-sheet-overlay',Math.round(overlayPx+9)+'px');
  return{width:rect.width,height:rect.height,visibleBottom,targetY:y,
   offsetY:y-rect.height/2,sheetTop:card.top-rect.top};
 }
 function routeVisibleOffset(){
  const a=routeVisibleArea();
  return [0,a.offsetY];
 }
 function routeVisibleCameraCenter(lng,lat){
  // A MapLibre easeTo({center: same point,offset}) is a no-op when the
  // POI already equals the current camera center. Derive the REAL center
  // required to place it at the exposed-map target pixel instead.
  // Conversion is computed at the unchanged zoom, so map never enlarges.
  const view=routeVisibleArea();
  const pixel=liveMap.project([lng,lat]);
  return liveMap.unproject([pixel.x,pixel.y+view.height/2-view.targetY]).toArray();
 }
 window.__atlasRouteViewportQA=routeVisibleArea;
 // Attribution must remain above the sheet; it has no impact on map
 // canvas dimensions. Track only card size, not every map frame.
 const safeAreaObserver=typeof ResizeObserver==='function'?new ResizeObserver(()=>{
  routeVisibleArea();
 }):null;
 safeAreaObserver?.observe(main);
 window.addEventListener('pagehide',()=>safeAreaObserver?.disconnect(),{once:true});
 requestAnimationFrame(routeVisibleArea);
 window.__atlasRoutePoiQA=()=>{""",
'fixed-overlay-visible-center')

once(
 "liveMap.easeTo({center:[lng,lat],zoom:liveMap.getZoom(),duration:470,",
 "liveMap.easeTo({center:routeVisibleCameraCenter(lng,lat),zoom:liveMap.getZoom(),duration:470,",
 'picker-center-exposed-map')

once(
 "  if(Math.hypot(v.x-box.clientWidth/2,v.y-box.clientHeight/2)<2)return;",
 """  const visibleOffset=routeVisibleOffset();
  if(Math.hypot(v.x-box.clientWidth/2,v.y-(box.clientHeight/2+visibleOffset[1]))<2)return;""",
 'stored-marker-visible-center-check')

once(
 "liveMap.easeTo({center:[+place.lng,+place.lat],zoom:liveMap.getZoom(),",
 "liveMap.easeTo({center:routeVisibleCameraCenter(+place.lng,+place.lat),zoom:liveMap.getZoom(),",
 'stored-marker-visible-center-pan')

p.write_text(s,encoding='utf-8')
print('PASS C V5 route stable full-viewport map and exposed-map POI focus:',p)
