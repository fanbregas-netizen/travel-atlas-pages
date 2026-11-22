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
 // Route page shares the same OSM raster source and building vector tile data as the
 // home figure-ground map. The MapLibre client renders black building footprints
 // natively (no second JS PBF decoder / canvas painting loop on iPhone).
 // Keep figureStyle unchanged for homepage compatibility.
 function routeFigureStyle(){
  return 'https://tiles.openfreemap.org/styles/bright';
 }
 // Both product maps use one locale rule; avoid a bilingual stacked
 // "Huangpen'aocun / 黄盆岙村" label on the MapLibre default Bright style.
 function localizeLabels(map){
  const labels=map?.getStyle?.()?.layers||[];
  const once=['coalesce',
   ['get','name:zh'],['get','name_zh'],['get','name:zh-Hans'],['get','name:zh-CN'],
   ['get','name:nonlatin'],['get','name']];
  let changed=0;
  for(const l of labels){
   if(l.type!=='symbol')continue;
   const original=l.layout?.['text-field'];
   if(!original||!/name/i.test(JSON.stringify(original)))continue;
   try{
    const now=map.getLayoutProperty(l.id,'text-field');
    if(JSON.stringify(now)!==JSON.stringify(once)){map.setLayoutProperty(l.id,'text-field',once);changed++}
   }catch(_){}
  }
  return changed;
 }
 // QA-only diagnostic for visible vector names which lack a verified Chinese
 // translation. Source tiles/raster labels cannot be translated by CSS.
 function auditVisibleLabels(map){
  const ids=(map?.getStyle?.()?.layers||[])
   .filter(l=>l.type==='symbol'&&l.layout?.['text-field']&&l.layout.visibility!=='none')
   .map(l=>l.id);
  if(!ids.length||typeof map?.queryRenderedFeatures!=='function')
   return {available:false,sampled:0,needsReview:0,examples:[]};
  let rows=[];try{rows=map.queryRenderedFeatures(undefined,{layers:ids})||[]}catch(_){
   return {available:false,sampled:0,needsReview:0,examples:[]}
  }
  const unique=new Set(),examples=[];
  let sampled=0,needsReview=0;
  for(const f of rows){
   const p=f.properties||{},name=String(p.name||p['name:nonlatin']||p['name:latin']||'').trim();
   if(!name||unique.has(name))continue;unique.add(name);sampled++;
   const zh=p['name:zh']||p.name_zh||p['name:zh-Hans']||p['name:zh-CN'];
   if(!zh&&!/[\u3400-\u9fff]/u.test(name)){
    needsReview++;if(examples.length<30)examples.push(name.slice(0,70))
   }
  }
  return {available:true,sampled,needsReview,examples,
   note:'抽样仅反映当前可见矢量要素，缺少中文字段并不等于可自动翻译；栅格底图文字无法客户端替换'}
 }
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
  version:'与主页同源底图',tile,figureStyle,routeFigureStyle,lastCamera,localizeLabels,auditVisibleLabels,
  options:(container)=>({
   container,style:figureStyle(),...lastCamera(),
   minZoom:2,maxZoom:19,pitch:0,bearing:0,maxPitch:0,
   dragRotate:false,pitchWithRotate:false,touchPitch:false,
   renderWorldCopies:true,fadeDuration:120,attributionControl:{compact:true},
   pixelRatio:Math.min(Number(root.devicePixelRatio)||1,2)
  })
 });
})(window);
