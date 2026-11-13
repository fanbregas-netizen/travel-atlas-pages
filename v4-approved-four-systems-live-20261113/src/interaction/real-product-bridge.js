/* Travel Atlas V4: one sheet owner for the actual #fpPlaceCard DOM.
 * UI remains the existing V4 HTML, map, star, Dock and IndexedDB.
 * The legacy AtlasPhase1 listener and document pointerdown dismissal are removed
 * from the integration entrypoint; dynamic card children are rebound safely.
 */
(()=>{'use strict';
 const api=window.TravelAtlasSheet,dom=window.TravelAtlasSheetDOM;
 if(!api||!dom){console.error('Unified sheet controller is unavailable');return}
 const cardCtrl=api.createSheetController(),searchCtrl=api.createSheetController();
 let card=null,cardHead=null,cardBinding=null,cardMotion=null,cardObserver=null;
 let search=null,searchBinding=null,searchMotion=null,searchObserver=null,closingTimer=null,searchClosingTimer=null;
 const find=id=>document.getElementById(id);
 const ensureGrip=(header)=>{
  let grip=header.querySelector('.atlas-card-grip');
  if(!grip){grip=document.createElement('button');grip.type='button';
    grip.className='atlas-card-grip';grip.setAttribute('aria-label','上下滑动地点卡片');
    header.prepend(grip)}
  return grip;
 };
 function syncCard(){
  if(!card)return;
  const state=cardCtrl.getState(),id=card.dataset.placeId;
  if(!card.hidden&&id&&(state.sheet==='closed'||state.selectedPlaceId!==id)){
   // During V3's physical exit the card is deliberately still visible.
   // Child-list mutations (media, Brief, or grip updates) must not interpret
   // that outgoing DOM as an external request to reopen the same place.
   if(state.sheet==='closed'&&(closingTimer!==null||
      cardMotion?.state()?.sheet==='closed'))return;
   cardCtrl.open(id);
  }else if(card.hidden&&state.sheet!=='closed')cardCtrl.close();
 }
 function mountCard(){
  const node=find('fpPlaceCard');if(!node)return;
  if(card!==node){
   cardObserver?.disconnect();cardMotion?.destroy();cardMotion=null;cardBinding?.destroy();cardBinding=null;cardHead=null;
   card=node;cardObserver=new MutationObserver(()=>{bindCard();syncCard()});
   cardObserver.observe(card,{childList:true,attributes:true,attributeFilter:['hidden']});
  }
  bindCard();syncCard();
 }
 function bindCard(){
  if(!card)return;
  const header=card.querySelector('.fp-card-header'),scroll=card.querySelector('.fp-card-scroll');
  if(!header||header===cardHead&&cardBinding)return;
  // Capture only an externally displayed card. During a physical close the
  // outgoing card remains visible and may replace its header as media rerenders.
  // Rebinding that DOM must never be treated as a new open request.
  const closingInFlight=cardCtrl.getState().sheet==='closed'&&
    (closingTimer!==null||cardMotion?.state()?.sheet==='closed');
  const pendingId=!card.hidden&&!closingInFlight ? card.dataset.placeId : null;
  cardMotion?.destroy();cardMotion=null;cardBinding?.destroy();cardBinding=null;cardHead=header;
  const grip=ensureGrip(header);
  cardBinding=dom.connectSheetDOM({
   controller:cardCtrl,sheet:card,header,grip,scroll,physicalMotion:true,
   onRender:next=>{
    // The outgoing physical spring may remain visible for a few frames after
    // the controller is closed. Make the entire subtree non-interactive NOW,
    // otherwise it can still steal the first tap on the persistent Dock.
    // Keep the spring motor as the sole animation/visibility owner.
    const exiting=next.sheet==='closed';
    card.inert=exiting;
    if(exiting)card.style.setProperty('pointer-events','none','important');
    else card.style.removeProperty('pointer-events');
    if(!exiting){if(closingTimer)clearTimeout(closingTimer);return}
    // Preserve the legacy close routine for video teardown/Dock state,
    // but let the approved closing motion finish first.
    if(closingTimer)clearTimeout(closingTimer);
    // One bounded close attempt. Never leave a ghost card covering the map
    // if Safari suspends WAAPI or the spring motor misses its final frame.
    const closeStartedAt=performance.now();
    const finishClose=()=>{
      closingTimer=null;
      if(cardCtrl.getState().sheet!=='closed')return;
      // Do not tear down an animating card at an arbitrary 440ms boundary.
      // The V3 motor owns the actual spring; Safari may take longer after
      // frame suspension, so wait until it settles (or its 840ms fail-safe).
      if(cardMotion?.state()?.animating && performance.now()-closeStartedAt<1150){
        closingTimer=setTimeout(finishClose,40);
        return;
      }
      window.__atlasClosePlace?.();
    };
    closingTimer=setTimeout(finishClose,50);
   }
  });
  cardMotion=window.TravelAtlasPhysicalSheet?.connect({sheet:card,controller:cardCtrl,header,grip,scroll})||null;
  if(pendingId&&cardCtrl.getState().sheet==='closed'){
    card.dataset.placeId=pendingId;cardCtrl.open(pendingId);
  }
 }
 function bindSearch(){
  const node=find('fpSearchSheet');
  if(!node||node===search&&searchBinding)return;
  searchObserver?.disconnect();searchMotion?.destroy();searchMotion=null;searchBinding?.destroy();search=node;
  const grip=node.querySelector('.fp-search-grip');
  if(!grip)return;
  searchBinding=dom.connectSheetDOM({
   controller:searchCtrl,sheet:search,grip,header:node.querySelector('.fp-search-top')||grip,
   scroll:node.querySelector('.fp-search-body'),physicalMotion:true,
   onRender:next=>{
    if(next.sheet!=='closed'){
      if(searchClosingTimer!==null){clearTimeout(searchClosingTimer);searchClosingTimer=null}
      return;
    }
    if(searchClosingTimer!==null)clearTimeout(searchClosingTimer);
    const started=performance.now();
    const finish=()=>{
      searchClosingTimer=null;
      if(searchCtrl.getState().sheet!=='closed'||!document.body.classList.contains('fp-search-open'))return;
      if(searchMotion?.state()?.animating&&performance.now()-started<1150){
        searchClosingTimer=setTimeout(finish,40);return;
      }
      search.querySelector('.fp-search-close')?.click();
    };
    searchClosingTimer=setTimeout(finish,42);
   }
  });
  // Search keeps the original controller and its actual result DOM.
  searchMotion=window.TravelAtlasPhysicalSheet?.connect({
    sheet:search,controller:searchCtrl,header:node.querySelector('.fp-search-top')||grip,
    grip,scroll:node.querySelector('.fp-search-body')
  })||null;
  searchObserver=new MutationObserver(()=>{
   const state=searchCtrl.getState();
   if(!search.hidden&&state.sheet==='closed'){
    searchCtrl.open('search-workspace');searchCtrl.snapTo('full');
   }else if(search.hidden&&state.sheet!=='closed')searchCtrl.close();
  });
  searchObserver.observe(search,{attributes:true,attributeFilter:['hidden']});
 }
 // On map blank taps, dismiss only after a short stationary pointer gesture.
 // The original code dismissed on pointerdown, even during map drags.
 let down=null;
 const excluded='#fpPlaceCard,#fpSearchSheet,#fpMediaViewer,#memorySheet,#drawer,dialog,.star-pin,.atlas-bookmark-hit,.atlas-photo-location-pin,.atlas-vector-photo-pin,.atlas-official-star,#destinationCard,#appDock,button,a,input,textarea,select,[contenteditable]';
 document.addEventListener('pointerdown',e=>{
   down=null;
   if(cardCtrl.getState().sheet==='closed'||e.target.closest?.(excluded))return;
   down={x:e.clientX,y:e.clientY,id:e.pointerId};
 },true);
 document.addEventListener('pointerup',e=>{
   if(!down||e.pointerId!==down.id)return;
   const d=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;
   if(d<=9&&!e.target.closest?.(excluded))cardCtrl.close();
 },true);
 document.addEventListener('pointercancel',()=>{down=null},true);
 const watch=new MutationObserver(()=>{if(!card||!search){mountCard();bindSearch()}});
 function init(){
  mountCard();bindSearch();
  watch.observe(document.body,{childList:true,subtree:false});
  window.AtlasPhase1={version:'V4-unified-sheet-B-20261111',
    setSnap:(node,index)=>{
      const c=node?.id==='fpSearchSheet'?searchCtrl:cardCtrl;
      const levels=['peek','half','full'];if(c.getState().sheet!=='closed')
        c.snapTo(levels[Math.max(0,Math.min(2,Number(index)||0))]);
    }};
  window.__atlasSheetIntegration={card:cardCtrl,search:searchCtrl,get motion(){return cardMotion},get searchMotion(){return searchMotion},version:'B-V3-real-product'};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
