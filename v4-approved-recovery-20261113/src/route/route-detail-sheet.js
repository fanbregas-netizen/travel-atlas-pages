/* V4 route detail: approved three-snap card powered by the same B state machine.
 * Owns only the real #rvDetail on route-view.html, never the homepage #fpPlaceCard. */
(function(){
'use strict';
const sheetAPI=window.TravelAtlasSheet;
if(!sheetAPI){console.error('Route detail controller unavailable');return;}
const ctrl=sheetAPI.createSheetController();
let detail=null,grip=null,domObserver=null,placeObserver=null,sourceId='';
let start=null,scrollTouch=null;
const bubble=()=>document.getElementById('stopBubble');
const state=()=>ctrl.getState();
function syncFromView(){
 if(!detail)return;
 const selectedId=bubble()?.dataset.placeId||'';
 const shown=detail.classList.contains('open');
 if(shown&&selectedId){
  if(state().sheet==='closed'||state().selectedPlaceId!==selectedId)ctrl.open(selectedId);
 }else if(!shown&&state().sheet!=='closed')ctrl.close();
}
function paint(next){
 if(!detail)return;
 const opened=next.sheet!=='closed';
 detail.classList.toggle('open',opened);
 detail.dataset.atlasSnap=next.sheet;
 detail.setAttribute('aria-hidden',String(!opened));
 if(grip){
  grip.setAttribute('aria-valuenow',String(Math.max(1,sheetAPI.OPEN_LEVELS.indexOf(next.sheet)+1)));
  grip.setAttribute('aria-valuetext',({peek:'预览',half:'半屏',full:'全屏'})[next.sheet]||'关闭');
 }
}
ctrl.subscribe(next=>paint(next));
function bind(node){
 if(detail===node)return;
 domObserver?.disconnect();placeObserver?.disconnect();
 detail=node;grip=detail.querySelector('.grab');if(!grip)return;
 grip.tabIndex=0;grip.setAttribute('role','slider');
 grip.setAttribute('aria-label','路线地点详情展开程度');
 grip.setAttribute('aria-valuemin','1');grip.setAttribute('aria-valuemax','3');
 grip.style.touchAction='none';
 detail.querySelector('.rv-x')?.addEventListener('click',()=>ctrl.close());
 const begin=e=>{
  if(state().sheet==='closed'||start||(e.button!==undefined&&e.button!==0))return;
  start={pointerId:e.pointerId,x:e.clientX,y:e.clientY,time:e.timeStamp,height:detail.getBoundingClientRect().height,moved:false};
  try{grip.setPointerCapture(e.pointerId)}catch(_){}
 };
 const move=e=>{
  if(!start||e.pointerId!==start.pointerId)return;
  const dx=e.clientX-start.x,dy=e.clientY-start.y;
  if(!start.moved){
   if(Math.abs(dy)<6||Math.abs(dx)>Math.abs(dy)*1.2)return;
   start.moved=true;detail.dataset.atlasDragging='true';
  }
  const h=window.visualViewport?.height||innerHeight;
  detail.style.height=Math.min(h-90,Math.max(140,start.height-dy*.82))+'px';
 };
 const finish=e=>{
  if(!start||e.pointerId!==start.pointerId)return;
  const data={deltaX:e.clientX-start.x,deltaY:e.clientY-start.y,durationMs:Math.max(1,e.timeStamp-start.time)};
  const moved=start.moved;
  start=null;delete detail.dataset.atlasDragging;detail.style.removeProperty('height');
  if(moved)ctrl.swipe(data);
 };
 grip.addEventListener('pointerdown',begin);
 grip.addEventListener('pointermove',move);
 grip.addEventListener('pointerup',finish);
 grip.addEventListener('pointercancel',()=>{start=null;delete detail.dataset.atlasDragging;detail.style.removeProperty('height')});
 grip.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();ctrl.close();return;}
  if(e.key==='ArrowUp'||e.key==='ArrowDown'){
   e.preventDefault();ctrl.swipe({deltaX:0,deltaY:e.key==='ArrowUp'?-72:72,durationMs:220});
  }
 });
 // Content can change the snap only when scrolling has returned to the top.
 // Ignore taps and links, media, multi-touch and horizontal swipes.
 detail.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||e.target.closest('.grab,button,a,input,textarea,video,select')){scrollTouch=null;return;}
  scrollTouch={x:e.touches[0].clientX,y:e.touches[0].clientY,time:e.timeStamp,top:detail.scrollTop};
 },{passive:true});
 detail.addEventListener('touchend',e=>{
  if(!scrollTouch||e.changedTouches.length!==1){scrollTouch=null;return;}
  const last=e.changedTouches[0],g={deltaX:last.clientX-scrollTouch.x,deltaY:last.clientY-scrollTouch.y,
    durationMs:Math.max(1,e.timeStamp-scrollTouch.time),fromContent:true,scrollTop:Math.max(scrollTouch.top,detail.scrollTop)};
  scrollTouch=null;ctrl.swipe(g);
 },{passive:true});
 detail.addEventListener('touchcancel',()=>{scrollTouch=null},{passive:true});
 domObserver=new MutationObserver(syncFromView);
 domObserver.observe(detail,{attributes:true,attributeFilter:['class']});
 if(bubble()){
  placeObserver=new MutationObserver(syncFromView);
  placeObserver.observe(bubble(),{attributes:true,attributeFilter:['data-place-id','hidden']});
 }
 syncFromView();paint(state());
 window.__atlasRouteDetailSheet={state,open:placeId=>ctrl.open(String(placeId)),close:()=>ctrl.close(),
   snapTo:level=>ctrl.snapTo(level)};
}
function findAndBind(){
 const node=document.getElementById('rvDetail');
 if(node)bind(node);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',findAndBind,{once:true});
else findAndBind();
const watch=new MutationObserver(()=>{if(!detail)findAndBind()});
watch.observe(document.body,{childList:true,subtree:false});
setTimeout(findAndBind,1000);
})();
