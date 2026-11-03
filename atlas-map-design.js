/* Footprint Map V4 architectural master style — a real MapLibre vector layer, not a raster filter. */
(()=>{
  'use strict';
  const palette=Object.freeze({
    paper:'#f8f7f3',land:'#f2f0eb',park:'#edeee7',water:'#dfe7e8',
    road:'#b9bbb5',minor:'#d4d5d0',ink:'#30352f',stroke:'#838983'
  });
  const ID='atlas-real-architectural-footprints';
  const buildingColor=['interpolate',['linear'],['zoom'],
    10,'#343936',12,'#292e2b',14,'#292e2b',15.5,'#444a45',
    16,'#dadbd5',16.35,'#fbfbf8',18,'#ffffff'];
  const buildingOutline=['interpolate',['linear'],['zoom'],
    10,'#353935',15,'#494d48',16,'#a0a49c',17,'#838982',19,'#828780'];
  const buildingOpacity=['interpolate',['linear'],['zoom'],
    10,.95,13,1,15.6,.98,16.3,1,19,1];
  function apply(map){
    if(!map?.getStyle||!map?.setPaintProperty)return {ok:false,reason:'maplibre-not-ready'};
    const style=map.getStyle();
    if(!Array.isArray(style?.layers))return {ok:false,reason:'style-layers-not-ready'};
    for(const layer of style.layers){
      const id=String(layer.id||'').toLowerCase();
      const src=String(layer['source-layer']||'').toLowerCase();
      const name=id+' '+src;
      try{
        if(layer.type==='background')map.setPaintProperty(layer.id,'background-color',palette.paper);
        else if(layer.type==='fill'){
          const building=/building/.test(name),water=/water/.test(name);
          const green=/park|landcover|landuse|wood|grass|forest|farmland|natural/.test(name);
          if(building){
            map.setPaintProperty(layer.id,'fill-color',buildingColor);
            map.setPaintProperty(layer.id,'fill-opacity',buildingOpacity);
            try{map.setPaintProperty(layer.id,'fill-outline-color',buildingOutline)}catch(_){}
          }else {
            map.setPaintProperty(layer.id,'fill-color',water?palette.water:green?palette.park:palette.land);
          }
        }else if(layer.type==='line'){
          const road=/road|street|highway|bridge|transport/.test(name);
          const water=/water/.test(name);
          map.setPaintProperty(layer.id,'line-color',water?'#b8c9c9':road?palette.road:palette.minor);
          if(road)map.setPaintProperty(layer.id,'line-opacity',['interpolate',['linear'],['zoom'],8,.48,12,.73,15,.9,19,.96]);
        }else if(layer.type==='symbol'){
          try{map.setPaintProperty(layer.id,'text-color',palette.ink)}catch(_){}
          try{map.setPaintProperty(layer.id,'text-halo-color','#faf9f6')}catch(_){}
          try{map.setPaintProperty(layer.id,'text-halo-width',1.05)}catch(_){}
        }else if(layer.type==='fill-extrusion'){
          map.setLayoutProperty(layer.id,'visibility','none');
        }
      }catch(err){console.debug('Optional map style adjustment skipped:',layer.id,err?.message)}
    }
    // Explicit geometry source-layer. The old design relied on style layer names,
    // so in some styles the building changes never drew anything.
    const ref=style.layers.find(l=>l['source-layer']==='building'&&l.source);
    const source=ref?.source||Object.keys(style.sources||{}).find(k=>style.sources[k]?.type==='vector');
    if(!source)return {ok:false,reason:'no-vector-source'};
    try{
      if(!map.getLayer(ID)){
        const before=style.layers.find(l=>l.type==='symbol')?.id;
        map.addLayer({
          id:ID,type:'fill',source,'source-layer':'building',minzoom:11,
          paint:{
            'fill-color':buildingColor,
            'fill-opacity':buildingOpacity,
            'fill-outline-color':buildingOutline,
            'fill-antialias':true
          }
        },before);
      }
      map.setPitch?.(0);map.setBearing?.(0);
      return {ok:!!map.getLayer(ID),layerId:ID,source,version:'v4.4-real-vector-map'};
    }catch(err){
      console.warn('Unable to enable real architectural footprints:',err);
      return {ok:false,reason:String(err?.message||err)};
    }
  }
  window.AtlasFigureGround={palette,apply,version:'v4.4-real-vector-map',buildingLayerId:ID};
})();
