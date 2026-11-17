#!/usr/bin/env python3
"""Map-only V4 2026-11-17 Safari acceptance repairs.
Apply solely to an isolated copy of the November 17 full V4 candidate.
No card, route, visual or media source is modified.
"""
from pathlib import Path
import sys

target = Path(sys.argv[1])
assert target.name == 'v4-map-runtime.js', target
source = target.read_text(encoding='utf-8')

def once(before, after, label):
    global source
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one source anchor, found {count}')
    source = source.replace(before, after, 1)

# Failed CDN attempts must allow the explicit retry button to start a new fetch.
once(
    '    });return fallbackScriptRequest;\n  }\n  let vectorRenderWatch=',
    "    });\n    fallbackScriptRequest=fallbackScriptRequest.catch(error=>{fallbackScriptRequest=null;throw error});\n    return fallbackScriptRequest;\n  }\n  let vectorRenderWatch=",
    'maplibre-retry')

# A large rendered-feature hit rectangle must not pick the first unrelated label.
# Prefer a real direct hit, then the nearest geometrically verified point.
start='''      const pool=feats.filter(f=>/poi|place|station|shop|amenity|tourism|historic|museum|hotel|restaurant|cafe|railway|mountain_peak|attraction|park|garden/.test((f.layer?.id||'').toLowerCase()+' '+(f.sourceLayer||'')+' '+(f.properties?.class||'')+' '+(f.properties?.subclass||''))&&readPoiName(f.properties||{}));
      if(!pool.length)continue;
      poi=pool.map(f=>{
        let d=Infinity;
        try{
          if(f.geometry?.type==='Point'&&Array.isArray(f.geometry.coordinates)){
            const px=vectorMap.project(f.geometry.coordinates);
            d=Math.hypot(px.x-e.point.x,px.y-e.point.y);
          }
        }catch(_){}
        return{f,d};
      }).sort((a,b)=>a.d-b.d)[0].f;
      break;'''
end='''      const eligible=f=>/poi|place|station|shop|amenity|tourism|historic|museum|hotel|restaurant|cafe|railway|mountain_peak|attraction|park|garden/.test((f.layer?.id||'').toLowerCase()+' '+(f.sourceLayer||'')+' '+(f.properties?.class||'')+' '+(f.properties?.subclass||''))&&readPoiName(f.properties||{});
      const pool=feats.filter(eligible);
      if(!pool.length)continue;
      let direct=[];
      try{direct=vectorMap.queryRenderedFeatures(e.point).filter(eligible)}catch(_){}
      const candidates=(direct.length?direct:pool).map(f=>{
        let d=Infinity;
        try{
          if(f.geometry?.type==='Point'&&Array.isArray(f.geometry.coordinates)){
            const px=vectorMap.project(f.geometry.coordinates);
            d=Math.hypot(px.x-e.point.x,px.y-e.point.y);
          }
        }catch(_){}
        return{f,d};
      }).filter(item=>Number.isFinite(item.d)).sort((a,b)=>a.d-b.d);
      if(candidates.length&&candidates[0].d<=pad+10){poi=candidates[0].f;break}
      // Polygon labels are accepted only when the finger actually intersects
      // the painted feature, not an arbitrary 38px neighboring rectangle.
      if(direct.length){poi=direct[0];break}'''
once(start,end,'poi-accurate-hit')

# No synchronous duplicate bookmark repaints in mapmove + moveend + zoomend.
once("officialMap.on('moveend',()=>{if(!isOfficial())return;lockOfficialNorthUp();renderBookmarkOverlay();",
     "officialMap.on('moveend',()=>{if(!isOfficial())return;lockOfficialNorthUp();requestOfficialBookmarkRender();",
     'amap-moveend-batching')
once("officialMap.on('zoomend',()=>{if(!isOfficial())return;lockOfficialNorthUp();syncNativeFeatures();renderBookmarkOverlay();",
     "officialMap.on('zoomend',()=>{if(!isOfficial())return;lockOfficialNorthUp();syncNativeFeatures();requestOfficialBookmarkRender();",
     'amap-zoomend-batching')

# Clip touch-hit targets to the actual map overlay rather than the Safari window.
once("x>window.innerWidth||y<0||y>window.innerHeight)continue;",
     "x>pane.clientWidth||y<0||y>pane.clientHeight)continue;",
     'amap-overlay-viewport')

assert 'window.AtlasPOIMotion?.play(token,d.category,d.name)' in source
assert "window.__atlasMapHealth=()" in source
assert 'const SAVED_STAR_SVG=' in source
target.write_text(source,encoding='utf-8')
print('Map-only repairs applied:',target)
