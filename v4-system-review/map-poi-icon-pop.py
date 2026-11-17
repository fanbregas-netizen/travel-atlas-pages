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
prelude="""// Apple-like selected POI ONLY. The basemap NEVER zooms for a POI tap.
// iPhone WebKit can ignore an animated style when old inline rules win the
// cascade, so use a single cancelable requestAnimationFrame for ONE symbol.
let selectedPoiToken=null,selectedPoiAnimation=null;
function clearSelected(){
 try{selectedPoiAnimation?.cancel()}catch(_){}
 selectedPoiAnimation=null;
 if(selectedPoiToken){
  selectedPoiToken.style.removeProperty('transform');
  selectedPoiToken.style.removeProperty('transition');
  selectedPoiToken.style.removeProperty('transform-origin');
  selectedPoiToken.style.removeProperty('will-change');
  delete selectedPoiToken.dataset.poiPopMotion;
 }
 selectedPoiToken=null;
}
function popSelected(token){
 if(!token||!token.isConnected)return;
 clearSelected();
 selectedPoiToken=token;
 token.style.setProperty('transform-origin','center center','important');
 token.style.setProperty('transition','none','important');
 if(reduced()||document.hidden){
  token.style.setProperty('transform','scale(1.34)','important');
  return;
 }
 token.style.setProperty('will-change','transform');
 token.style.setProperty('transform','scale(1)','important');
 token.dataset.poiPopMotion='running';
 const segments=[
  {at:0,value:1},{at:.49,value:1.52},
  {at:.77,value:1.29},{at:1,value:1.34}
 ];
 const span=485,start=performance.now();
 let frame=0,active=true;
 const state={cancel(){active=false;cancelAnimationFrame(frame)}};
 selectedPoiAnimation=state;
 const tick=now=>{
  if(!active||selectedPoiToken!==token)return;
  const t=Math.min(1,(now-start)/span);
  let index=0;
  while(index<segments.length-2&&t>segments[index+1].at)index++;
  const from=segments[index],to=segments[index+1];
  const u=Math.max(0,Math.min(1,(t-from.at)/(to.at-from.at)));
  const e=1-Math.pow(1-u,3);
  const value=from.value+(to.value-from.value)*e;
  token.style.setProperty('transform','scale('+value.toFixed(4)+')','important');
  if(t<1){frame=requestAnimationFrame(tick);return}
  token.style.setProperty('transform','scale(1.34)','important');
  token.style.removeProperty('will-change');
  token.dataset.poiPopMotion='settled';
  selectedPoiAnimation=null;
 };
 frame=requestAnimationFrame(tick);
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
