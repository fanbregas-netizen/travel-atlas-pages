/* B05: existing #drawer, original B05 tabs and original content. Adds only
 * iPhone vertical follow/snap; no second sheet, DB, or close handler. */
(()=>{'use strict';
const el=document.getElementById('drawer');if(!el||el.dataset.physicalB05)return;
el.dataset.physicalB05='v4';
const header=el.querySelector('.drawer-head');
const headerSkip='button,a,input,select,textarea,[contenteditable]';
// Rows are clickable, but a deliberate vertical swipe on one must drag the
// entire sheet (not be discarded as an interactive target). Keep text fields,
// embedded links and separate actions native/tappable.
const bodySkip='input,select,textarea,[contenteditable],button:not(.spotrow):not(.rs-row),a:not(.rs-row)';
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const detents=()=>{const h=window.visualViewport?.height||innerHeight||844;
return {peek:Math.min(h*.43,360),half:Math.min(h*.72,630),full:Math.max(h*.72+40,h-40)}};
let level='half',d=null,frame=0,dragFrame=0,pendingHeight=null,lastPainted=-1,lastResizeGoal=null;
// One composited translation for the EXISTING drawer. B05 still owns the
// actual height, content scroll and 3 detents; there is no extra card DOM.
let layerMotion=null,layerOffset=0,layerPhase='hidden',closeAfterMotion=null;
function setLayerOffset(y){
 layerOffset=y;
 // The native compositor must own the active WAAPI property. An inline
 // !important translate suppresses its interpolation in WebKit.
 el.style.setProperty('translate','0 '+Math.max(-16,y).toFixed(2)+'px');
}
function readLayerOffset(){
 const css=getComputedStyle(el),str=css.translate;
 const parts=str?.match(/-?[0-9.]+px/g);
 const y=parts?.length?parseFloat(parts[parts.length-1]):NaN;
 if(Number.isFinite(y)&&Math.abs(y)>.05)return y;
 // While the compositor drives transform, the final matrix component is Y.
 const m=css.transform?.match(/^matrix\(([^)]+)\)$/);
 if(m){const vals=m[1].split(',').map(Number);if(Number.isFinite(vals[5]))return vals[5]}
 return Number.isFinite(y)?y:layerOffset;
}
function cancelLayer(){
 if(layerMotion){
  const y=readLayerOffset();
  layerMotion.cancel();layerMotion=null;setLayerOffset(y);
 }
}
function makeSpringFrames(from,to){
 // Sample EXACT approved C V5 0.105/0.75 motor at 60 Hz, then allow
 // WebKit's compositor to animate when main-thread requestAnimationFrame
 // is delayed by map tile/geometry work. No second visual language.
 const motor=window.FootprintRubberSpring;
 const frames=[{transform:'translate(-50%, '+from.toFixed(2)+'px)'}];
 let pos=from,velocity=0;
 for(let n=0;n<49;n++){
  const next=motor.step(pos,to,velocity,1000/60);
  pos=next.value;velocity=next.velocity;
  frames.push({transform:'translate(-50%, '+Math.max(-16,pos).toFixed(2)+'px)'});
  if(n>=20&&Math.abs(pos-to)<.65&&Math.abs(velocity)<.4)break;
 }
 frames.push({transform:'translate(-50%, '+to.toFixed(2)+'px)'});
 return frames;
}
function moveLayer(from,to,done){
 cancelLayer();setLayerOffset(from);
 const motor=window.FootprintRubberSpring;
 if(reduced.matches||typeof motor?.step!=='function'){
  setLayerOffset(to);done?.();return;
 }
 if(typeof el.animate==='function'){
  try{
   const frames=makeSpringFrames(from,to);
   // Safari/WebKit reliably composites transform, but some builds silently
   // ignore WAAPI keyframes on the individual translate property.
   el.style.removeProperty('translate');
   const animation=el.animate(frames,{
    duration:(frames.length-1)*(1000/60),easing:'linear',fill:'both'
   });
   const handle={cancel:()=>animation.cancel()};
   layerMotion=handle;
   animation.onfinish=()=>{
    if(layerMotion!==handle)return;
    layerMotion=null;animation.cancel();setLayerOffset(to);done?.();
   };
   return;
  }catch(error){console.debug('Collection compositor spring fallback',error)}
 }
 // Older browsers fall back to the same solver on the main thread.
 if(typeof motor.animate!=='function'){setLayerOffset(to);done?.();return}
 let motion=null;
 motion=motor.animate({from,to,epsilon:.6,maxMs:840,
   onFrame:y=>setLayerOffset(y),
   onDone:()=>{if(layerMotion!==motion)return;layerMotion=null;setLayerOffset(to);done?.()}
 });
 layerMotion=motion;
}
function reveal(){
 if(!el.classList.contains('visible')||layerPhase==='entering'||layerPhase==='shown')return;
 const from=layerPhase==='closing'?readLayerOffset():Math.max(320,detents()[level]+35);
 closeAfterMotion=null;layerPhase='entering';el.inert=false;el.style.removeProperty('pointer-events');
 moveLayer(from,0,()=>{layerPhase='shown';el.style.removeProperty('translate');layerOffset=0});
}
function requestClose(done){
 if(!el.classList.contains('visible'))return false;
 closeAfterMotion=done;
 if(layerPhase==='closing')return true;
 layerPhase='closing';d=null;
 el.inert=true;el.style.setProperty('pointer-events','none','important');
 const dest=Math.max(320,el.getBoundingClientRect().height+44);
 moveLayer(readLayerOffset(),dest,()=>{layerPhase='hidden';const fn=closeAfterMotion;closeAfterMotion=null;fn?.()});
 return true;
}
// WebKit may pause rAF while the map is compositing or resuming a tab.
// Preserve normal one-write-per-frame behavior, but never let touch deltas
// queue up invisibly for the entire drag (observed: 608px rendered / 723px
// pending, then snap only on release). If a queued frame is >32ms late,
// flush the latest height from the gesture that actually arrived.
let pendingSince=0;
function scheduleDragPaint(h){
 pendingHeight=h;
 const now=performance.now();
 if(dragFrame){
  if(now-pendingSince>=32){
   cancelAnimationFrame(dragFrame);dragFrame=0;pendingSince=0;
   const next=pendingHeight;pendingHeight=null;
   if(next!==null)paint(next);
  }
  return;
 }
 pendingSince=now;
 dragFrame=requestAnimationFrame(()=>{
  dragFrame=0;pendingSince=0;
  const next=pendingHeight;pendingHeight=null;if(next!==null)paint(next);
 });
}
function flushDragPaint(){
 if(dragFrame){cancelAnimationFrame(dragFrame);dragFrame=0}
 pendingSince=0;
 if(pendingHeight!==null){const h=pendingHeight;pendingHeight=null;paint(h)}
}
function setMaxHeight(){el.style.setProperty('max-height','calc(100dvh - 32px)','important')}
function paint(h){const px=Math.max(110,Math.round(h));if(px!==lastPainted){lastPainted=px;el.style.setProperty('height',px+'px','important')}}
function snap(next){
 level=next;const goal=detents()[next],start=el.getBoundingClientRect().height;
 lastResizeGoal=goal;setMaxHeight();
 if(frame)cancelAnimationFrame(frame);
 if(reduced.matches){paint(goal);return}
 let h=start,v=0,last=0,frames=0;
 const tick=t=>{const dt=clamp(last?(t-last)/1000:.016,.001,.03);last=t;
 const approved=window.FootprintV5Spring?.step(h,goal,v,dt*1000);
 if(approved){h=approved.value;v=approved.velocity}
 else{v+=(340*(goal-h)-35*v)*dt;h+=v*dt}
 paint(h);
 if(Math.abs(h-goal)<.7&&Math.abs(v)<(approved?.velocity!==undefined?.4:4)||frames++>85){paint(goal);frame=0;return}
 frame=requestAnimationFrame(tick)};
 frame=requestAnimationFrame(tick);
}
function start(x,y){
 if(!el.classList.contains('visible')||d||layerPhase==='closing')return;
 if(layerPhase==='entering'){cancelLayer();setLayerOffset(0);el.style.removeProperty('translate');layerPhase='shown'}
 if(frame)cancelAnimationFrame(frame);frame=0;
 setMaxHeight();
 d={x,y,last:y,h:el.getBoundingClientRect().height,moved:false};
}
function move(x,y,e){
 if(!d)return;const dx=x-d.x,dy=y-d.y;
 if(!d.moved){
  if(Math.abs(dx)>Math.abs(dy)*1.2&&Math.abs(dx)>7){d=null;return}
  if(Math.abs(dy)<7)return;
  d.moved=true;el.dataset.collectionDragging='true';
 }
 d.last=y;const a=detents(),raw=d.h-dy;
 scheduleDragPaint(raw>a.full?a.full+(raw-a.full)*.2:raw<a.peek?a.peek-(a.peek-raw)*.27:raw);
 if(e?.cancelable)e.preventDefault();
}
function end(cancelled=false){
 if(!d)return;flushDragPaint();const g=d;d=null;delete el.dataset.collectionDragging;
 if(cancelled||!g.moved){snap(level);return}
 const dy=g.last-g.y,order=['peek','half','full'];
 if(level==='peek'&&dy>80){el.querySelector('#closeDrawer')?.click();return}
 const next=clamp(order.indexOf(level)+(dy<0?1:-1),0,2);
 snap(Math.abs(dy)>32?order[next]:level);
}
if(header){
 header.style.touchAction='none';
 let pointer=null;
 header.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0||e.target.closest(headerSkip))return;
  start(e.clientX,e.clientY);
  if(d){pointer=e.pointerId;try{header.setPointerCapture?.(pointer)}catch(_){/* WebKit fallback uses document events */}}
 });
 // WebKit can silently lose element pointer capture on a composited sticky
 // sheet. Following the active pointer on document keeps real finger travel
 // continuous when the hit-tested target changes under the moving card.
 document.addEventListener('pointermove',e=>{
  if(pointer!==null&&pointer===e.pointerId)move(e.clientX,e.clientY,e);
 },{passive:false});
 document.addEventListener('pointerup',e=>{
  if(pointer===null||pointer!==e.pointerId)return;
  move(e.clientX,e.clientY,e);pointer=null;end();
 },{passive:false});
 document.addEventListener('pointercancel',e=>{
  if(pointer!==null&&pointer===e.pointerId){pointer=null;end(true)}
 },{passive:true});
 // Safari's native touch events are a fallback for iPhone builds where pointer
 // capture is interrupted by the composited sticky heading.
 let touch=null;
 header.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||e.target.closest(headerSkip)){touch=null;return}
  const t=e.touches[0];touch=t.identifier;
  if(pointer===null)start(t.clientX,t.clientY);
 },{passive:true});
 header.addEventListener('touchmove',e=>{
  if(pointer!==null||touch===null||e.touches.length!==1)return;
  const t=e.touches[0];if(t.identifier!==touch)return;
  move(t.clientX,t.clientY,e);
 },{passive:false});
 header.addEventListener('touchend',e=>{
  if(touch===null)return;
  const t=[...e.changedTouches].find(x=>x.identifier===touch);
  if(pointer===null&&t){move(t.clientX,t.clientY);end()}
  touch=null;
 },{passive:true});
 header.addEventListener('touchcancel',()=>{if(pointer===null)end(true);touch=null},{passive:true});
 for(const type of ['touchstart','touchmove','touchend'])header.addEventListener(type,e=>e.stopPropagation(),{passive:type!=='touchmove'});
}
let bodyTouch=null;
for(const content of [el.querySelector('#spotList'),el.querySelector('#drawerRouteList')]){
 if(!content)continue;
 content.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||e.target.closest(bodySkip)){bodyTouch=null;return}
  const t=e.touches[0];bodyTouch={id:t.identifier,x:t.clientX,y:t.clientY,active:false,ignore:false};
  e.stopPropagation();
 },{passive:true});
 content.addEventListener('touchmove',e=>{
  if(!bodyTouch||e.touches.length!==1||bodyTouch.ignore)return;
  const t=e.touches[0],dy=t.clientY-bodyTouch.y,dx=t.clientX-bodyTouch.x;
  if(!bodyTouch.active){
   if(Math.abs(dx)>Math.abs(dy)*1.2){bodyTouch.ignore=true;return}
   if(Math.abs(dy)<10)return;
   if(el.scrollTop>1&&dy>0||level==='full'&&dy<0){bodyTouch.ignore=true;return}
   start(bodyTouch.x,bodyTouch.y);bodyTouch.active=!!d;
  }
  if(bodyTouch.active){move(t.clientX,t.clientY,e);e.stopPropagation()}
 },{passive:false});
 content.addEventListener('touchend',e=>{
  if(bodyTouch?.active){const t=[...e.changedTouches].find(x=>x.identifier===bodyTouch.id);
   if(t)move(t.clientX,t.clientY);end();e.stopPropagation()}
  bodyTouch=null;
 },{passive:true});
 content.addEventListener('touchcancel',()=>{if(bodyTouch?.active)end(true);bodyTouch=null},{passive:true});
}
// The collection has legitimate subview class changes (fp30-hub/detail/routes).
// Only a genuine visible<->hidden transition may start/stop the sheet spring.
// The previous observer restarted snap() for EVERY class change, including
// switching a content tab, which made the card jump under the user's finger.
let wasVisible=el.classList.contains('visible');
new MutationObserver(()=>{
 const visible=el.classList.contains('visible');
 if(visible===wasVisible)return;
 wasVisible=visible;
 if(!visible){
  if(frame)cancelAnimationFrame(frame);frame=0;
  if(dragFrame)cancelAnimationFrame(dragFrame);dragFrame=0;pendingHeight=null;lastPainted=-1;lastResizeGoal=null;d=null;level='half';
  el.style.removeProperty('height');el.style.removeProperty('max-height');
  cancelLayer();el.style.removeProperty('translate');layerOffset=0;layerPhase='hidden';closeAfterMotion=null;
  el.inert=false;el.style.removeProperty('pointer-events');
  return;
 }
 // Only opening from hidden sets the initial B05 half detent. Subsequent
 // internal content/class changes retain the live finger-driven height.
 requestAnimationFrame(()=>{if(el.classList.contains('visible')&&!d){snap(level);if(layerPhase==='hidden')reveal()}});
}).observe(el,{attributes:true,attributeFilter:['class']});
let resizeFrame=0;
window.addEventListener('resize',()=>{
 if(resizeFrame||!el.classList.contains('visible')||d)return;
 resizeFrame=requestAnimationFrame(()=>{
  resizeFrame=0;
  if(!el.classList.contains('visible')||d)return;
  if(document.activeElement?.matches?.('input,textarea,select,[contenteditable]')&&
     window.visualViewport&&window.visualViewport.height<window.innerHeight-140)return;
  const goal=detents()[level];
  if(lastResizeGoal!==null&&Math.abs(goal-lastResizeGoal)<2)return;
  snap(level);
 });
},{passive:true});
window.__atlasCollectionSheet={reveal,requestClose,getState:()=>({level,phase:layerPhase,dragging:!!d,height:el.getBoundingClientRect().height,opened:el.classList.contains('visible'),lastPainted,pendingHeight,dragFrame,pendingSince,pointerY:d?.last??null,dragged:d?.moved??false})};
})();
