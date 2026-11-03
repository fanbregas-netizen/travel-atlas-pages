/* Footprint Map / Travel Atlas V4: shared 2D figure-ground visual palette. */
(()=>{'use strict';
const palette=Object.freeze({paper:'#f7f6f3',land:'#f3f2ee',park:'#f0efe9',water:'#e3e3df',road:'#b5b6b1',minor:'#d7d7d0',ink:'#393c39',stroke:'#e6e5df'});
function apply(map){if(!map?.getStyle||!map?.setPaintProperty)return false;const style=map.getStyle();if(!Array.isArray(style?.layers))return false;
for(const layer of style.layers){const id=String(layer.id||'').toLowerCase(),src=String(layer['source-layer']||'').toLowerCase(),name=id+' '+src;try{
if(layer.type==='background')map.setPaintProperty(layer.id,'background-color',palette.paper);
else if(layer.type==='fill'){const building=/building/.test(name),water=/water/.test(name),green=/park|landcover|landuse|wood|grass|forest|farmland|natural/.test(name);if(building){map.setPaintProperty(layer.id,'fill-color',['interpolate',['linear'],['zoom'],10,'#313331',14,'#323432',15.5,'#565956',16.2,'#fcfbf8',19,'#ffffff']);map.setPaintProperty(layer.id,'fill-opacity',['interpolate',['linear'],['zoom'],9,.8,13.5,.93,15.5,.83,16.2,.96,19,.98]);}else map.setPaintProperty(layer.id,'fill-color',water?palette.water:green?palette.park:palette.land);}
else if(layer.type==='line'){const road=/road|street|highway|bridge|transport/.test(name),water=/water/.test(name),building=/building/.test(name);map.setPaintProperty(layer.id,'line-color',water?'#cacbc5':building?palette.stroke:road?palette.road:palette.minor);if(road)map.setPaintProperty(layer.id,'line-opacity',['interpolate',['linear'],['zoom'],8,.4,12,.64,15,.89,19,.96]);}
else if(layer.type==='symbol'){map.setPaintProperty(layer.id,'text-color',palette.ink);map.setPaintProperty(layer.id,'text-halo-color','#faf9f5');map.setPaintProperty(layer.id,'text-halo-width',1.1);}
else if(layer.type==='fill-extrusion')map.setLayoutProperty(layer.id,'visibility','none');
}catch(_){}}
try{map.setPitch?.(0)}catch(_){}return true;}
window.AtlasFigureGround={palette,apply,version:'v4-figure-ground-20261103'};
})();