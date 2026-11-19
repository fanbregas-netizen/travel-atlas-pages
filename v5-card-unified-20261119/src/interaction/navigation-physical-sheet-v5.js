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
 const finish=()=>{
  if(finalTimer){clearTimeout(finalTimer);finalTimer=0}
  if(controller.getState().sheet!=='closed')return;
  closing=false;panel.hidden=true;overlay.classList.remove('visible');
 };
 controller.subscribe(state=>{
  if(state.sheet!=='closed'){closing=false;if(finalTimer)clearTimeout(finalTimer);finalTimer=0;return}
  closing=true;
  // B V3 motor hides the sheet only after spring settles; do not cause a
  // second opacity animation or return Docks before that physical exit.
  finalTimer=setTimeout(finish,1150);
 });
 const panelWatcher=new MutationObserver(()=>{
  if(panel.hidden&&controller.getState().sheet==='closed')finish()
 });
 panelWatcher.observe(panel,{attributes:true,attributeFilter:['hidden']});
 function sync(){
  const open=overlay.classList.contains('visible');
  if(open){
   if(!closing&&controller.getState().sheet==='closed')controller.open('navigation');
  }else if(controller.getState().sheet!=='closed'){
   // External route reset or map state change may dismiss immediately.
   controller.close();
  }
 }
 const visibleWatch=new MutationObserver(sync);
 visibleWatch.observe(overlay,{attributes:true,attributeFilter:['class']});
 // Original close button's bubble handler removes .visible immediately.
 // Own that one event in capture and let the approved sheet physically exit.
 close.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  controller.close();
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
  if(delta<9)controller.close();
  delete overlay.dataset.navBackdropPointer;
 });
 sync();
 window.FootprintNavigationSheet=Object.freeze({
  get state(){return controller.getState()},
  close:()=>controller.close(),
  open:()=>{overlay.classList.add('visible');if(controller.getState().sheet==='closed')controller.open('navigation')},
  physical
 });
})();
