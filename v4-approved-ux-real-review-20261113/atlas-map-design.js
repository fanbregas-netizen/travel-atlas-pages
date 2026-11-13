/* Footprint Map / Travel Atlas V4: shared 2D figure-ground visual palette. */
(()=>{'use strict';
/* Final V4 map A: high-contrast 2D architectural figure-ground. No fake
   outlines or labels; retains real vector footprints and one saved star. */
const palette=Object.freeze({paper:'#faf9f6',land:'#f7f6f2',park:'#eff1ea',water:'#e1e5e2',road:'#b9c0b9',minor:'#d9ddd6',ink:'#29332e',stroke:'#e3e8e1'});
function apply(map){if(!map?.getStyle||!map?.setPaintProperty)return false;const style=map.getStyle();if(!Array.isArray(style?.layers))return false;
for(const layer of style.layers){const id=String(layer.id||'').toLowerCase(),src=String(layer['source-layer']||'').toLowerCase(),name=id+' '+src;try{
if(layer.type==='background')map.setPaintProperty(layer.id,'background-color',palette.paper);
else if(layer.type==='fill'){const building=/building/.test(name),water=/water/.test(name),green=/park|landcover|landuse|wood|grass|forest|farmland|natural/.test(name);if(building){map.setPaintProperty(layer.id,'fill-color',['interpolate',['linear'],['zoom'],10,'#252c28',13.9,'#2a312c',15.15,'#414c45',15.72,'#cad1c8',16.25,'#fafaf7',17.1,'#ffffff',19,'#ffffff']);map.setPaintProperty(layer.id,'fill-opacity',['interpolate',['linear'],['zoom'],9,.9,13.5,.97,15.5,.92,16.2,.98,19,1]);}else map.setPaintProperty(layer.id,'fill-color',water?palette.water:green?palette.park:palette.land);}
else if(layer.type==='line'){const road=/road|street|highway|bridge|transport/.test(name),major=/motorway|trunk|primary/.test(name),water=/water/.test(name),building=/building/.test(name),trail=/path|track|footway|cycleway|pedestrian|steps|bridleway/.test(name);
/* build .18 · 低缩放不再空白:道路从 z5 起可见,主干道更早更深;人行道/小径虚线改细实线,去掉"虚线疤"。 */
if(trail){try{map.setPaintProperty(layer.id,'line-dasharray',['literal',[1,0]])}catch(_){}}
map.setPaintProperty(layer.id,'line-color',water?'#cacbc5':building?palette.stroke:major?'#9ba89e':road?palette.road:palette.minor);
/* build .21 · 用户批注：放到最大后 block 边缘的描线辣眼睛——建筑描边随放大淡出，街区块纯白干净 */
if(building)map.setPaintProperty(layer.id,'line-opacity',['interpolate',['linear'],['zoom'],13,.9,15.2,.18,15.5,0]);
if(road)map.setPaintProperty(layer.id,'line-opacity',['interpolate',['linear'],['zoom'],5,major?.55:.32,12,major?.78:.6,15,.89,19,.96]);}
else if(layer.type==='symbol'){map.setPaintProperty(layer.id,'text-color',palette.ink);map.setPaintProperty(layer.id,'text-halo-color','#faf9f5');map.setPaintProperty(layer.id,'text-halo-width',.9);}
else if(layer.type==='fill-extrusion')map.setLayoutProperty(layer.id,'visibility','none');
}catch(_){}}
try{map.setPitch?.(0)}catch(_){}return true;}
window.AtlasFigureGround={palette,apply,version:'v4-figure-ground-20261103.18'};
})();