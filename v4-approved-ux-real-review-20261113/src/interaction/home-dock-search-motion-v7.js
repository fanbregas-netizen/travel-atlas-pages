/* Footprint Map: reversible shared-element search morph on the ORIGINAL product DOM.
 * This script does not intercept search requests, map, stars, routes, or storage.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const dock=$('appDock'),button=$('dockSearch');
if(!dock||!button||window.__fpRealSearchMotion?.version===7)return;
const body=document.body;
const prefersReduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t);return t*t*(3-2*t)};
const geometry=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height,cx:r.left+r.width/2,cy:r.top+r.height/2}};
const valid=g=>g&&g.w>6&&g.h>6;
const nativeOpen=()=>body.classList.contains('fp-search-open');
const attr=(node,sty)=>Object.assign(node.style,sty);
let active=null,openSnapshot=null,wasOpen=nativeOpen();
// The maximum unobstructed visual viewport is the keyboard-independent baseline.
const vv=window.visualViewport;
let restViewportHeight=vv?.height||window.innerHeight;
const keyboardGap=()=>Math.max(0,restViewportHeight-(vv?.height||window.innerHeight));
function updateViewportBaseline(){
 if(!nativeOpen()&&!active && (vv?.height||window.innerHeight)>restViewportHeight)
  restViewportHeight=vv?.height||window.innerHeight;
 if(active)active.measureDirty=true;
}
vv?.addEventListener('resize',updateViewportBaseline,{passive:true});
window.addEventListener('resize',updateViewportBaseline,{passive:true});

function captureDock(){
 const frame=geometry(dock),lens=geometry(button.querySelector('img')||button);
 const others=[...dock.querySelectorAll('.dock-btn:not(#dockSearch)')].map(el=>({image:el.querySelector('img')?.cloneNode(true),im:geometry(el.querySelector('img')),label:el.querySelector('span')?.textContent||'',labelBox:geometry(el.querySelector('span'))}));
 return {frame,lens,others,searchLabel:geometry(button.querySelector('span')),searchLabelText:button.querySelector('span')?.textContent||'搜索'};
}
function captureSearch(){
 const sheet=$('fpSearchSheet'),bar=sheet?.querySelector('.fp-search-top'),glass=sheet?.querySelector('.fp-magnify'),field=$('fpSearchField'),cancel=sheet?.querySelector('.fp30-search-cancel,.fp-search-close');
 let frame=geometry(bar),lens=geometry(glass),input=geometry(field),right=geometry(cancel);
 if(!valid(frame)){
  const w=Math.min(338,window.innerWidth-36),h=69;
  frame={x:(window.innerWidth-w)/2,y:window.innerHeight-86,w,h,cx:window.innerWidth/2,cy:window.innerHeight-86+h/2};
 }
 if(!valid(lens))lens={cx:frame.x+25,cy:frame.cy,w:22,h:22};
 if(!valid(input))input={x:frame.x+50,y:frame.y+10,w:frame.w-108,h:45};
 if(!valid(right))right={x:frame.x+frame.w-45,y:frame.y+12,w:40,h:42};
 return {frame,lens,input,right};
}
function makeNode(type,cssClass,txt){const n=document.createElement(type);n.className=cssClass;if(txt!==undefined)n.textContent=txt;return n;}
function cleanup(){
 if(active){cancelAnimationFrame(active.raf);active.el.remove();active=null;}
 body.classList.remove('fp-search-ux-flight','fp-search-ux-prepare');
}
function place(el,center,box,opacity=1,scale=1){
 // Never read offsetWidth/offsetHeight after writing each animation frame.
 // A compositor-side centering transform keeps label/icon geometry identical.
 attr(el,{left:(center.x-box.x)+'px',top:(center.y-box.y)+'px',opacity:String(opacity),
  transform:'translate(-50%,-50%) scale('+scale.toFixed(3)+')'});
}
function center(g){return{x:g.cx??g.x+g.w/2,y:g.cy??g.y+g.h/2};}
function frameFor(progress,src,search,velocity,target){
 // Spring-driven rubber edge, anchored to the real Dock without an intermediate floating tile.
 const p=clamp(progress,-.10,1.10),within=clamp(p),m=ease(within);
 const a=src.frame,c=search.frame;
 const strain=Math.sin(Math.PI*within);
 const overhang=(p-within)*176;
 const direction=target===1?1:-1;
 const elastic=direction*12*strain+overhang+clamp(velocity*1.0,-8,8);
 const x=mix(a.x,c.x,m)-elastic*.18;
 const y=mix(a.y,c.y,m)+Math.abs(elastic)*.08;
 const w=mix(a.w,c.w,m)+elastic;
 const h=mix(a.h,c.h,m)-Math.min(5,Math.abs(elastic)*.18);
 return {x:Math.max(6,x),y,w,h:Math.max(55,h),elastic};
}
function start(target,options={}){
 if(prefersReduced.matches){cleanup();return;}
 const old=active;
 let source=options.source || old?.source || openSnapshot || captureDock();
 if(!valid(source.frame)||!valid(source.lens))return;
 let finish=options.search || captureSearch();
 if(!valid(finish.frame))return;
 const startProgress=old?old.progress:(target===1?0:1);
 cleanup();
 body.classList.add('fp-search-ux-flight');
 const surface=makeNode('div','');surface.id='fp-search-shared-surface';surface.setAttribute('aria-hidden','true');
 const searchLens=button.querySelector('img')?.cloneNode(true)||makeNode('span','');searchLens.className='ux-asset ux-lens';surface.append(searchLens);
 const others=source.others.map(o=>{
   if(!o.image||!o.im)return null;
   const img=o.image;img.className='ux-asset ux-other';surface.append(img);
   const label=makeNode('span','ux-label',o.label);surface.append(label);
   return{im:o.im,img,label,labelBox:o.labelBox};
 }).filter(Boolean);
 const lensLabel=makeNode('span','ux-label',source.searchLabelText);surface.append(lensLabel);
 const hint=makeNode('span','ux-placeholder',$('fpSearchField')?.placeholder||'搜索城市、景点或地点…');surface.append(hint);
 const cancel=makeNode('span','ux-cancel','取消');surface.append(cancel);
 document.body.append(surface);
 const anim={el:surface,source,search:finish,target,progress:startProgress,
  velocity:old?.velocity||0,raf:0,started:0,lastFrame:0,physicsStarted:0,
  // Restrained underdamped spring: one stretch, a short recoil, then settle.
  stiffness:target?230:250,damping:target?19:20,
  // When cancelling with the iOS keyboard raised, keep the search bar aligned
  // with the retreating keyboard. Only then complete the reverse Dock morph.
  waitForKeyboard:target===0&&!old&&keyboardGap()>115,
  keyboardGapAtStart:keyboardGap(),keyboardWaitStarted:0,
  baselineSearch:finish,
  // Re-measure on actual native open and keyboard resize, not every rAF.
  seenOpen:false,measureDirty:true};
 active=anim;
 const render=p=>{
  const q=clamp(p),t=ease(q);
  const b=frameFor(p,source,finish,anim.velocity,target);
  attr(surface,{left:b.x+'px',top:b.y+'px',width:b.w+'px',height:b.h+'px',borderRadius:(mix(22,23,t)+Math.abs(b.elastic)*.09)+'px'});
  const aPoint=center(source.lens),cPoint=center(finish.lens),lensPos={x:mix(aPoint.x,cPoint.x,t),y:mix(aPoint.y,cPoint.y,t)};
  place(searchLens,lensPos,b,1,mix(1,1.025,Math.sin(Math.PI*q)));
  const contentIn=ease((q-.37)/.43),othersOut=1-ease(q/.37),tinyP=ease(Math.min(q/.42,1));
  others.forEach((o,i)=>{
   const from=center(o.im),to={x:aPoint.x+10+((i-1)*3),y:aPoint.y};
   place(o.img,{x:mix(from.x,to.x,tinyP),y:mix(from.y,to.y,tinyP)},b,othersOut,mix(1,.67,tinyP));
   if(o.labelBox){const g=center(o.labelBox);place(o.label,{x:mix(g.x,to.x,tinyP),y:mix(g.y,to.y,tinyP)},b,othersOut,1)}
   else o.label.style.opacity='0';
  });
  if(source.searchLabel){const m=center(source.searchLabel);place(lensLabel,{x:mix(m.x,aPoint.x,tinyP),y:mix(m.y,aPoint.y,tinyP)},b,1-ease(p/.22),1)}
  else lensLabel.style.opacity='0';
  hint.style.left=(finish.input.x-b.x+3)+'px';hint.style.top=(finish.input.y-b.y+finish.input.h/2-13+7*(1-contentIn))+'px';hint.style.opacity=String(contentIn);
  const cancelIn=ease((p-.63)/.32);
  cancel.style.left=(finish.right.x-b.x)+'px';cancel.style.top=(finish.right.y-b.y+finish.right.h/2-13)+'px';cancel.style.opacity=String(cancelIn);
 };
 render(startProgress);
 const tick=now=>{
  if(active!==anim)return;
  if(anim.waitForKeyboard){
   if(!anim.keyboardWaitStarted)anim.keyboardWaitStarted=now;
   const gap=keyboardGap();
   if(gap>85 && now-anim.keyboardWaitStarted<500){
    const dy=Math.max(0,anim.keyboardGapAtStart-gap);
    const shifted={...anim.baselineSearch};
    for(const key of ['frame','lens','input','right']){
      const b=anim.baselineSearch[key];
      if(b)shifted[key]={...b,y:b.y+dy,cy:(b.cy??b.y+b.h/2)+dy};
    }
    finish=shifted;
    render(1);
    anim.raf=requestAnimationFrame(tick);
    return;
   }
   anim.waitForKeyboard=false;
   anim.started=now;
  }
  if(!anim.started)anim.started=now;
  if(!anim.physicsStarted)anim.physicsStarted=now;
  const dt=anim.lastFrame?Math.min(.035,(now-anim.lastFrame)/1000):1/60;
  anim.lastFrame=now;
  // Semi-implicit Euler preserves momentum and reverses without a new layout jump.
  const a=anim.stiffness*(target-anim.progress)-anim.damping*anim.velocity;
  anim.velocity+=a*dt;
  anim.progress=clamp(anim.progress+anim.velocity*dt,-.10,1.10);
  if(target===1&&nativeOpen()&&(!anim.seenOpen||anim.measureDirty)){
   const measured=captureSearch();
   if(valid(measured.frame))finish=measured;
   anim.measureDirty=false;anim.seenOpen=true;
  }
  render(anim.progress);
  const settled=Math.abs(anim.progress-target)<.006&&Math.abs(anim.velocity)<.065;
  const timeout=now-anim.physicsStarted>740;
  if(!settled&&!timeout){anim.raf=requestAnimationFrame(tick);return;}
  anim.progress=target;anim.velocity=0;
  render(target);
  cleanup();
  if(target===1&&nativeOpen()){
   // Empty results must leave the map visible. Only real search controller adds results.
   const area=$('fpSearchSheet')?.querySelector('.fp-search-body');
   if(area&&area.children.length)animateResults();
  }
 };
 anim.raf=requestAnimationFrame(tick);
}
let resultTimer=0;
function animateResults(){
 if(!nativeOpen())return;
 const area=$('fpSearchSheet')?.querySelector('.fp-search-body');
 if(!area||!area.children.length)return;
 body.classList.remove('fp-ux-results-enter');
 void area.offsetHeight;
 body.classList.add('fp-ux-results-enter');
 clearTimeout(resultTimer);
 resultTimer=setTimeout(()=>body.classList.remove('fp-ux-results-enter'),340);
}
const searchResults=$('fpSearchSheet')?.querySelector('.fp-search-body');
if(searchResults)new MutationObserver(records=>{
 if(records.some(r=>r.addedNodes.length))animateResults();
}).observe(searchResults,{childList:true});
const searchField=$('fpSearchField');
if(searchField)searchField.placeholder='搜索城市或地点';
function onSearchTap(){
 if(nativeOpen())return;
 openSnapshot=captureDock();
 if(!valid(openSnapshot.frame))return;
 // Start exactly ONCE in the original trusted click. Previously the observer
 // and a delayed rAF both started the same animation, causing extra swaps.
 // captureSearch supplies a safe target until the actual search DOM is visible.
 start(1,{source:openSnapshot});
}
function onSearchDismiss(){
 if(!nativeOpen()&&!active&&!wasOpen)return;
 if(active?.target===0)return;
 const finish=captureSearch();
 // Cancel can occur while the keyboard is open; measure the field BEFORE the native blur.
 start(0,{source:openSnapshot||captureDock(),search:finish});
}
button.addEventListener('click',onSearchTap,true);
// iPhone Safari requires trusted-event synchronous focus to raise the software keyboard.
document.addEventListener('click',event=>{
 if(!event.target.closest('#dockSearch')||!nativeOpen())return;
 const field=$('fpSearchField');
 try{field?.focus({preventScroll:true})}catch(_){field?.focus()}
},false);
// Native handlers own all actual behavior; these merely prepare the visual reverse action.
document.addEventListener('click',event=>{
 const t=event.target;
 if(t.closest('#fpSearchSheet .fp-search-close, #fpSearchSheet .fp-search-row'))onSearchDismiss();
},true);
const watcher=new MutationObserver(()=>{
 const next=nativeOpen();
 if(!next&&wasOpen&&(!active||active.target!==0))onSearchDismiss();
 if(next&&!wasOpen&&!active){openSnapshot=captureDock();start(1,{source:openSnapshot,search:captureSearch()})}
 wasOpen=next;
});
watcher.observe(body,{attributes:true,attributeFilter:['class']});
window.addEventListener('pagehide',()=>{watcher.disconnect();cleanup();vv?.removeEventListener('resize',updateViewportBaseline);window.removeEventListener('resize',updateViewportBaseline)});
window.__fpRealSearchMotion={version:7,state:()=>({mode:active?(active.target?'opening':'closing'):nativeOpen()?'search':'dock',progress:active?.progress||0,hasOverlay:!!active}),cleanup};
})();
