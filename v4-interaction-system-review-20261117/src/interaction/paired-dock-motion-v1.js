/* Footprint Map V4 independent interaction acceptance.
 * One paired top-search / bottom-Dock motion whenever a physical card opens.
 * Top exits UP and returns DOWN with a restrained spring.
 * Bottom exits DOWN and returns UP with the same restrained spring.
 *
 * Do not own sheet heights, gestures, search input morphing, POI projections
 * or collection data. Let accepted sheet motors finish BEFORE Dock reentry.
 */
(()=>{'use strict';
 const body=document.body,top=document.getElementById('fpTopSearch'),bottom=document.getElementById('appDock');
 if(!top||!bottom||window.__atlasCardDockMotion)return;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const watchedIds=['drawer','fpPlaceCard','destinationCard','memorySheet','atlasRoutesSheet',
                   'editor','fpMediaViewer','fpSearchSheet'];
 const watchers=new Map();
 const animations={top:null,bottom:null};
 const states={active:false,reason:'',top:'visible',bottom:'visible',serial:0};
 let pending=false,initialized=false;
 const reasons=()=>{
  if(body.classList.contains('atlas-collection-exiting'))return 'collection-exit';
  if(document.getElementById('drawer')?.classList.contains('visible'))return 'collection';
  if(body.classList.contains('fp-place-open')||
     (document.getElementById('fpPlaceCard')&&!document.getElementById('fpPlaceCard').hidden))return 'place';
  if(body.classList.contains('destination-selected')||
     document.getElementById('destinationCard')?.classList.contains('visible'))return 'destination';
  if(body.classList.contains('memory-open'))return 'memory';
  if(document.getElementById('atlasRoutesSheet')?.classList.contains('open'))return 'saved-routes';
  if(body.classList.contains('route-pick-active'))return 'route-picking';
  if(document.getElementById('editor')?.open)return 'editor';
  if(body.classList.contains('fp-media-viewer-open')||
     (document.getElementById('fpMediaViewer')&&!document.getElementById('fpMediaViewer').hidden))return 'media';
  return '';
 };
 function searchOwnsDock(){
  // The already-confirmed top search / anchored history morph owns its UI.
  // Do not replace it with a second search animation.
  return body.classList.contains('fp-search-open')||
         body.classList.contains('fp34-searching')||
         body.classList.contains('fp34-search-returning');
 }
 const set=(node,name,value)=>node.style.setProperty(name,value,'important');
 const unset=(node,name)=>node.style.removeProperty(name);
 function cancel(key){
  const a=animations[key];animations[key]=null;
  if(a){try{a.cancel()}catch(_){}}
 }
 function clear(node){
  for(const key of ['opacity','visibility','filter','translate','pointer-events'])unset(node,key);
 }
 function hideImmediately(){
  cancel('top');cancel('bottom');
  for(const node of [top,bottom]){
   set(node,'visibility','hidden');set(node,'opacity','0');set(node,'pointer-events','none');
   unset(node,'filter');unset(node,'translate');
  }
  states.top=states.bottom='hidden';
 }
 function animateOne(key,kind){
  const node=key==='top'?top:bottom;
  cancel(key);
  const opening=kind==='return';
  const topEdge=key==='top';
  if(reduced.matches){
   if(opening){clear(node);states[key]='visible'}
   else{set(node,'opacity','0');set(node,'visibility','hidden');set(node,'pointer-events','none');states[key]='hidden'}
   return;
  }
  // Inline important visibility/opacity overcome legacy immediate :has()
  // display suppression. Animate only compositor properties, never layout.
  set(node,'visibility','visible');
  set(node,'opacity','1');
  set(node,'pointer-events','none');
  unset(node,'translate');
  const hiddenOffset=topEdge?-77:86;
  const settleOvershoot=topEdge?6:-6;
  let frames;
  if(opening){
   frames=topEdge?[
    {translate:'0 -77px',filter:'opacity(0)',offset:0},
    {translate:'0 6px',filter:'opacity(1)',offset:.76},
    {translate:'0 0',filter:'opacity(1)',offset:1}
   ]:[
    {transform:'translate3d(-50%,30px,0) scale(.977)',filter:'opacity(0)',offset:0},
    {transform:'translate3d(-50%,-5px,0) scale(1.007)',filter:'opacity(1)',offset:.76},
    {transform:'translate3d(-50%,0,0) scale(1)',filter:'opacity(1)',offset:1}
   ];
  }else{
   frames=topEdge?[
    {translate:'0 0',filter:'opacity(1)',offset:0},
    {translate:'0 -77px',filter:'opacity(0)',offset:1}
   ]:[
    {transform:'translate3d(-50%,0,0)',filter:'opacity(1)',offset:0},
    {transform:'translate3d(-50%,86px,0)',filter:'opacity(0)',offset:1}
   ];
  }
  const anim=node.animate(frames,{duration:opening?410:230,
    easing:opening?'cubic-bezier(.22,.82,.29,1)':'cubic-bezier(.36,0,.78,.38)',
    fill:'both'});
  animations[key]=anim;
  states[key]=opening?'returning':'hiding';
  anim.finished.then(()=>{
   if(animations[key]!==anim)return;
   // Persist the final state BEFORE removing the filling animation.
   if(opening){clear(node);states[key]='visible'}
   else{
    set(node,'visibility','hidden');set(node,'opacity','0');
    set(node,'pointer-events','none');unset(node,'filter');unset(node,'translate');
    states[key]='hidden';
   }
   cancel(key);
  }).catch(()=>{});
 }
 function pauseForSearch(){
  cancel('top');cancel('bottom');
  clear(top);clear(bottom);
  states.top=states.bottom='native-search';
 }
 function sync(){
  pending=false;
  bind();
  const reason=reasons(),active=!!reason;
  if(!initialized){
   initialized=true;
   states.active=active;states.reason=reason;
   if(active)hideImmediately();
   return;
  }
  if(searchOwnsDock()&&!active){
   states.active=false;states.reason='';
   pauseForSearch();return;
  }
  if(active===states.active){
   states.reason=reason;
   if(!active&&(states.top==='native-search'||states.bottom==='native-search')){
    states.top=states.bottom='hidden';animateOne('top','return');animateOne('bottom','return');
   }
   return;
  }
  states.active=active;states.reason=reason;states.serial++;
  if(active){
   animateOne('top','hide');
   animateOne('bottom','hide');
  }else{
   // Called only after the last physical card has disappeared.
   animateOne('top','return');
   animateOne('bottom','return');
  }
 }
 function schedule(){
  if(pending)return;
  pending=true;
  requestAnimationFrame(sync);
 }
 function bind(){
  for(const id of watchedIds){
   const node=document.getElementById(id);
   if(!node||watchers.has(node))continue;
   const observer=new MutationObserver(schedule);
   observer.observe(node,{attributes:true,attributeFilter:['class','hidden','open']});
   watchers.set(node,observer);
  }
 }
 const mainObs=new MutationObserver(schedule);
 mainObs.observe(body,{attributes:true,attributeFilter:['class']});
 // The physical place card and search sheet are inserted dynamically after
 // initial map render. Watch only direct body child additions to avoid a
 // map-wide subtree observer and the Safari POI performance penalty.
 const addedObs=new MutationObserver(bind);
 addedObs.observe(body,{childList:true});
 bind();sync();
 window.__atlasCardDockMotion={
  version:'paired-v1',
  sync:()=>sync(),
  getState:()=>({...states,topAnimation:animations.top?.playState||'none',
    bottomAnimation:animations.bottom?.playState||'none'}),
  destroy:()=>{
   mainObs.disconnect();addedObs.disconnect();
   for(const observer of watchers.values())observer.disconnect();
   cancel('top');cancel('bottom');clear(top);clear(bottom);
  }
 };
})();
