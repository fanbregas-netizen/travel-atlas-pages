#!/usr/bin/env python3
"""POI map-only V4 Safari motion synchronization patch.

One native MapLibre ease, and one shared compositor translation on both
geographic DOM overlays, derived synchronously from the same camera transform.
Do not update per-item geometry, rebuild symbols or repaint stars during pan.
At moveend commit both overlays to their new coordinates before removing
the shared translation so no one-frame jump can occur.
"""
from pathlib import Path
import sys
p=Path(sys.argv[1]);src=p.read_text(encoding='utf-8')
def once(old,new,label):
 global src
 n=src.count(old)
 if n!=1:raise SystemExit(f'{label}: expected 1 anchor, got {n}')
 src=src.replace(old,new,1)

if p.name=='v4-map-runtime.js':
 once(
  """    const pane=$('atlasPoiOverlay');if(pane)pane.replaceChildren();
  }
  let reverseReq=0,lastVectorPickAt=0,lastVectorPickKey='';""",
  """    // The actual hand-drawn overlay controller owns these live POI nodes.
    // The legacy vector POI placeholder used to REMOVE EVERY SVG on each
    // moveend, then the new controller recreated them 140ms later. That is
    // the visible vanish/reappear flicker in the iPhone recording.
    const pane=$('atlasPoiOverlay');
    if(pane&&!window.__atlasPOICommitCurrent)pane.replaceChildren();
  }
  let reverseReq=0,lastVectorPickAt=0,lastVectorPickKey='';""",
  'retire-legacy-poi-overlay-destructor')
 once(
  """        pixelRatio:mobileStableMap?Math.min(window.devicePixelRatio||1,2):undefined});""",
  """        pixelRatio:mobileStableMap?Math.min(window.devicePixelRatio||1,2):undefined,
        // A modest wider live-vector tile cache reduces newly blank edges
        // during neighboring POI pans without creating a second map.
        maxTileCacheSize:mobileStableMap?64:undefined,
        fadeDuration:200});""",
  'moderate-safari-vector-tile-cache')
 once(
  """  function centerTappedPOI(d){""",
  """  // The basemap and BOTH overlay planes share one camera transform.
  // Only two compositor writes per frame, independent of how many POIs exist.
  let poiCenterOrigin=null;
  function beginCenterPanVisuals(){
    if(poiCenterOrigin||!vectorMap)return;
    const center=vectorMap.getCenter(),size=vectorMap.getContainer();
    poiCenterOrigin={lng:center.lng,lat:center.lat,
      x:size.clientWidth/2,y:size.clientHeight/2};
  }
  function syncCenterPanVisuals(){
    if(!poiCenterOrigin||!vectorMap)return;
    const at=vectorMap.project([poiCenterOrigin.lng,poiCenterOrigin.lat]);
    const dx=(at.x-poiCenterOrigin.x).toFixed(2)+'px';
    const dy=(at.y-poiCenterOrigin.y).toFixed(2)+'px';
    for(const id of ['atlasPoiOverlay','atlasBookmarkOverlay']){
      const pane=$(id);
      if(pane)pane.style.translate=dx+' '+dy;
    }
  }
  function finishCenterPanVisuals(){
    if(!poiCenterOrigin)return;
    // Finish position recomputation without removing the old translation
    // until both DOM surfaces have committed their final geo-anchored pixels.
    try{window.__atlasPOICommitCurrent?.()}catch(error){console.warn('POI end-of-pan sync',error)}
    for(const id of ['atlasPoiOverlay','atlasBookmarkOverlay']){
      const pane=$(id);
      if(pane)pane.style.removeProperty('translate');
    }
    poiCenterOrigin=null;
  }
  function centerTappedPOI(d){""",
  'one-shared-overlay-translation')
 once(
  """      window.__atlasPOICentering=true;
      vectorMap.easeTo({center:[lng,lat],zoom:vectorMap.getZoom(),""",
  """      window.__atlasPOICentering=true;
      beginCenterPanVisuals();
      vectorMap.easeTo({center:[lng,lat],zoom:vectorMap.getZoom(),""",
  'begin-pan-in-one-frame')
 once(
  """        if(window.__atlasPOICentering)scheduleVectorBookmarkMotion();
        else scheduleVectorBookmarkRender();""",
  """        if(window.__atlasPOICentering)syncCenterPanVisuals();
        else scheduleVectorBookmarkRender();""",
  'sync-move-with-native-camera')
 once(
  """      vectorMap.on('moveend',()=>{window.__atlasPOICentering=false;rememberMapView();renderVectorBookmarks();scheduleVectorPOIs();const pane=$('atlasPoiOverlay');if(pane)pane.style.opacity='1';/* Legacy raster camera synchronizes once on provider fallback, not on every vector gesture. */});""",
  """      vectorMap.on('moveend',()=>{
        const wasCentering=window.__atlasPOICentering;
        rememberMapView();renderVectorBookmarks();
        if(wasCentering)finishCenterPanVisuals();
        window.__atlasPOICentering=false;
        scheduleVectorPOIs();
        const pane=$('atlasPoiOverlay');if(pane&&pane.style.opacity!=='1')pane.style.opacity='1';
        /* Legacy raster fallback camera remains unchanged. */
      });""",
  'commit-overlay-before-removing-translation')
 once(
  """    requestAnimationFrame(reveal);
    $('selectionFeedback').hidden=true;""",
  """    // Preserve the original icon-pop head start ONLY on first open.
    // An already-visible card must reflect the newest POI on the next
    // frame, without any postponed title or a fade-to-white renewal.
    const alreadyOpen=$('destinationCard')?.classList.contains('visible');
    if(d.__poiTap&&moving&&!alreadyOpen&&
       !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
      destinationRevealTimer=setTimeout(()=>requestAnimationFrame(reveal),105);
    else requestAnimationFrame(reveal);
    $('selectionFeedback').hidden=true;""",
  'handoff-card-after-icon-begins')
 once(
  """      const wasVisible=card.classList.contains('visible');
      card.classList.add('visible');
      const handoff=window.FootprintElasticHandoff;
      if(handoff?.revealCard)handoff.revealCard(card,{renew:wasVisible,commit:commitDestinationContent});
      else commitDestinationContent();""",
  """      const wasVisible=card.classList.contains('visible');
      card.classList.add('visible');
      const handoff=window.FootprintElasticHandoff;
      if(wasVisible){
        // Keep one opaque card while its map and POI move: the old renewed
        // spring faded title, category AND buttons to zero at midpoint.
        handoff?.stop?.(card);
        commitDestinationContent();
      }else if(handoff?.revealCard){
        handoff.revealCard(card,{renew:false,commit:commitDestinationContent});
      }else commitDestinationContent();""",
  'keep-live-poi-card-opaque-on-rapid-selection')
