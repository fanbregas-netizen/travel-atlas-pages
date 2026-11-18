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
let sourceById=new Map(); // populated only after the async IndexedDB bridge finishes
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
/* Same V4 hand-drawn star path as icons/04_star_saved.svg, scaled down with a quiet keyline. */
const iconStar='<svg class="fp-small-gold-star" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8 L39.2 23.2 L56 25.4 L43.2 37.2 L46.1 54.4 L31.7 45.8 L16.8 54.4 L20 37.4 L8.1 25.3 L24.8 23Z" fill="#D7B36E" stroke="#c59f56" stroke-width="1.3" stroke-linejoin="round"/></svg>';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const fmt=s=>{const p=String(s||'').split('-');return p.length===3?Number(p[1])+'月'+Number(p[2])+'日':'选择日期'};
const dateDays=(a,b)=>{const x=new Date(a+'T12:00:00'),y=new Date(b+'T12:00:00');return clamp(Math.round((y-x)/86400000)+1||1,1,30)};
const modeLabels={car:'驾车',walk:'步行',bike:'骑行',transit:'公交'};
const modeIcons={car:'car',walk:'walk',bike:'bike',transit:'bus'};
const saved=Boolean(initial.id);
const state={
 step:saved?'preview':'pick',order:saved?[...new Set(initial.order||[])]:[],
 days:{...(initial.days||{})},from:initial.from||'same',to:initial.to||'same',
 start:initial.start||'',end:initial.end||'',mode:initial.mode||'car',
 legs:{...(initial.legs||{})},locked:[...(initial.locked||[])],
 query:'',pickMode:'list',legDetail:null,mapDraft:null,dayView:0,proposal:null,undo:[],undoLabel:'',dirty:false,saving:false,saveError:'',
 savedId:initial.id||null,title:initial.title||'我的旅行路线',placeCard:null
};
let sheet=null,head=null,content=null,foot=null,topbar=null,favLayer=null;
let currentHeight=190,goalHeight=190,velocity=0,frame=0,gesture=null,drag=null;
let mapInstalled=false,favNodes=new Map(),mapRefresh=0,toastTimer=0,undoTimer=0,fitTimer=0;
let preferredDetent='peek';state.undoVisible=false;state.datePickerField=null;state.datePickerMonth=null;
const snapshot=()=>({order:[...state.order],days:{...state.days},from:state.from,to:state.to,
 start:state.start,end:state.end,mode:state.mode,legs:{...state.legs},title:state.title,locked:[...state.locked]});
function canUndo(label){
 state.undo.push(snapshot());if(state.undo.length>25)state.undo.shift();
 state.undoLabel=label||'已调整';state.undoVisible=true;state.dirty=true;
 clearTimeout(undoTimer);undoTimer=setTimeout(()=>{state.undoVisible=false;render(true)},4500);
}
function undo(){if(!state.undo.length)return;const u=state.undo.pop();
 state.undoVisible=state.undo.length>0;clearTimeout(undoTimer);
 Object.assign(state,{order:u.order,days:u.days,from:u.from,to:u.to,start:u.start,end:u.end,mode:u.mode,legs:u.legs,title:u.title,locked:u.locked});
 state.proposal=null;state.dirty=true;syncRoute();render(true);}
function normalizeDays(){const total=dateDays(state.start,state.end);
 for(const id of state.order)state.days[id]=clamp(Number(state.days[id])||1,1,total);}
const count=()=>state.order.length;
const point=id=>sourceById.get(String(id));
function routeRecord(){return {order:state.order.slice(),days:{...state.days},from:state.from,to:state.to,
 start:state.start,end:state.end,mode:state.mode,legs:{...state.legs},title:state.title,locked:state.locked.slice()};}
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
 window.__fpRouteLiveBridge?.changed?.(routeRecord());drawFavorites();updateRoadDisplay();
}
function displayOrder(){return state.step==='preview'&&state.dayView
 ?state.order.filter(id=>Number(state.days[id]||1)===state.dayView):state.order;}
