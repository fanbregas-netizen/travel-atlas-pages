#!/usr/bin/env python3
"""Reuse the EXACT homepage Stage1.29 SVG POI overlay on route map selection.
The source is extracted from the approved V4 index.html; no icon rules fork.
Do not change accepted C V5 sheet, map camera, route stages or map selection.
Run after map-route-home-poi-v15.py.
"""
from pathlib import Path
import re,sys
p=Path(sys.argv[1])
assert p.name=="route-cards-v5-live.js",p
root=p.parents[2]
home=(root/"index.html").read_text(encoding="utf-8")
journey=root/"journey.html"
s=p.read_text(encoding="utf-8")
def once(a,b,k):
 global s
 n=s.count(a)
 if n!=1:raise SystemExit(f"{k}: expected one anchor, got {n}")
 s=s.replace(a,b,1)

renderer=re.search(r'<script data-inline="stage1-29-poi\.js">\s*(.*?)</script>',home,re.S)
if not renderer:raise SystemExit("approved homepage semantic POI renderer missing")
src=renderer.group(1)
if "function candidatesFromVector(map)" not in src or "const shown=renderRows(rows" not in src or "icon-opacity',0" not in src:
 raise SystemExit("home POI renderer changed: native-icons/handdrawn contract not recognized")
html=journey.read_text(encoding="utf-8")
pattern=r'<script id="atlas-route-home-poi-classifier">.*?</script>'
replacement='<script id="atlas-route-home-poi-renderer">\n'+src+'\n</script>'
html,n=re.subn(pattern,lambda _:replacement,html,count=1,flags=re.S)
if n!=1:raise SystemExit("route homepage classification bootstrap missing")
journey.write_text(html,encoding="utf-8")

once(
 """ const target=document.createElement('div');target.id='rc-live-map-canvas';
 routeMap.prepend(target);""",
 """ const target=document.createElement('div');target.id='rc-live-map-canvas';
 routeMap.prepend(target);
 // Same DOM POI layer/classes as the homepage. Unlike native MapLibre
 // icons, it uses trusted V3 ink art and the approved 22-category classifier.
 const homePoiPane=document.createElement('div');
 homePoiPane.id='atlasPoiOverlay';
 homePoiPane.setAttribute('aria-label','地图上可选择的地点');
 routeMap.append(homePoiPane);""",
 'one homepage POI overlay in route map')

once(
 " window.__atlasLivePlannerMap=liveMap;",
 """ window.__atlasLivePlannerMap=liveMap;
 // Route can reuse the SAME homepage stage1-29 renderer with one adapter:
 // its vector source is present only while adding places. Everything else
 // (camera, card state, route line and stop numbers) remains C V5.
 window.__atlasPOIBridge={
  vector:()=>liveMapPickMode&&state.active?liveMap:null,
  select:poi=>{
   if(!liveMapPickMode||!poi)return;
   const lat=Number(poi.lat),lng=Number(poi.lng);
   if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
   if(!livePickedPoint(lng,lat,poi.name||'',poi.category||''))return;
   liveMap.stop();
   const c=routeVisibleCameraCenter(lng,lat);
   if(window.matchMedia?.('(prefers-reduced-motion:reduce)')?.matches){
    liveMap.jumpTo({center:c});
   }else liveMap.easeTo({center:c,zoom:liveMap.getZoom(),duration:470,
    easing:t=>t*t*(3-2*t),essential:true});
  }
 };""",
 'homepage POI overlay uses route map bridge')

once(
 """ routeMap.classList.toggle('rc-map-picking',!!liveMapPickMode);
 syncRoutePoiVisibility();""",
 """ routeMap.classList.toggle('rc-map-picking',!!liveMapPickMode);
 // Trigger the homepage renderer to add/remove semantic POIs when the
 // user switches map selection. Route preview remains POI-free.
 window.dispatchEvent(new Event('atlas:map-bridge'));
 syncRoutePoiVisibility();""",
 'route map mode updates homepage POI renderer')

once(
 """  fit();
  syncRoutePoiVisibility();
  scheduleVisibleRouteFit(true);
 });""",
 """  fit();
  syncRoutePoiVisibility();
  scheduleVisibleRouteFit(true);
  window.dispatchEvent(new Event('atlas:map-bridge'));
 });""",
 'load binds homepage renderer to route geographic tiles')

p.write_text(s,encoding="utf-8")
print("PASS route map reuses approved home Stage1.29 native-to-SVG POI renderer only in selection mode:",p)
