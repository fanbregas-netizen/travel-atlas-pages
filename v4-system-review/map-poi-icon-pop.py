#!/usr/bin/env python3
"""Map acceptance ONLY: enlarge selected POI pictogram, never the basemap.
Keep the original V4 22 SVG internal path animations untouched.
"""
from pathlib import Path
import sys
path=Path(sys.argv[1]);assert path.name=='poi-svg-motion-v4.js'
s=path.read_text(encoding='utf-8')
anchor="let sequence=0;\nfunction play(target,category,name){"
assert s.count(anchor)==1,('prelude',s.count(anchor))
prelude="""// The selected POI icon itself grows and settles. Map camera stays fixed.
// One selected icon and one active animation: rapid A -> B taps cancel A.
let selectedPoiToken=null,selectedPoiAnimation=null;
function clearSelected(){
 try{selectedPoiAnimation?.cancel()}catch(_){}
 selectedPoiAnimation=null;
 if(selectedPoiToken){
  selectedPoiToken.style.removeProperty('transform');
  selectedPoiToken.style.removeProperty('transition');
  selectedPoiToken.style.removeProperty('transform-origin');
  selectedPoiToken.style.removeProperty('will-change');
 }
 selectedPoiToken=null;
}
function popSelected(token){
 if(!token||!token.isConnected)return;
 clearSelected();
 selectedPoiToken=token;
 token.style.setProperty('transform-origin','center center','important');
 token.style.setProperty('transition','none','important');
 token.style.setProperty('transform','scale(1.34)');
 if(reduced()||document.hidden||typeof token.animate!=='function')return;
 token.style.setProperty('will-change','transform');
 // 1.00 -> 1.52 -> 1.29 -> 1.34: perceptible but gentle growth
 // applied only to the existing geographic marker artwork.
 const frames=[
  {transform:'scale(1)',offset:0},
  {transform:'scale(1.52)',offset:.49},
  {transform:'scale(1.29)',offset:.77},
  {transform:'scale(1.34)',offset:1}
 ];
 try{
  const a=token.animate(frames,{duration:485,easing:'cubic-bezier(.22,.82,.22,1)',fill:'none'});
  selectedPoiAnimation=a;
  a.onfinish=()=>{
   if(selectedPoiAnimation!==a||selectedPoiToken!==token)return;
   token.style.setProperty('transform','scale(1.34)');
   token.style.removeProperty('will-change');
   selectedPoiAnimation=null;
  };
 }catch(_){token.style.removeProperty('will-change')}
}
document.addEventListener('atlas:poi-cleared',clearSelected,{passive:true});
"""
s=s.replace(anchor,prelude+anchor,1)
anchor="  begin(svg);\n  const motor=window.FootprintRubberSpring;"
assert s.count(anchor)==1,('skip double spring',s.count(anchor))
s=s.replace(anchor,"  begin(svg);\n  // Only one spring: the selected outer pictogram owns the scale motion.\n  if(target===selectedPoiToken)return;\n  const motor=window.FootprintRubberSpring;",1)
old="window.AtlasPOIMotion=Object.freeze({play,playStar,categoryId,version:'v4-internal-svg-18'});"
assert s.count(old)==1
s=s.replace(old,"window.AtlasPOIMotion=Object.freeze({play,popSelected,clearSelected,playStar,categoryId,version:'v4-internal-svg-18-map-pin-pop'});",1)
path.write_text(s,encoding='utf-8')
print('Map-only POI artwork enlargement installed',path)
