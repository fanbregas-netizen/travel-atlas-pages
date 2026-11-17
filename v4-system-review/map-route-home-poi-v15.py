#!/usr/bin/env python3
"""Route POI parity: derive exact homepage classifier, gold star and generic pin
from pinned full V4 source. Run AFTER map-route-focus-v13.py.
"""
from pathlib import Path
import re,sys
p=Path(sys.argv[1])
assert p.name=="route-cards-v5-live.js",p
root=p.parents[2]
home=(root/"index.html").read_text(encoding="utf-8")
runtime=(root/"v4-map-runtime.js").read_text(encoding="utf-8")
journey=root/"journey.html"
s=p.read_text(encoding="utf-8")
def once(old,new,label):
 global s
 n=s.count(old)
 if n!=1:raise SystemExit(f"{label}: expected one anchor, found {n}")
 s=s.replace(old,new,1)

start=home.find("const icons={mountain:'21_mountain'")
marker="window.AtlasPOIIcons={categoryFor,fileFor,icons:Object.freeze({...icons})};"
end=home.find(marker,start)
if start<0 or end<0:raise SystemExit("approved homepage 22-category classifier missing")
icon_code=home[start:end+len(marker)]
if icon_code.count("function categoryFor(")!=1:raise SystemExit("homepage icon classifier changed")
star=re.search(r"const SAVED_STAR_SVG=('[^']+');",runtime)
generic=re.search(r"img\.src=window\.AtlasPOIIcons\?\.fileFor\(place\.category,place\.name\)\|\|('data:image/svg\+xml;base64,[^']+')",runtime)
if not star or not generic:raise SystemExit("approved homepage saved-star or unclassified selection SVG missing")
if "#C9AD79" not in star.group(1):raise SystemExit("gold star visual changed")
boot='<script id="atlas-route-home-poi-classifier">\n(()=>{\'use strict\';\n'+icon_code+'\n})();\n</script>\n'
boot+='<script defer src="./src/interaction/poi-svg-motion-v4.js?v=home-poi-15"></script>\n'
html=journey.read_text(encoding="utf-8")
script='<script defer src="./src/interaction/route-cards-v5-live.js?v=fluid-3"></script>'
if html.count(script)!=1 or "atlas-route-home-poi-classifier" in html:
 raise SystemExit("journey boot contract changed")
journey.write_text(html.replace(script,boot+script,1),encoding="utf-8")

start=s.find("  function routeIcon(spot){")
end=s.find("  const selectionMapRender=mapRender;",start)
if start<0 or end<0 or s.count("  function routeIcon(spot){")!=1:
 raise SystemExit("route-only guessed category mapper missing")
art="""  // Draw one of the EXACT homepage marker families. All geographic
  // positions remain C V5's one existing button, not a second map marker.
  const ROUTE_HOME_STAR="""+star.group(1)+""";
  const ROUTE_HOME_GENERIC="""+generic.group(1)+""";
  function routeHomeCategory(spot){
   return window.AtlasPOIIcons?.categoryFor?.(spot.category,spot.name)||null;
  }
  function routeHomeKind(spot){
   if(spot.starred!==false&&!spot.routeOnly)return 'star';
   return routeHomeCategory(spot)?'semantic':'generic';
  }
  function routeArtwork(spot){
   const kind=routeHomeKind(spot);
   if(kind==='star')return ROUTE_HOME_STAR;
   const src=kind==='semantic'
    ?window.AtlasPOIIcons.fileFor(spot.category,spot.name):ROUTE_HOME_GENERIC;
   return '<span class="fp-route-home-token fp-vector-token"><img class="fp-route-poi-art" src="'+src+'" alt="" aria-hidden="true"></span>';
  }
"""
s=s[:start]+art+s[end:]
once(
 "class=\"rc-pin rc-choice-pin ${selected?'selected':''} ${String(spot.id)===liveTopPlaceId?'fp-route-tapped':''}\"",
 "class=\"rc-pin rc-choice-pin ${selected?'selected':''} ${String(spot.id)===liveTopPlaceId?'fp-route-tapped':''} fp-route-home-${routeHomeKind(spot)}\"",
 'route mark uses home icon kind')
once(
 '><img class="fp-route-poi-art" src="${routeIcon(spot)}" alt="" aria-hidden="true"></button>',
 '>${routeArtwork(spot)}</button>',
 'reuse home saved-star SVG, semantic glyph or generic selection')
once(
 "  id:'live'+i,storeId:String(p.id),starred:p.starred!==false,routeOnly:!!p.routeOnly,",
 "  id:'live'+i,storeId:String(p.id),starred:p.starred!==false,routeOnly:!!p.routeOnly,\n  category:String(p.category||p.type||p.kind||''),",
 'preserve saved place category')
once(
 "function livePickedPoint(lng,lat,poiName=''){",
 "function livePickedPoint(lng,lat,poiName='',poiCategory=''){",
 'tap category argument')
once(
 "  brief:stored.note,lat,lng,day:1,time:'',routeOnly:true,starred:false};",
 "  brief:stored.note,category:poiCategory,lat,lng,day:1,time:'',routeOnly:true,starred:false};",
 'record tap category')
once(
 "   return{name,lng,lat,d:Math.hypot(xy.x-e.point.x,xy.y-e.point.y)};",
 """   return{name,lng,lat,
    category:[props.class,props.subclass,props.type,props.amenity,props.tourism,props.shop]
     .filter(Boolean).join(' '),
    d:Math.hypot(xy.x-e.point.x,xy.y-e.point.y)};""",
 'native map POI category')
once(
 "  if(!livePickedPoint(lng,lat,point?.name||''))return;",
 "  if(!livePickedPoint(lng,lat,point?.name||'',point?.category||''))return;",
 'native POI kind on tap')
assert "16_add_place" not in s[s.find("function routeHomeCategory"):s.find("const selectionMapRender")]
p.write_text(s,encoding="utf-8")
print("PASS route POI = homepage exact golden star, 22 category glyphs, generic selected pin; never default plus")