elif p.name=='index.html':
 once(
  """ function queueAnchorSync(){
  if(anchorFrame||document.hidden)return;""",
  """ function queueAnchorSync(){
  // Automatic centering is now handled by one shared parent compositor
  // translation in the map renderer itself. No per-POI rAF in this path.
  if(window.__atlasPOICentering)return;
  if(anchorFrame||document.hidden)return;""",
  'prevent-competing-per-marker-rAF')
 once(
  """ function schedule(){if(queued)return;queued=window.setTimeout(doRender,140)}""",
  """ // Synchronous end-of-pan commit before the map renderer removes the
 // shared overlay translation; avoids the one-frame marker disappearance.
 window.__atlasPOICommitCurrent=()=>{
  if(queued){clearTimeout(queued);queued=0}
  doRender();
 };
 function schedule(){if(queued)return;queued=window.setTimeout(doRender,140)}""",
  'commit-POI-overlay-together-with-stars')
elif p.name=='poi-svg-motion-v4.js':
 # No more changes to the already-approved one-icon scale animation.
 assert 'if(selectedPoiToken===token&&selectedPoiAnimation)return;' in src
else:raise SystemExit('unexpected target '+str(p))
p.write_text(src,encoding='utf-8')
print('PASS synchronized composited map movement:',p)
