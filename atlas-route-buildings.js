/* Travel Atlas B · architectural figure-ground, strictly overhead (camera does not tilt).
   Shared vector footprints, black → translucent → white block, 2D side relief at close zoom.
   Does not alter any marker, route, photo, or POI behavior. */
(()=>{'use strict';
const VERSION='architectural-B-overhead-final-20261103';
const NEAR='atlas-route-building-relief-near',FAR='atlas-route-building-relief-far';
const roof=['interpolate',['linear'],['zoom'],11,'#303230',14.3,'#343633',15.08,'#5b5d59',15.48,'#969993',15.83,'#c7cac4',16.25,'#e8e9e5',16.65,'#f9f9f6',17.1,'#ffffff',19,'#ffffff'];
const alpha=['interpolate',['linear'],['zoom'],10,1,14.5,.98,15.12,.86,15.5,.47,15.82,.41,16.08,.55,16.46,.84,16.82,.97,19,1];
const outline=['interpolate',['linear'],['zoom'],12,'#3b3d39',15.45,'#7b7d77',16.32,'#c4c7c1',17,'#b7bcb5',19,'#b7bcb5'];
const relief1=['interpolate',['linear'],['zoom'],15.1,0,15.7,.04,16.15,.13,16.6,.25,17.1,.32,19,.32];
const relief2=['interpolate',['linear'],['zoom'],15.1,0,15.7,.02,16.15,.07,16.6,.15,17.1,.20,19,.2];
function findBuildings(map){
 const style=map.getStyle?.()||{};
 let buildings=(style.layers||[]).filter(l=>l.type==='fill'&&l.source&&l['source-layer']&&/building/i.test(String(l.id)+' '+String(l['source-layer'])));
 if(buildings.length)return buildings;
 const vector=Object.entries(style.sources||{}).find(([_,v])=>v?.type==='vector');if(!vector)return [];
 const id='atlas-route-fallback-real-buildings';
 try{if(!map.getLayer?.(id)){const before=style.layers?.find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id;map.addLayer({id,type:'fill',source:vector[0],'source-layer':'building',minzoom:11,paint:{'fill-color':'#353735','fill-opacity':.98}},before)}}
 catch(e){console.warn('无法载入建筑矢量轮廓',e);return []}
 return (map.getStyle?.()?.layers||[]).filter(l=>l.id===id);
}
function paint(map,layer,key,value){try{map.setPaintProperty(layer.id,key,value)}catch(e){console.warn('建筑样式未支持',key,e?.message)}}
function addShadow(map,id,building,shift,opacity,color){
 if(map.getLayer?.(id))return;
 try{map.addLayer({id,type:'fill',source:building.source,'source-layer':building['source-layer'],minzoom:15.1,paint:{
  'fill-color':color,'fill-opacity':opacity,'fill-translate':shift,'fill-translate-anchor':'viewport'
 }},building.id)}catch(e){console.warn('建筑俯视体块侧面暂不可用',e?.message)}
}
function apply(map){
 const buildings=findBuildings(map);if(!buildings.length)return {ok:false,reason:'No OSM vector building footprint in the loaded map style'};
 for(const l of buildings){
  paint(map,l,'fill-color',roof);paint(map,l,'fill-opacity',alpha);paint(map,l,'fill-outline-color',outline);
 }
 const first=buildings[0];
 addShadow(map,FAR,first,[5,6],relief2,'#424a43');
 addShadow(map,NEAR,first,[2.5,3.4],relief1,'#70766f');
 // Markers, labels, interactive POIs and map camera are not modified.
 return {ok:true,footprints:buildings.length,relief:[NEAR,FAR]};
}
function attach(map){
 if(!map||map.__atlasOverheadB)return;
 map.__atlasOverheadB=true;
 const result=apply(map);
 try{if(Math.abs(map.getPitch?.()||0)>.05)map.setPitch?.(0)}catch(_){}
 window.__atlasRouteBStatus={version:VERSION,...result,view:'fixed-overhead',pitchMax:0};
}
window.AtlasRouteBuildings={attach,apply,pitchForZoom:()=>0,version:VERSION,zoomStages:[
 {zoom:12.8,name:'黑色建筑',opacity:.98,pitch:0},
 {zoom:15.65,name:'半透明过渡',opacity:.44,pitch:0},
 {zoom:17.3,name:'白色屋顶 + 俯视侧面',opacity:1,pitch:0}
]};
})();