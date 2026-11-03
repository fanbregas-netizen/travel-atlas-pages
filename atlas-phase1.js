/* V4 mobile sheet motion · no duplicate markers or independent order layer. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const states=['peek','half','full'];
const handlers=new WeakSet();const observedNodes=new WeakSet();
const current=node=>Math.max(0,states.indexOf(node.dataset.atlasSnap||'peek'));
function setSnap(node,index){const next=Math.max(0,Math.min(2,index));node.dataset.atlasSnap=states[next];node.querySelector('[data-atlas-grip]')?.setAttribute('aria-valuenow',String(next+1));}
function closeSheet(node){if(node.id==='fpSearchSheet')node.querySelector('.fp-search-close')?.click();else if(node.id==='fpPlaceCard')node.querySelector('.fp-card-close')?.click();}
function install(node,selector,initial){
 if(!node)return;let grip=node.querySelector(selector);
 if(!grip&&node.id==='fpPlaceCard'){grip=document.createElement('button');grip.type='button';grip.className='atlas-card-grip';grip.setAttribute('aria-label','上下滑动地点卡片');node.insertBefore(grip,node.firstChild)}
 if(!grip||handlers.has(grip))return;handlers.add(grip);
 grip.setAttribute('data-atlas-grip','');grip.setAttribute('role','slider');grip.setAttribute('aria-label','上下滑动卡片');grip.setAttribute('aria-valuemin','1');grip.setAttribute('aria-valuemax','3');grip.tabIndex=0;
 if(!states.includes(node.dataset.atlasSnap))node.dataset.atlasSnap=initial;setSnap(node,current(node));
 let start=null,dragging=false;
 grip.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;start={y:e.clientY,x:e.clientX,id:e.pointerId,time:performance.now()};dragging=false;try{grip.setPointerCapture(e.pointerId)}catch(_){}});
 grip.addEventListener('pointermove',e=>{if(!start||start.id!==e.pointerId)return;const dy=e.clientY-start.y;if(Math.abs(dy)>6)dragging=true;if(!dragging)return;node.style.setProperty('--fp-drag-offset',Math.max(-34,Math.min(90,dy*.55))+'px')});
 grip.addEventListener('pointerup',e=>{if(!start)return;const dy=e.clientY-start.y,elapsed=Math.max(1,performance.now()-start.time);start=null;node.style.removeProperty('--fp-drag-offset');if(Math.abs(dy)<28)return;const direction=dy<0?1:-1;const jump=Math.abs(dy)>148||Math.abs(dy/elapsed)>1.55?2:1;const next=current(node)+direction*jump;if(next<0)closeSheet(node);else setSnap(node,next)});
 grip.addEventListener('pointercancel',()=>{start=null;node.style.removeProperty('--fp-drag-offset')});
 grip.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const next=current(node)+(e.key==='ArrowUp'?1:-1);if(next<0)closeSheet(node);else setSnap(node,next)}else if(e.key==='Escape'){e.preventDefault();closeSheet(node)}});
 // A gesture starting at the top of the scroll container can open the sheet,
 // without stealing normal scroll, selection, media controls, or edit fields.
 const sc=node.querySelector(node.id==='fpPlaceCard'?'.fp-card-scroll':'.fp-search-body');
 if(sc&&!handlers.has(sc)){handlers.add(sc);let at=null;sc.addEventListener('touchstart',e=>{if(e.touches.length!==1||e.target.closest('button,a,input,textarea,select,video')){at=null;return}at={y:e.touches[0].clientY,scroll:sc.scrollTop}},{passive:true});
 sc.addEventListener('touchend',e=>{if(!at||e.changedTouches.length!==1)return;const diff=e.changedTouches[0].clientY-at.y;const canCollapse=at.scroll<=3&&diff>75;const canExpand=diff< -80&&current(node)<2;if(canCollapse)setSnap(node,current(node)-1);else if(canExpand)setSnap(node,current(node)+1);at=null},{passive:true});
 sc.addEventListener('touchcancel',()=>{at=null},{passive:true})}
 if(!observedNodes.has(node)){observedNodes.add(node);new MutationObserver(()=>{if(node.hidden){setSnap(node,states.indexOf(initial));node.style.removeProperty('--fp-drag-offset')}}).observe(node,{attributes:true,attributeFilter:['hidden']});}
}
function viewPort(){const v=window.visualViewport;if(!v)return;const update=()=>{const height=Math.max(300,v.height),kb=Math.max(0,innerHeight-v.height-v.offsetTop);document.documentElement.style.setProperty('--atlas-visible-height',height+'px');document.documentElement.style.setProperty('--atlas-keyboard-bottom',kb+'px');const search=$('fpSearchSheet');if(search&&!search.hidden&&kb>100)setSnap(search,2)};
 v.addEventListener('resize',update,{passive:true});v.addEventListener('scroll',update,{passive:true});update()}
function setup(){install($('fpSearchSheet'),'.fp-search-grip','half');install($('fpPlaceCard'),'.atlas-card-grip','peek');}
function init(){setup();new MutationObserver(()=>{setup()}).observe(document.body,{childList:true,subtree:true});viewPort();window.AtlasPhase1={version:'V4-mobile-sheets-final-20261103',setSnap}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();