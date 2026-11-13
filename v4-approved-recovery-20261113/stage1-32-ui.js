/* Footprint Map 1.32 — unified, locale-first calendar.
   No layout changes to the existing flows and no database migration. */
(()=>{'use strict';
if(window.__fp32CalendarInstalled)return;window.__fp32CalendarInstalled=true;
let current=null,month=new Date(),selected='';
const sheet=document.createElement('dialog');sheet.id='fp32Calendar';sheet.setAttribute('aria-label','选择日期');
sheet.innerHTML=`<div class="fp32-cal-panel">
 <div class="fp32-cal-header"><button type="button" data-prev aria-label="上一个月">‹</button><strong id="fp32CalMonth"></strong><button type="button" data-next aria-label="下一个月">›</button></div>
 <div class="fp32-cal-week" aria-hidden="true"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
 <div class="fp32-cal-days" id="fp32CalDays" role="grid" aria-label="日期"></div>
 <div class="fp32-cal-actions"><button type="button" data-clear>清除</button><button type="button" data-today>今天</button><button type="button" data-done>完成</button></div>
 </div>`;
document.body.append(sheet);
const pad=n=>String(n).padStart(2,'0');
const iso=(y,m,d)=>`${y}-${pad(m+1)}-${pad(d)}`;
function render(){
 const y=month.getFullYear(),m=month.getMonth();
 sheet.querySelector('#fp32CalMonth').textContent=`${y}年 ${m+1}月`;
 const box=sheet.querySelector('#fp32CalDays');box.replaceChildren();
 const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();
 const today=new Date(),todayStr=iso(today.getFullYear(),today.getMonth(),today.getDate());
 for(let i=0;i<first;i++)box.append(document.createElement('span'));
 for(let d=1;d<=days;d++){
  const day=iso(y,m,d),b=document.createElement('button');b.type='button';b.textContent=d;
  b.dataset.date=day;b.setAttribute('aria-selected',String(selected===day));
  b.setAttribute('aria-label',`${y}年${m+1}月${d}日`);if(day===todayStr)b.classList.add('is-today');
  b.addEventListener('click',()=>{selected=day;render()});box.append(b);
 }
}
function prepare(el){
 if(!el||el.dataset.fp32Calendar||el.closest?.('#atlasJourneyDateDialog'))return;
 // Text format remains an ISO date; existing storage and itinerary code read input.value unchanged.
 el.type='text';el.readOnly=true;el.inputMode='none';el.autocomplete='off';
 el.dataset.fp32Calendar='ready';el.classList.add('fp32-date');
 el.setAttribute('aria-haspopup','dialog');el.setAttribute('aria-label',el.labels?.[0]?.textContent?.trim()||'选择日期');
 if(!el.getAttribute('placeholder'))el.placeholder='选择日期';
 el.addEventListener('click',e=>{e.preventDefault();open(el)});
 el.addEventListener('keydown',e=>{if(['Enter',' ','ArrowDown'].includes(e.key)){e.preventDefault();open(el)}});
}
function open(el){current=el;const parsed=/^\d{4}-\d{2}-\d{2}$/.test(el.value)?el.value:'';
 selected=parsed;const n=parsed?new Date(parsed+'T12:00:00'):new Date();month=new Date(n.getFullYear(),n.getMonth(),1);
 render();if(!sheet.open)sheet.showModal();
}
function save(value){
 if(current){current.value=value;current.dispatchEvent(new Event('input',{bubbles:true}));current.dispatchEvent(new Event('change',{bubbles:true}))}
 if(sheet.open)sheet.close();current=null;
}
sheet.querySelector('[data-prev]').addEventListener('click',()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);render()});
sheet.querySelector('[data-next]').addEventListener('click',()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);render()});
sheet.querySelector('[data-today]').addEventListener('click',()=>{const d=new Date();save(iso(d.getFullYear(),d.getMonth(),d.getDate()))});
sheet.querySelector('[data-clear]').addEventListener('click',()=>save(''));
sheet.querySelector('[data-done]').addEventListener('click',()=>save(selected));
sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close()});
sheet.addEventListener('close',()=>{current=null});
function scan(node=document){if(node.matches?.('input[type="date"]'))prepare(node);node.querySelectorAll?.('input[type="date"]').forEach(prepare)}
scan();new MutationObserver(entries=>{for(const entry of entries)for(const n of entry.addedNodes)if(n.nodeType===1)scan(n)}).observe(document.body,{childList:true,subtree:true});
})();
