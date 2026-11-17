#!/usr/bin/env python3
"""V4 map-only adapter repairs. Approved C V5 cards, dates, route order and storage untouched."""
from pathlib import Path
import sys
path=Path(sys.argv[1])
assert path.name=='route-cards-v5-live.js'
s=path.read_text(encoding='utf-8')
def once(a,b,label):
 global s
 n=s.count(a)
 if n!=1:raise SystemExit(f'{label}: expected 1 anchor, found {n}')
 s=s.replace(a,b,1)
once("function livePickedPoint(lng,lat){","function livePickedPoint(lng,lat,poiName=''){",'poi-title-param')
once(" const label='地图途经点'+(1+allPlaces.filter(p=>p.routeOnly).length);",
     " const label=String(poiName||'').trim().slice(0,58)||('地图途经点'+(1+allPlaces.filter(p=>p.routeOnly).length));",'poi-name')
once(
 " toast(mode==='add'?'已在路线中间添加地图途经点':'已选中真实地图位置');",
 """ const newPin=Array.from(routeMap.querySelectorAll('#rc-map-pins [data-place-id]')).find(el=>el.dataset.placeId===p.id);
 if(newPin&&!window.matchMedia?.('(prefers-reduced-motion:reduce)')?.matches){
   requestAnimationFrame(()=>newPin.isConnected&&newPin.classList.add('fp-map-pick-arrive'));
   newPin.addEventListener('animationend',()=>newPin.classList.remove('fp-map-pick-arrive'),{once:true});
 }
 toast(mode==='add'?'已在路线中间添加地图途经点':'已选中真实地图位置');""",'route-tap-cue')
once("function liveRenderCamera(){\n if(!liveMap||!allPlaces.length)return;",
     "function liveRenderCamera(rebuild=true){\n if(!liveMap||!allPlaces.length)return;",'frame-mode')
once(
 " if(state.active)mapRender();\n}\nasync function liveMountMap(){",
 """ if(!state.active)return;
 if(rebuild){mapRender();return}
 // Move existing pins with the WebGL map; never destroy/recreate DOM in a pan.
 const lookup=new Map(allPlaces.map((p,i)=>[String(p.id),pointPositions[i]]));
 for(const pin of routeMap.querySelectorAll('#rc-map-pins [data-place-id]')){
  const xy=lookup.get(pin.dataset.placeId);
  if(xy){pin.style.left=xy[0]+'%';pin.style.top=xy[1]+'%'}
 }
 const pts=state.stops.slice(0,9).map(p=>lookup.get(String(p.id)));
 if(pts.length>1&&pts.every(Boolean)){
  const value=pts.map(x=>x.join(',')).join(' ');
  routeMap.querySelectorAll('svg.rc-route polyline').forEach(line=>line.setAttribute('points',value));
 }
}
async function liveMountMap(){""",'route-pins-follow-map')
once(
 " liveMap.on('load',()=>{\n  try{",
 """ liveMap.on('load',()=>{
  window.AtlasFigureGround?.apply?.(liveMap);
  window.AtlasRouteBuildings?.attach?.(liveMap);
  try{""",'home-palette')
once(
 "    else if(layer.type==='symbol')liveMap.setPaintProperty(layer.id,'text-color','#414844');",
 """    else if(layer.type==='symbol'){
     liveMap.setPaintProperty(layer.id,'text-color','#29332e');
     const tf=layer.layout?.['text-field'];
     if(tf&&/name/i.test(JSON.stringify(tf)))try{
       liveMap.setLayoutProperty(layer.id,'text-field',['coalesce',['get','name:zh'],['get','name:nonlatin'],['get','name:latin'],['get','name']]);
     }catch(_){}
    }""",'same-chinese-labels')
once("  liveMapPaint=requestAnimationFrame(()=>{liveMapPaint=0;liveRenderCamera()});",
     "  liveMapPaint=requestAnimationFrame(()=>{liveMapPaint=0;liveRenderCamera(false)});",'no-rebuild-during-pan')
once(" liveMap.on('moveend',schedule);\n liveMap.on('zoomend',schedule);",
     " liveMap.on('move',schedule);\n liveMap.on('moveend',()=>liveRenderCamera(true));\n liveMap.on('zoomend',schedule);",'live-reproject')
once(
 """ liveMap.on('click',e=>{
  if(liveMapPickMode&&e.lngLat)livePickedPoint(Number(e.lngLat.lng),Number(e.lngLat.lat));
 });""",
 """ // Use exactly tapped real vector POI when one is painted under the finger.
 // Blank-map taps still select a precise geographic coordinate, as approved.
 function namedFeatureAtTap(e){
  if(!e.point)return null;
  const isPoi=f=>f.geometry?.type==='Point'&&Array.isArray(f.geometry.coordinates)&&
   /poi|place|amenity|tourism|historic|shop|garden|museum|park|station|hotel/.test(
   String(f.layer?.id||'').toLowerCase()+' '+String(f.sourceLayer||'').toLowerCase()+' '+String(f.properties?.class||'').toLowerCase());
  let rows=[];
  try{
   rows=liveMap.queryRenderedFeatures(e.point).filter(isPoi);
   if(!rows.length)rows=liveMap.queryRenderedFeatures([[e.point.x-27,e.point.y-27],[e.point.x+27,e.point.y+27]]).filter(isPoi);
  }catch(_){return null}
  const points=rows.map(f=>{
   const props=f.properties||{};
   const name=String(props['name:zh']||props.name_zh||props.name||props['name:nonlatin']||'').trim();
   const lng=Number(f.geometry.coordinates[0]),lat=Number(f.geometry.coordinates[1]);
   const xy=liveMap.project([lng,lat]);
   return{name,lng,lat,d:Math.hypot(xy.x-e.point.x,xy.y-e.point.y)};
  }).filter(p=>p.name&&p.d<=30).sort((a,b)=>a.d-b.d);
  return points[0]||null;
 }
 liveMap.on('click',e=>{
  if(!liveMapPickMode||!e.lngLat)return;
  const point=namedFeatureAtTap(e);
  const lng=point?.lng??Number(e.lngLat.lng),lat=point?.lat??Number(e.lngLat.lat);
  if(!livePickedPoint(lng,lat,point?.name||''))return;
  if(!window.matchMedia?.('(prefers-reduced-motion:reduce)')?.matches){
   liveMap.stop();
   liveMap.easeTo({center:[lng,lat],offset:[0,-58],duration:360,
    easing:t=>1-Math.pow(1-t,3),essential:true});
  }
 });""",'route-same-real-pois')
once(">＋</button>",">"+chr(36)+"{spot.starred!==false?'★':'＋'}</button>",'saved-stars-versus-new-route-pins')
path.write_text(s,encoding='utf-8')
print('Map-only route adapter repaired:',path)
