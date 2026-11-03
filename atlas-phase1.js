/* V4 stage review: native-feeling, shared three-stop sheets. No synthetic map markers. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const sheetConfigs={
 fpSearchSheet:{stops:[.32,.59,.91],initial:1,head:'.fp-search-grip',close:'.fp-search-close'},
 fpPlaceCard:{stops:[.49,.70,.91],initial:0,head:'.atlas-card-grip',close:'.fp-card-close'}
};
let queued=false;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function visibleHeight(){return Math.max(290,window.visualViewport?.height||window.innerHeight)}
function snap(node,at,config,gesture=false){at=clamp(at,0,2);node.dataset.atlasSnap=['peek','half','full'][at];node.style.removeProperty('height');node.style.removeProperty('transition');delete node.dataset.dragging;node.dataset.snapIndex=String(at);
  const head=node.querySelector(config.head);head?.setAttribute('aria-valuenow',String(at+1));
  if(gesture){try{if(navigator.vibrate)navigator.vibrate(4)}catch(_){}}
}
function attach(node,handle,cfg){if(!handle||handle.dataset.atlasMotionAttached)return;
 handle.dataset.atlasMotionAttached='1';handle.setAttribute('role','slider');handle.tabIndex=0;
 handle.setAttribute('aria-label','向上展开或向下收起卡片');handle.setAttribute('aria-valuemin','1');handle.setAttribute('aria-valuemax','3');
 if(!node.dataset.atlasSnap)snap(node,cfg.initial,cfg);
 const size=i=>Math.min(visibleHeight()-18,Math.round(visibleHeight()*cfg.stops[i]));
 let touch=null,frame=0;
 handle.addEventListener('pointerdown',e=>{if(e.target.closest?.('button,a,input,textarea,select'))return;
   const rect=node.getBoundingClientRect(),cur=['peek','half','full'].indexOf(node.dataset.atlasSnap);touch={id:e.pointerId,y:e.clientY,t:performance.now(),height:rect.height,index:Math.max(0,cur),lastY:e.clientY,lastT:performance.now()};
   node.dataset.dragging='1';node.style.transition='none';try{handle.setPointerCapture(e.pointerId)}catch(_){}},{passive:true});
 handle.addEventListener('pointermove',e=>{if(!touch||touch.id!==e.pointerId)return;
   const y=e.clientY;touch.lastY=y;touch.lastT=performance.now();
   cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(!touch)return;const h=clamp(touch.height-(touch.lastY-touch.y),size(0)-55,size(2)+24);node.style.height=h+'px'});},{passive:true});
 const finish=e=>{if(!touch||touch.id!==e.pointerId)return;cancelAnimationFrame(frame);
   const dt=Math.max(16,performance.now()-touch.t),distance=e.clientY-touch.y,velocity=distance/dt,initial=touch.index;touch=null;
   let target=initial;
   if(Math.abs(distance)>24){if(Math.abs(velocity)>.42||Math.abs(distance)>64)target=clamp(initial+(distance<0?1:-1),0,2);
   else{const h=node.getBoundingClientRect().height;target=[0,1,2].reduce((best,i)=>Math.abs(h-size(i))<Math.abs(h-size(best))?i:best,initial);}}
   if(initial===0&&distance>96&&velocity>.36){node.querySelector(cfg.close)?.click();return}
   snap(node,target,cfg,true);
 };
 handle.addEventListener('pointerup',finish);
 handle.addEventListener('pointercancel',e=>{if(touch&&e.pointerId===touch.id){touch=null;cancelAnimationFrame(frame);snap(node,Number(node.dataset.snapIndex||cfg.initial),cfg)}});
 handle.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();snap(node,Number(node.dataset.snapIndex||cfg.initial)+(e.key==='ArrowUp'?1:-1),cfg,true)}else if(e.key==='Escape'){e.preventDefault();node.querySelector(cfg.close)?.click()}});
}
function resetOnHide(node,config){if(node.dataset.atlasResetObserved)return;node.dataset.atlasResetObserved='1';
 new MutationObserver(()=>{if(node.hidden)snap(node,config.initial,config)}).observe(node,{attributes:true,attributeFilter:['hidden']});
}
function ensureHandles(){for(const [id,cfg] of Object.entries(sheetConfigs)){const node=$(id);if(!node)continue;
  if(id==='fpPlaceCard'&&!node.querySelector('.atlas-card-grip')&&node.querySelector('.fp-card-header')){const grip=document.createElement('div');grip.className='atlas-card-grip';node.insertBefore(grip,node.querySelector('.fp-card-header'))}
  const grip=node.querySelector(cfg.head);if(grip)attach(node,grip,cfg);
  resetOnHide(node,cfg);
}}
function setupViewport(){const v=window.visualViewport;
 const refresh=()=>{if(!v)return;const keyboard=Math.max(0,window.innerHeight-v.height-v.offsetTop);
 document.documentElement.style.setProperty('--atlas-safe-visual-height',Math.max(290,v.height)+'px');
 document.documentElement.style.setProperty('--atlas-keyboard-bottom',keyboard+'px');
 const search=$('fpSearchSheet');if(search&&!search.hidden&&keyboard>120&&search.dataset.dragging!=='1')snap(search,2,sheetConfigs.fpSearchSheet);
 };
 v?.addEventListener('resize',refresh,{passive:true});v?.addEventListener('scroll',refresh,{passive:true});
 window.addEventListener('orientationchange',refresh,{passive:true});refresh();
}
function init(){ensureHandles();new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;ensureHandles()})}).observe(document.body,{childList:true,subtree:true});
 setupViewport();
 window.AtlasPhase1={version:'native-sheets-no-extra-markers-20261103',attach,snap};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();