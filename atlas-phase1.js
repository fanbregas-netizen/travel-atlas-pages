/* Batch 1: high-reliability star selection and unified iPhone sheet gestures. */
(()=>{'use strict';
const $=id=>document.getElementById(id),api=()=>window.__atlasPickMapAPI,picker=()=>window.__atlasTripPicker;
let layer=null,numbers=null,interval=0,raf=0,active=false,queued=false,lastSignature='';
function mount(){if(layer)return;layer=document.createElement('div');layer.id='atlasPhase1Pins';layer.hidden=true;numbers=document.createElement('div');numbers.id='atlasPhase1OrderLabels';numbers.hidden=true;numbers.setAttribute('aria-hidden','true');document.body.append(layer,numbers)}
function cluster(points,r){const map=new Map();for(const p of points){const k=Math.floor(p.x/r)+':'+Math.floor(p.y/r);if(!map.has(k))map.set(k,[]);map.get(k).push(p)}return [...map.values()]}
function draw(){raf=0;if(!active||!document.body.classList.contains('route-pick-active'))return;const map=api(),trip=picker();if(!map?.project||!trip?.selected||!trip?.records)return;
const data=trip.records(),chosen=trip.selected(),width=innerWidth,height=innerHeight,visible=[];
for(const place of data){if(!Number.isFinite(+place.lat)||!Number.isFinite(+place.lng))continue;let p=null;try{p=map.project(+place.lng,+place.lat)}catch(_){}
if(!p||!Number.isFinite(+p.x)||!Number.isFinite(+p.y)||p.x<-28||p.y<-28||p.x>width+28||p.y>height+28)continue;visible.push({place,id:String(place.id),x:+p.x,y:+p.y});}
const signature=chosen.join('|')+'/'+visible.map(p=>p.id+':'+Math.round(p.x)+','+Math.round(p.y)).join(';');if(signature===lastSignature)return;lastSignature=signature;
const plain=visible.filter(p=>!chosen.includes(p.id)),selected=visible.filter(p=>chosen.includes(p.id));
const pins=document.createDocumentFragment(),badges=document.createDocumentFragment();
const button=(x,y,caption,cls,callback,label)=>{const el=document.createElement('button');el.type='button';el.className='atlas-phase1-pickpin '+cls;el.style.left=x+'px';el.style.top=y+'px';el.textContent=caption;el.setAttribute('aria-label',label);el.onclick=e=>{e.preventDefault();e.stopPropagation();callback()};return el};
for(const group of cluster(plain,Math.min(70,Math.max(46,Math.round(width*.115))))){const x=group.reduce((n,p)=>n+p.x,0)/group.length,y=group.reduce((n,p)=>n+p.y,0)/group.length;
if(group.length===1){const p=group[0];pins.append(button(x,y,'★','',()=>trip.toggle?.(p.id),'选择 '+String(p.place.title||'收藏地点')))}
else{const n=group.length;const p=group[0];pins.append(button(x,y,n>99?'99+':String(n),'is-cluster',()=>map.zoomTo?.(p.place.lat,p.place.lng,Math.min(18,(map.zoom?.()||10)+2.1)),n+' 个相近收藏点，点击放大查看'))}}
const occupied=[];
for(const p of selected){const order=chosen.indexOf(p.id)+1;pins.append(button(p.x,p.y,'★','is-chosen',()=>trip.toggle?.(p.id),'移除第 '+order+' 站 '+String(p.place.title||'')));
let x=p.x+13,y=p.y-32;
for(let n=0;n<8;n++){if(occupied.every(a=>Math.hypot(a.x-x,a.y-y)>25))break;const a=(n+1)*Math.PI/4;x=p.x+21*Math.cos(a);y=p.y-29+21*Math.sin(a)}
occupied.push({x,y});const badge=document.createElement('span');badge.className='atlas-phase1-number';badge.textContent=order;badge.style.left=Math.max(10,Math.min(width-10,x))+'px';badge.style.top=Math.max(18,Math.min(height-16,y))+'px';badges.append(badge)}
layer.replaceChildren(pins);numbers.replaceChildren(badges)}
function schedule(){if(!active||raf)return;raf=requestAnimationFrame(draw)}
function enter(){if(active)return;active=true;mount();layer.hidden=false;numbers.hidden=false;document.body.classList.add('atlas-phase1-overlay-active');schedule();interval=setInterval(schedule,200)}
function leave(){if(!active)return;active=false;lastSignature='';clearInterval(interval);interval=0;if(raf)cancelAnimationFrame(raf);raf=0;document.body.classList.remove('atlas-phase1-overlay-active');layer.hidden=true;numbers.hidden=true;layer.replaceChildren();numbers.replaceChildren()}
function observePicker(){new MutationObserver(()=>{if(document.body.classList.contains('route-pick-active'))enter();else leave()}).observe(document.body,{attributes:true,attributeFilter:['class']});if(document.body.classList.contains('route-pick-active'))enter();window.addEventListener('resize',schedule,{passive:true});document.addEventListener('atlas:route-selection-changed',schedule)}
function attach(node,handle,defaultSnap){if(!node||!handle||handle.dataset.atlasSnapAttached)return;handle.dataset.atlasSnapAttached='1';if(!node.dataset.atlasSnap)node.dataset.atlasSnap=defaultSnap;
let press=null;const snaps=['peek','half','full'],switchSnap=by=>{const index=Math.max(0,snaps.indexOf(node.dataset.atlasSnap)),next=snaps[Math.max(0,Math.min(2,index+by))];node.dataset.atlasSnap=next;handle.setAttribute('aria-valuenow',String(snaps.indexOf(next)+1))};
handle.setAttribute('role','slider');handle.setAttribute('aria-label','向上或向下拖动卡片');handle.setAttribute('aria-valuemin','1');handle.setAttribute('aria-valuemax','3');handle.setAttribute('aria-valuenow',String(snaps.indexOf(node.dataset.atlasSnap)+1));handle.tabIndex=0;
handle.addEventListener('pointerdown',e=>{if(e.target.closest?.('button,a,input,textarea,select'))return;press={y:e.clientY,id:e.pointerId};try{handle.setPointerCapture(e.pointerId)}catch(_){}});
handle.addEventListener('pointerup',e=>{if(!press)return;const dy=e.clientY-press.y;press=null;if(Math.abs(dy)>=26)switchSnap(dy<0?1:-1)});
handle.addEventListener('pointercancel',()=>{press=null});
handle.addEventListener('keydown',e=>{if(e.key==='ArrowUp'){e.preventDefault();switchSnap(1)}else if(e.key==='ArrowDown'){e.preventDefault();switchSnap(-1)}else if(e.key==='Escape'){e.preventDefault();if(node.id==='fpSearchSheet')node.querySelector('.fp-search-close')?.click();else node.querySelector('.fp-card-close')?.click()}})}
function addHandles(){const search=$('fpSearchSheet'),place=$('fpPlaceCard');if(search)attach(search,search.querySelector('.fp-search-grip'),'half');if(place){const head=place.querySelector('.fp-card-header');if(head){let grip=place.querySelector('.atlas-card-grip');if(!grip){grip=document.createElement('div');grip.className='atlas-card-grip';place.insertBefore(grip,head)}attach(place,grip,'peek')}}}
function viewport(){const v=window.visualViewport;if(!v)return;const refresh=()=>{const keyboard=Math.max(0,innerHeight-v.height-v.offsetTop);document.documentElement.style.setProperty('--atlas-safe-visual-height',Math.max(260,v.height)+'px');document.documentElement.style.setProperty('--atlas-keyboard-bottom',keyboard+'px');const search=$('fpSearchSheet');if(search&&!search.hidden&&keyboard>90)search.dataset.atlasSnap='full'};v.addEventListener('resize',refresh,{passive:true});v.addEventListener('scroll',refresh,{passive:true});window.addEventListener('orientationchange',refresh,{passive:true});refresh()}
function init(){observePicker();addHandles();new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;addHandles()})}).observe(document.body,{childList:true,subtree:true});viewport();window.AtlasPhase1={version:'20261103-v1',schedule,attach}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();