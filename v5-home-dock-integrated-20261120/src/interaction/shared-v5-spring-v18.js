/* Footprint Map V4.18 · shared approved C-V5 spring motor.
 * The ORIGINAL route/B05 spring recurrence is:
 *     velocity = (velocity + (target - value) * 0.105) * 0.75
 *     value += velocity
 * Reuse it for SEARCH HISTORY and the INNER POI artwork. Do not replace any
 * existing card controller or change geographic marker projection. */
(()=>{'use strict';
if(window.FootprintRubberSpring?.version==='18')return;
const frameMs=1000/60;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function step(value,target,velocity,deltaMs){
 const available=window.FootprintV5Spring?.step;
 if(typeof available==='function'){
  const out=available(value,target,velocity,deltaMs);
  if(Number.isFinite(out?.value)&&Number.isFinite(out?.velocity))return out;
 }
 let remaining=clamp((deltaMs||frameMs)/frameMs,.1,1.8);
 while(remaining>0){
  const size=Math.min(1,remaining);
  velocity=(velocity+(target-value)*.105*size)*Math.pow(.75,size);
  value+=velocity*size;remaining-=size;
 }
 return {value,velocity};
}
function animate({from=0,to=1,velocity=0,onFrame,onDone,epsilon=.0015,maxMs=850}){
 let value=from,frame=0,last=0,start=0,active=true;
 function stop(){if(!active)return;active=false;if(frame)cancelAnimationFrame(frame)}
 const tick=now=>{
  if(!active)return;
  if(!start)start=now;
  const out=step(value,to,velocity,last?now-last:frameMs);
  last=now;value=out.value;velocity=out.velocity;
  onFrame?.(value);
  if((Math.abs(value-to)<epsilon&&Math.abs(velocity)<epsilon)||now-start>maxMs){
   value=to;onFrame?.(value);stop();onDone?.();return;
  }
  frame=requestAnimationFrame(tick);
 };
 onFrame?.(value);frame=requestAnimationFrame(tick);
 return Object.freeze({cancel:stop,get value(){return value}});
}
window.FootprintRubberSpring=Object.freeze({version:'18',step,animate});
})();