/* C V5 route planning sheet, wired to real journey.html.
 * It reuses the existing #chosen, #places and IndexedDB-backed planner;
 * no demo stops, fake map, or second route data store.
 */
(()=>{'use strict';
 const sheet=document.querySelector('.builder');
 const map=document.querySelector('.atlas-view');
 const isPhone=matchMedia('(max-width:700px)');
 if(!sheet||!map||!window.TravelAtlasSheet||!window.TravelAtlasPhysicalSheet)return;
 let controller=null,physical=null;
 const bar=document.createElement('div');bar.className='journey-sheet-toolbar';
 bar.innerHTML='<button class="journey-sheet-grip" data-atlas-grip type="button" aria-label="展开或收起真实路线规划卡片"><span></span></button><div class="journey-sheet-summary"><strong>路线规划</strong><small>日期 · 收藏地点 · 站点顺序</small></div><button class="journey-sheet-minimize" type="button" aria-label="收起路线规划卡片">⌄</button>';
 sheet.prepend(bar);
 const openButton=document.createElement('button');openButton.id='journeySheetOpen';openButton.type='button';openButton.hidden=true;
 openButton.textContent='展开路线规划 ↑';document.body.append(openButton);
 const grip=bar.querySelector('.journey-sheet-grip');
 const close=bar.querySelector('.journey-sheet-minimize');
 function activate(){
  if(physical||!isPhone.matches)return;
  sheet.hidden=false;controller=TravelAtlasSheet.createSheetController();
  physical=TravelAtlasPhysicalSheet.connect({sheet,controller,header:bar,grip});
  controller.subscribe(next=>{openButton.hidden=next.sheet!=='closed'});
  controller.open('journey-real-planner');controller.snapTo('half');
  document.body.classList.add('journey-live-sheet');
 }
 function deactivate(){
  physical?.destroy();physical=null;controller=null;
  sheet.style.removeProperty('height');sheet.style.removeProperty('transform');sheet.style.removeProperty('opacity');
  sheet.hidden=false;openButton.hidden=true;
  document.body.classList.remove('journey-live-sheet');
 }
 close.addEventListener('click',()=>controller?.close());
 openButton.addEventListener('click',()=>{if(!physical)activate();else controller?.open('journey-real-planner')});
 function onResize(){if(isPhone.matches)activate();else if(physical)deactivate()}
 isPhone.addEventListener?.('change',onResize);
 onResize();
 window.__atlasJourneyRealV5={get state(){return controller?.getState()||null},snapTo:level=>controller?.snapTo(level),open:()=>controller?.open('journey-real-planner'),close:()=>controller?.close(),get physical(){return physical?.state()||null}};
})();
