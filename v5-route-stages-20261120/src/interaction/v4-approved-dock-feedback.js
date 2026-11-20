/* Restored approved Interaction B Dock touch: only the ORIGINAL toolbar moves.
 * Restrained by final 2026-11-13 user feedback, no triple bounce/glider. */
(()=>{'use strict';
const dock=document.getElementById('appDock');
if(!dock||dock.dataset.approvedDockMotion)return;
dock.dataset.approvedDockMotion='one-surface';
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
let running=null;
function feedback(){
 if(reduced.matches)return;
 try{running?.cancel()}catch(_){}
 running=dock.animate([
  {scale:'1 1',offset:0},{scale:'1.018 .991',offset:.28},
  {scale:'.997 1.002',offset:.69},{scale:'1 1',offset:1}
 ],{duration:325,easing:'cubic-bezier(.22,.8,.36,1)'});
 running.finished.catch(()=>{}).then(()=>running=null);
}
dock.addEventListener('pointerdown',e=>{if(e.target.closest('.dock-btn'))feedback()},{capture:true,passive:true});
dock.addEventListener('click',e=>{if(e.detail===0&&e.target.closest('.dock-btn'))feedback()},true);
window.addEventListener('pagehide',()=>{try{running?.cancel()}catch(_){}},{once:true});
})();
