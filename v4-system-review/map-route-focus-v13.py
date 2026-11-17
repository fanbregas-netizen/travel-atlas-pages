#!/usr/bin/env python3
"""C V5 route map focus: quiet ordinary POIs + live route-visible framing.
Run AFTER stable-viewport-v11. Never alter card physics or route data.
"""
from pathlib import Path
import sys
p=Path(sys.argv[1])
assert p.name=="route-cards-v5-live.js",p
s=p.read_text(encoding="utf-8")
def once(old,new,label):
 global s
 n=s.count(old)
 if n!=1:raise SystemExit(f"{label}: expected 1 anchor, found {n}")
 s=s.replace(old,new,1)

once(
 "let liveMapPickMode=null,liveMapPickHint=null;let liveTopPlaceId=null,liveTapFocusSerial=0;const livePendingRoutePlaces=new Map();",
 """let liveMapPickMode=null,liveMapPickHint=null;let liveTopPlaceId=null,liveTapFocusSerial=0;const livePendingRoutePlaces=new Map();
 // Route pages give visual priority to a route's own pins + connecting line.
 // Keep district names, street names and basemap details for orientation.
 // Only the ordinary POI symbol layers disappear in normal planning.
 const routePoiSavedVisibility=new Map();
 const routePoiLayerTest=/(^|[-_:])(poi|amenity|tourism|attraction|shop|leisure|housenumber|house_number|address|retail|restaurant|cafe|museum|hotel|hospital)([-_:]|$)/i;
 function isOrdinaryRoutePoiLayer(layer){
  if(layer?.type!=='symbol')return false;
  const id=String(layer.id||'').toLowerCase();
  const src=String(layer['source-layer']||'').toLowerCase();
  return routePoiLayerTest.test(id)||routePoiLayerTest.test(src);
 }
 function syncRoutePoiVisibility(){
  if(!liveMap||!liveMap.getStyle?.()?.layers)return;
  const selecting=Boolean(liveMapPickMode)&&
   (state.stage==='select'||state.stage==='preview'||state.stage==='order');
  for(const layer of liveMap.getStyle().layers){
   if(!isOrdinaryRoutePoiLayer(layer))continue;
   const id=layer.id;
   if(!routePoiSavedVisibility.has(id))
    routePoiSavedVisibility.set(id,layer.layout?.visibility||'visible');
   const visibility=selecting?routePoiSavedVisibility.get(id):'none';
   try{
    if((liveMap.getLayoutProperty(id,'visibility')||'visible')!==visibility)
     liveMap.setLayoutProperty(id,'visibility',visibility);
   }catch(_){}
  }
 }
 let routeFitFrame=0,routeFitKey='',routeFitReport=null;
 function scheduleVisibleRouteFit(force=false){
  if(!liveMap||!state.active||liveMapPickMode||
    (state.stage!=='preview'&&state.stage!=='order')||state.stops.length<2)return;
  if(force)routeFitKey='';
  if(routeFitFrame)return;
  routeFitFrame=requestAnimationFrame(()=>{
   routeFitFrame=0;
   fitRouteAboveCard();
  });
 }
 function fitRouteAboveCard(){
  if(!liveMap||liveMapPickMode||!state.active||
    !['preview','order'].includes(state.stage))return;
  const pts=state.stops.slice(0,9).filter(p=>
   Number.isFinite(+p.lng)&&Number.isFinite(+p.lat));
  if(pts.length<2)return;
  const canvas=liveMap.getContainer(),rect=canvas.getBoundingClientRect();
  const width=rect.width,H=rect.height;
  if(width<50||H<200)return;
  const cardTop=main.getBoundingClientRect().top-rect.top;
  const shown=Math.max(74,Math.min(H,cardTop));
  const top=Math.max(18,Math.min(116,shown*.24));
  const bottom=Math.max(0,H-shown)+Math.max(12,Math.min(24,shown*.09));
  const sides=Math.max(25,Math.min(44,width*.09));
  // Camera padding is relative to the UNCHANGED full-screen canvas.
  // This fits all route stops, including both endpoints, into uncovered map.
  const pad={top:Math.round(top),bottom:Math.round(bottom),
   left:Math.round(sides),right:Math.round(sides)};
  if(H-pad.top-pad.bottom<48)return;
  const signature=state.stage+'|'+Math.round(shown/2)*2+'|'+pts.map(p=>
   p.id+':'+(+p.lng).toFixed(5)+','+(+p.lat).toFixed(5)).join('|');
  if(signature===routeFitKey)return;
  routeFitKey=signature;
  try{
   const bounds=new window.maplibregl.LngLatBounds();
   pts.forEach(p=>bounds.extend([+p.lng,+p.lat]));
   const camera=liveMap.cameraForBounds(bounds,{padding:pad,maxZoom:12.5,bearing:0,pitch:0});
   if(!camera)return;
   // jumpTo is frame-synchronous, unlike easeTo which restarts on EVERY
   // sheet-drag frame. Only changes the geographic camera, never canvas size.
   const current=liveMap.getCenter();
   const change=Math.hypot(current.lng-camera.center.lng,current.lat-camera.center.lat);
   const zoomChange=Math.abs(liveMap.getZoom()-camera.zoom);
   routeFitReport={stage:state.stage,stops:pts.length,shown,padding:pad,
    target:[camera.center.lng,camera.center.lat],zoom:camera.zoom,change};
   if(change>1e-7||zoomChange>.003){
    liveMap.jumpTo({center:camera.center,zoom:camera.zoom,bearing:0,pitch:0});
   }
  }catch(e){
   console.warn('路线可视区域取景',e?.message||e);
  }
 }
 window.__atlasRouteFocusQA=()=>({
  mode:liveMapPickMode||'route',stage:state.stage,
  poiLayers:[...routePoiSavedVisibility.keys()],
  visiblePoiLayers:[...routePoiSavedVisibility.keys()].filter(id=>{
   try{return liveMap?.getLayoutProperty(id,'visibility')!=='none'}catch(_){return false}
  }),
  fit:routeFitReport,
  cardTop:main.getBoundingClientRect().top,
  mapHeight:liveMap?.getContainer().clientHeight,
  stops:state.stops.slice(0,9).map(p=>({id:p.id,lng:p.lng,lat:p.lat}))
 });""",
 'route-focused-state-and-camera')

once(
 """  routeMap.style.bottom=Math.max(0,px)+'px';""",
 """  // Full-viewport map stays fixed. The approved C V5 sheet floats above.
  // As the user drags it, keep the WHOLE route within the uncovered area.
  routeMap.style.bottom='0px';
  scheduleVisibleRouteFit();""",
 'sheet-drag-fits-entire-route')

once(
 "  lastRenderedStage=stage;",
 """  lastRenderedStage=stage;
  syncRoutePoiVisibility();
  scheduleVisibleRouteFit(true);""",
 'stage-changes-quiet-pois-and-refit')

once(
 "  routeMap.classList.toggle('rc-map-picking',!!liveMapPickMode);",
 """  routeMap.classList.toggle('rc-map-picking',!!liveMapPickMode);
  syncRoutePoiVisibility();
  if(!liveMapPickMode)scheduleVisibleRouteFit(true);""",
 'poi-selection-mode-only')

once(
 """   fit();
  });""",
 """   fit();
   syncRoutePoiVisibility();
   scheduleVisibleRouteFit(true);
  });""",
 'map-loaded-default-pois-hidden-route-visible')

p.write_text(s,encoding="utf-8")
print("PASS C V5 route overview fit in exposed map and contextual POI visibility:",p)
