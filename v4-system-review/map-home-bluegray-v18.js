/* Footprint Map V4 · blue-gray homepage map review, November 2026.
   Geographic camera, labels, saved-star and V3 POIs are left intact.
   Applies to existing MapLibre paint layers; never adds a raster overlay. */
(()=>{'use strict';
 const P=Object.freeze({
  background:'#485D6B', land:'#506676', building:'#617687',
  buildingFar:'#455A68', minorBuilding:'#758995',
  water:'#9DBDC4', park:'#799A86', ground:'#607785',
  road:'#B7C4C5', majorRoad:'#D8B7A6',
  minorRoad:'#8298A4', path:'#A9B8B5',
  text:'#F5F3EA', textMinor:'#E1E9E9', halo:'#384C5B'
 });
 let current=null, lastApply=0, applied=0, isApplying=false;
 const C=/building|roof|footprint|structure/i;
 const W=/water|river|canal|stream|lake|ocean|sea/i;
 const G=/park|garden|grass|forest|wood|landuse|landcover|meadow|nature|natural|green|wetland/i;
 const R=/road|street|transport|highway|bridge|tunnel|motorway|trunk|primary|secondary|tertiary|residential|service|pedestrian/i;
 const M=/motorway|trunk|primary|major|highway/i;
 const FOOT=/path|footway|cycleway|trail|track|steps|bridleway/i;
 const isLine=l=>l.type==='line',isFill=l=>l.type==='fill';
 function eq(a,b){return JSON.stringify(a)===JSON.stringify(b)}
 function paint(map,id,key,value){
  try{
   if(map.getPaintProperty(id,key)===undefined && !map.getLayer(id))return;
   if(!eq(map.getPaintProperty(id,key),value))map.setPaintProperty(id,key,value);
  }catch(_){}
 }
 function apply(map){
  if(!map||!map.isStyleLoaded?.()||isApplying)return false;
  isApplying=true;
  try{
   const layers=map.getStyle()?.layers||[];
   if(!layers.length)return false;
   for(const l of layers){
    const key=String(l.id)+' '+String(l['source-layer']||'');
    const building=C.test(key),water=W.test(key),green=G.test(key),road=R.test(key),
     major=M.test(key),foot=FOOT.test(key),relief=/atlas-route-building-relief/i.test(l.id);
    if(l.type==='background')paint(map,l.id,'background-color',P.background);
    else if(isFill(l)){
     if(building){
      paint(map,l.id,'fill-color',relief?'#344B5B':[
        'interpolate',['linear'],['zoom'],10,P.buildingFar,
        13.5,'#506674',15.1,P.building,16.5,P.minorBuilding,19,'#8496A0']);
      paint(map,l.id,'fill-opacity',relief?0.16:0.94);
      if(!relief)paint(map,l.id,'fill-outline-color','#465D6B');
     }else if(water)paint(map,l.id,'fill-color',P.water);
     else if(green)paint(map,l.id,'fill-color',P.park);
     else if(road)paint(map,l.id,'fill-color',major?P.majorRoad:P.road);
     else paint(map,l.id,'fill-color',P.land);
    }else if(isLine(l)){
     paint(map,l.id,'line-color',water?'#A8CBD1':
      building?'#455B6A':major?P.majorRoad:
      foot?P.path:road?P.road:green?'#8BAA96':'#889EAA');
     if(road)paint(map,l.id,'line-opacity',[
      'interpolate',['linear'],['zoom'],5,major?.80:.54,12,major?.95:.8,15,.94,19,1]);
     if(building)paint(map,l.id,'line-opacity',0.36);
    }else if(l.type==='symbol'){
     paint(map,l.id,'text-color',/housenumber/i.test(key)?P.textMinor:P.text);
     paint(map,l.id,'text-halo-color',P.halo);
     paint(map,l.id,'text-halo-width',1.15);
    }
   }
   applied++;lastApply=Date.now();
   document.documentElement.dataset.fpMapTheme='bluegray-v18';
   return true;
  }finally{isApplying=false}
 }
 function ready(map){
  if(current===map)return;
  current=map;
  const recolor=()=>requestAnimationFrame(()=>apply(map));
  map.on('style.load',()=>setTimeout(recolor,80));
  map.on('load',()=>setTimeout(recolor,80));
  const attempt=()=>{if(map.isStyleLoaded?.())recolor()};
  attempt();
  setTimeout(attempt,450);
  setTimeout(attempt,1200);
 }
 function attach(){
  const map=window.__atlasPOIBridge?.vector?.();
  if(map)ready(map);
 }
 window.__atlasBlueGrayMap={
  palette:P,apply:()=>{attach();return current?apply(current):false},
  status:()=>({ready:!!current,applied,lastApply,theme:document.documentElement.dataset.fpMapTheme,
   center:current?.getCenter?.()?.toArray(),zoom:current?.getZoom?.()})
 };
 window.addEventListener('atlas:map-bridge',attach,{passive:true});
 document.addEventListener('DOMContentLoaded',attach,{once:true});
 let checks=0;
 const tick=setInterval(()=>{attach();if(current||++checks>35)clearInterval(tick)},450);
})();