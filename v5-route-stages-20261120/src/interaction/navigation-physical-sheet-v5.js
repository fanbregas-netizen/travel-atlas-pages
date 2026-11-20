/* Footprint Map V5 navigation lifecycle.
 * ONE owner for open, close, backdrop, swipe, browser restore and external links.
 * Keep the accepted B-V3 physical spring and original navigation choices. */
(()=>{'use strict';
 if(window.FootprintNavigationSheet)return;
 const overlay=document.getElementById('navigationChooser');
 const panel=overlay?.querySelector('.nav-panel');
 const header=panel?.querySelector('.fp-nav-header');
 const grip=panel?.querySelector('.fp-nav-grip');
 const scroll=panel?.querySelector('.fp-nav-content');
 const exit=panel?.querySelector('#closeNavigationChooser');
 const make=window.TravelAtlasSheet?.createSheetController;
 const connect=window.TravelAtlasPhysicalSheet?.connect;
 if(!overlay||!panel||!header||!grip||!exit||!make||!connect)return;

 // The HTML starts closed on EVERY load, including WebKit restored pages.
 // No persisted UI lock is allowed to outlive a navigation session.
 overlay.classList.remove('visible');
 overlay.hidden=true;overlay.inert=true;overlay.setAttribute('aria-hidden','true');
 overlay.style.setProperty('pointer-events','none','important');
 panel.hidden=true;
 const controller=make(),physical=connect({sheet:panel,controller,header,grip,scroll});
 let phase='closed',serial=0,finishTimer=0,backdropDown=null;
 const cancelFinish=()=>{if(finishTimer){clearTimeout(finishTimer);finishTimer=0}};
 const unblock=()=>{
  overlay.style.removeProperty('pointer-events');
  panel.style.removeProperty('pointer-events');
  delete overlay.dataset.navExiting;
 };
 function finalize(token){
  if(token!==serial||phase==='open')return;
  cancelFinish();
  phase='closed';
  overlay.classList.remove('visible');
  overlay.hidden=true;overlay.inert=true;
  overlay.setAttribute('aria-hidden','true');
  overlay.style.setProperty('pointer-events','none','important');
  panel.hidden=true;panel.style.removeProperty('pointer-events');
  delete overlay.dataset.navExiting;
  backdropDown=null;
  document.dispatchEvent(new Event('footprint:navigation-closed'));
 }
 function closeNavigation(opts={}){
  const immediate=!!opts.immediate;
  if(phase==='closed'&&controller.getState().sheet==='closed'){
   if(!overlay.hidden)finalize(serial);
   return;
  }
  const token=++serial;
  phase='closing';overlay.dataset.navExiting='1';
  overlay.style.setProperty('pointer-events','none','important');
  panel.style.setProperty('pointer-events','none','important');
  overlay.inert=true;
  if(controller.getState().sheet!=='closed')controller.close();
  cancelFinish();
  if(immediate){finalize(token);return}
  // The physical motor has its own 840ms bound. Even a suspended Safari
  // requestAnimationFrame must NEVER leave a transparent intercepting layer.
  finishTimer=setTimeout(()=>finalize(token),870);
 }
 function openNavigation(){
  ++serial;cancelFinish();
  phase='open';backdropDown=null;
  overlay.hidden=false;overlay.inert=false;
  overlay.removeAttribute('aria-hidden');
  unblock();
  overlay.classList.add('visible');
  if(controller.getState().sheet==='closed')controller.open('navigation');
  else if(panel.hidden)panel.hidden=false;
 }
 // A gesture can close the physical controller without touching the × button.
 controller.subscribe(state=>{
  if(state.sheet==='closed'&&phase==='open')closeNavigation();
 });
 // Only external legacy class mutations are bridged. Our own state transitions
 // are explicitly phase-gated, so MutationObserver cannot reopen a closing card.
 const externalWatch=new MutationObserver(()=>{
  if(phase==='open'&&!overlay.classList.contains('visible'))closeNavigation();
  else if(phase==='closed'&&overlay.classList.contains('visible'))openNavigation();
 });
 externalWatch.observe(overlay,{attributes:true,attributeFilter:['class']});
 exit.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  closeNavigation();
 },true);
 overlay.addEventListener('pointerdown',e=>{
  if(e.target!==overlay)return;
  backdropDown={id:e.pointerId,x:e.clientX,y:e.clientY};
 });
 overlay.addEventListener('pointerup',e=>{
  const p=backdropDown;backdropDown=null;
  if(!p||p.id!==e.pointerId||e.target!==overlay)return;
  if(Math.hypot(e.clientX-p.x,e.clientY-p.y)<9)closeNavigation();
 });
 overlay.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();closeNavigation()}
 });
 // The external app can open while Safari remains in the background. Its
 // return must never restore a modal hit target over the shared map.
 overlay.querySelector('#navLinks')?.addEventListener('click',e=>{
  if(e.target.closest('a'))setTimeout(()=>closeNavigation({immediate:true}),80);
 });
 const restore=()=>closeNavigation({immediate:true});
 window.addEventListener('pagehide',restore);
 window.addEventListener('pageshow',restore);
 window.FootprintNavigationSheet=Object.freeze({
  open:openNavigation,close:closeNavigation,physical,
  get state(){return {phase,sheet:controller.getState().sheet,visible:!overlay.hidden,blocking:!overlay.inert&&overlay.style.pointerEvents!=='none'}},
  recover:restore
 });
})();