/* Footprint Map V4 .19
 * One C-V5 rubber-band motor for the REAL POI -> card handoff.
 * No duplicate map/canvas, no second card controller, no invented artwork.
 * CSS individual translate/scale are independent of the map-projection
 * transform and of the accepted physical-sheet height controller. */
(()=>{'use strict';
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const motion=new WeakMap();
function stop(el){
 const prev=motion.get(el);
 prev?.cancel?.();
 motion.delete(el);
 if(!el)return;
 el.style.removeProperty('translate');
 el.style.removeProperty('scale');
 el.style.removeProperty('will-change');
 el.dataset.fpElasticState='idle';
}
function revealCard(el,{renew=false}={}){
 if(!el)return;
 const motor=window.FootprintRubberSpring;
 if(!motor?.animate||reduced()){stop(el);return}
 const previous=motion.get(el);
 if(previous){previous.cancel();motion.delete(el)}
 // Already visible cards have a smaller, continuous response on destination
 // changes; fresh selections enter with a clear physical stretch/rebound.
 const from=renew?.42:0;
 el.dataset.fpElasticState='entering';
 el.style.willChange='translate,scale';
 let m=null;
 const apply=p=>{
  if(!el.isConnected){m?.cancel();return}
  const t=clamp(p,-.10,1.2), bounded=clamp(t,0,1);
  const stretch=Math.sin(Math.PI*bounded);
  const displacement=(1-t)*(renew?22:38);
  const sy=1-(1-t)*(renew?.075:.13)-stretch*.018;
  const sx=1+stretch*.012;
  el.style.setProperty('translate','0 '+displacement.toFixed(2)+'px','important');
  el.style.setProperty('scale',sx.toFixed(5)+' '+sy.toFixed(5),'important');
 };
 m=motor.animate({from,to:1,epsilon:.001,maxMs:730,onFrame:apply,
  onDone:()=>{if(motion.get(el)!==m)return;stop(el)}
 });
 motion.set(el,m);
}
function acknowledgePoi(node){
 if(!node||reduced())return;
 const motor=window.FootprintRubberSpring;
 if(!motor?.animate)return;
 let p=1;
 node.dataset.fpElasticPoi='active';
 node.style.willChange='scale';
 const burst=motor.animate({from:1,to:1.14,epsilon:.006,maxMs:260,
  onFrame:x=>{p=x;node.style.setProperty('scale',x.toFixed(5),'important')},
  onDone:()=>{
   motor.animate({from:p,to:1,epsilon:.001,maxMs:570,
    onFrame:x=>node.style.setProperty('scale',x.toFixed(5),'important'),
    onDone:()=>{node.style.removeProperty('scale');node.style.removeProperty('will-change');node.dataset.fpElasticPoi='rest'}
   });
  }
 });
}
window.FootprintElasticHandoff=Object.freeze({version:'19',revealCard,acknowledgePoi,stop});
})();