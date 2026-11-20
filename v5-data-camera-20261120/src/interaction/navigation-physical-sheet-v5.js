/* V5: real navigation chooser reuses the APPROVED V3 physical sheet motor.
 * One place record, one map; no duplicate gesture physics or route map.
 * Native navigation links and existing choice UI remain the actual actions. */
(()=>{'use strict';
 if(window.FootprintNavigationSheet)return;
 const overlay=document.getElementById('navigationChooser');
 const panel=overlay?.querySelector('.nav-panel');
 const header=panel?.querySelector('.fp-nav-header');
 const grip=panel?.querySelector('.fp-nav-grip');
 const scroll=panel?.querySelector('.fp-nav-content');
 const close=panel?.querySelector('#closeNavigationChooser');
 const make=window.TravelAtlasSheet?.createSheetController;
 const connect=window.TravelAtlasPhysicalSheet?.connect;
 if(!overlay||!panel||!header||!grip||!close||!make||!connect)return;
 panel.hidden=!overlay.classList.contains('visible');
 const controller=make();
 const physical=connect({sheet:panel,controller,header,grip,scroll});
 let finalTimer=0,closing=false;
 const unblock=()=>{overlay.style.removeProperty('pointer-events');panel.style.removeProperty('pointer-events');delete overlay.dataset.navClosing};
 const disableExitedHitTargets=()=>{
  // Critical: an invisible modal backdrop must never retain iPhone touches
  // while its V3 physical sheet continues the exit spring.
  closing=true;overlay.dataset.navClosing='1';
  overlay.style.setProperty('pointer-events','none','important');
  panel.style.setProperty('pointer-events','none','important');
 };
 const finish=()=>{
  if(finalTimer){clearTimeout(finalTimer);finalTimer=0}
  if(controller.getState().sheet!=='closed')return;
  closing=false;panel.hidden=true;overlay.classList.remove('visible');unblock();
 };
 const requestClose=()=>{
  if(controller.getState().sheet==='closed'){finish();return}
  disableExitedHitTargets();controller.close();
 };
 controller.subscribe(state=>{
  if(state.sheet!=='closed'){
   if(!closing)unblock();
   if(finalTimer)clearTimeout(finalTimer);finalTimer=0;return;
  }
  disableExitedHitTargets();
  // The spring may finish sooner. This timer is only the dead-overlay fail-safe.
  if(finalTimer)clearTimeout(finalTimer);
  finalTimer=setTimeout(finish,820);
 });
 const panelWatcher=new MutationObserver(()=>{
  if(panel.hidden&&controller.getState().sheet==='closed')finish()
 });
 panelWatcher.observe(panel,{attributes:true,attributeFilter:['hidden']});
 function sync(){
  const open=overlay.classList.contains('visible');
  if(open){
   if(controller.getState().sheet==='closed'&&!closing){unblock();controller.open('navigation')}
  }else if(controller.getState().sheet!=='closed'){
   requestClose();
  }
 }
 const visibleWatch=new MutationObserver(sync);
 visibleWatch.observe(overlay,{attributes:true,attributeFilter:['class']});
 // Original close button's bubble handler removes .visible immediately.
 // Own that one event in capture and let the approved sheet physically exit.
 close.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  requestClose();
 },true);
 overlay.addEventListener('pointerdown',e=>{
  if(e.target!==overlay)return;
  overlay.dataset.navBackdropPointer=String(e.pointerId);
  overlay.dataset.navBackdropX=String(e.clientX);
  overlay.dataset.navBackdropY=String(e.clientY);
 });
 overlay.addEventListener('pointerup',e=>{
  if(e.target!==overlay||String(e.pointerId)!==overlay.dataset.navBackdropPointer)return;
  const delta=Math.hypot(e.clientX-Number(overlay.dataset.navBackdropX),e.clientY-Number(overlay.dataset.navBackdropY));
  if(delta<9)requestClose();
  delete overlay.dataset.navBackdropPointer;
 });
 sync();
 window.FootprintNavigationSheet=Object.freeze({
  get state(){return controller.getState()},
  close:requestClose,
  open:()=>{
   if(finalTimer){clearTimeout(finalTimer);finalTimer=0}
   closing=false;unblock();overlay.classList.add('visible');
   if(controller.getState().sheet==='closed')controller.open('navigation');
  },
  physical
 });
})();
