/* Footprint Map V4.18 · the ORIGINAL anchored search history panel.
 * Its appearance now follows the approved C-V5 physical sheet motor, not a
 * CSS keyframe, independently created popup, or second search input. */
(()=>{'use strict';
if(window.__atlasSearchHistorySpring18)return;
window.__atlasSearchHistorySpring18=true;
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const motor=()=>window.FootprintRubberSpring;
let sheet=null,body=null,observer=null,active=null,lastVisible=false,lastHasItems=false,pending=null;
const meaningful=()=>!!body?.querySelector('.fp-search-row,.fp-search-group,.fp-quick,.fp-search-empty,.fp-search-notice');
function clear(){
 if(active){active.cancel();active=null}
 if(sheet){sheet.style.removeProperty('scale');sheet.style.removeProperty('translate');sheet.style.removeProperty('opacity')}
}
function reveal(small=false){
 if(!sheet||sheet.hidden||!meaningful()||!document.body.classList.contains('fp-search-open'))return;
 clear();
 if(reduced.matches||!motor()?.animate)return;
 const from=small?.978:.90;
 active=motor().animate({
  from,to:1,epsilon:.0015,maxMs:700,
  onFrame:value=>{
   if(!sheet||sheet.hidden){clear();return}
   const normalized=Math.max(0,Math.min(1,(value-from)/(1-from)));
   sheet.style.setProperty('scale','1 '+value.toFixed(5));
   sheet.style.setProperty('translate','0 '+(-10*(1-normalized)).toFixed(2)+'px');
   sheet.style.setProperty('opacity',String(.45+.55*normalized));
  },
  onDone:()=>{active=null;clear()}
 });
}
function inspect(){
 if(!sheet)return;
 const visible=!sheet.hidden&&document.body.classList.contains('fp-search-open');
 const has=meaningful();
 if(!visible){lastVisible=false;lastHasItems=false;clear();return}
 if(has&&(!lastVisible||!lastHasItems))reveal(false);
 lastVisible=visible;lastHasItems=has;
}
function mount(){
 if(sheet)return;
 const s=document.getElementById('fpSearchSheet');
 if(!s)return;
 sheet=s;body=s.querySelector('.fp-search-body');
 if(!body)return;
 observer=new MutationObserver(()=>{
  if(pending!==null)cancelAnimationFrame(pending);
  pending=requestAnimationFrame(()=>{pending=null;inspect()});
 });
 observer.observe(sheet,{attributes:true,attributeFilter:['hidden']});
 observer.observe(body,{subtree:true,childList:true});
 // The search-open body class toggles before the keyboard reports its final
 // viewport. Wait for the real state; the anchored field itself never moves.
 new MutationObserver(inspect).observe(document.body,{attributes:true,attributeFilter:['class']});
 inspect();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
if(!sheet){
 const ready=new MutationObserver(()=>{if(document.getElementById('fpSearchSheet')){ready.disconnect();mount()}});
 ready.observe(document.documentElement,{childList:true,subtree:true});
}
})();