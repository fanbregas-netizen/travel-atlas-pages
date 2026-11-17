/* Footprint Map · paired Dock motion v2.
 * One interruption-safe motor; transform remains owned by the existing Dock layout.
 * Collection waits until its physical exit completes before returning either Dock.
 */
(()=>{'use strict';
const body=document.body;
const top=document.getElementById('fpTopSearch');
const bottom=document.getElementById('appDock');
if(!top||!bottom||window.__atlasCardDockMotion)return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const watchers=new Map();
const watched=['drawer','fpPlaceCard','destinationCard','memorySheet','atlasRoutesSheet','editor','fpMediaViewer','fpSearchSheet'];
const nodes={top,bottom};
const shifts={top:-70,bottom:82};
const motion={top:null,bottom:null};
const state={active:false,reason:'',top:'visible',bottom:'visible',serial:0};
let queued=false,initialized=false;
const set=(el,key,value)=>el.style.setProperty(key,value,'important');
const unset=(el,key)=>el.style.removeProperty(key);
const clear=el=>{for(const p of ['translate','opacity','visibility','pointer-events'])unset(el,p)};
function reason(){
 if(body.classList.contains('atlas-collection-exiting'))return 'collection-exit';
 if(document.getElementById('drawer')?.classList.contains('visible'))return 'collection';
 if(body.classList.contains('fp-place-open')||
   (document.getElementById('fpPlaceCard')&&!document.getElementById('fpPlaceCard').hidden))return 'place';
 if(body.classList.contains('destination-selected')||
   document.getElementById('destinationCard')?.classList.contains('visible'))return 'destination';
 if(body.classList.contains('memory-open'))return 'memory';
 if(document.getElementById('atlasRoutesSheet')?.classList.contains('open'))return 'saved-routes';
 if(body.classList.contains('route-pick-active'))return 'route-picking';
 if(document.getElementById('editor')?.open)return 'editor';
 if(body.classList.contains('fp-media-viewer-open')||
   (document.getElementById('fpMediaViewer')&&!document.getElementById('fpMediaViewer').hidden))return 'media';
 return '';
}
function nativeSearch(){
 return body.classList.contains('fp-search-open')||
   body.classList.contains('fp34-searching')||
   body.classList.contains('fp34-search-returning');
}
function stop(key){
 const a=motion[key];
 if(a){cancelAnimationFrame(a.frame);motion[key]=null}
 return a?.current||null;
}
function position(key,y,opacity){
 const el=nodes[key];
 set(el,'translate','0 '+y.toFixed(2)+'px');
 set(el,'opacity',Math.max(0,Math.min(1,opacity)).toFixed(3));
 set(el,'pointer-events','none');
 set(el,'visibility','visible');
}
function finish(key,hidden){
 stop(key);
 const el=nodes[key];
 if(hidden){
  position(key,shifts[key],0);
  set(el,'visibility','hidden');
  state[key]='hidden';
 }else{
  clear(el);
  state[key]='visible';
 }
}
function animate(key,hide){
 const el=nodes[key],old=stop(key);
 const start=old||{y:state[key]==='hidden'?shifts[key]:0,o:state[key]==='hidden'?0:1};
 const end={y:hide?shifts[key]:0,o:hide?0:1};
 if(reduced.matches){finish(key,hide);return}
 // Never cancel the previous animation back to its start. The new one
 // begins at its LAST painted position, also for repeated fast taps.
 const duration=hide?235:385;
 const began=performance.now();
 state[key]=hide?'hiding':'returning';
 position(key,start.y,start.o);
 const a={frame:0,current:{...start}};
 motion[key]=a;
 const tick=now=>{
  if(motion[key]!==a)return;
  const t=Math.min(1,(now-began)/duration);
  const p=hide?1-Math.pow(1-t,2.3):1-Math.pow(1-t,3.2);
  let y=start.y+(end.y-start.y)*p;
  if(!hide)y+=(key==='top'?4:-5)*Math.sin(Math.PI*t)*Math.pow(1-t,.45);
  const o=start.o+(end.o-start.o)*p;
  a.current={y,o};
  position(key,y,o);
  if(t>=1){finish(key,hide);return}
  a.frame=requestAnimationFrame(tick);
 };
 a.frame=requestAnimationFrame(tick);
}
function hideAtBoot(){
 for(const key of ['top','bottom'])finish(key,true);
}
function pauseForSearch(){
 for(const key of ['top','bottom']){stop(key);clear(nodes[key]);state[key]='native-search'}
}
function bind(){
 for(const id of watched){
  const el=document.getElementById(id);
  if(!el||watchers.has(el))continue;
  const observer=new MutationObserver(schedule);
  observer.observe(el,{attributes:true,attributeFilter:['class','hidden','open']});
  watchers.set(el,observer);
 }
}
function sync(){
 queued=false;bind();
 const why=reason(),active=Boolean(why);
 if(!initialized){
  initialized=true;state.active=active;state.reason=why;
  if(active)hideAtBoot();
  return;
 }
 if(nativeSearch()&&!active){
  state.active=false;state.reason='';pauseForSearch();return;
 }
 if(active===state.active){
  state.reason=why;
  if(!active&&(state.top==='native-search'||state.bottom==='native-search')){
   state.top=state.bottom='hidden';animate('top',false);animate('bottom',false);
  }
  return;
 }
 state.active=active;state.reason=why;state.serial++;
 animate('top',active);animate('bottom',active);
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(sync)}
const bodyObserver=new MutationObserver(schedule);
bodyObserver.observe(body,{attributes:true,attributeFilter:['class']});
const additions=new MutationObserver(bind);
additions.observe(body,{childList:true});
bind();sync();
window.__atlasCardDockMotion={
 version:'paired-v2',
 sync, getState:()=>({...state,topAnimation:motion.top?'running':'none',bottomAnimation:motion.bottom?'running':'none'}),
 destroy:()=>{bodyObserver.disconnect();additions.disconnect();for(const o of watchers.values())o.disconnect();
  for(const key of ['top','bottom']){stop(key);clear(nodes[key])}
  delete window.__atlasCardDockMotion;
 }
};
})();
