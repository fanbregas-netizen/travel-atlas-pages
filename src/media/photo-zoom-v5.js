/* Footprint Map V5 · photo-only pinch, pan and double tap.
 * Runs alongside the accepted iPhone gallery spring. Never captures
 * unzoomed one-finger horizontal / downward gestures or video controls.
 */
(()=>{
 'use strict';
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const point=(a,b)=>({x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2});
 const dist=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
 let viewer=null,img=null,scale=1,panX=0,panY=0,pinch=null,pan=null,lastTap=null;
 const photo=()=>document.querySelector('#fpMediaViewer .fp-gallery-track > .fp-gallery-cell:nth-child(2) > img');
 function ensure(){
  const current=document.getElementById('fpMediaViewer');
  const active=photo();
  if(current!==viewer||active!==img){
   viewer=current;img=active;scale=1;panX=0;panY=0;pinch=null;pan=null;lastTap=null;
   if(viewer)viewer.dataset.photoZoom='1.00';
  }
  return !!(viewer&&img&&img.isConnected&&!viewer.dataset.gestureState?.includes('closing'));
 }
 function paint(z,x=0,y=0,animate=false){
  if(!ensure())return;
  const stage=viewer.querySelector('.fp-gallery-stage');if(!stage)return;
  scale=clamp(z,1,4);
  const maxX=Math.max(0,((img.offsetWidth||img.clientWidth)*scale-stage.clientWidth)/2);
  const maxY=Math.max(0,((img.offsetHeight||img.clientHeight)*scale-stage.clientHeight)/2);
  panX=scale<=1.005?0:clamp(x,-maxX,maxX);
  panY=scale<=1.005?0:clamp(y,-maxY,maxY);
  img.style.transition=animate?'transform 260ms cubic-bezier(.2,.83,.24,1)':'none';
  img.style.transform=scale<=1.005?'none':
   'translate3d('+panX+'px,'+panY+'px,0) scale('+scale+')';
  viewer.dataset.photoZoom=scale.toFixed(2);
 }
 function freezeEntrance(){
  if(!img)return;
  // Keep the same decoded image. Finishing an entrance is cheaper and less
  // prone to Safari double-compositing than cloning a second bitmap.
  if(img.getAnimations?.().length){
   for(const animation of img.getAnimations())try{animation.finish()}catch(_){}
   img.style.opacity='1';
  }
 }
 function anchored(z,x,y,animate=false){
  const old=scale,rect=img.getBoundingClientRect();
  const centerX=rect.left+rect.width/2-panX,centerY=rect.top+rect.height/2-panY;
  const ux=(x-centerX-panX)/old,uy=(y-centerY-panY)/old;
  paint(z,x-centerX-z*ux,y-centerY-z*uy,animate);
 }
 function inStage(e){return !!e.target?.closest?.('#fpMediaViewer .fp-gallery-stage')}
 document.addEventListener('touchstart',e=>{
  if(!inStage(e)||!ensure())return;
  if(e.touches.length===2){
   freezeEntrance();
   const p=point(e.touches[0],e.touches[1]),r=img.getBoundingClientRect();
   const cx=r.left+r.width/2-panX,cy=r.top+r.height/2-panY;
   pinch={distance:Math.max(1,dist(e.touches[0],e.touches[1])),scale,
    cx,cy,ux:(p.x-cx-panX)/scale,uy:(p.y-cy-panY)/scale};
   pan=null;lastTap=null;viewer.dataset.photoZoomGesture='pinch';
   // Let the accepted gallery's two-touch start clear its swipe state.
   return;
  }
  if(e.touches.length===1&&scale>1.005){
   pan={x:e.touches[0].clientX,y:e.touches[0].clientY,
    px:panX,py:panY,moved:false};
   viewer.dataset.photoZoomGesture='pan';
   e.stopPropagation();
  }
 },{capture:true,passive:true});
 document.addEventListener('touchmove',e=>{
  if(!ensure())return;
  if(pinch&&e.touches.length===2){
   if(e.cancelable)e.preventDefault();
   e.stopPropagation();
   const p=point(e.touches[0],e.touches[1]),z=clamp(
    pinch.scale*dist(e.touches[0],e.touches[1])/pinch.distance,1,4);
   paint(z,p.x-pinch.cx-z*pinch.ux,p.y-pinch.cy-z*pinch.uy);
  }else if(pan&&e.touches.length===1){
   if(e.cancelable)e.preventDefault();
   e.stopPropagation();
   const dx=e.touches[0].clientX-pan.x,dy=e.touches[0].clientY-pan.y;
   if(Math.hypot(dx,dy)>4)pan.moved=true;
   paint(scale,pan.px+dx,pan.py+dy);
  }
 },{capture:true,passive:false});
 document.addEventListener('touchend',e=>{
  if(!ensure())return;
  if(pinch){
   if(e.touches.length<2){
    pinch=null;viewer.dataset.photoZoomGesture='rest';
    if(scale<1.04)paint(1,0,0,true);
   }
   return;
  }
  if(!inStage(e)||e.changedTouches.length!==1)return;
  const t=e.changedTouches[0],moved=pan?.moved;
  pan=null;viewer.dataset.photoZoomGesture='rest';
  if(moved){lastTap=null;return}
  const now=performance.now();
  if(lastTap&&now-lastTap.at<330&&Math.hypot(t.clientX-lastTap.x,t.clientY-lastTap.y)<36){
   freezeEntrance();
   if(scale>1.005)paint(1,0,0,true);
   else anchored(2.35,t.clientX,t.clientY,true);
   lastTap=null;if(e.cancelable)e.preventDefault();
  }else lastTap={at:now,x:t.clientX,y:t.clientY};
 },{capture:true,passive:false});
 document.addEventListener('touchcancel',()=>{
  pinch=null;pan=null;if(viewer)viewer.dataset.photoZoomGesture='rest';
 },{capture:true,passive:true});
 // Keyboard carousel moves must not carry a previous photo's zoom pose.
 document.addEventListener('keydown',e=>{
  if(!ensure())return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){paint(1,0,0);pinch=null;pan=null}
 },{capture:true});
 window.__fpPhotoZoomV5={getState:()=>({
  active:!!(viewer&&img?.isConnected),zoom:scale,panX,panY,
  gesture:pinch?'pinch':pan?'pan':'rest'
 })};
})();
