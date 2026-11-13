/* V3 approved physical movement, moved from final Interaction B demo to
 * actual map sheet. One geographic place, one state controller, no new star. */
(function(root){
'use strict';
const LEVELS=['peek','half','full'];
const forbidden='button:not([data-atlas-grip]),a,input,textarea,select,video,[contenteditable],.fp-media-mosaic';
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
function connect({sheet,controller,header,grip,scroll}){
 if(!sheet||!controller||!header)return null;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 let level=controller.getState().sheet,place=controller.getState().selectedPlaceId;
 let height=0,vertical=0,heightVelocity=0,verticalVelocity=0,frame=0,lastTick=0;
 let springTargetHeight=0;
 let drag=null,touch=null,animating=false,settleTimer=null;
 const listeners=[];
 const on=(el,type,cb,opt)=>{el?.addEventListener(type,cb,opt);listeners.push(()=>el?.removeEventListener(type,cb,opt))};
 const detents=()=>{
  const viewport=window.visualViewport?.height||window.innerHeight||844;
  const bottom=parseFloat(getComputedStyle(sheet).bottom)||16;
  const full=Math.max(400,viewport-bottom-22);
  const peek=Math.min(full-175,clamp(Math.round(viewport*.32),188,265));
  const half=clamp(Math.round(viewport*.58),peek+105,full-94);
  return {peek,half,full};
 };
 const paint=()=>{
  if(!sheet.isConnected)return;
  // Historic V4 CSS still declares #fpSearchSheet height:max-content!important.
  // JS-driven physical detents must win, otherwise search never truly grows
  // beyond its ~316px content and its touch gesture feels broken on iPhone.
  if(sheet.id==='fpSearchSheet')sheet.style.setProperty('height',height.toFixed(2)+'px','important');
  else sheet.style.height=height.toFixed(2)+'px';
  if(sheet.id==='fpSearchSheet')sheet.style.setProperty('transform','translate3d(0,'+vertical.toFixed(2)+'px,0)','important');
  else sheet.style.transform='translate3d(0,'+vertical.toFixed(2)+'px,0)';
  sheet.style.opacity=String(1-Math.min(.48,Math.max(0,vertical/(height+120))*.4));
 };
 const stop=()=>{if(frame)cancelAnimationFrame(frame);if(settleTimer!==null)clearTimeout(settleTimer);
  settleTimer=null;frame=0;animating=false;lastTick=0};
 const target=(h,y=0,v=0)=>{
  // Coalesce repeated WebKit geometry notifications against the destination,
  // not the still-moving rendered height; otherwise the spring restarts forever.
  springTargetHeight=h;
  stop();
  if(reduced.matches){height=h;vertical=y;paint();complete();return}
  heightVelocity=clamp(v,-2000,2000);animating=true;
  // Safari/WebKit can pause rAF when map canvases reconfigure or a tab resumes.
  // A bounded fail-safe makes the physical spring settle without leaving UI
  // hit targets perpetually unstable; it is cancelled by any new gesture.
  settleTimer=setTimeout(()=>{
    if(animating&&!drag){stop();height=h;vertical=y;
      heightVelocity=verticalVelocity=0;paint();complete()}
  },840);
  const tick=now=>{
   const dt=clamp(lastTick?(now-lastTick)/1000:.0167,.001,.03);lastTick=now;
   // Matches Interaction B's original semi-implicit 395/38 spring.
   heightVelocity+=(395*(h-height)-38*heightVelocity)*dt;
   height+=heightVelocity*dt;
   verticalVelocity+=(395*(y-vertical)-38*verticalVelocity)*dt;
   vertical+=verticalVelocity*dt;paint();
   if(Math.abs(h-height)<.55&&Math.abs(heightVelocity)<4&&
      Math.abs(y-vertical)<.65&&Math.abs(verticalVelocity)<4){
    height=h;vertical=y;heightVelocity=verticalVelocity=0;paint();
    frame=0;if(settleTimer!==null)clearTimeout(settleTimer);settleTimer=null;complete();
   }else frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
 };
 function complete(){
  animating=false;
  if(level==='closed'&&!drag){
   sheet.hidden=true;
   sheet.style.removeProperty('height');
   sheet.style.removeProperty('transform');
   sheet.style.removeProperty('opacity');
  }
 }
 function render(state,previous,reason){
  const next=state.sheet;
  if(next==='closed'){
   if(level!=='closed'&&!sheet.hidden){
    level='closed';const departing=Math.max(200,height||sheet.getBoundingClientRect().height);
    target(departing,departing+115);
   }else level='closed';
   return;
  }
  const wasClosed=level==='closed'||sheet.hidden;
  if(wasClosed){
   height=detents().peek;vertical=height+96;heightVelocity=verticalVelocity=0;
   sheet.hidden=false;paint();
  }
  const changedPlace=place&&place!==state.selectedPlaceId;
  place=state.selectedPlaceId;level=next;
  if(changedPlace&&scroll)scroll.scrollTop=0;
  if(scroll)scroll.style.touchAction=next==='full'?'pan-y':'none';
  target(detents()[next],0);
 }
 function velocity(samples){
  if(samples.length<2)return 0;
  const last=samples[samples.length-1];let first=samples[0];
  for(let i=samples.length-2;i>=0;i--){first=samples[i];if(last.t-first.t>=65)break}
  return (last.y-first.y)/Math.max(1,last.t-first.t);
 }
 const nearest=(val,bounds)=>LEVELS.reduce((best,key)=>
  Math.abs(bounds[key]-val)<Math.abs(bounds[best]-val)?key:best,'peek');
 function start(id,x,y,t,from){
  if(level==='closed'||drag)return false;
  stop();height=sheet.getBoundingClientRect().height||detents()[level];
  vertical=0;paint();
  drag={id,x,y,lastY:y,moved:false,t,from,startHeight:height,fromLevel:level,samples:[{y,t}],bounds:detents()};
  return true;
 }
 function move(x,y,t){
  if(!drag)return;
  const dx=x-drag.x,dy=y-drag.y;
  if(!drag.moved){
   if(Math.abs(dx)>Math.abs(dy)*1.2&&Math.abs(dx)>8)return;
   if(Math.abs(dy)<4)return;
   drag.moved=true;sheet.dataset.atlasDragging='true';
  }
  drag.lastY=y;drag.samples.push({y,t});
  while(drag.samples.length>2&&t-drag.samples[0].t>105)drag.samples.shift();
  const h=drag.startHeight-dy,b=drag.bounds;
  height=h<b.peek?b.peek-(b.peek-h)*.28:h>b.full?b.full+(h-b.full)*.2:h;
  height=Math.max(135,height);paint();
 }
 function end(cancelled=false){
  if(!drag)return;const d=drag;drag=null;delete sheet.dataset.atlasDragging;
  if(cancelled||!d.moved){target(detents()[level]);return}
  const dy=d.lastY-d.y,v=velocity(d.samples),b=detents();
  const targetLevel=nearest(height-v*165,b);
  const old=LEVELS.indexOf(d.fromLevel);
  let idx=LEVELS.indexOf(targetLevel);
  if(Math.abs(v)>.62&&Math.abs(dy)>14&&(idx-old)*(v<0?1:-1)<=0)idx=clamp(old+(v<0?1:-1),0,2);
  if(Math.abs(dy)<14&&Math.abs(v)<.35)idx=old;
  if(d.fromLevel==='peek'&&dy>60&&(height<b.peek-14||v>.58||dy>100)){controller.close();return}
  const next=LEVELS[idx];
  if(next===controller.getState().sheet)target(b[next]);
  else controller.snapTo(next);
 }
 let pointer=null;
 on(header,'pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0||e.target.closest(forbidden))return;
  if(start(e.pointerId,e.clientX,e.clientY,e.timeStamp,'header')){
   pointer=e.pointerId;try{header.setPointerCapture(pointer)}catch(_){}
  }
 });
 on(header,'pointermove',e=>{if(e.pointerId===pointer)move(e.clientX,e.clientY,e.timeStamp)});
 on(header,'pointerup',e=>{if(e.pointerId!==pointer)return;const wasMoved=drag?.moved;const onGrip=!!e.target.closest('[data-atlas-grip]');pointer=null;end(false);
  if(!wasMoved&&onGrip&&level!=='closed'){const i=LEVELS.indexOf(level);controller.snapTo(LEVELS[i===2?1:i+1])}
 });
 on(header,'pointercancel',()=>{pointer=null;end(true)});
 on(grip,'keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();controller.close()}
  else if(e.key==='ArrowUp'||e.key==='ArrowDown'){
   e.preventDefault();const i=LEVELS.indexOf(level),next=i+(e.key==='ArrowUp'?1:-1);
   if(next<0)controller.close();else controller.snapTo(LEVELS[clamp(next,0,2)]);
  }
 });
 if(scroll){
  on(scroll,'touchstart',e=>{
   if(e.touches.length!==1||e.target.closest(forbidden)){touch=null;return}
   const p=e.touches[0];touch={id:p.identifier,x:p.clientX,y:p.clientY,engaged:false};
  },{passive:true});
  on(scroll,'touchmove',e=>{
   if(!touch||e.touches.length!==1)return;const p=e.touches[0],dx=p.clientX-touch.x,dy=p.clientY-touch.y;
   if(!touch.engaged&&level==='full'&&scroll.scrollTop>1){touch.x=p.clientX;touch.y=p.clientY;return}
   if(!touch.engaged){
    if((level==='full'&&dy<=7)||Math.abs(dy)<7||Math.abs(dx)>Math.abs(dy)*1.15)return;
    touch.engaged=start(touch.id,touch.x,touch.y,e.timeStamp-16,'content');
   }
   if(touch.engaged){e.preventDefault();move(p.clientX,p.clientY,e.timeStamp)}
  },{passive:false});
  on(scroll,'touchend',e=>{
   if(!touch)return;const t=touch;touch=null;
   if(t.engaged){const p=[...e.changedTouches].find(x=>x.identifier===t.id);if(p)move(p.clientX,p.clientY,e.timeStamp);end()}
  },{passive:true});
  on(scroll,'touchcancel',()=>{touch=null;end(true)},{passive:true});
 }
 // Keyboard and Safari toolbar resize must not teleport an open card to a
 // new detent. Coalesce visualViewport events, retaining the V3 spring.
 let viewportFrame=0;
 const resettleForViewport=()=>{
  if(viewportFrame)return;
  viewportFrame=requestAnimationFrame(()=>{
   viewportFrame=0;
   if(level==='closed'||drag||!sheet.isConnected)return;
   const nextHeight=detents()[level];
   if(Math.abs(nextHeight-(springTargetHeight||height))<1)return;
   target(nextHeight,0,heightVelocity);
  });
 };
 on(window,'resize',resettleForViewport,{passive:true});
 on(window.visualViewport,'resize',resettleForViewport,{passive:true});
 on(window.visualViewport,'scroll',resettleForViewport,{passive:true});
 // iOS WebKit can change the CSS viewport (including keyboard/toolbar
 // transitions) without delivering a window/visualViewport resize event to
 // app listeners. Observe the document geometry without polling or layout
 // reads on every animation frame.
 const rootResizeObserver=typeof ResizeObserver!=='undefined'
  ?new ResizeObserver(resettleForViewport):null;
 rootResizeObserver?.observe(document.documentElement);
 sheet.dataset.atlasPhysicalSheet='v3';
 // Recover existing card after DOM re-render and attach only once.
 if(level!=='closed'&&!sheet.hidden){height=detents()[level];vertical=0;paint()}
 const unsubscribe=controller.subscribe(render);
 return Object.freeze({
  state:()=>({sheet:level,height,animating,placeId:place}),
  destroy(){stop();rootResizeObserver?.disconnect();unsubscribe();listeners.splice(0).forEach(f=>f());delete sheet.dataset.atlasPhysicalSheet},
  snapTo:level=>controller.snapTo(level),close:()=>controller.close()
 });
}
root.TravelAtlasPhysicalSheet=Object.freeze({connect});
})(window);
