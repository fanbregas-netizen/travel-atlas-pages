/* Footprint Map V4 · Stage 1.34.7: independent, pure geometry for one real map bookmark.
 * It never creates a marker, never pans a map and never accesses user data.
 * The map focus corridor and the four shapes share this exact measurement.
 */
(function(global){
'use strict';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const BASE={
 tl:{x:-150,y:-116,w:124,h:86, side:'bottom', attach:.71, tilt:1},
 tr:{x:18,y:-172,w:167,h:142, side:'bottom', attach:.25, tilt:-1},
 bl:{x:-155,y:31,w:147,h:111,side:'top',attach:.71,tilt:1},
 br:{x:14,y:31,w:147,h:111,side:'top',attach:.28,tilt:-1}
};
function measure(width,height,dockTop,viewportTop=0){
 const W=Math.max(1,Number(width)||1),H=Math.max(1,Number(height)||1);
 const top=Math.max(74,viewportTop+22),bottom=Math.min(H-22,Number.isFinite(dockTop)?dockTop-19:H-106);
 const safe={left:17,right:W-17,top,bottom};
 const availableH=bottom-top;
 const spaceWidth=340, spaceHeight=314;
 // Scale every shape UNIFORMLY; never change the original hierarchy or tail geometry.
 const scale=Math.min(1.02,(W-34)/spaceWidth,(availableH-16)/spaceHeight);
 const fullFourPossible=W>=358&&availableH>=335&&scale>=.82;
 const s=Math.max(.1,scale);
 const corridor={left:safe.left+155*s,right:safe.right-185*s,top:safe.top+172*s,bottom:safe.bottom-142*s};
 return{W,H,safe,scale:s,corridor,fullFourPossible:fullFourPossible&&corridor.left<=corridor.right+.1&&corridor.top<=corridor.bottom+.1,
  left:corridor.left,right:corridor.right,top:corridor.top,bottom:corridor.bottom};
}
function layout(ax,ay,g){
 const out={};
 for(const [key,r] of Object.entries(BASE))out[key]={key,x:ax+r.x*g.scale,y:ay+r.y*g.scale,w:r.w*g.scale,h:r.h*g.scale,
  side:r.side,attach:r.attach,tilt:r.tilt};
 return out;
}
function fits(rects,g){
 return Object.values(rects).every(r=>r.x>=g.safe.left-.3&&r.y>=g.safe.top-.3&&r.x+r.w<=g.safe.right+.3&&r.y+r.h<=g.safe.bottom+.3);
}
function shape(r,g){
 const s=g.scale,R=12*s,shoulder=8*s,reach=18*s,tilt=11*s*r.tilt;
 const W=r.w,H=r.h;
 const anchor=clamp(W*r.attach,R+shoulder+6*s,W-R-shoulder-6*s);
 const f=v=>(Math.round(v*100)/100).toString();
 const p=(x,y)=>`${f(x)} ${f(y)}`;
 if(r.side==='bottom'){
  // Every top-row SVG has the same bottom-edge pointer with an inset shoulder.
  return `M ${p(R,0)} H ${f(W-R)} Q ${p(W,0)} ${p(W,R)} V ${f(H-R)} Q ${p(W,H)} ${p(W-R,H)} H ${f(anchor+shoulder)} L ${p(anchor+tilt,H+reach)} L ${p(anchor-shoulder,H)} H ${f(R)} Q ${p(0,H)} ${p(0,H-R)} V ${f(R)} Q ${p(0,0)} ${p(R,0)} Z`;
 }
 // Every bottom-row SVG has the same top-edge pointer with a matching shoulder.
 return `M ${p(R,0)} H ${f(anchor-shoulder)} L ${p(anchor+tilt,-reach)} L ${p(anchor+shoulder,0)} H ${f(W-R)} Q ${p(W,0)} ${p(W,R)} V ${f(H-R)} Q ${p(W,H)} ${p(W-R,H)} H ${f(R)} Q ${p(0,H)} ${p(0,H-R)} V ${f(R)} Q ${p(0,0)} ${p(R,0)} Z`;
}
function shortestDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
const API=Object.freeze({measure,layout,fits,shape,clamp,shortestDistance,BASE});
global.AtlasConstellationCore=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window==='undefined'?globalThis:window);
