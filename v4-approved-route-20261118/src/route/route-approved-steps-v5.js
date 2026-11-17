/* Approved final route review: three-step navigation on the ONE existing C V5
 * physical sheet. Do not create a second sheet, map, star or data repository.
 * The existing original approved spring and gesture control remain untouched. */
(()=>{'use strict';
 const shell=document.getElementById('rc-shell');
 const main=document.getElementById('rc-main'),grip=document.getElementById('rc-grab');
 const body=document.getElementById('rc-body'),footer=document.getElementById('rc-footer');
 if(!shell||!main||!grip||!body||!footer)return;
 const upper=grip.querySelector('.rc-upper > div');
 if(!upper||document.getElementById('rc-approved-tabs'))return;
 const summary=document.createElement('div');summary.id='rc-approved-summary';
 summary.innerHTML='<strong>路线规划</strong><small>0 站 · 3 天</small>';upper.append(summary);
 const tabs=document.createElement('nav');tabs.id='rc-approved-tabs';tabs.setAttribute('aria-label','路线规划步骤');tabs.setAttribute('role','tablist');
 for(const [id,name] of [['places','地点'],['order','顺序'],['settings','设置']]){
   const btn=document.createElement('button');btn.type='button';btn.dataset.approvedTab=id;
   btn.textContent=name;btn.setAttribute('role','tab');tabs.append(btn);
 }
 grip.append(tabs);
 const panel=document.createElement('section');panel.id='rc-approved-panel';panel.hidden=true;
 panel.innerHTML='<h3>行程设置</h3><div class="rc-approved-setting-grid">'+
 '<button type="button" data-rc="mini-date"><small>旅行日期</small><b data-setting="date"></b></button>'+
 '<button type="button" data-rc="mini-origin"><small>出发地</small><b>编辑</b></button>'+
 '<button type="button" data-rc="mini-destination"><small>目的地</small><b>编辑</b></button>'+
 '<button type="button" data-rc="mini-transport"><small>交通方式</small><b data-setting="mode"></b></button>'+
 '</div><p>地点顺序、出发日期和交通方式会随路线一同保存。实际车程与换乘以导航为准。</p>';
 main.append(panel);
 const empty=document.createElement('div');empty.id='rc-approved-empty';empty.hidden=true;
 empty.innerHTML='<h3>先从收藏添加地点</h3><p>选择至少两个地点，就可以安排路线顺序。</p><button type="button" data-approved-tab="places">前往选点</button>';
 main.append(empty);
 let tab='places',searchText='',lastStage='';
 const api=()=>window.__atlasRouteV5Live?.state||{};
 const days=(start,end)=>{
   const a=new Date((start||'')+'T12:00:00'),b=new Date((end||'')+'T12:00:00');
   return Number.isFinite(a.getTime())&&Number.isFinite(b.getTime())?Math.max(1,Math.round((b-a)/86400000)+1):1;
 };
 const filter=()=>{
   const q=searchText.trim().toLocaleLowerCase('zh');
   const inp=body.querySelector('#rc-approved-filter');if(inp&&inp.value!==searchText)inp.value=searchText;
   for(const row of body.querySelectorAll('.rc-stop-pick'))row.hidden=Boolean(q)&&!row.textContent.toLocaleLowerCase('zh').includes(q);
 };
 function enhancePlaces(){
   if(api().stage!=='select')return;
   if(!body.querySelector('#rc-approved-places')){
     const head=document.createElement('div');head.id='rc-approved-places';
     head.innerHTML='<div class="rc-approved-rowhead"><strong>收藏地点</strong><small id="rc-approved-count"></small></div>'+
      '<input type="search" id="rc-approved-filter" autocomplete="off" placeholder="搜索你保存的地点…" aria-label="搜索收藏地点">';
     body.prepend(head);
   }
   const count=body.querySelector('#rc-approved-count');
   const rows=body.querySelectorAll('.rc-stop-pick').length;
   const n=api().order?.length||0;
   const label=rows+' 个收藏 · 已选 '+n;
   if(count&&count.textContent!==label)count.textContent=label;
   filter();
 }
 function sync(){
   const s=api(),stage=s.stage||'select';
   if(stage!==lastStage){
     if(tab!=='settings'&&tab!=='empty')tab=stage==='select'?'places':'order';
     lastStage=stage;
   }
   const title=summary.querySelector('small'),txt=(s.order?.length||0)+' 站 · '+days(s.start,s.end)+' 天';
   if(title.textContent!==txt)title.textContent=txt;
   for(const b of tabs.querySelectorAll('button')){
     const on=b.dataset.approvedTab===(tab==='empty'?'order':tab);
     b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;
   }
   const settings=tab==='settings',emptyMode=tab==='empty';
   main.classList.toggle('rc-approved-cover',settings||emptyMode);
   panel.hidden=!settings;empty.hidden=!emptyMode;
   const mode=panel.querySelector('[data-setting="mode"]');
   if(mode)mode.textContent=({car:'驾车',walk:'步行',bike:'骑行',transit:'公共交通'}[s.transportMode]||'驾车');
   const date=panel.querySelector('[data-setting="date"]');
   if(date)date.textContent=(s.start||'待设置')+'—'+(s.end||'');
   if(!settings&&!emptyMode)enhancePlaces();
 }
 function change(name){
   const s=api();
   if(name==='settings'){tab='settings';sync();return}
   if(name==='order'&&(!s.order||s.order.length<2)){tab='empty';sync();return}
   tab=name;
   if(s.stage!==(name==='places'?'select':'order'))
     window.__atlasRouteV5Live?.stage?.(name==='places'?'select':'order');
   sync();
 }
 tabs.addEventListener('click',e=>{const b=e.target.closest('[data-approved-tab]');if(b)change(b.dataset.approvedTab)});
 empty.addEventListener('click',()=>change('places'));
 body.addEventListener('input',e=>{if(e.target.id==='rc-approved-filter'){searchText=e.target.value;filter()}});
 const observer=new MutationObserver(()=>sync());
 observer.observe(body,{childList:true});
 window.addEventListener('pageshow',sync);
 window.addEventListener('focus',sync);
 sync();
 window.__atlasApprovedRouteSteps={get step(){return tab},navigate:change,sync};
})();