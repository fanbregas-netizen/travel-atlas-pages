/* Footprint Map: reversible shared-element search morph on the ORIGINAL product DOM.
 * This script does not intercept search requests, map, stars, routes, or storage.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const dock=$('appDock'),button=$('dockSearch');
if(!dock||!button||window.__fpRealSearchMotion?.version===4)return;
const body=document.body;
const prefersReduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t);return t*t*(3-2*t)};
const geometry=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height,cx:r.left+r.width/2,cy:r.top+r.height/2}};
const valid=g=>g&&g.w>6&&g.h>6;
const nativeOpen=()=>body.classList.contains('fp-search-open');
const attr=(node,sty)=>Object.assign(node.style,sty);
let active=null,openSnapshot=null,unmounting=false,wasOpen=nativeOpen();
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
 attr(el,{left:(center.x-box.x-el.offsetWidth/2)+'px',top:(center.y-box.y-el.offsetHeight/2)+'px',opacity:String(opacity),transform:'scale('+scale.toFixed(3)+')'});
}
function center(g){return{x:g.cx??g.x+g.w/2,y:g.cy??g.y+g.h/2};}
function frameFor(progress,src,search){
 // Direct continuous source-to-target geometry. No temporary 76px detached tile.
 const p=ease(clamp(progress)),a=src.frame,c=search.frame;
 return {x:mix(a.x,c.x,p),y:mix(a.y,c.y,p),w:mix(a.w,c.w,p),h:mix(a.h,c.h,p)};
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
 const anim={el:surface,source,search:finish,target,progress:startProgress,raf:0,started:0,duration:target?302:280};active=anim;
 const render=p=>{
  const b=frameFor(p,source,finish);
  attr(surface,{left:b.x+'px',top:b.y+'px',width:b.w+'px',height:b.h+'px',borderRadius:mix(22,23,ease(p))+'px'});
  const aPoint=center(source.lens),cPoint=center(finish.lens),lensPos={x:mix(aPoint.x,cPoint.x,ease(p)),y:mix(aPoint.y,cPoint.y,ease(p))};
  place(searchLens,lensPos,b,1,mix(1,1.04,Math.sin(Math.PI*clamp(p))));
  const contentIn=ease((p-.43)/.41),othersOut=1-ease(p/.31),tinyP=ease(Math.min(p/.35,1));
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
  if(!anim.started)anim.started=now;
  const u=clamp((now-anim.started)/anim.duration);
  // A spring-like settle with no exaggerated bounce; reverse uses exactly the same geometry.
  const smooth=1-Math.pow(1-u,3)*(1+1.5*u);
  anim.progress=mix(startProgress,target,clamp(smooth));
  if(target===1 && nativeOpen()){
   const measured=captureSearch();
   if(valid(measured.frame))finish=measured;
  }
  render(anim.progress);
  if(u<1){anim.raf=requestAnimationFrame(tick);return;}
  cleanup();
  if(target===1&&nativeOpen()){
   const area=$('fpSearchSheet')?.querySelector('.fp-search-body');
   if(area&&!area.textContent.trim()&&!$('fpSearchField')?.value?.trim()){
    const empty=document.createElement('div');
    empty.className='fp-search-empty fp-review-search-prompt';
    empty.textContent='输入城市、景点或地点开始搜索';
    area.append(empty);
   }
   body.classList.add('fp-ux-results-enter');
   window.setTimeout(()=>body.classList.remove('fp-ux-results-enter'),380);
  }
 };
 anim.raf=requestAnimationFrame(tick);
}
function onSearchTap(){
 if(nativeOpen())return;
 openSnapshot=captureDock();
 if(!valid(openSnapshot.frame))return;
 // Capture before the original handler changes the Dock, then measure native search surface.
 requestAnimationFrame(()=>{
  if(!nativeOpen()){body.classList.remove('fp-search-ux-prepare');return;}
  const finish=captureSearch();
  start(1,{source:openSnapshot,search:finish});
 });
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
 if(next&&!wasOpen&&!active&&!body.classList.contains('fp-search-ux-prepare')){openSnapshot=captureDock();start(1,{source:openSnapshot,search:captureSearch()})}
 wasOpen=next;
});
watcher.observe(body,{attributes:true,attributeFilter:['class']});
window.addEventListener('pagehide',()=>{watcher.disconnect();cleanup()});
window.__fpRealSearchMotion={version:4,state:()=>({mode:active?(active.target?'opening':'closing'):nativeOpen()?'search':'dock',progress:active?.progress||0,hasOverlay:!!active}),cleanup};
})();
