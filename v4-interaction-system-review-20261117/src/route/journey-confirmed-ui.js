/* Footprint Map V4 · single-owner minimalist journey presentation.
 * Uses existing #chosen/#places/IndexedDB-backed journey.js. Never creates
 * a second map, a second route repository, or a second sheet controller.
 */
(()=>{'use strict';
 const body=document.body;
 const root=document.querySelector('.builder');
 const live=window.__atlasJourneyRoute;
 if(!root||!live)return;
 const sections=[...root.children].filter(e=>e.matches('section.block'));
 if(sections.length<3)return;
 sections[0].dataset.routeStep='settings';
 sections[1].dataset.routeStep='places';
 sections[2].dataset.routeStep='order';
 body.classList.add('journey-confirmed');
 const media=matchMedia('(max-width:700px)');
 let step='order';
 function setStep(next){
  if(!['order','places','settings'].includes(next))return;
  step=next;body.dataset.journeyStep=step;
  const scroller=root;scroller.scrollTo?.({top:0,behavior:'instant'});
  update();
 }
 const toolbar=root.querySelector('.journey-sheet-toolbar');
 if(toolbar){
  const nav=document.createElement('div');nav.className='journey-step-nav';
  const b=(label,value,cls='')=>{const n=document.createElement('button');n.type='button';n.textContent=label;n.className=cls;n.dataset.routeNav=value;return n};
  nav.append(b('‹','order'),b('＋','places'),b('设置','settings'));
  toolbar.insertBefore(nav,toolbar.querySelector('.journey-sheet-minimize'));
  nav.addEventListener('click',e=>{const target=e.target.closest('[data-route-nav]');if(target)setStep(target.dataset.routeNav)});
  toolbar.querySelector('.journey-sheet-summary')?.addEventListener('click',()=>{
   if(media.matches)setStep('order');
  });
 }
 const orderBlock=sections[2];
 // Keep the real original route builder and full-size sheet; no extra Dock.
 function update(){
  const state=live.getState();
  const dateA=document.getElementById('startDate')?.value||'';
  const dateB=document.getElementById('endDate')?.value||'';
  const d1=new Date(dateA+'T12:00:00'),d2=new Date(dateB+'T12:00:00');
  const count=Number.isFinite(d1.getTime())&&Number.isFinite(d2.getTime())?
    Math.max(1,Math.min(60,Math.round((d2-d1)/86400000)+1)):1;
  const n=state.selected.length,detail=n+' 站 · '+count+' 天';
  const title=toolbar?.querySelector('.journey-sheet-summary strong');
  if(title)title.textContent=step==='places'?'添加地点':step==='settings'?'行程设置':'调整路线';
  const desc=toolbar?.querySelector('.journey-sheet-summary small');
  if(desc)desc.textContent=detail;
  for(const btn of toolbar?.querySelectorAll('[data-route-nav]')||[]){
   btn.hidden=step===btn.dataset.routeNav||(step==='order'&&btn.dataset.routeNav==='order');
  }
  const collapsed=document.getElementById('journeySheetOpen');
  if(collapsed)collapsed.textContent=detail+' · 调整';
 }
 // The existing builder's renderChosen() emits after its real DOM update.
 document.addEventListener('atlas:journey-changed',update);
 for(const id of ['startDate','endDate'])document.getElementById(id)?.addEventListener('change',update);
 window.addEventListener('pageshow',update);
 body.dataset.journeyStep=step;
 update();
 window.__atlasJourneyVisual={setStep,get step(){return step},getSource:()=>orderBlock};
})();
