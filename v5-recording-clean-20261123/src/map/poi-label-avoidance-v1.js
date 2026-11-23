/* Footprint V5: bounded screen-space placements. Native vector labels win.
 * Pure policy; doesn't move camera, mutate geographic coordinates, or access storage.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FootprintPOILabelAvoidance=api;
})(typeof window!=='undefined'?window:this,()=>{'use strict';
 const offsets=Object.freeze([
  Object.freeze([0,0]),Object.freeze([-30,-25]),Object.freeze([30,-25]),
  Object.freeze([-30,25]),Object.freeze([30,25]),
  Object.freeze([0,-40]),Object.freeze([0,40])
 ]);
 const finite=v=>Number.isFinite(Number(v));
 function choose(point,permitted,previous){
  if(!point||!finite(point.x)||!finite(point.y)||typeof permitted!=='function')return null;
  const order=previous&&finite(previous.dx)&&finite(previous.dy)
   ?[[Number(previous.dx),Number(previous.dy)],...offsets]:offsets;
  const tested=new Set();
  for(const [dx,dy] of order){
   const key=dx+','+dy;if(tested.has(key))continue;tested.add(key);
   // Keep artwork close to the actual geographic anchor (never move coordinates).
   if(Math.hypot(dx,dy)>42)continue;
   const candidate={x:+point.x+dx,y:+point.y+dy,dx,dy};
   if(permitted(candidate))return candidate
  }
  return null
 }
 function boundsOverlap(a,b,min=49){
  return !!a&&!!b&&Math.abs(a.x-b.x)<min&&Math.abs(a.y-b.y)<min
 }
 return Object.freeze({choose,boundsOverlap,offsets});
});
