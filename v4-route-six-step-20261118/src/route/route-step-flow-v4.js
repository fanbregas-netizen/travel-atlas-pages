/* Footprint Map V4 · six-step guided route planner.
 * Product UI based on the user-approved six-screen reference (18 Nov 2026).
 * Map and starred places remain real; this one spring sheet is the only editor.
 * MediaCore stores routes only on an explicit user Save.
 */
(()=>{'use strict';
if(!window.__fpRouteLive||window.__fpSixStepRoute)return;
const $=s=>document.querySelector(s);
const placeList=window.__fpRoutePreviewData||[];
const initial=window.__fpRouteLiveInitial||{};
const sourceById=new Map(placeList.map(p=>[String(p.id),p]));
const iSvg=(name)=>{const shapes={
 back:'<path d="M14 5 7 12l7 7"/>',
 layers:'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5m-18 5 9 5 9-5"/>',
 location:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.4"/>',
 route:'<circle cx="5" cy="17" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 17h5c4 0 0-11 5-11"/>',
 next:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16.4 16.4 4.5 4.5"/>',
 grip:'<path d="M5 8h14M5 12h14M5 16h14"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
 car:'<path d="m4 12 1.6-5a2 2 0 0 1 1.9-1.4h9a2 2 0 0 1 1.9 1.4L20 12v6h-2v-2H6v2H4zM4 12h16"/><path d="M7 14h2m6 0h2"/>',
 walk:'<circle cx="13" cy="4" r="2"/><path d="m10 21 2-7-3-3 3-3 4 3 2 4M7 16l4-4m3 9-1-5"/>',
 bike:'<circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="m5 17 5-9 4 9h5M10 8h4m-1-3h3"/>',
 bus:'<rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 12h14m-9 7-2 3m6-3 2 3M8 7h8"/>',
 undo:'<path d="m9 14-5-5 5-5M4 9h11a5 5 0 0 1 0 10h-3"/>',
 star:'<path d="m12 2 2.9 6 6.6 1-4.8 4.6 1.2 6.5L12 17l-5.9 3.1 1.2-6.5L2.5 9l6.6-1Z"/>',
 pen:'<path d="M13 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M11 13l8-8 2 2-8 8-4 1z"/>',
 shrink:'<path d="m6 10 6 6 6-6"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 trash:'<path d="M4 7h16m-13 0 1 14h8l1-14m-8-3h6"/>',
 flag:'<path d="M5 22V3m0 1h14l-4 5 4 5H5"/>'
};return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(shapes[name]||'')+'</svg>'};
const iconStar='<img src="./icons/active_04_star_saved.svg" alt="" loading="lazy">';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const fmt=s=>{const p=String(s||'').split('-');return p.length===3?Number(p[1])+'月'+Number(p[2])+'日':'选择日期'};
const dateDays=(a,b)=>{const x=new Date(a+'T12:00:00'),y=new Date(b+'T12:00:00');return clamp(Math.round((y-x)/86400000)+1||1,1,30)};
const modeLabels={car:'驾车',walk:'步行',bike:'骑行',transit:'公交'};
const modeIcons={car:'car',walk:'walk',bike:'bike',transit:'bus'};
const saved=Boolean(initial.id);
const state={
 step:saved?'done':'entry',order:saved?[...new Set(initial.order||[])]:[],
 days:{...(initial.days||{})},from:initial.from||'same',to:initial.to||'same',
 start:initial.start||'',end:initial.end||'',mode:initial.mode||'car',
 legs:{...(initial.legs||{})},locked:[...(initial.locked||[])],
 query:'',proposal:null,undo:null,undoLabel:'',dirty:false,saving:false,saveError:'',
 savedId:initial.id||null,placeCard:null
};
let sheet=null,head=null,content=null,foot=null,topbar=null,favLayer=null;
let currentHeight=190,goalHeight=190,velocity=0,frame=0,gesture=null,drag=null;
let mapInstalled=false,favNodes=new Map(),mapRefresh=0,toastTimer=0;
const snapshot=()=>({order:[...state.order],days:{...state.days},from:state.from,to:state.to,
 start:state.start,end:state.end,mode:state.mode,legs:{...state.legs}});
function canUndo(label){state.undo=snapshot();state.undoLabel=label||'已调整';state.dirty=true}
function undo(){if(!state.undo)return;const u=state.undo;state.undo=null;
 Object.assign(state,{order:u.order,days:u.days,from:u.from,to:u.to,start:u.start,end:u.end,mode:u.mode,legs:u.legs});
 state.proposal=null;state.dirty=true;syncRoute();render(true);}
function normalizeDays(){const total=dateDays(state.start,state.end);
 for(const id of state.order)state.days[id]=clamp(Number(state.days[id])||1,1,total);}
const count=()=>state.order.length;
const point=id=>sourceById.get(String(id));
function routeRecord(){return {order:state.order.slice(),days:{...state.days},from:state.from,to:state.to,
 start:state.start,end:state.end,mode:state.mode,legs:{...state.legs},locked:state.locked.slice()};}
function mapLocation(){const p=point(state.order[0]);return p?[Number(p.lng),Number(p.lat)]:null}
function syncRoute(){
 document.body.classList.toggle('fp-route-empty',!state.order.length);
 const rv=window.__atlasRV;
 if(state.order.length&&rv?.setSelection){
  try{rv.setSelection(state.order,{...state.days})}catch(e){console.warn('路线地图更新失败',e)}
 }
 if(rv?.setTripDetails)try{rv.setTripDetails({startDate:state.start,endDate:state.end,
  origin:endpointName(state.from),destination:endpointName(state.to)})}catch{}
 window.__fpRoutePreviewMode=state.mode;
 window.__fpRouteHasNonDrivingLegs=state.mode!=='car'||Object.values(state.legs).some(m=>m!=='car');
 document.dispatchEvent(new CustomEvent('atlas:route-stops-changed'));
 window.__fpRouteLiveBridge?.changed?.(routeRecord());drawFavorites();
}
function endpointName(v){if(v==='same')return '不指定';return point(String(v).replace(/^place:/,''))?.title||'未指定'}
function daysGroups(){const groups=new Map();for(const id of state.order){const day=state.days[id]||1;if(!groups.has(day))groups.set(day,[]);groups.get(day).push(point(id)?.title||'地点')}return [...groups].sort((a,b)=>a[0]-b[0])}
function startSheet(){
 document.body.classList.add('fp-step-route');document.body.classList.toggle('fp-route-empty',!state.order.length);
 topbar=document.createElement('header');topbar.id='fpRouteFlowTop';
 topbar.innerHTML='<button class="fp-rt-icon" data-top="back" aria-label="返回地图">'+iSvg('back')+'</button>'+
  '<span class="fp-rt-title">路线规划</span>'+
  '<button class="fp-rt-icon" data-top="layers" aria-label="地图全览">'+iSvg('layers')+'</button>';
 document.body.appendChild(topbar);
 favLayer=document.createElement('div');favLayer.id='fpRouteFavLayer';favLayer.setAttribute('aria-label','地图收藏地点');document.body.appendChild(favLayer);
 sheet=document.createElement('section');sheet.id='fpRouteFlowSheet';sheet.setAttribute('aria-label','路线规划底部卡片');
 sheet.innerHTML='<header id="fpRouteSheetHead"><span class="fp-route-grab" aria-hidden="true"></span>'+
  '<div class="fp-route-headrow"><strong id="fpRouteStepTitle"></strong><span id="fpRouteStepSummary" class="fp-route-summary"></span>'+
  '<button id="fpRouteStepCollapse" class="fp-route-head-action" aria-label="调整卡片高度">'+iSvg('shrink')+'</button></div></header>'+
  '<div id="fpRouteSheetContent"></div><footer id="fpRouteSheetFoot"></footer>';
 document.body.appendChild(sheet);head=$('#fpRouteSheetHead');content=$('#fpRouteSheetContent');foot=$('#fpRouteSheetFoot');
 attachHandlers();render(false);
 const target=state.step==='entry'?getDetents().peek:getDetents().half;
 currentHeight=target;goalHeight=target;applyHeight();
 requestAnimationFrame(()=>{syncRoute();initMapProjection()});
}
function getDetents(){const h=window.visualViewport?.height||innerHeight||844;
 const max=Math.max(220,h-66);
 const peek=Math.min(max,Math.max(156,Math.min(206,h*.245)));
 const half=Math.min(max,Math.max(peek+60,Math.min(h*.575,545)));
 return {peek,half,full:max};
}
function applyHeight(){if(!sheet)return;
 sheet.style.setProperty('--fp-flow-visible',Math.max(140,currentHeight).toFixed(1)+'px');
}
function stopFrame(){if(frame){cancelAnimationFrame(frame);frame=0}}
function snap(level){const limits=getDetents();goalHeight=limits[level]||limits.half;
 stopFrame();if(matchMedia('(prefers-reduced-motion:reduce)').matches){currentHeight=goalHeight;velocity=0;applyHeight();return}
 let ticks=0;function tick(){velocity=(velocity+(goalHeight-currentHeight)*.115)*.73;currentHeight+=velocity;applyHeight();
  if((Math.abs(goalHeight-currentHeight)<.55&&Math.abs(velocity)<.35)||ticks++>95){currentHeight=goalHeight;velocity=0;frame=0;applyHeight();return}
  frame=requestAnimationFrame(tick)}
 frame=requestAnimationFrame(tick);
}
function headerText(){
 const names={entry:'路线规划',pick:'选择地点',order:'排列顺序',settings:'行程设置',recommend:'行程推荐',done:'已保存'};
 $('#fpRouteStepTitle').textContent=names[state.step]||'路线规划';
 $('#fpRouteStepSummary').textContent=count()+' 地点 · '+dateDays(state.start,state.end)+' 天';
}
function listItem(p){const selected=state.order.includes(p.id);
 return '<div class="fp-route-place-row">'+iconStar+
  '<div class="fp-route-place-name"><div>'+esc(p.title)+'</div>'+
  '<div class="fp-route-place-sub">'+esc(p.address||p.note||'')+'</div></div>'+
  '<button class="fp-route-add" type="button" data-action="toggle" data-id="'+esc(p.id)+'" aria-label="'+(selected?'移除':'添加')+esc(p.title)+'" aria-pressed="'+selected+'">'+iSvg(selected?'check':'plus')+'</button></div>'}
function filteredPlaces(){const q=state.query.trim().toLocaleLowerCase();return q?placeList.filter(p=>[p.title,p.address,p.note].join(' ').toLocaleLowerCase().includes(q)):placeList}
function pickList(){const items=filteredPlaces();return items.length?items.map(listItem).join(''):'<div class="fp-route-empty-hint">没有找到地点，可返回地图继续添加收藏</div>'}
function orderRow(id,index){const p=point(id),day=state.days[id]||1;
 return '<div class="fp-route-order-row" data-row="'+esc(id)+'">'+iconStar+
  '<span class="fp-route-place-name">'+esc(p?.title||'未命名地点')+'</span>'+
  '<button class="fp-route-day" data-action="day" data-id="'+esc(id)+'" type="button" aria-label="'+esc(p?.title||'地点')+'：第'+day+'天">D'+day+'</button>'+
  '<button class="fp-route-drag" type="button" data-grab="'+esc(id)+'" aria-label="拖动调整'+esc(p?.title||'地点')+'的顺序">'+iSvg('grip')+'</button></div>'}
function modeButtons(){return Object.entries(modeLabels).map(([id,label])=>'<button type="button" class="fp-route-mode" data-action="mode" data-mode="'+id+'" aria-pressed="'+(state.mode===id)+'">'+iSvg(modeIcons[id])+'<span>'+label+'</span></button>').join('')}
function endpointSelect(kind){const val=kind==='from'?state.from:state.to;
 return '<select data-field="'+kind+'" aria-label="'+(kind==='from'?'出发地':'目的地')+'">'+
  '<option value="same" '+(val==='same'?'selected':'')+'>不指定</option>'+
  placeList.map(p=>'<option value="place:'+esc(p.id)+'" '+(val==='place:'+p.id?'selected':'')+'>'+esc(p.title)+'</option>').join('')+'</select>'}
function daysDetails(){const groups=daysGroups();return groups.length?'<div class="fp-route-day-list">'+groups.map(([d,names])=>'<div class="fp-route-day-list-row"><b>D'+d+'</b><span>'+esc(names.join(' · '))+'</span></div>').join('')+'</div>':'<div class="fp-route-empty-hint">还没有地点</div>'}
function distance(a,b){if(!a||!b)return 0;const r=x=>Number(x)*Math.PI/180;
 const x=r(Number(b.lat)-Number(a.lat)),y=r(Number(b.lng)-Number(a.lng)),z=Math.sin(x/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(y/2)**2;
 return 12742*Math.atan2(Math.sqrt(z),Math.sqrt(Math.max(0,1-z)))}
function pathLength(ids){
 let pts=ids.map(point).filter(Boolean),start=point(state.from.replace(/^place:/,'')),end=point(state.to.replace(/^place:/,''));
 let total=0,last=start||pts[0];for(const p of pts){total+=distance(last,p);last=p}if(end&&last)total+=distance(last,end);return total;
}
function suggestion(){
 if(state.order.length<2)return null;const arr=state.order.slice(),start=point(state.from.replace(/^place:/,''))||point(arr[0]);
 const finish=point(state.to.replace(/^place:/,''));let remaining=arr.slice(),sorted=[],cur=start;
 while(remaining.length){let best=0,bestScore=Infinity;remaining.forEach((id,i)=>{const loc=point(id),s=distance(cur,loc)+(remaining.length===1&&finish?distance(loc,finish):0);if(s<bestScore){bestScore=s;best=i}});const id=remaining.splice(best,1)[0];sorted.push(id);cur=point(id)}
 if(arr.length<=10){let improved=true,iterations=0;while(improved&&iterations++<6){improved=false;for(let a=0;a<sorted.length-1;a++)for(let b=a+1;b<sorted.length;b++){const trial=sorted.slice();trial.splice(a,b-a+1,...sorted.slice(a,b+1).reverse());if(pathLength(trial)<pathLength(sorted)-.001){sorted=trial;improved=true}}}}
 const before=pathLength(arr),after=pathLength(sorted);
 return {order:after<before-.001?sorted:arr,before,after:Math.min(after,before)};
}
function chain(ids){return '<div class="fp-route-chain">'+ids.slice(0,7).map((id,i)=>'<div class="fp-route-chain-star">'+iconStar+'<span>'+String.fromCharCode(65+i)+'</span></div>'+
 (i<Math.min(7,ids.length)-1?'<span class="fp-route-chain-line"></span>':'')).join('')+'</div>'}
function routeHint(){return '<div class="fp-route-route-overview">'+iSvg('route')+' <span>'+esc(count()+' 地点 · '+dateDays(state.start,state.end)+' 天 · '+modeLabels[state.mode])+'</span></div>'}
function renderBody(){
 switch(state.step){
 case 'entry':return '<p class="fp-route-hint">从收藏地点开始规划，地图会始终显示在卡片上方。</p>'+
  '<div class="fp-route-route-overview">'+iSvg('route')+'<span>'+count()+' 地点 · '+dateDays(state.start,state.end)+' 天</span></div>';
 case 'pick':return '<div class="fp-route-rowbar"><h2>选择地点</h2><span class="fp-route-minor">'+count()+' 已选</span></div>'+
  '<label class="fp-route-search">'+iSvg('search')+'<input id="fpRoutePlaceSearch" type="search" placeholder="搜索保存的地点…" value="'+esc(state.query)+'" aria-label="搜索收藏地点"></label>'+
  '<div id="fpRoutePlaceRows" class="fp-route-place-list">'+pickList()+'</div>'+
  '<p class="fp-route-tiny">星标保留在地图上，加入路线不会修改原收藏。</p>';
 case 'order':return '<div class="fp-route-rowbar"><h2>排列顺序</h2><span class="fp-route-minor">'+count()+' 站</span></div>'+
  '<div class="fp-route-place-list">'+state.order.map(orderRow).join('')+'</div>'+
  '<p class="fp-route-hint">按住右侧线条拖动，点击 D1 / D2 调整当天安排。</p>'+
  '<button type="button" class="fp-route-choose-next" data-action="backpick">'+iSvg('plus')+' 添加地点</button>';
 case 'settings':return '<h2>行程设置</h2>'+
  '<div class="fp-route-field"><label for="fpRouteDates">旅行日期</label></div>'+
  '<div class="fp-route-line">'+
   '<div class="fp-route-field"><input type="date" data-field="start" aria-label="开始日期" value="'+esc(state.start)+'"></div>'+
   '<div class="fp-route-field"><input type="date" data-field="end" aria-label="结束日期" value="'+esc(state.end)+'"></div></div>'+
  '<div class="fp-route-line">'+
   '<div class="fp-route-field"><label>起点</label>'+endpointSelect('from')+'</div>'+
   '<div class="fp-route-field"><label>终点</label>'+endpointSelect('to')+'</div></div>'+
  '<div class="fp-route-field"><label>主要交通方式</label></div>'+
  '<div class="fp-route-mode-list">'+modeButtons()+'</div>'+
  '<p class="fp-route-tiny">交通方式用于路线规划，不虚构实时路况和行驶时间。</p>';
 case 'recommend':{
  const p=state.proposal||suggestion();state.proposal=p;
  return '<h2>行程推荐</h2>'+routeHint()+
   '<div class="fp-route-recommend"><div><div class="fp-route-recommend-title">'+iSvg('star')+' 推荐顺序</div>'+
   '<p class="fp-route-recommend-note">根据地点之间的直线距离提供参考，减少折返。</p></div>'+
   chain(p?.order||state.order)+
   '<p class="fp-route-recommend-note">约 '+Math.round(p?.before||0)+' → '+Math.round(p?.after||0)+' 公里 · 非实际导航里程</p>'+
   '<div class="fp-route-recommend-actions"><button type="button" data-action="keep">保持原顺序</button>'+
   '<button type="button" class="fp-route-gold" data-action="adopt">采用建议</button></div></div>';
 }
 case 'done':return '<div class="fp-route-check">'+iSvg('check')+'</div>'+
  '<h2 class="fp-route-done-title">已保存</h2>'+
  routeHint()+daysDetails()+
  '<p class="fp-route-hint">路线和原收藏关联保存，地点 Brief、照片和视频不会被改动。</p>';
 default:return '';
 }
}
function renderFoot(){
 const back=(state.step==='entry'||state.step==='done')?'':'<button class="fp-route-quiet-btn" type="button" data-action="prev">'+iSvg('back')+' 上一步</button>';
 const footRow=(state.step==='entry'||state.step==='done')?'':'<div class="fp-route-foot-row">'+back+
  '<span class="fp-route-minor">'+({pick:'第 1 步',order:'第 2 步',settings:'第 3 步',recommend:'第 4 步'}[state.step]||'')+' / 4</span></div>';
 const actions={entry:['start','开始规划'],pick:['nextpick','下一步'],order:['nextorder','下一步'],settings:['nextsettings','下一步'],recommend:['save','完成并保存'],done:['view','查看行程']};
 const [act,label]=actions[state.step]||actions.entry;
 const disabled=((act==='nextpick'||act==='nextorder'||act==='save')&&!count())||state.saving;
 return (state.undo?'<div class="fp-route-undo"><span>'+esc(state.undoLabel)+' · 可撤回</span><button type="button" data-action="undo">'+iSvg('undo')+' 撤回</button></div>':'')+
  (state.saveError?'<p class="fp-route-save-error" role="alert">'+esc(state.saveError)+'</p>':'')+
  footRow+'<button class="fp-route-main-btn" type="button" data-action="'+act+'" '+(disabled?'disabled':'')+'>'+
  (state.saving?'正在保存…':label)+' '+iSvg(act==='view'?'route':'next')+'</button>';
}
function render(preserveScroll=false){
 const scroll=content?.scrollTop||0;headerText();
 content.innerHTML=renderBody();foot.innerHTML=renderFoot();
 if(preserveScroll)content.scrollTop=scroll;else content.scrollTop=0;
 drawFavorites();
}
function setStep(step){state.step=step;state.saveError='';if(step==='recommend')state.proposal=suggestion();render();snap(step==='entry'?'peek':'half');fitRoute();}
function togglePlace(id){id=String(id);if(!point(id))return;canUndo('地点已调整');const n=state.order.indexOf(id);
 if(n>=0){state.order.splice(n,1);delete state.days[id];if(state.from==='place:'+id)state.from='same';if(state.to==='place:'+id)state.to='same'}
 else{state.order.push(id);state.days[id]=clamp(Number(state.days[id])||1,1,dateDays(state.start,state.end))}
 state.proposal=null;syncRoute();render(true);}
function dayOf(id){canUndo('行程日期已调整');state.days[id]=state.days[id]>=dateDays(state.start,state.end)?1:state.days[id]+1;
 syncRoute();render(true)}
function updateField(name,value){
 if(!['start','end','from','to'].includes(name))return;
 if((name==='start'||name==='end')&&!/^\d{4}-\d{2}-\d{2}$/.test(value))return;
 if(name==='start'&&value>state.end||name==='end'&&value<state.start){state.saveError='结束日期不能早于开始日期';render(true);return}
 canUndo('设置已修改');state[name]=value;state.saveError='';
 if(name==='start'||name==='end')normalizeDays();
 syncRoute();render(true);
}
function updateMode(mode){if(!modeLabels[mode]||state.mode===mode)return;canUndo('交通方式已调整');
 state.mode=mode;syncRoute();render(true)}
function requestSave(){if(state.saving)return;const bridge=window.__fpRouteLiveBridge;if(!bridge?.save){state.saveError='路线存储未就绪';render(true);return}
 state.saving=true;state.saveError='';render(true);
 bridge.save(routeRecord()).then(id=>{state.savedId=id;state.undo=null;state.dirty=false;state.saving=false;setStep('done')}).catch(e=>{
  state.saving=false;state.saveError=e?.message||'保存失败，请重试';render(true)
 });
}
function action(name,b){
 switch(name){
 case 'start':setStep('pick');return;
 case 'prev':setStep({pick:'entry',order:'pick',settings:'order',recommend:'settings'}[state.step]||'entry');return;
 case 'nextpick':if(!count())return;setStep('order');return;
 case 'nextorder':if(!count())return;setStep('settings');return;
 case 'nextsettings':setStep('recommend');return;
 case 'backpick':setStep('pick');return;
 case 'toggle':togglePlace(b.dataset.id);return;
 case 'day':dayOf(b.dataset.id);return;
 case 'mode':updateMode(b.dataset.mode);return;
 case 'adopt':if(state.proposal){const s=state.proposal;if(state.order.join()!==s.order.join()){canUndo('已采用推荐顺序');state.order=s.order.slice();syncRoute()};state.proposal=null;setStep('recommend')}return;
 case 'keep':state.proposal=null;setStep('recommend');return;
 case 'undo':undo();return;
 case 'save':requestSave();return;
 case 'view':if(state.savedId)location.assign('./route-view.html?saved='+encodeURIComponent(state.savedId));return;
 case 'edit':setStep('pick');return;
 case 'new':location.assign('./journey.html?new=1');return;
 }
}
function attachHandlers(){
 sheet.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(b){e.preventDefault();action(b.dataset.action,b);return}
  const h=e.target.closest('#fpRouteStepCollapse');if(h){const l=getDetents();
   const nearest=currentHeight<l.half-20?'half':currentHeight<l.full-45?'full':'peek';snap(nearest)}
 });
 content.addEventListener('input',e=>{
  if(e.target.id==='fpRoutePlaceSearch'){state.query=e.target.value;const list=$('#fpRoutePlaceRows');if(list)list.innerHTML=pickList()}
 });
 content.addEventListener('change',e=>{
  const name=e.target.dataset.field;if(name)updateField(name,e.target.value)
 });
 topbar.addEventListener('click',e=>{
  const btn=e.target.closest('[data-top]');if(!btn)return;
  if(btn.dataset.top==='back'){if(state.dirty&&!confirm('当前路线尚未保存，确定返回地图吗？'))return;location.assign('./index.html')}
  else fitRoute(true);
 });
 head.addEventListener('pointerdown',e=>{
  if(e.target.closest('button'))return;
  stopFrame();gesture={id:e.pointerId,sy:e.clientY,initial:currentHeight,lastY:e.clientY,lastTime:performance.now(),speed:0,moved:false};
  try{head.setPointerCapture(e.pointerId)}catch{}
 });
 head.addEventListener('pointermove',e=>{
  const g=gesture;if(!g||g.id!==e.pointerId)return;const dy=e.clientY-g.sy;if(Math.abs(dy)>3)g.moved=true;
  const d=getDetents(),raw=g.initial-dy;
  currentHeight=raw<d.peek?d.peek-(d.peek-raw)*.20:raw>d.full?d.full+(raw-d.full)*.15:raw;
  const now=performance.now();g.speed=(e.clientY-g.lastY)/Math.max(7,now-g.lastTime);g.lastY=e.clientY;g.lastTime=now;
  applyHeight();if(e.cancelable)e.preventDefault();
 });
 const finish=e=>{
  const g=gesture;if(!g||g.id!==e.pointerId)return;gesture=null;
  const d=getDetents();let entries=['peek','half','full'],closest='peek',min=Infinity;
  for(const n of entries){const gap=Math.abs(currentHeight-d[n]);if(gap<min){min=gap;closest=n}}
  if(Math.abs(g.speed)>.75){const index=entries.indexOf(closest);closest=entries[clamp(index+(g.speed<0?1:-1),0,2)]}
  else if(!g.moved)closest=currentHeight<d.half-20?'half':currentHeight<d.full-25?'full':'peek';
  snap(closest);
 };
 head.addEventListener('pointerup',finish);head.addEventListener('pointercancel',finish);
 content.addEventListener('pointerdown',e=>{
  const h=e.target.closest('[data-grab]');if(!h)return;const id=h.dataset.grab;
  drag={id,pointer:e.pointerId,from:state.order.indexOf(id),target:state.order.indexOf(id),
   startY:e.clientY,row:h.closest('[data-row]')};h.style.touchAction='none';
  try{h.setPointerCapture(e.pointerId)}catch{}e.preventDefault();
 });
 content.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointer)return;
  const dy=e.clientY-drag.startY;if(drag.row){
   drag.row.classList.add('fp-is-dragging');drag.row.style.transform='translateY('+clamp(dy,-160,160)+'px)'}
  const rows=[...content.querySelectorAll('[data-row]')],p=e.clientY;
  let target=drag.target,min=Infinity;rows.forEach((r,i)=>{const b=r.getBoundingClientRect(),d=Math.abs(p-(b.top+b.bottom)/2);if(d<min){min=d;target=i}});
  drag.target=target;e.preventDefault();
 });
 const end=e=>{if(!drag||e.pointerId!==drag.pointer)return;const d=drag;drag=null;
  if(d.row){d.row.classList.remove('fp-is-dragging');d.row.style.removeProperty('transform')}
  if(d.from===d.target||d.from<0||d.target<0)return;
  canUndo('顺序已调整');const [item]=state.order.splice(d.from,1);state.order.splice(d.target,0,item);
  state.proposal=null;syncRoute();render(true);
 };
 content.addEventListener('pointerup',end);content.addEventListener('pointercancel',end);
 document.addEventListener('click',e=>{const pin=e.target.closest?.('#pinLayer .route-pin');
  if(!pin)return;const rv=window.__atlasRV,idx=[...pin.parentElement.children].indexOf(pin);
  const p=rv?.places?.[idx];if(p){e.preventDefault();e.stopImmediatePropagation();openPoint(p.id)}
 },true);
 window.addEventListener('resize',()=>{snap('half');drawFavorites()},{passive:true});
 window.visualViewport?.addEventListener('resize',()=>{currentHeight=clamp(currentHeight,getDetents().peek,getDetents().full);applyHeight();drawFavorites()},{passive:true});
}
function openPoint(id){const p=point(id);if(!p)return;state.placeCard=id;
 const previous=document.getElementById('fpRoutePointCard');previous?.remove();
 const card=document.createElement('section');card.id='fpRoutePointCard';
 card.style.cssText='position:fixed;z-index:54;left:14px;right:14px;max-width:490px;margin:auto;bottom:calc(env(safe-area-inset-bottom) + 210px);border:1px solid #e5e7df;border-radius:18px;background:#fffefa;box-shadow:0 9px 25px #1a2b2327;padding:12px 14px;color:#27342f;display:flex;align-items:center;gap:10px';
 card.innerHTML=iconStar+'<div style="flex:1;min-width:0"><strong style="font-size:13px">'+esc(p.title)+'</strong><div style="font-size:11px;color:#69746e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(p.address||p.note||'')+'</div></div>'+
 '<button type="button" data-close-point style="background:transparent;border:0;color:#69746e" aria-label="关闭">'+iSvg('shrink')+'</button>'+
 '<button type="button" data-add-point style="background:#496e50;color:white;border:0;border-radius:99px;min-height:36px;padding:8px 12px;font-size:12px">'+(state.order.includes(p.id)?'移除':'＋ 加入路线')+'</button>';
 card.addEventListener('click',e=>{
  if(e.target.closest('[data-close-point]'))card.remove();
  if(e.target.closest('[data-add-point]')){togglePlace(p.id);card.remove();if(state.step==='entry')setStep('pick')}
 });
 document.body.appendChild(card);
}
function drawFavorites(){
 const map=window.__atlasRV?.currentMap;
 if(!favLayer||!map||typeof map.project!=='function')return;
 const selected=new Set(state.order);
 const w=innerWidth,h=innerHeight;
 for(const p of placeList.slice(0,100)){
  let node=favNodes.get(p.id);
  if(!node){node=document.createElement('button');node.className='fp-route-extra-star';node.type='button';node.setAttribute('aria-label','查看'+p.title);node.innerHTML=iconStar;
   node.addEventListener('click',()=>{openPoint(p.id)});favLayer.appendChild(node);favNodes.set(p.id,node)}
  if(selected.has(p.id)){node.hidden=true;continue}
  const pt=map.project([Number(p.lng),Number(p.lat)]);
  const inFrame=pt&&Number.isFinite(pt.x)&&Number.isFinite(pt.y)&&pt.x>=15&&pt.x<=w-15&&pt.y>=85&&pt.y<=h-105;
  node.hidden=!inFrame;if(inFrame){node.style.left=pt.x+'px';node.style.top=pt.y+'px'}
 }
}
function scheduleFavorites(){if(mapRefresh)return;mapRefresh=requestAnimationFrame(()=>{mapRefresh=0;drawFavorites()})}
function fitRoute(all=false){
 const map=window.__atlasRV?.currentMap;if(!map||typeof map.fitBounds!=='function')return;
 const selected=state.order.map(point).filter(Boolean);
 const visible=(all||!selected.length)?placeList.slice(0,45):selected;
 if(visible.length===1){const p=visible[0];map.easeTo?.({center:[Number(p.lng),Number(p.lat)],zoom:10,duration:320});return}
 if(visible.length<2)return;
 const lng=visible.map(p=>Number(p.lng)),lat=visible.map(p=>Number(p.lat));
 const lower=getDetents().peek;
 map.fitBounds([[Math.min(...lng),Math.min(...lat)],[Math.max(...lng),Math.max(...lat)]],
  {padding:{top:92,right:36,bottom:Math.min(390,lower+55),left:36},maxZoom:12,duration:390});
}
function initMapProjection(){
 let cycles=0;
 function ready(){
  const map=window.__atlasRV?.currentMap;
  if(map&&typeof map.project==='function'&&!mapInstalled){
   mapInstalled=true;map.on?.('move',scheduleFavorites);map.on?.('zoom',scheduleFavorites);
   if(!state.order.length)fitRoute(true);else fitRoute();
   drawFavorites();return
  }
  if(++cycles<130)setTimeout(ready,350)
 }ready();
}
window.__fpSixStepRoute={get state(){return {...routeRecord(),step:state.step,savedId:state.savedId,dirty:state.dirty}},
 get visibleHeight(){return currentHeight},step:setStep,snap,undo,fit:fitRoute};
window.__fpRouteLiveReady.then(startSheet).catch(e=>console.error('路线加载失败',e));
})();