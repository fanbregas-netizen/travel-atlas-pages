/**
 * Travel Atlas / architectural map B.
 * The main Footprint Map remains unchanged. This module adds a near-overhead
 * building-massing layer to the route map, using the SAME real OSM geometries.
 *
 * Distant: black figure-ground. Transitional: semitransparent charcoal.
 * Close: luminous white roof blocks, soft side faces and higher perceived depth.
 * North always up; pitch never exceeds 17 degrees.
 */
(()=>{'use strict';
const VERSION='travel-atlas-architectural-B-20261103';
const LAYER='atlas-travel-white-block-massing';
const LIMIT=17;
const roofColor=[
  'interpolate',['linear'],['zoom'],
  11,'#2d302e',14.2,'#303230',15.0,'#4a4d49',
  15.48,'#7d807b',15.85,'#b3b6b0',16.2,'#e0e1dd',
  16.55,'#f7f7f3',17.1,'#ffffff',19,'#ffffff'
];
const roofOpacity=[
  'interpolate',['linear'],['zoom'],
  10,.98,14.6,.96,15.1,.86,15.45,.54,
  15.78,.40,16.04,.52,16.3,.76,16.72,.94,17.2,.99,19,1
];
const roofOutline=[
  'interpolate',['linear'],['zoom'],
  11,'#4a4d49',15.0,'#72756e',15.7,'#b5b7b0',
  16.45,'#c2c6bf',17.2,'#babfb8',19,'#bec3bb'
];
const extrusionColor=[
  'interpolate',['linear'],['zoom'],
  15.6,'#797d77',16.02,'#c9cbc5',
  16.48,'#f0f0ec',16.85,'#fdfdfa',17.35,'#ffffff',19,'#ffffff'
];
const extrusionOpacity=[
  'interpolate',['linear'],['zoom'],
  15.58,0,15.85,.12,16.12,.43,16.4,.76,16.75,.92,17.5,.97,19,.97
];
const height=['max',8,['to-number',['coalesce',['get','render_height'],['get','height'],12],12]];
const base=['max',0,['to-number',['coalesce',['get','render_min_height'],['get','min_height'],0],0]];
const extrudedHeight=[
  'interpolate',['linear'],['zoom'],
  15.6,0,16.1,['*',.28,height],16.55,['*',.78,height],
  17.2,['*',1.22,height],19,['*',1.27,height]
];
const extrudedBase=[
  'interpolate',['linear'],['zoom'],
  15.6,0,16.1,['*',.28,base],16.55,['*',.78,base],
  17.2,['*',1.22,base],19,['*',1.27,base]
];
function pitchForZoom(z){
  if(z<=15.4)return 0;
  if(z<15.9)return (z-15.4)/.5*5.5;
  if(z<16.6)return 5.5+(z-15.9)/.7*7;
  if(z<17.3)return 12.5+(z-16.6)/.7*4.5;
  return LIMIT;
}
function findBuildingLayer(map){
  const layers=map.getStyle?.()?.layers||[];
  return layers.find(layer=>layer.type==='fill'&&layer.source&&layer['source-layer']&&
    /building/i.test(layer.id+' '+layer['source-layer']))||null;
}
function setStyle(map){
  const target=findBuildingLayer(map);
  if(!target)return {ok:false,reason:'No building polygons in current map style'};
  const buildingFills=(map.getStyle?.()?.layers||[]).filter(layer=>layer.type==='fill'&&/building/i.test(String(layer.id)+' '+String(layer['source-layer']||'')));
  const set=(property,value)=>{for(const layer of buildingFills){try{map.setPaintProperty(layer.id,property,value)}catch(e){console.warn('Architectural property unavailable',property,e?.message)}}};
  set('fill-color',roofColor);
  set('fill-opacity',roofOpacity);
  set('fill-outline-color',roofOutline);
  try{
    map.setLight?.({anchor:'viewport',color:'#ffffff',intensity:.55,position:[1.45,210,63]});
  }catch(e){console.debug('Map light customization skipped',e?.message)}
  if(map.getLayer?.(LAYER))return {ok:true,layer:LAYER,source:target.source};
  const styles=map.getStyle()?.layers||[];
  const firstSymbol=styles.find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id;
  try{
    map.addLayer({
      id:LAYER,type:'fill-extrusion',source:target.source,
      'source-layer':target['source-layer'],
      minzoom:15.58,
      filter:['!=',['get','hide_3d'],true],
      paint:{
        'fill-extrusion-color':extrusionColor,
        'fill-extrusion-opacity':extrusionOpacity,
        'fill-extrusion-height':extrudedHeight,
        'fill-extrusion-base':extrudedBase
      }
    },firstSymbol);
    return {ok:true,layer:LAYER,source:target.source};
  }catch(err){
    console.warn('建筑体块图层未启用，保留连续的二维黑白地图',err);
    return {ok:false,reason:String(err?.message||err)};
  }
}
function attach(map){
  if(!map||map.__atlasRouteBInstalled)return;
  map.__atlasRouteBInstalled=true;
  let raf=0;
  const updatePitch=()=>{
    if(raf)return;
    raf=requestAnimationFrame(()=>{
      raf=0;
      const z=Number(map.getZoom?.());
      if(!Number.isFinite(z))return;
      const target=pitchForZoom(z);
      try{
        if(Math.abs((map.getPitch?.()||0)-target)>.15)map.setPitch(target);
        if(Math.abs(map.getBearing?.()||0)>.2)map.setBearing(0);
      }catch(e){console.debug('地图俯视角度调整失败',e?.message)}
    });
  };
  const styled=setStyle(map);
  map.on?.('zoom',updatePitch);
  map.on?.('zoomend',updatePitch);
  map.on?.('resize',updatePitch);
  updatePitch();
  window.__atlasRouteBStatus={version:VERSION,...styled,pitchMax:LIMIT};
}
window.AtlasRouteBuildings={attach,pitchForZoom,version:VERSION,zoomStages:[
  {zoom:12.5,name:'Black figure-ground',opacity:.98,pitch:0},
  {zoom:15.6,name:'Semi-transparent transition',opacity:.47,pitch:pitchForZoom(15.6)},
  {zoom:17.3,name:'White blocks + raised roofs',opacity:.99,pitch:pitchForZoom(17.3)}
]};
})();