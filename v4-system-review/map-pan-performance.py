#!/usr/bin/env python3
"""V4 isolated map-only optimization for natural POI centering on iPhone Safari.

Camera animation, SVG spring and existing cards stay; remove frame-by-frame
DOM layout churn and redundant icon-spring restart, and avoid rewriting all
bookmark nodes during an automatic center pan.
"""
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text(encoding='utf-8')
def once(a,b,label):
 global s
 n=s.count(a)
 if n!=1:raise SystemExit(f"{label}: expected one anchor; found {n}")
 s=s.replace(a,b,1)

if p.name=='v4-map-runtime.js':
 once(
  """    const duration=prefersStill?0:500;
    const easing=t=>1-Math.pow(1-t,3);""",
  """    const duration=prefersStill?0:470;
    // Gentle acceleration AND deceleration. The previous 1-(1-t)^3
    // front-loaded most of the movement and appeared to snap, then stall.
    const easing=t=>t*t*(3-2*t);""",
  'even-camera-easing')
 once(
  """  function scheduleVectorBookmarkRender(){
    if(vectorBookmarkFrame||document.hidden)return;
    vectorBookmarkFrame=requestAnimationFrame(()=>{
      vectorBookmarkFrame=0;
      if(isVector())renderVectorBookmarks();
    });
  }""",
  """  function scheduleVectorBookmarkRender(){
    if(vectorBookmarkFrame||document.hidden)return;
    vectorBookmarkFrame=requestAnimationFrame(()=>{
      vectorBookmarkFrame=0;
      if(isVector())renderVectorBookmarks();
    });
  }
  // Automatic centering needs position-only updates. Rebuilding saved-star
  // DOM, sorting locations, updating selected cards and sweeping caches on
  // every camera frame janks Safari. Run the full render at moveend instead.
  let bookmarkMotionFrame=0;
  function scheduleVectorBookmarkMotion(){
    if(bookmarkMotionFrame||document.hidden)return;
    bookmarkMotionFrame=requestAnimationFrame(()=>{
      bookmarkMotionFrame=0;
      if(!isVector())return;
      const pane=$('atlasBookmarkOverlay');
      if(!pane)return;
      for(const b of pane.querySelectorAll('.atlas-bookmark-hit[data-place-id]')){
        const lng=Number(b.dataset.geoLng),lat=Number(b.dataset.geoLat);
        if(!Number.isFinite(lng)||!Number.isFinite(lat))continue;
        const point=vectorMap.project([lng,lat]);
        if(!Number.isFinite(point.x)||!Number.isFinite(point.y))continue;
        // CSS translate runs on the compositor without triggering layout.
        const ox=parseFloat(b.style.left),oy=parseFloat(b.style.top);
        if(Number.isFinite(ox)&&Number.isFinite(oy)){
          b.style.translate=(point.x-ox)+'px '+(point.y-oy)+'px';
        }
      }
    });
  }""",
  'defer-heavy-star-paint')
 once(
  """      b.style.left=it.x+'px';b.style.top=it.y+'px';
      b.style.fontSize='34px';""",
  """      b.style.removeProperty('translate');
      b.style.left=it.x+'px';b.style.top=it.y+'px';
      b.dataset.geoLng=String(it.p.lng);b.dataset.geoLat=String(it.p.lat);
      b.style.fontSize='34px';""",
  'bookmark-motion-geographic-cache')
 once(
  """      vectorMap.on('move',()=>{userHasMovedMap=true;scheduleVectorBookmarkRender();if(selectedId)relayoutMemoryOpen();const pane=$('atlasPoiOverlay');if(pane)pane.style.opacity=window.__atlasPOICentering?'1':'0'});""",
  """      vectorMap.on('move',()=>{
        userHasMovedMap=true;
        if(window.__atlasPOICentering)scheduleVectorBookmarkMotion();
        else scheduleVectorBookmarkRender();
        if(selectedId)relayoutMemoryOpen();
        const pane=$('atlasPoiOverlay'),opacity=window.__atlasPOICentering?'1':'0';
        if(pane&&pane.style.opacity!==opacity)pane.style.opacity=opacity;
      });""",
  'center-pan-fast-path')
 # Markers undergoing the automatic pan were positioned by translate
 # relative to their pre-pan left/top. A normal full render at moveend commits
 # the new geographic left/top and clears the compositor translation.
elif p.name=='index.html':
 once(
  """    b.style.left=p.x+'px';b.style.top=p.y+'px';""",
  """    // Do not relayout ~20 individual POI hit targets every WebGL frame.
    // Keep their baseline left/top stable and track camera pixels through
    // a compositor-only translate; their SVG animation remains independent.
    const baseX=parseFloat(b.style.left),baseY=parseFloat(b.style.top);
    if(Number.isFinite(baseX)&&Number.isFinite(baseY))
      b.style.translate=(p.x-baseX)+'px '+(p.y-baseY)+'px';
    else {b.style.left=p.x+'px';b.style.top=p.y+'px'}""",
  'composited-poi-tracking')
 once(
  """   b.style.left=xy.x+'px';b.style.top=xy.y+'px';b.title=p.name;""",
  """   b.style.removeProperty('translate');
   b.style.left=xy.x+'px';b.style.top=xy.y+'px';b.title=p.name;""",
  'commit-poi-final-position')
elif p.name=='poi-svg-motion-v4.js':
 once(
  """function popSelected(token){
 if(!token||!token.isConnected)return;
 clearSelected();""",
  """function popSelected(token){
 if(!token||!token.isConnected)return;
 // Click handler and showVectorSelection both acknowledge the SAME tap.
 // Resetting the spring between them yielded a visible one-frame hitch.
 if(selectedPoiToken===token&&selectedPoiAnimation)return;
 clearSelected();""",
  'one-animation-per-tap')
else:
 raise SystemExit('Unsupported map-only performance patch path '+str(p))
p.write_text(s,encoding='utf-8')
print('PASS V4 map-only center-pan frame optimization:',p)
