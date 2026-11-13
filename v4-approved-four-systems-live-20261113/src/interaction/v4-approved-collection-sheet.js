/* B05: existing #drawer, original B05 tabs and original content. Adds only
 * iPhone vertical follow/snap; no second sheet, DB, or close handler. */
(()=>{'use strict';
const el=document.getElementById('drawer');if(!el||el.dataset.physicalB05)return;
el.dataset.physicalB05='v4';
const header=el.querySelector('.drawer-head');
const skip='button,a,input,select,textarea,[contenteditable],.spotrow,.rs-row';
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const detents=()=>{const h=visualViewport?.height||innerHeight||844;
return {peek:Math.min(h*.43,360),half:Math.min(h*.72,630),full:Math.max(h*.72+40,h-40)}};
let level='half',d=null,frame=0;
function paint(h){el.style.setProperty('height',Math.max(110,Math.round(h))+'px','important');el.style.setProperty('max-height','calc(100dvh - 32px)','important')}
function snap(next){
 level=next;const goal=detents()[next],start=el.getBoundingClientRect().height;
 if(frame)cancelAnimationFrame(frame);
 if(reduced.matches){paint(goal);return}
 let h=start,v=0,last=0,frames=0;
 const tick=t=>{const dt=clamp(last?(t-last)/1000:.016,.001,.03);last=t;
 v+=(340*(goal-h)-35*v)*dt;h+=v*dt;paint(h);
 if(Math.abs(h-goal)<.7&&Math.abs(v)<4||frames++>85){paint(goal);frame=0;return}
 frame=requestAnimationFrame(tick)};
 frame=requestAnimationFrame(tick);
}
function start(x,y){
 if(!el.classList.contains('visible')||d)return;
 if(frame)cancelAnimationFrame(frame);frame=0;
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
 paint(raw>a.full?a.full+(raw-a.full)*.2:raw<a.peek?a.peek-(a.peek-raw)*.27:raw);
 if(e?.cancelable)e.preventDefault();
}
function end(cancelled=false){
 if(!d)return;const g=d;d=null;delete el.dataset.collectionDragging;
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
  if(e.button!==undefined&&e.button!==0||e.target.closest(skip))return;
  start(e.clientX,e.clientY);if(d){pointer=e.pointerId;header.setPointerCapture?.(pointer)}
 });
 header.addEventListener('pointermove',e=>{if(pointer===e.pointerId)move(e.clientX,e.clientY,e)});
 header.addEventListener('pointerup',e=>{if(pointer===e.pointerId){move(e.clientX,e.clientY,e);pointer=null;end()}});
 header.addEventListener('pointercancel',()=>{pointer=null;end(true)});
 for(const type of ['touchstart','touchmove','touchend'])header.addEventListener(type,e=>e.stopPropagation(),{passive:type!=='touchmove'});
}
let bodyTouch=null;
for(const content of [el.querySelector('#spotList'),el.querySelector('#drawerRouteList')]){
 if(!content)continue;
 content.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||e.target.closest(skip)){bodyTouch=null;return}
  const t=e.touches[0];bodyTouch={id:t.identifier,x:t.clientX,y:t.clientY,active:false,ignore:false};
  e.stopPropagation();
 },{passive:true});
 content.addEventListener('touchmove',e=>{
  if(!bodyTouch||e.touches.length!==1||bodyTouch.ignore)return;
  const t=e.touches[0],dy=t.clientY-bodyTouch.y,dx=t.clientX-bodyTouch.x;
  if(!bodyTouch.active){
   if(Math.abs(dx)>Math.abs(dy)*1.2){bodyTouch.ignore=true;return}
   if(Math.abs(dy)<8)return;
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
new MutationObserver(()=>{
 if(!el.classList.contains('visible')){
  if(frame)cancelAnimationFrame(frame);frame=0;d=null;level='half';
  el.style.removeProperty('height');el.style.removeProperty('max-height');
 }
}).observe(el,{attributes:true,attributeFilter:['class']});
window.addEventListener('resize',()=>{if(el.classList.contains('visible')&&!d)snap(level)});
window.__atlasCollectionSheet={getState:()=>({level,dragging:!!d})};
})();
