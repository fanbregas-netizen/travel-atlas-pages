/* 家园地图与路线地图共用同一底图定义。
 * 原主页 figure 风格：OSM 栅格，俯视、零旋转、单一地图实例。
 * 未使用额外地图制图系统；后续高德正式接入也由同一 provider 控制。
 */
(function(root){'use strict';
 const tile='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
 const figureStyle=()=>({
  version:8,name:'开放街道图',
  sources:{base:{type:'raster',tiles:[tile],tileSize:256,attribution:'© OpenStreetMap contributors',maxzoom:19}},
  layers:[{id:'base-raster',type:'raster',source:'base',paint:{'raster-opacity':1}}]
 });
 function lastCamera(){
  try{
   const a=JSON.parse(localStorage.getItem('atlas-map-view')||'null');
   if(a&&Number.isFinite(+a.lng)&&Number.isFinite(+a.lat)&&Number.isFinite(+a.zoom)
    &&Math.abs(+a.lat)<=85&&Math.abs(+a.lng)<=180&&a.zoom>=2&&a.zoom<=19)
    return {center:[+a.lng,+a.lat],zoom:+a.zoom};
  }catch(_){}
  try{
   const b=JSON.parse(localStorage.getItem('travel-atlas-last-location-v19')||'null');
   if(b&&Number.isFinite(+b.lng)&&Number.isFinite(+b.lat)&&Math.abs(+b.lat)<=85&&Math.abs(+b.lng)<=180)
    return {center:[+b.lng,+b.lat],zoom:13.35};
  }catch(_){}
  return {center:[121.905,29.492],zoom:13.35};
 }
 root.FootprintSharedMap=Object.freeze({
  version:'与主页同源底图',tile,figureStyle,lastCamera,
  options:(container)=>({
   container,style:figureStyle(),...lastCamera(),
   minZoom:2,maxZoom:19,pitch:0,bearing:0,maxPitch:0,
   dragRotate:false,pitchWithRotate:false,touchPitch:false,
   renderWorldCopies:true,fadeDuration:120,attributionControl:{compact:true},
   pixelRatio:Math.min(Number(root.devicePixelRatio)||1,2)
  })
 });
})(window);
