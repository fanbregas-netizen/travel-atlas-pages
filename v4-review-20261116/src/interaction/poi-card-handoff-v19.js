/* Footprint Map V4 .19
 * One C-V5 rubber-band motor for the REAL POI -> card handoff.
 * No duplicate map/canvas, no second card controller, no invented artwork.
 * CSS individual translate/scale are independent of the map-projection
 * transform and of the accepted physical-sheet height controller. */
(()=>{'use strict';
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const motion=new WeakMap();
const poiMotion=new WeakMap();
function stop(el){
 const prev=motion.get(el);
 prev?.cancel?.();
 motion.delete(el);
 if(!el)return;
 el.style.removeProperty('translate');
 el.style.removeProperty('scale');
 el.style.removeProperty('will-change');
 // The old card must not retain an inert/pointer-blocked state if the user
 // closes it or rapidly selects another map POI mid-flight.
 el.inert=false;
 for(const selector of ['.destination-title','.destination-category','.destination-actions']){
  el.querySelector(selector)?.style.removeProperty('opacity');
 }
 el.dataset.fpElasticState='idle';
}
function revealCard(el,{renew=false,commit}={}){
 if(!el)return;
 const motor=window.FootprintRubberSpring;
 const previous=motion.get(el);
 // A rapid second POI tap can interrupt the first spring half-way through.
 // Sample the *current rendered pose* before cancelling: otherwise a new
 // 0->1 motor snaps the card and its labels back to their initial frame.
 const readNumber=(value,fallback)=>{const n=parseFloat(value);return Number.isFinite(n)?n:fallback};
 const carryY=previous&&renew?readNumber(el.style.translate.split(/\s+/).pop(),0):0;
 const carryScale=previous&&renew?readNumber(el.style.scale.split(/\s+/).pop(),1):1;
 const carryOpacity=previous&&renew?readNumber(el.querySelector('.destination-title')?.style.opacity,1):1;
 if(previous){previous.cancel();motion.delete(el)}
 if(reduced()||typeof motor?.animate!=='function'){
  commit?.();stop(el);return;
 }
 // During POI-to-POI handoff, buttons still refer to the outgoing place
 // until its label changes. Ignore taps inside that transient old card.
 el.inert=!!renew;
 el.dataset.fpElasticState=renew?'switching':'entering';
 el.dataset.fpElasticOvershoot='0';
 el.style.willChange='translate,scale';
 let committed=false,m=null;
 const apply=value=>{
  if(!el.isConnected){m?.cancel();return}
  const t=clamp(value,-.12,1.18),p=clamp(t,0,1);
  if(renew){
   // Whole sheet lowers while its previous title fades. Only at the low
   // point do we commit the NEXT location. No card removal, new popover,
   // jumping map projection or direct in-place text swap.
   const dip=Math.sin(Math.PI*p);
   if(p>=.5&&!committed){committed=true;commit?.()}
   // Blend an interrupted animation's last visual pose into this new
   // handoff during its opening frames. A single motor remains in control.
   const carry=Math.pow(Math.max(0,1-p/.24),2);
   const alpha=clamp(1-dip*1.12+(carryOpacity-1)*carry,0,1);
   for(const selector of ['.destination-title','.destination-category','.destination-actions']){
    const node=el.querySelector(selector);
    if(node)node.style.setProperty('opacity',alpha.toFixed(3));
   }
   const rebound=Math.max(0,t-1);
   el.style.setProperty('translate','0 '+(dip*43-rebound*48+carryY*carry).toFixed(2)+'px','important');
   // One scalar scales the whole card uniformly (two values previously
   // squeezed only the Y axis).
   el.style.setProperty('scale',(1-.055*dip+rebound*.07+(carryScale-1)*carry).toFixed(5),'important');
  }else{
   if(!committed){committed=true;commit?.()}
   const overshoot=1-t;
   if(overshoot<-.008)el.dataset.fpElasticOvershoot='1';
   const dy=overshoot*84;
   el.style.setProperty('translate','0 '+dy.toFixed(2)+'px','important');
   el.style.setProperty('scale',(1-.085*overshoot).toFixed(5),'important');
  }
 };
 m=motor.animate({from:0,to:1,epsilon:.0015,maxMs:790,onFrame:apply,
  onDone:()=>{if(motion.get(el)!==m)return;
   if(!committed)commit?.();
   stop(el);
  }
 });
 motion.set(el,m);
}
function stopPoi(node){
 const active=poiMotion.get(node);active?.cancel();
 poiMotion.delete(node);
 if(!node)return;
 node.style.removeProperty('scale');node.style.removeProperty('will-change');
 node.dataset.fpElasticPoi='rest';
}
function acknowledgePoi(node){
 if(!node)return;
 // A new tap owns the same original SVG. Cancel both the old grow and its
 // pending return; otherwise two motors fight over scale on fast selections.
 stopPoi(node);
 if(reduced())return;
 const motor=window.FootprintRubberSpring;
 if(typeof motor?.animate!=='function')return;
 let p=1;
 const running={current:null,cancel(){this.current?.cancel()}};
 poiMotion.set(node,running);
 node.dataset.fpElasticPoi='active';
 node.style.willChange='scale';
 const finish=()=>{if(poiMotion.get(node)===running)stopPoi(node)};
 running.current=motor.animate({from:1,to:1.14,epsilon:.006,maxMs:260,
  onFrame:x=>{p=x;if(node.isConnected)node.style.setProperty('scale',x.toFixed(5),'important');else finish()},
  onDone:()=>{
   if(poiMotion.get(node)!==running)return;
   running.current=motor.animate({from:p,to:1,epsilon:.001,maxMs:570,
    onFrame:x=>{if(node.isConnected)node.style.setProperty('scale',x.toFixed(5),'important');else finish()},
    onDone:finish
   });
  }
 });
}
// The existing POI preview also follows a real vertical finger gesture.
// It is intentionally the same card: there is no extra overlay or sheet.
// A downward swipe dismisses it; an incomplete swipe rebounds to rest.
function enableCardGestures(el){
 if(!el||el.dataset.fpPoiGestureOwner)return;
 el.dataset.fpPoiGestureOwner='v4';
 let active=null,pointer=null,touch=null;
 const skip='button,a,input,select,textarea,[contenteditable]';
 const start=(x,y)=>{
  if(active||!el.classList.contains('visible')||el.inert)return;
  const running=motion.get(el);
  running?.cancel?.();motion.delete(el);
  active={x,y,lastY:y,moved:false};
 };
 const move=(x,y,e)=>{
  if(!active)return;
  const dx=x-active.x,dy=y-active.y;
  if(!active.moved){
   if(Math.abs(dx)>Math.abs(dy)*1.2&&Math.abs(dx)>7){active=null;return}
   if(Math.abs(dy)<6)return;
   active.moved=true;
   el.dataset.fpPoiDragging='true';
  }
  active.lastY=y;
  // Preserve a small elastic resistance when the user pulls upward.
  const t=dy<0?dy*.22:dy;
  el.style.setProperty('translate','0 '+t.toFixed(2)+'px','important');
  if(e?.cancelable)e.preventDefault();
 };
 const end=(cancelled=false)=>{
  if(!active)return;
  const g=active;active=null;delete el.dataset.fpPoiDragging;
  const dy=g.lastY-g.y;
  if(!cancelled&&g.moved&&dy>95){
   el.querySelector('#destinationClose')?.click();return;
  }
  const from=g.moved?(dy<0?dy*.22:dy):0;
  const motor=window.FootprintRubberSpring;
  if(reduced()||typeof motor?.animate!=='function'){
   el.style.removeProperty('translate');return;
  }
  const prior=motion.get(el);prior?.cancel?.();motion.delete(el);
  let run=null;
  run=motor.animate({from,to:0,epsilon:.02,maxMs:650,
   onFrame:y=>el.style.setProperty('translate','0 '+y.toFixed(2)+'px','important'),
   onDone:()=>{if(motion.get(el)===run){motion.delete(el);el.style.removeProperty('translate')}}
  });
  motion.set(el,run);
 };
 // Pointer events on the card body, excluding all existing live controls.
 el.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0||e.target.closest(skip))return;
  start(e.clientX,e.clientY);
  if(active){pointer=e.pointerId;try{el.setPointerCapture(pointer)}catch(_){}}
 });
 document.addEventListener('pointermove',e=>{
  if(pointer!==null&&e.pointerId===pointer)move(e.clientX,e.clientY,e);
 },{passive:false});
 document.addEventListener('pointerup',e=>{
  if(pointer===null||e.pointerId!==pointer)return;
  move(e.clientX,e.clientY,e);pointer=null;end();
 });
 document.addEventListener('pointercancel',e=>{
  if(pointer!==null&&e.pointerId===pointer){pointer=null;end(true)}
 });
 // Real Safari touch fallback if the moving card loses pointer capture.
 el.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||e.target.closest(skip)){touch=null;return}
  const t=e.touches[0];touch=t.identifier;
  if(pointer===null)start(t.clientX,t.clientY);
 },{passive:true});
 el.addEventListener('touchmove',e=>{
  if(pointer!==null||touch===null||e.touches.length!==1)return;
  const t=e.touches[0];if(t.identifier===touch)move(t.clientX,t.clientY,e);
 },{passive:false});
 el.addEventListener('touchend',e=>{
  if(touch===null)return;
  const t=[...e.changedTouches].find(v=>v.identifier===touch);
  if(pointer===null&&t){move(t.clientX,t.clientY);end()}
  touch=null;
 });
 el.addEventListener('touchcancel',()=>{if(pointer===null)end(true);touch=null});
}
enableCardGestures(document.getElementById('destinationCard'));
window.FootprintElasticHandoff=Object.freeze({version:'19',revealCard,acknowledgePoi,stop});
})();