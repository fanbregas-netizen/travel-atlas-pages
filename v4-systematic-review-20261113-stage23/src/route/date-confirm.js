/* Footprint Map V4 — approved C02 explicit date commit for the REAL journey planner.
 * Does not create routes or change place storage; delegates date reflow to journey.js. */
(()=>{'use strict';
function init(){
 const start=document.getElementById('startDate'),end=document.getElementById('endDate');
 if(!start||!end||document.getElementById('atlasJourneyDateDialog'))return;
 const modal=document.createElement('dialog');modal.id='atlasJourneyDateDialog';
 modal.setAttribute('aria-label','确认旅行日期');
 modal.innerHTML='<form method="dialog" class="atlas-date-panel"><div class="atlas-date-handle" aria-hidden="true"></div><h2>旅行日期</h2><p>调整行程时间，点击「完成」后才会更新路线与 D1 / D2 日程。</p><label>出发日期<input type="date" id="atlasDateDraftStart" required></label><label>结束日期<input type="date" id="atlasDateDraftEnd" required></label><div id="atlasDateError" role="status" aria-live="polite"></div><footer><button type="button" id="atlasDateCancel">取消</button><button type="submit" id="atlasDateApply">完成</button></footer></form>';
 document.body.append(modal);
 const draftStart=modal.querySelector('#atlasDateDraftStart'),draftEnd=modal.querySelector('#atlasDateDraftEnd'),error=modal.querySelector('#atlasDateError');
 const today=()=>{const x=new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
 let updating=false;
 function open(){
  if(modal.open||updating)return;
  draftStart.value=start.value||today();draftEnd.value=end.value||draftStart.value;
  draftStart.min=today();draftEnd.min=draftStart.value;
  error.textContent='';
  modal.showModal();
 }
 function close(){if(modal.open)modal.close()}
 for(const el of [start,end]){
  el.readOnly=true;el.setAttribute('aria-haspopup','dialog');
  el.setAttribute('aria-controls','atlasJourneyDateDialog');el.setAttribute('aria-label','选择并确认'+(el===start?'出发':'结束')+'日期');
  el.addEventListener('pointerdown',e=>e.preventDefault(),true);
  el.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open()},true);
  el.addEventListener('keydown',e=>{
   if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}
  });
 }
 const finish=()=>{
  if(!draftStart.value||!draftEnd.value){error.textContent='请完整选择出发和结束日期。';return false}
  if(draftStart.value<today()){error.textContent='出发日期不能早于今天。';return false}
  if(draftEnd.value<draftStart.value){error.textContent='结束日期不能早于出发日期。';return false}
  const a=new Date(draftStart.value+'T12:00:00'),b=new Date(draftEnd.value+'T12:00:00');
  const days=Math.round((b-a)/86400000)+1;
  if(!Number.isInteger(days)||days<1||days>60){error.textContent='单次行程最多 60 天。';return false}
  const changed=start.value!==draftStart.value||end.value!==draftEnd.value;
  updating=true;
  start.value=draftStart.value;end.value=draftEnd.value;
  updating=false;
  if(changed){
   // One atomic state update, one legacy reflow. Never fire two competing events.
   end.dispatchEvent(new Event('change',{bubbles:true}));
   document.dispatchEvent(new CustomEvent('atlas:route-date-committed',{detail:{startDate:start.value,endDate:end.value,days}}));
  }
  close();return true;
 };
 draftStart.addEventListener('change',()=>{draftEnd.min=draftStart.value;if(draftEnd.value<draftStart.value)draftEnd.value=draftStart.value});
 modal.addEventListener('submit',e=>{e.preventDefault();finish()});
 modal.querySelector('#atlasDateCancel').addEventListener('click',close);
 modal.addEventListener('click',e=>{if(e.target===modal)close()});
 window.__atlasJourneyDate={open,close,getDraft:()=>({start:draftStart.value,end:draftEnd.value}),isOpen:()=>modal.open};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();