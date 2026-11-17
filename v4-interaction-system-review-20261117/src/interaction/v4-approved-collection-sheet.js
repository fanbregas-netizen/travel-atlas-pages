/* B05 collection: same physical motion as the approved C V5 "选择地点".
 * Only interaction physics change. Keep the original #drawer, content, tabs,
 * click actions, data store, headers, and close button.
 * C V5: v=(v+(goal-h)*.105)*.75; h+=v; bounds .21/.19;
 * nearest detent plus .42 px/ms flick; 105px initial entry stroke. */
(()=>{'use strict';
const el=document.getElementById('drawer');
if(!el||el.dataset.physicalB05)return;
el.dataset.physicalB05='cv5';
el.dataset.collectionMotion='cv5';
const header=el.querySelector('.drawer-head');
const closeButton=el.querySelector('#closeDrawer');
const headerSkip='button,a,input,select,textarea,[contenteditable]';
const bodySkip='input,select,textarea,[contenteditable],button:not(.spotrow):not(.rs-row),a:not(.rs-row)';
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const order=['peek','half','full'];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const detents=()=>{
 const h=window.visualViewport?.height||innerHeight||844;
 // Keep the accepted B05 THREE landing heights; only the motor/gestures
 // are replaced with the C V5 "选择地点" implementation.
 return {peek:Math.min(h*.43,360),half:Math.min(h*.72,630),full:Math.max(h*.72+40,h-40)};
};
const rubber=(value,min,max)=>value<min?min-(min-value)*.21:value>max?max+(value-max)*.19:value;
let level='half',height=0,targetHeight=0,sheetVelocity=0,sheetMotion=0;
let gesture=null,pointer=null,touch=null,bodyTouch=null,dragFrame=0,pendingHeight=null;
let lastPainted=-1,wasVisible=el.classList.contains('visible'),closing=false,closeCleanup=null;
let releaseClose=false,lastResizeGoal=null;
function stopSpring(){if(sheetMotion)cancelAnimationFrame(sheetMotion);sheetMotion=0}
function paintHeight(h){
 height=h;
 const px=Math.max(0,Math.round(h));
 if(px===lastPainted)return;
 lastPainted=px;
 el.style.setProperty('height',px+'px','important');
}
function setPhysicalSurface(){
 el.style.setProperty('max-height','calc(100dvh - 32px)','important');
 // The legacy V4 drawer enforces a roughly 58vh minimum in some layouts;
 // it held the visible card at ~490px even when the C V5 spring painted 86px.
 // Make the real bounding box equal the physical height, as with #rc-main.
 el.style.setProperty('min-height','0','important');
 el.style.setProperty('box-sizing','border-box','important');
 // The legacy drawer has a second, independent 240ms translate animation.
 // "选择地点" now uses ONLY the C V5 height motor: remove this collision.
 el.style.setProperty('transform','translate(-50%,0)','important');
 el.style.setProperty('transition','none','important');
}
function springTo(goal,releaseVelocity=null,onComplete=null){
 stopSpring();
 targetHeight=goal;
 if(Number.isFinite(releaseVelocity))sheetVelocity=clamp(releaseVelocity,-28,28);
 if(reduced.matches){sheetVelocity=0;paintHeight(goal);onComplete?.();return}
 let frames=0;
 function tick(){
  // Exactly the C V5 "选择地点" motor; no alternate CSS easing.
  sheetVelocity=(sheetVelocity+(targetHeight-height)*.105)*.75;
  paintHeight(height+sheetVelocity);
  if((Math.abs(targetHeight-height)<.65&&Math.abs(sheetVelocity)<.4)||++frames>110){
   paintHeight(targetHeight);sheetVelocity=0;sheetMotion=0;onComplete?.();return;
  }
  sheetMotion=requestAnimationFrame(tick);
 }
 sheetMotion=requestAnimationFrame(tick);
}
function snap(next,releaseVelocity=null){
 if(!detents()[next])next='half';
 level=next;
 setPhysicalSurface();
 lastResizeGoal=detents()[next];
 springTo(lastResizeGoal,releaseVelocity);
}
function flushGesturePaint(){
 if(dragFrame){cancelAnimationFrame(dragFrame);dragFrame=0}
 if(pendingHeight!==null){const h=pendingHeight;pendingHeight=null;paintHeight(h)}
}
function scheduleGesturePaint(h){
 pendingHeight=h;
 if(dragFrame)return;
 dragFrame=requestAnimationFrame(()=>{dragFrame=0;flushGesturePaint()});
}
function start(x,y){
 if(!el.classList.contains('visible')||closing||gesture)return;
 stopSpring();setPhysicalSurface();
 gesture={x,startY:y,startHeight:height,lastY:y,lastAt:performance.now(),velocity:0,moved:false};
}
function move(x,y,e){
 const g=gesture;if(!g)return;
 const dx=x-g.x,dy=y-g.startY;
 if(!g.moved){
  if(Math.abs(dx)>Math.abs(dy)*1.2&&Math.abs(dx)>7){gesture=null;return}
  if(Math.abs(dy)<7)return;
  g.moved=true;
  el.dataset.collectionDragging='true';
 }
 const [min,max]=[detents().peek,detents().full];
 const h=rubber(g.startHeight+g.startY-y,min,max);
 const now=performance.now(),dt=Math.max(8,now-g.lastAt);
 // Same C V5 instantaneous velocity estimation and 95ms release freshness.
 if(Math.abs(y-g.lastY)>.25)g.velocity=(y-g.lastY)/dt;
 g.lastY=y;g.lastAt=now;
 scheduleGesturePaint(h);
 if(e?.cancelable)e.preventDefault();
}
function completeOriginalClose(){
 releaseClose=true;
 if(closeButton)closeButton.click();
 else el.classList.remove('visible');
 releaseClose=false;
}
function closeWithSpring(velocity=0){
 if(closing||!el.classList.contains('visible'))return;
 flushGesturePaint();stopSpring();closing=true;
 delete el.dataset.collectionDragging;
 gesture=null;
 setPhysicalSurface();
 springTo(0,velocity,completeOriginalClose);
}
function end(cancelled=false){
 if(!gesture)return;
 flushGesturePaint();
 const g=gesture;gesture=null;
 delete el.dataset.collectionDragging;
 if(cancelled||!g.moved){snap(level);return}
 const deltaY=g.lastY-g.startY;
 const release=performance.now()-g.lastAt<95?-g.velocity*16.67:0;
 if(level==='peek'&&deltaY>80){closeWithSpring(release);return}
 const stops=detents();
 const distances=order.map(l=>Math.abs(stops[l]-height));
 let ix=distances.indexOf(Math.min(...distances));
 if(Math.abs(g.velocity)>.42)ix=clamp(ix+(g.velocity<0?1:-1),0,2);
 snap(order[ix],release);
}
if(closeButton){
 // Reuse the original close event only AFTER the same C V5 spring has settled.
 // This covers both the X and a swipe down from peek without changing other
 // existing listeners or their application state transitions.
 closeButton.addEventListener('click',e=>{
  if(releaseClose||!el.classList.contains('visible'))return;
  e.preventDefault();e.stopImmediatePropagation();
  closeWithSpring();
 },true);
}
if(header){
 header.style.touchAction='none';
 header.addEventListener('pointerdown',e=>{
  if((e.button!==undefined&&e.button!==0)||e.target.closest(headerSkip))return;
  start(e.clientX,e.clientY);
  if(gesture){pointer=e.pointerId;try{header.setPointerCapture(e.pointerId)}catch(_){}}
 });
 header.addEventListener('pointermove',e=>{if(pointer===e.pointerId)move(e.clientX,e.clientY,e)});
 header.addEventListener('pointerup',e=>{
  if(pointer!==e.pointerId)return;
  if(gesture&&Math.abs(e.clientY-gesture.lastY)>1)move(e.clientX,e.clientY,e);
  pointer=null;end();
 });
 header.addEventListener('pointercancel',()=>{pointer=null;end(true)});
 // Touch fallback for iPhone Safari WebKit pointer-capture interruptions.
 header.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||e.target.closest(headerSkip)){touch=null;return}
  const t=e.touches[0];touch=t.identifier;
  if(pointer===null)start(t.clientX,t.clientY);
 },{passive:true});
 header.addEventListener('touchmove',e=>{
  if(pointer!==null||touch===null||e.touches.length!==1)return;
  const t=e.touches[0];if(t.identifier===touch)move(t.clientX,t.clientY,e);
 },{passive:false});
 header.addEventListener('touchend',e=>{
  if(touch===null)return;
  const t=[...e.changedTouches].find(item=>item.identifier===touch);
  if(pointer===null&&t){if(gesture&&Math.abs(t.clientY-gesture.lastY)>1)move(t.clientX,t.clientY);end()}
  touch=null;
 },{passive:true});
 header.addEventListener('touchcancel',()=>{if(pointer===null)end(true);touch=null},{passive:true});
 for(const type of ['touchstart','touchmove','touchend'])
  header.addEventListener(type,e=>e.stopPropagation(),{passive:type!=='touchmove'});
}
for(const content of [el.querySelector('#spotList'),el.querySelector('#drawerRouteList')]){
 if(!content)continue;
 let bodyGesture=null;
 content.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||e.target.closest(bodySkip)){bodyGesture=null;return}
  const t=e.touches[0];
  bodyGesture={id:t.identifier,x:t.clientX,y:t.clientY,active:false,ignore:false};
  e.stopPropagation();
 },{passive:true});
 content.addEventListener('touchmove',e=>{
  const g=bodyGesture;
  if(!g||e.touches.length!==1||g.ignore)return;
  const t=e.touches[0],dy=t.clientY-g.y,dx=t.clientX-g.x;
  if(!g.active){
   if(Math.abs(dx)>Math.abs(dy)*1.2){g.ignore=true;return}
   if(Math.abs(dy)<10)return;
   if((Math.max(el.scrollTop,content.scrollTop)>1&&dy>0)||(level==='full'&&dy<0)){g.ignore=true;return}
   start(g.x,g.y);g.active=!!gesture;
  }
  if(g.active){move(t.clientX,t.clientY,e);e.stopPropagation()}
 },{passive:false});
 content.addEventListener('touchend',e=>{
  if(bodyGesture?.active){
   const t=[...e.changedTouches].find(item=>item.identifier===bodyGesture.id);
   if(t&&gesture&&Math.abs(t.clientY-gesture.lastY)>1)move(t.clientX,t.clientY);
   end();e.stopPropagation();
  }
  bodyGesture=null;
 },{passive:true});
 content.addEventListener('touchcancel',()=>{if(bodyGesture?.active)end(true);bodyGesture=null},{passive:true});
}
function onOpened(){
 closing=false;stopSpring();setPhysicalSurface();
 if(closeCleanup!==null){clearTimeout(closeCleanup);closeCleanup=null}
 level='half';lastPainted=-1;
 const stops=detents(),initial=Math.max(stops.peek,stops.half-105);
 paintHeight(initial);sheetVelocity=0;snap('half',0);
}
function onClosed(){
 stopSpring();if(dragFrame)cancelAnimationFrame(dragFrame);
 dragFrame=0;pendingHeight=null;gesture=null;pointer=null;touch=null;
 closing=false;level='half';sheetVelocity=0;lastResizeGoal=null;
 delete el.dataset.collectionDragging;
 // Keep the final height during any legacy externally-triggered exit.
 el.style.removeProperty('transform');el.style.removeProperty('transition');
 el.style.removeProperty('min-height');el.style.removeProperty('box-sizing');
 if(closeCleanup!==null)clearTimeout(closeCleanup);
 closeCleanup=setTimeout(()=>{
  closeCleanup=null;
  if(!el.classList.contains('visible')){
   el.style.removeProperty('height');el.style.removeProperty('max-height');lastPainted=-1;
  }
 },400);
}
new MutationObserver(()=>{
 const visible=el.classList.contains('visible');
 if(visible===wasVisible)return; // Tab/header class changes must NOT restart spring.
 wasVisible=visible;
 if(visible)onOpened();else onClosed();
}).observe(el,{attributes:true,attributeFilter:['class']});
let resizeFrame=0;
window.addEventListener('resize',()=>{
 if(resizeFrame||!el.classList.contains('visible')||gesture||closing)return;
 resizeFrame=requestAnimationFrame(()=>{
  resizeFrame=0;
  if(!el.classList.contains('visible')||gesture||closing)return;
  if(document.activeElement?.matches?.('input,textarea,select,[contenteditable]')&&
    window.visualViewport&&window.visualViewport.height<window.innerHeight-140)return;
  const goal=detents()[level];
  if(lastResizeGoal!==null&&Math.abs(goal-lastResizeGoal)<2)return;
  snap(level);
 });
},{passive:true});
if(wasVisible)onOpened();
window.__atlasCollectionSheet={
 getState:()=>({
  level,dragging:!!gesture,height:el.getBoundingClientRect().height,
  opened:el.classList.contains('visible'),closing,velocity:sheetVelocity,engine:'C V5'
 })
};
})();