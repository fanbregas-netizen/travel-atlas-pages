/* Footprint Map V4 · iPhone route planner navigation on the real sheet.
 * One sheet owner, real IndexedDB route data, no preview-only fake map.
 */
(()=>{'use strict';
 const body=document.body,root=document.querySelector('.builder'),live=window.__atlasJourneyRoute;
 if(!root||!live)return;
 const sections=[...root.children].filter(e=>e.matches('section.block'));
 if(sections.length!==3)return;
 const ids={settings:'journeySectionSettings',places:'journeySectionPlaces',order:'journeySectionOrder'};
 ['settings','places','order'].forEach((name,i)=>{sections[i].dataset.routeStep=name;sections[i].id=ids[name];const heading=sections[i].querySelector('.section-head h2');if(heading)heading.textContent=({settings:'行程设置',places:'收藏地点',order:'路线顺序'})[name]});
 const query=new URLSearchParams(location.search);
 let step=query.has('edit')||query.get('from')==='footprint'?'order':'places';
 let previousCount=0;
 body.classList.add('journey-confirmed');
 const phone=matchMedia('(max-width:700px)');
 const toolbar=root.querySelector('.journey-sheet-toolbar');
 const title=toolbar?.querySelector('.journey-sheet-summary strong');
 const desc=toolbar?.querySelector('.journey-sheet-summary small');
 const nav=document.createElement('div');
 nav.className='journey-step-nav';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','路线规划步骤');
 for(const [key,label] of [['places','地点'],['order','顺序'],['settings','设置']]){
  const btn=document.createElement('button');
  btn.type='button';btn.dataset.routeNav=key;btn.textContent=label;
  btn.setAttribute('role','tab');btn.setAttribute('aria-controls',ids[key]);
  nav.append(btn);
 }
 toolbar?.insertBefore(nav,toolbar.querySelector('.journey-sheet-minimize'));
 const orderBlock=sections[2];
 const chosen=document.getElementById('chosen');
 const emptyAdd=document.createElement('button');
 emptyAdd.type='button';emptyAdd.id='journeyEmptyAdd';emptyAdd.className='outline full';
 emptyAdd.textContent='＋ 从收藏添加地点';
 chosen?.after(emptyAdd);
 emptyAdd.addEventListener('click',()=>setStep('places'));
 const onEntry=document.createElement('button');
 onEntry.type='button';onEntry.id='journeySceneAdd';
 onEntry.className='outline';onEntry.textContent='＋ 选择收藏地点';
 onEntry.addEventListener('click',()=>{
  setStep('places');window.__atlasJourneyRealV5?.open?.();
  window.__atlasJourneyRealV5?.snapTo?.('half');
 });
 document.querySelector('.atlas-heading')?.append(onEntry);
 function setStep(next){
  if(!ids[next])return;
  step=next;body.dataset.journeyStep=step;
  root.scrollTop=0;
  if(phone.matches&&window.__atlasJourneyRealV5?.state?.sheet==='peek')
   window.__atlasJourneyRealV5.snapTo('half');
  update();
 }
 function update(){
  const state=live.getState(),n=state.selected.length;
  if(previousCount>0&&n===0&&step==='order')step='places';
  previousCount=n;
  body.dataset.journeyStep=step;
  body.classList.toggle('journey-no-stops',n===0);
  const start=document.getElementById('startDate')?.value||'';
  const end=document.getElementById('endDate')?.value||'';
  const a=new Date(start+'T12:00:00'),b=new Date(end+'T12:00:00');
  const days=Number.isFinite(a.getTime())&&Number.isFinite(b.getTime())?Math.max(1,Math.min(60,Math.round((b-a)/86400000)+1)):1;
  const available=document.querySelectorAll('#places .place:not([disabled])').length;
  const total=document.querySelectorAll('#places .place').length;
  if(title)title.textContent='路线规划';
  if(desc)desc.textContent=n+' 站 · '+days+' 天';
  for(const btn of nav.querySelectorAll('[data-route-nav]')){
   const selected=btn.dataset.routeNav===step;
   btn.classList.toggle('active',selected);btn.setAttribute('aria-selected',String(selected));
   btn.tabIndex=selected?0:-1;
  }
  const collapsed=document.getElementById('journeySheetOpen');
  if(collapsed)collapsed.textContent=n?'调整路线 · '+n+' 站':'从收藏添加地点';
  const save=document.getElementById('savePlan');
  if(save){save.disabled=n===0;save.setAttribute('aria-disabled',String(n===0))}
  const generate=document.getElementById('generate');
  if(generate)generate.hidden=n===0;
  const optimize=document.getElementById('autoArrange');
  if(optimize)optimize.hidden=n<2;
  emptyAdd.hidden=n!==0;
  onEntry.hidden=n!==0;
  const heading=document.getElementById('atlasTitle');
  if(heading&&n===0)heading.textContent='从收藏开始规划';
  else if(heading)heading.textContent='你的旅行路线';
  const subtitle=document.getElementById('atlasSubtitle');
  if(subtitle)subtitle.textContent=n===0?(total?'已有 '+total+' 个收藏地点，选择后安排路线':'先在地图收藏地点，再开始规划'):'已添加 '+n+' 站 · 可继续调整顺序';
  const currentStatus=document.getElementById('status');
  if(currentStatus&&total>0&&!currentStatus.classList.contains('error'))currentStatus.hidden=true;
 }
 nav.addEventListener('click',e=>{const item=e.target.closest('[data-route-nav]');if(item)setStep(item.dataset.routeNav)});
 nav.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
  e.preventDefault();const names=['places','order','settings'];
  const current=names.indexOf(step);
  const next=names[(current+(e.key==='ArrowRight'?1:2))%3];
  setStep(next);nav.querySelector('[data-route-nav="'+next+'"]')?.focus();
 });
 document.getElementById('newPlan')?.addEventListener('click',()=>{
  requestAnimationFrame(()=>{if(!live.getState().selected.length)setStep('places')});
 });
 document.addEventListener('atlas:journey-changed',update);
 for(const id of ['startDate','endDate'])document.getElementById(id)?.addEventListener('change',update);
 window.addEventListener('pageshow',update);
 body.dataset.journeyStep=step;update();
 window.__atlasJourneyVisual={setStep,get step(){return step},getSource:()=>orderBlock};
})();