function updateRoadDisplay(){window.__fpLiveRouting?.update(displayOrder(),placeList,state.mode,state.legs)}
function endpointName(v){if(v==='same')return '不指定';return point(String(v).replace(/^place:/,''))?.title||'未指定'}
function daysGroups(){const groups=new Map();for(const id of state.order){const day=state.days[id]||1;if(!groups.has(day))groups.set(day,[]);groups.get(day).push(point(id)?.title||'地点')}return [...groups].sort((a,b)=>a[0]-b[0])}
function startSheet(){
 // Bridge bootstraps asynchronously. Read route records AFTER it resolves,
 // otherwise an eagerly constructed point index stays empty forever.
 sourceById=new Map(placeList.map(p=>[String(p.id),p]));
 const seed=window.__fpRouteLiveInitial||{};
 Object.assign(state,{
  step:seed.id?'preview':'pick',
  order:seed.id?[...new Set(seed.order||[])]:[],
  days:{...(seed.days||{})},from:seed.from||'same',to:seed.to||'same',
  start:seed.start||'',end:seed.end||'',mode:seed.mode||'car',
  legs:{...(seed.legs||{})},locked:[...(seed.locked||[])],
  savedId:seed.id||null,title:seed.title||'我的旅行路线'
 });
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
  '<button id="fpRouteUndoHead" type="button" class="fp-route-undo-icon" data-action="undo" aria-label="撤回上一步" hidden>'+iSvg('undo')+'</button>'+
  '<button id="fpRouteStepCollapse" class="fp-route-head-action" aria-label="调整卡片高度">'+iSvg('shrink')+'</button></div></header>'+
  '<div id="fpRouteSheetContent"></div><footer id="fpRouteSheetFoot"></footer>';
 document.body.appendChild(sheet);head=$('#fpRouteSheetHead');content=$('#fpRouteSheetContent');foot=$('#fpRouteSheetFoot');
 attachHandlers();render(false);
 const target=state.step==='preview'?getDetents().peek:getDetents().half;
 preferredDetent=state.step==='preview'?'peek':'half';
 currentHeight=target;goalHeight=target;applyHeight();
 requestAnimationFrame(()=>{syncRoute();initMapProjection()});
}
function getDetents(){
 const h=window.visualViewport?.height||innerHeight||844;
 const peek=state.step==='preview'&&!state.placeCard?clamp(Math.min(224,h*.28),194,228):state.step==='pick'&&state.pickMode==='map'&&!state.placeCard?clamp(h*.36,258,305):clamp(Math.min(189,h*.24),152,206);
 const maxMapReserve=Math.max(170,Math.min(245,h*.30));
 const full=Math.max(peek+80,h-maxMapReserve);
 const maxHalf=Math.min(full-36,h*.53,470);
 const needed=(head?.offsetHeight||65)+(foot?.scrollHeight||80)+(content?.scrollHeight||76)+4;
 const half=clamp(needed,peek+42,maxHalf);
 return {peek,half,full};
}
function applyHeight(){if(!sheet)return;
 const h=window.visualViewport?.height||innerHeight||844;
 const peek=getDetents().peek;
 sheet.classList.toggle('fp-route-at-peek',currentHeight<=peek+11);
 sheet.style.setProperty('--fp-flow-visible',Math.max(140,currentHeight).toFixed(1)+'px');
}
function stopFrame(){if(frame){cancelAnimationFrame(frame);frame=0}}
function snap(level){if(state.step==='preview'&&!state.placeCard&&state.legDetail===null)level='peek';const limits=getDetents();preferredDetent=level;goalHeight=limits[level]||limits.half;
 stopFrame();if(matchMedia('(prefers-reduced-motion:reduce)').matches){currentHeight=goalHeight;velocity=0;applyHeight();return}
 let ticks=0;function tick(){velocity=(velocity+(goalHeight-currentHeight)*.115)*.73;currentHeight+=velocity;applyHeight();
  if((Math.abs(goalHeight-currentHeight)<.55&&Math.abs(velocity)<.35)||ticks++>95){currentHeight=goalHeight;velocity=0;frame=0;applyHeight();return}
  frame=requestAnimationFrame(tick)}
 frame=requestAnimationFrame(tick);
}
function headerText(){
 const names={pick:'选择地点',settings:'行程设置',order:'排列顺序',recommend:'推荐顺序',done:'已保存',preview:'查看行程'};
 $('#fpRouteStepTitle').textContent=state.placeCard?'地点详情':state.legDetail!==null?'路段交通':state.mapDraft?'添加地点':(names[state.step]||'路线规划');
 $('#fpRouteStepSummary').textContent=state.placeCard?'':count()+' 地点 · '+dateDays(state.start,state.end)+' 天';
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
function legRow(id,i){
 if(i>=state.order.length-1)return '';
 const a=point(id),b=point(state.order[i+1]),mode=state.legs[id]||state.mode;
 const result=window.__fpLiveRouting?.peek(a,b,mode)||{label:'路段服务待连接'};
 return '<button type="button" class="fp-route-leg-row" data-action="leg" data-index="'+i+'">'+iSvg(modeIcons[mode]||'route')+
   '<span>'+esc(result.label)+'</span><small>设置 ›</small></button>';
}
function modeButtons(){return Object.entries(modeLabels).map(([id,label])=>'<button type="button" class="fp-route-mode" data-action="mode" data-mode="'+id+'" aria-pressed="'+(state.mode===id)+'">'+iSvg(modeIcons[id])+'<span>'+label+'</span></button>').join('')}
function endpointSelect(kind){const val=kind==='from'?state.from:state.to;
 return '<select data-field="'+kind+'" aria-label="'+(kind==='from'?'出发地':'目的地')+'">'+
  '<option value="same" '+(val==='same'?'selected':'')+'>不指定</option>'+
  placeList.map(p=>'<option value="place:'+esc(p.id)+'" '+(val==='place:'+p.id?'selected':'')+'>'+esc(p.title)+'</option>').join('')+'</select>'}
function daysDetails(){const groups=daysGroups();return groups.length?'<div class="fp-route-day-list">'+groups.map(([d,names])=>'<div class="fp-route-day-list-row"><b>D'+d+'</b><span>'+esc(names.join(' · '))+'</span></div>').join('')+'</div>':'<div class="fp-route-empty-hint">还没有地点</div>'}
function emptyDays(){
 const assigned=new Set(state.order.map(id=>Number(state.days[id])||1));
 return Array.from({length:dateDays(state.start,state.end)},(_,i)=>i+1).filter(day=>!assigned.has(day));
}
function dayWarning(){
 const missing=emptyDays();if(!missing.length||!state.order.length)return '';
 const editable=['settings','recommend','order'].includes(state.step);
 return '<div class="fp-route-day-warning" role="status"><span>'+missing.map(d=>'D'+d).join('、')+' 暂无安排'+(editable?'，可保留原计划':'')+'</span>'+
 (editable?'<button type="button" data-action="spread">均匀分天</button>':'')+'</div>';
}
function spreadDays(){
 if(!state.order.length||dateDays(state.start,state.end)<2)return;
 canUndo('已重新分配旅行日');
 const total=dateDays(state.start,state.end),n=state.order.length;
 state.order.forEach((id,i)=>{state.days[id]=Math.min(total,Math.floor(i*total/n)+1)});
 syncRoute();render(true);
}
function calendarWidget(){
 if(!state.datePickerField)return '';
 const month=state.datePickerMonth||state.start.slice(0,7);
 const [yr,mo]=month.split('-').map(Number),start=new Date(yr,mo-1,1);
 const dayOffset=(start.getDay()+6)%7,total=new Date(yr,mo,0).getDate();
 let days='<div class="fp-route-calendar-grid">'+['一','二','三','四','五','六','日'].map(d=>'<span>'+d+'</span>').join('');
 for(let i=0;i<dayOffset;i++)days+='<span></span>';
 for(let d=1;d<=total;d++){
  const iso=yr+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  const invalid=state.datePickerField==='start'?iso>state.end:iso<state.start;
  days+='<button type="button" data-action="chooseDate" data-date="'+iso+'" data-selected="'+(iso===state[state.datePickerField])+'" '+(invalid?'disabled':'')+'>'+d+'</button>';
 }
 return '<div class="fp-route-calendar" aria-label="卡片内日期选择"><div class="fp-route-calendar-head">'+
  '<button type="button" data-action="month" data-offset="-1" aria-label="上个月">‹</button><span>'+yr+' 年 '+mo+' 月</span>'+
  '<button type="button" data-action="month" data-offset="1" aria-label="下个月">›</button></div>'+days+'</div></div>';
}
function chooseDate(date){
 const key=state.datePickerField;
 if(key!=='start'&&key!=='end')return;
 if(key==='start'&&date>state.end||key==='end'&&date<state.start)return;
 canUndo('旅行日期已修改');state[key]=date;state.datePickerField=null;
 normalizeDays();syncRoute();render(true);
}
function changeMonth(offset){
 const [y,m]=(state.datePickerMonth||state.start.slice(0,7)).split('-').map(Number);
 const d=new Date(y,m-1+offset,1);
 state.datePickerMonth=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
 render(true);
}
function distance(a,b){if(!a||!b)return 0;const r=x=>Number(x)*Math.PI/180;
 const network=window.__fpLiveRouting?.metric?.(a,b,state.mode);if(network!=null)return network;
 const x=r(Number(b.lat)-Number(a.lat)),y=r(Number(b.lng)-Number(a.lng)),z=Math.sin(x/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(y/2)**2;
 return 12742*Math.atan2(Math.sqrt(z),Math.sqrt(Math.max(0,1-z)))}
function pathLength(ids){
 let pts=ids.map(point).filter(Boolean),start=point(state.from.replace(/^place:/,'')),end=point(state.to.replace(/^place:/,''));
 let total=0,last=start||pts[0];for(const p of pts){total+=distance(last,p);last=p}if(end&&last)total+=distance(last,end);return total;
}
function suggestion(){
 if(state.order.length<2)return null;const arr=state.order.slice(),start=point(state.from.replace(/^place:/,''))||point(arr[0]);
 const finish=point(state.to.replace(/^place:/,''));const fixedFirst=arr[0],fixedLast=arr.at(-1);
 let remaining=arr.length<=2?[]:arr.slice(1,-1),sorted=[fixedFirst],cur=point(fixedFirst)||start;
 while(remaining.length){let best=0,bestScore=Infinity;remaining.forEach((id,i)=>{const loc=point(id),s=distance(cur,loc)+(remaining.length===1?distance(loc,point(fixedLast)||finish):0);if(s<bestScore){bestScore=s;best=i}});const id=remaining.splice(best,1)[0];sorted.push(id);cur=point(id)}
 if(arr.length>1)sorted.push(fixedLast);
 if(arr.length>3&&arr.length<=10){let improved=true,iterations=0;while(improved&&iterations++<6){improved=false;for(let a=1;a<sorted.length-2;a++)for(let b=a+1;b<sorted.length-1;b++){const trial=sorted.slice();trial.splice(a,b-a+1,...sorted.slice(a,b+1).reverse());if(pathLength(trial)<pathLength(sorted)-.001){sorted=trial;improved=true}}}}
 const before=pathLength(arr),after=pathLength(sorted);
 return {order:after<before-.001?sorted:arr,before,after:Math.min(after,before)};
}
function chain(ids){return '<div class="fp-route-chain">'+ids.slice(0,7).map((id,i)=>'<div class="fp-route-chain-star">'+iconStar+'<span>'+String.fromCharCode(65+i)+'</span></div>'+
 (i<Math.min(7,ids.length)-1?'<span class="fp-route-chain-line"></span>':'')).join('')+'</div>'}
function routeHint(){return '<div class="fp-route-route-overview">'+iSvg('route')+' <span>'+esc(count()+' 地点 · '+dateDays(state.start,state.end)+' 天 · '+modeLabels[state.mode])+'</span></div>'}
function renderBody(){
 if(state.mapDraft){
  return '<p class="fp-route-hint">从地图选择坐标，确认后才加入当前路线。</p>'+
   '<label class="fp-route-map-label">地点名称<input id="fpRouteMapName" maxlength="48" value="'+esc(state.mapDraft.title)+'" placeholder="输入地点名称"></label>'+
   '<p class="fp-route-tiny">位置：'+Number(state.mapDraft.lat).toFixed(5)+'，'+Number(state.mapDraft.lng).toFixed(5)+'</p>';
 }
 if(state.legDetail!==null){
  const a=point(state.order[state.legDetail]),b=point(state.order[state.legDetail+1]);
  if(!a||!b)return '<p>路段已变更</p>';
  const mode=state.legs[a.id]||state.mode,p=window.__fpLiveRouting?.peek(a,b,mode)||{label:'等待路线服务'};
  const nav=window.__fpLiveRouting?.link(a,b,mode)||'',amap=window.__fpLiveRouting?.amapLink(a,b,mode)||'';
  return '<div class="fp-route-mini-heading">'+esc(a.title)+' → '+esc(b.title)+'</div>'+
   '<p class="fp-route-hint">'+esc(p.label)+(mode==='transit'?'（具体班次以导航服务为准）':'（道路用时，非实时交通）')+'</p>'+
   '<div class="fp-route-mode-list">'+Object.keys(modeLabels).map(m=>'<button type="button" class="fp-route-mode" data-action="legmode" data-mode="'+m+'" aria-pressed="'+(m===mode)+'">'+iSvg(modeIcons[m])+'<span>'+modeLabels[m]+'</span></button>').join('')+'</div>'+
   (amap?'<a class="fp-route-nav-out" href="'+amap+'" target="_blank" rel="noopener noreferrer">高德地图 · '+(mode==='transit'?'公交换乘':'导航详情')+' ↗</a>':'')+
   (nav?'<a class="fp-route-nav-out" href="'+nav+'" target="_blank" rel="noopener noreferrer">Google 地图 · '+(mode==='transit'?'公交换乘':'导航详情')+' ↗</a>':'');
 }
 if(state.placeCard){
  const p=point(state.placeCard);
  return p?'<div class="fp-route-point-detail"><div class="fp-route-mini-heading">'+iconStar+' '+esc(p.title)+'</div>'+
   '<div class="fp-route-point-meta">'+esc(p.address||'收藏地点')+'</div>'+
   '<div class="fp-route-point-note">'+esc(p.note||'可把此地点加入规划路线')+'</div></div>':'';
 }
 switch(state.step){
 case 'entry':return '<div class="fp-route-route-overview">'+iSvg('route')+'<span>'+count()+' 地点 · '+dateDays(state.start,state.end)+' 天</span></div>';
 case 'pick':return '<div class="fp-route-pick-modes"><button data-action="pickmode" data-mode="list" aria-pressed="'+(state.pickMode==='list')+'">收藏列表</button><button data-action="pickmode" data-mode="map" aria-pressed="'+(state.pickMode==='map')+'">地图选点</button></div>'+
  (state.pickMode==='map'
   ?'<p class="fp-route-hint">点击上方地图空白位置创建地点，或点击星标查看、添加及移除。</p><p class="fp-route-tiny">当前已选 '+count()+' 地点 · 地图与列表保持同步</p>'
   :'<label class="fp-route-search">'+iSvg('search')+'<input id="fpRoutePlaceSearch" type="search" placeholder="搜索保存的地点…" value="'+esc(state.query)+'" aria-label="搜索收藏地点"></label>'+
    '<div id="fpRoutePlaceRows" class="fp-route-place-list">'+pickList()+'</div>'+
    '<p class="fp-route-tiny">用右侧控件添加或取消，不修改原有收藏。</p>');
 case 'order':return '<div class="fp-route-rowbar"><span class="fp-route-mini-heading">沿途地点</span><span class="fp-route-minor">'+count()+' 站</span></div>'+
  '<div class="fp-route-place-list">'+state.order.map((id,i)=>orderRow(id,i)+legRow(id,i)).join('')+'</div>'+
  '<p class="fp-route-hint">拖动右侧抓手排序，轻点 D1 调整旅行日。</p>'+
  '<button type="button" class="fp-route-choose-next" data-action="backpick">'+iSvg('plus')+' 添加地点</button>';
 case 'settings':return '<label class="fp-route-map-label">路线名称<input id="fpRouteTripName" maxlength="64" value="'+esc(state.title)+'" placeholder="为这条路线命名"></label>'+ 
   '<div class="fp-route-mini-heading">旅行日期</div>'+
  '<div class="fp-route-date-row">'+
  '<button type="button" class="fp-route-date-button" data-action="calendar" data-field="start" aria-pressed="'+(state.datePickerField==='start')+'">'+iSvg('calendar')+fmt(state.start)+'</button>'+
  '<button type="button" class="fp-route-date-button" data-action="calendar" data-field="end" aria-pressed="'+(state.datePickerField==='end')+'">'+iSvg('calendar')+fmt(state.end)+'</button></div>'+calendarWidget()+
  '<div class="fp-route-line">'+
   '<div class="fp-route-field"><label>起点</label>'+endpointSelect('from')+'</div>'+
   '<div class="fp-route-field"><label>终点</label>'+endpointSelect('to')+'</div></div>'+
  '<div class="fp-route-field"><label>主要交通方式</label></div>'+
  '<div class="fp-route-mode-list">'+modeButtons()+'</div>'+dayWarning()+
  '<p class="fp-route-tiny">驾车、步行、骑行按在线道路网络估算；公交换乘通过导航服务查看。未获取的数据不估算。</p>';
 case 'recommend':{
   window.__fpLiveRouting?.prepareMatrix(state.order.map(point).filter(Boolean),state.mode);
   const p=state.proposal||suggestion();state.proposal=p;
  const useful=p&&p.order.join('|')!==state.order.join('|')&&p.before-p.after>Math.max(.6,p.before*.025)&&Math.round(p.before)!==Math.round(p.after);
  return '<div class="fp-route-recommend"><div><div class="fp-route-recommend-title">'+iSvg('star')+
   (useful?' 推荐顺序':' 当前顺序已较合理')+'</div>'+
   '<p class="fp-route-recommend-note">'+(useful?'按道路距离优化，服务暂不可用时仅按直线距离参考（非实时路况）。':'没有明显更短的排列，不必调整。')+'</p></div>'+
   chain(useful?p.order:state.order)+
   (useful?'<p class="fp-route-recommend-note">约 '+Math.round(p.before)+' → '+Math.round(p.after)+' 公里 · 非实际导航里程</p>':'')+
   (useful?'<div class="fp-route-recommend-actions"><button type="button" data-action="keep">保持原顺序</button>'+
   '<button type="button" class="fp-route-gold" data-action="adopt">采用建议</button></div>':'')+'</div>'+dayWarning();
 }
 case 'done':return '<div class="fp-route-check">'+iSvg('check')+'</div>'+
  '<h2 class="fp-route-done-title">已保存</h2>'+
  '<div class="fp-route-mini-heading">'+esc(state.title)+'</div>'+routeHint()+
   '<p class="fp-route-hint">'+esc(fmt(state.start))+' — '+esc(fmt(state.end))+' · 起点 '+esc(endpointName(state.from))+' · 终点 '+esc(endpointName(state.to))+'</p>'+daysDetails();
 case 'preview':return '<div class="fp-route-fixed-summary"><b>'+esc(state.title)+'</b><span>'+count()+' 地点 · '+dateDays(state.start,state.end)+' 天 · '+modeLabels[state.mode]+'</span></div>'+
 '<div class="fp-route-day-tabs"><button data-action="dayview" data-day="0" aria-pressed="'+(!state.dayView)+'">全部</button>'+Array.from({length:Math.min(7,dateDays(state.start,state.end))},(_,i)=>'<button data-action="dayview" data-day="'+(i+1)+'" aria-pressed="'+(state.dayView===i+1)+'">D'+(i+1)+'</button>').join('')+'</div>';
 default:return '';
 }
}
function renderFoot(){
 const pointView=Boolean(state.placeCard),legView=state.legDetail!==null,draft=Boolean(state.mapDraft);
 const back=pointView||legView||draft
   ?'<button class="fp-route-quiet-btn" type="button" data-action="'+(pointView?'closepoint':legView?'closeleg':'cancelmap')+'">'+iSvg('back')+' 返回</button>'
   :['settings','order','recommend'].includes(state.step)?'<button class="fp-route-quiet-btn" type="button" data-action="prev">'+iSvg('back')+' 上一步</button>':'';
 const progress={pick:'1',settings:'2',order:'3',recommend:'4',done:'5'};
 const footRow=back?'<div class="fp-route-foot-row">'+back+'<span class="fp-route-minor">'+(progress[state.step]||'')+' / 5</span></div>':'';
 const actions={pick:['nextpick','下一步 · 行程设置'],settings:['nextsettings','下一步 · 排列顺序'],order:['nextorder','下一步 · 推荐顺序'],recommend:['save','完成并保存'],done:['view','查看行程'],preview:['edit','编辑路线']};
 let pair=actions[state.step]||actions.pick;
 if(pointView)pair=state.step==='preview'?['closepoint','返回行程']:['togglepoint',state.order.includes(state.placeCard)?'从路线移除':'加入路线'];
 if(legView)pair=['closeleg','完成路段设置'];
 if(draft)pair=['confirmmap','添加到路线'];
 const [act,label]=pair;
 const disabled=((act==='nextpick'||act==='save')&&count()<2)||state.saving;
 return (state.undoVisible&&state.undo.length?'<div class="fp-route-undo">'+esc(state.undoLabel)+' · 可撤回</div>':'')+
  (state.saveError?'<p class="fp-route-save-error" role="alert">'+esc(state.saveError)+'</p>':'')+
  footRow+'<button class="fp-route-main-btn" type="button" data-action="'+act+'" '+(disabled?'disabled':'')+'>'+
  (state.saving?'正在保存…':label)+' '+iSvg(act==='view'?'route':'next')+'</button>';
}
function render(preserveScroll=false){
 const scroll=content?.scrollTop||0;document.body.classList.toggle('fp-day-filter',state.step==='preview'&&state.dayView>0);document.body.classList.toggle('fp-route-map-picking',state.step==='pick'&&state.pickMode==='map'&&!state.placeCard);document.body.classList.toggle('fp-route-viewing',state.step==='preview'&&!state.placeCard);headerText();
 content.innerHTML=renderBody();foot.innerHTML=renderFoot();
 const undoButton=$('#fpRouteUndoHead');
 if(undoButton)undoButton.hidden=!state.undo.length||state.step==='preview'||state.step==='done';
 if(preserveScroll)content.scrollTop=scroll;else content.scrollTop=0;
 drawFavorites();
}
function setStep(step){
 state.placeCard=null;state.legDetail=null;state.mapDraft=null;state.step=step;state.saveError='';
 if(step==='recommend')state.proposal=suggestion();
 render();updateRoadDisplay();
 sheet.classList.remove('fp-route-animating');void sheet.offsetWidth;sheet.classList.add('fp-route-animating');
 snap(step==='preview'||step==='done'?'peek':'half');
 // Never cancel the pending selected-route fit when moving from picking to ordering.
 // That used to leave an offscreen line until Save, although the map itself loaded.
 clearTimeout(fitTimer);
 if(['order','preview','done'].includes(step)&&state.order.length)
  fitTimer=setTimeout(()=>fitRoute(),300);
}
function togglePlace(id){id=String(id);if(!point(id))return;canUndo('地点已调整');const n=state.order.indexOf(id);
 if(n>=0){state.order.splice(n,1);delete state.days[id];if(state.from==='place:'+id)state.from='same';if(state.to==='place:'+id)state.to='same'}
 else{state.order.push(id);state.days[id]=clamp(Number(state.days[id])||1,1,dateDays(state.start,state.end))}
 state.proposal=null;syncRoute();render(true);clearTimeout(fitTimer);
 if(state.order.length>1)fitTimer=setTimeout(()=>fitRoute(),220);}
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
 bridge.save(routeRecord()).then(id=>{state.savedId=id;state.undo=[];state.dirty=false;state.saving=false;setStep('done')}).catch(e=>{
  state.saving=false;state.saveError=e?.message||'保存失败，请重试';render(true)
 });
}
function action(name,b){
 switch(name){
 case 'start':setStep('pick');return;
 case 'prev':setStep({settings:'pick',order:'settings',recommend:'order'}[state.step]||'pick');return;
 case 'nextpick':if(count()<2)return;setStep('settings');return;
 case 'nextsettings':setStep('order');return;
 case 'nextorder':if(count()<2)return;setStep('recommend');return;
 case 'backpick':setStep('pick');return;
 case 'pickmode':state.pickMode=b.dataset.mode==='map'?'map':'list';render();snap(state.pickMode==='map'?'peek':'half');return;
 case 'leg':state.legDetail=Number(b.dataset.index);render();snap('half');return;
 case 'legmode':{const id=state.order[state.legDetail];if(!id||!modeLabels[b.dataset.mode])return;canUndo('已更改路段交通');state.legs[id]=b.dataset.mode;syncRoute();render(true);return}
 case 'closeleg':state.legDetail=null;render();snap('half');return;
 case 'cancelmap':state.mapDraft=null;render();snap('peek');return;
 case 'confirmmap':{if(!state.mapDraft)return;const name=String($('#fpRouteMapName')?.value||'').trim();if(!name){state.saveError='请输入地点名称';render(true);return}
  const draft={...state.mapDraft,title:name};state.mapDraft=null;
  window.__fpRouteLiveBridge?.registerPoint?.(draft);
  placeList.push(draft);sourceById.set(draft.id,draft);
  togglePlace(draft.id);render();snap('half');return}
 case 'toggle':togglePlace(b.dataset.id);return;
 case 'day':dayOf(b.dataset.id);return;
 case 'mode':updateMode(b.dataset.mode);return;
 case 'adopt':if(state.proposal){const s=state.proposal;const valid=s.before-s.after>Math.max(.6,s.before*.025)&&Math.round(s.before)!==Math.round(s.after);if(valid&&state.order.join()!==s.order.join()){canUndo('已采用推荐顺序');state.order=s.order.slice();syncRoute()};state.proposal=null;setStep('recommend')}return;
 case 'keep':state.proposal={order:state.order.slice(),before:pathLength(state.order),after:pathLength(state.order)};render(true);return;
 case 'undo':undo();return;
 case 'save':requestSave();return;
 case 'view':if(state.savedId){state.dayView=0;setStep('preview')}return;
 case 'dayview':if(state.step!=='preview')return;state.dayView=Number(b.dataset.day)||0;render(true);drawFavorites();updateRoadDisplay();setTimeout(()=>fitRoute(),100);return;
 case 'edit':setStep('settings');return;
 case 'closepoint':state.placeCard=null;render();snap(state.step==='preview'||(state.step==='pick'&&state.pickMode==='map')?'peek':'half');return;
 case 'togglepoint':if(state.placeCard){const id=state.placeCard;state.placeCard=null;togglePlace(id);if(state.step==='entry'||state.step==='preview'||state.step==='done')setStep('pick')}return;
 case 'calendar':state.datePickerField=state.datePickerField===b.dataset.field?null:b.dataset.field;
  state.datePickerMonth=(state[state.datePickerField]||state.start||'').slice(0,7);render(true);snap('half');return;
 case 'month':changeMonth(Number(b.dataset.offset)||0);return;
 case 'chooseDate':chooseDate(b.dataset.date);return;
 case 'spread':spreadDays();return;
 case 'new':location.assign('./journey.html?new=1');return;
 }
}
function attachHandlers(){
 sheet.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(b){e.preventDefault();action(b.dataset.action,b);return}
  const h=e.target.closest('#fpRouteStepCollapse');if(h){if(state.step==='preview'&&!state.placeCard)return;const l=getDetents();
   const nearest=currentHeight<l.half-20?'half':currentHeight<l.full-45?'full':'peek';snap(nearest)}
 });
 content.addEventListener('input',e=>{
  if(e.target.id==='fpRoutePlaceSearch'){state.query=e.target.value;const list=$('#fpRoutePlaceRows');if(list)list.innerHTML=pickList()}
 });
 content.addEventListener('change',e=>{
   if(e.target.id==='fpRouteTripName'){const name=e.target.value.trim().slice(0,64);if(name&&name!==state.title){canUndo('路线名称已修改');state.title=name;render(true)}return}
   const name=e.target.dataset.field;if(name)updateField(name,e.target.value)
  });
 topbar.addEventListener('click',e=>{
  const btn=e.target.closest('[data-top]');if(!btn)return;
  if(btn.dataset.top==='back'){if(state.dirty&&!confirm('当前路线尚未保存，确定返回地图吗？'))return;location.assign('./index.html')}
  else fitRoute(true);
 });
 head.addEventListener('pointerdown',e=>{
   if(e.target.closest('button')||state.step==='preview'&&!state.placeCard)return;
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
 window.addEventListener('resize',()=>{snap(preferredDetent);drawFavorites()},{passive:true});
 window.visualViewport?.addEventListener('resize',()=>{currentHeight=clamp(currentHeight,getDetents().peek,getDetents().full);applyHeight();drawFavorites()},{passive:true});
}
function openPoint(id){
 const p=point(id);if(!p)return;
 state.placeCard=id;render();snap('half');
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
  node.setAttribute('aria-pressed',String(selected.has(p.id)));
  const pt=map.project([Number(p.lng),Number(p.lat)]);
  const maxY=h-Math.max(currentHeight,getDetents().peek)-12;
  const allowed=state.step!=='preview'||(selected.has(p.id)&&(!state.dayView||Number(state.days[p.id]||1)===state.dayView));
   const inFrame=allowed&&pt&&Number.isFinite(pt.x)&&Number.isFinite(pt.y)&&pt.x>=17&&pt.x<=w-17&&pt.y>=84&&pt.y<=maxY;
  node.hidden=!inFrame;if(inFrame){node.style.left=pt.x+'px';node.style.top=pt.y+'px'}
 }
}
function scheduleFavorites(){if(mapRefresh)return;mapRefresh=requestAnimationFrame(()=>{mapRefresh=0;drawFavorites()})}
function fitRoute(all=false){
 const map=window.__atlasRV?.currentMap;if(!map||typeof map.fitBounds!=='function')return;
 const selected=displayOrder().map(point).filter(Boolean);
 const visible=(all||!selected.length)?placeList.slice(0,45):selected;
 if(visible.length===1){const p=visible[0];map.easeTo?.({center:[Number(p.lng),Number(p.lat)],zoom:10,duration:320});return}
 if(visible.length<2)return;
 const lng=visible.map(p=>Number(p.lng)),lat=visible.map(p=>Number(p.lat));
 const bottom=clamp(goalHeight+24,170,Math.max(170,innerHeight-155));
 map.fitBounds([[Math.min(...lng),Math.min(...lat)],[Math.max(...lng),Math.max(...lat)]],
  {padding:{top:101,right:40,bottom,left:40},maxZoom:12,duration:420});
}
function initMapProjection(){
 let cycles=0;
 function ready(){
  const map=window.__atlasRV?.currentMap;
  if(map&&typeof map.project==='function'&&!mapInstalled){
   mapInstalled=true;map.on?.('move',scheduleFavorites);map.on?.('zoom',scheduleFavorites);
   // Reframe after map data has loaded; calling fitBounds before MapLibre is ready
   // does not reliably adjust its first camera in iOS WebKit.
   if(state.order.length>1){
    const reframe=()=>{if(state.order.length>1)fitRoute()};
    if(map.loaded?.())reframe();else map.once?.('load',reframe);
   }
   map.on?.('click',e=>{
      if(state.step!=='pick'||state.pickMode!=='map'||state.placeCard||state.mapDraft)return;
      if(!e.lngLat||!Number.isFinite(e.lngLat.lat)||!Number.isFinite(e.lngLat.lng))return;
      const id='route-map-'+(crypto.randomUUID?.()||Date.now().toString(36));
      state.mapDraft={id,lat:e.lngLat.lat,lng:e.lngLat.lng,title:'地图选点',address:'',note:'地图选点',routeOnly:true};
      render();snap('half');
    });
   drawFavorites();return
  }
  if(++cycles<130)setTimeout(ready,350)
 }ready();
}
document.addEventListener('fp:route-network-update',()=>{
 if(state.step==='order'&&state.legDetail===null)render(true);
 if(state.step==='recommend'){state.proposal=null;render(true)}
});
window.__fpSixStepRoute={get state(){return {...routeRecord(),step:state.step,savedId:state.savedId,dirty:state.dirty}},
 get visibleHeight(){return currentHeight},step:setStep,snap,undo,fit:fitRoute,openPoint};
window.__fpRouteLiveReady.then(startSheet).catch(e=>console.error('路线加载失败',e));
})();