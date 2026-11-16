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
 for(const selector of ['.destination-title','.destination-category']){
  el.querySelector(selector)?.style.removeProperty('opacity');
 }
 el.dataset.fpElasticState='idle';
}
function revealCard(el,{renew=false,commit}={}){
 if(!el)return;
 const motor=window.FootprintRubberSpring;
 const previous=motion.get(el);
 if(previous){previous.cancel();motion.delete(el)}
 if(reduced()||typeof motor?.animate!=='function'){
  commit?.();stop(el);return;
 }
 el.dataset.fpElasticState=renew?'switching':'entering';
 el.dataset.fpElasticOvershoot='0';
 el.style.willChange='translate,scale';
 let committed=false,m=null;
 const apply=value=>{
  if(!el.isConnected){m?.cancel();return}
  const t=clamp(value,-.12,1.18),p=clamp(t,0,1);
  if(renew){
   // Whole sheet lowers while its previous title fades. Only at the low
   // point do we commit the NEXT location. No card removal, new popover,
   // jumping map projection or direct in-place text swap.
   const dip=Math.sin(Math.PI*p);
   if(p>=.5&&!committed){committed=true;commit?.()}
   const alpha=Math.max(0,1-dip*1.12);
   for(const selector of ['.destination-title','.destination-category']){
    const node=el.querySelector(selector);
    if(node)node.style.setProperty('opacity',alpha.toFixed(3));
   }
   el.style.setProperty('translate','0 '+(dip*43).toFixed(2)+'px','important');
   el.style.setProperty('scale','1 '+(1-.055*dip).toFixed(5),'important');
  }else{
   if(!committed){committed=true;commit?.()}
   const overshoot=1-t;
   if(overshoot<-.008)el.dataset.fpElasticOvershoot='1';
   const dy=overshoot*84;
   el.style.setProperty('translate','0 '+dy.toFixed(2)+'px','important');
   el.style.setProperty('scale','1 '+(1-.085*overshoot).toFixed(5),'important');
  }
 };
 m=motor.animate({from:0,to:1,epsilon:.0015,maxMs:790,onFrame:apply,
  onDone:()=>{if(motion.get(el)!==m)return;
   if(!committed)commit?.();
   stop(el);
  }
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