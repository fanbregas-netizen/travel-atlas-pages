
/* Footprint Map V4 · iPhone route-logic interaction review.
 * Inherits the actual route-view DOM/map, hand-drawn yellow star and route styling.
 * Never writes IndexedDB, localStorage, route repository or the user's saved places.
 */
(function(){
'use strict';
if(!/route-logic-review-20261117\.html$/.test(location.pathname))return;
var body=document.body;
var preset=[
 {id:'ningbo',name:'宁波站',lat:29.868,lng:121.548},
 {id:'wenzhou',name:'温州市区',lat:27.999,lng:120.674},
 {id:'linhai',name:'临海市区',lat:28.851,lng:121.142}
];
var modeLabels={car:'驾车',walk:'步行',bike:'骑行',transit:'公交'};
var modeIcons={
 car:'<svg viewBox="0 0 24 24"><path d="M4 12l1.7-5.2A2 2 0 0 1 7.6 5.4h8.8a2 2 0 0 1 1.9 1.4L20 12v6h-2v-2H6v2H4z"/><path d="M4 12h16M7 14h2m6 0h2"/></svg>',
 walk:'<svg viewBox="0 0 24 24"><circle cx="13" cy="4" r="2"/><path d="M10 21l2-7-3-3 3-3 4 3 2 4M7 16l4-4M15 21l-1-5"/></svg>',
 bike:'<svg viewBox="0 0 24 24"><circle cx="5" cy="17" r="3.3"/><circle cx="19" cy="17" r="3.3"/><path d="M5 17l5-9 4 9h5M10 8h4m-1-3h3"/></svg>',
 transit:'<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 12h14M8 22l3-3m5 3l-3-3M8 7h8M9 15h1m4 0h1"/></svg>'
};
var toolIcons={
 pick:'<svg viewBox="0 0 24 24"><path d="M12 21s7-6.1 7-12a7 7 0 0 0-14 0c0 5.9 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
 order:'<svg viewBox="0 0 24 24"><path d="M5 5h9m-9 7h14M5 19h9M16 4l3 3-3 3M16 16l3 3-3 3"/></svg>',
 mode:modeIcons.car,
 setup:'<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="#fffefa"/><circle cx="16" cy="12" r="2" fill="#fffefa"/><circle cx="11" cy="18" r="2" fill="#fffefa"/></svg>'
};
function el(id){return document.getElementById(id)}
function escapeText(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function find(id){return (window.__fpRoutePreviewData||[]).find(function(p){return String(p.id)===String(id)})}
function unique(a){return Array.from(new Set(a))}
function pad(n){return String(n).padStart(2,'0')}
function dateISO(d){return [d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-')}
function plusDays(day,n){var d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return dateISO(d)}
function daysTotal(){
 var a=new Date(state.start+'T12:00:00'),b=new Date(state.end+'T12:00:00');
 var n=Math.round((b-a)/86400000)+1;
 return Number.isFinite(n)?Math.max(1,Math.min(30,n)):1;
}
function pickOrigin(){
 if(state.from.indexOf('place:')===0)return find(state.from.slice(6))||preset[0];
 return preset.find(function(x){return x.id===state.from})||preset[0];
}
function pickDestination(){
 if(state.to==='same')return pickOrigin();
 if(state.to.indexOf('place:')===0)return find(state.to.slice(6))||preset[1];
 return preset.find(function(x){return x.id===state.to})||preset[1];
}
function endpointName(value,isDestination){
 if(value==='same')return '返回起点';
 if(value.indexOf('place:')===0)return (find(value.slice(6))||{}).title||'已选地点';
 return (preset.find(function(x){return x.id===value})||preset[isDestination?1:0]).name;
}
function km(a,b){
 if(!a||!b)return 0;
 var toRad=function(x){return Number(x)*Math.PI/180};
 var dLat=toRad(b.lat-a.lat),dLon=toRad(b.lng-a.lng);
 var x=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
 return 12742*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));
}
function directDistance(ids){
 var last=pickOrigin(),sum=0;
 ids.forEach(function(id){var p=find(id);if(p){sum+=km(last,p);last=p}});
 sum+=km(last,pickDestination());
 return sum;
}
function snapshot(){
 return {order:state.order.slice(),days:Object.assign({},state.days),from:state.from,to:state.to,mode:state.mode,legs:Object.assign({},state.legs)};
}
function restoreSnapshot(s){
 state.order=s.order.slice();state.days=Object.assign({},s.days);
 state.from=s.from;state.to=s.to;state.mode=s.mode;state.legs=Object.assign({},s.legs);
 window.__fpRoutePreviewMode=state.mode;
 syncRoute();
}
var source=window.__fpRoutePreviewData||[];
var initDate=new Date();initDate.setDate(initDate.getDate()+8);
var begin=dateISO(initDate);
var state={
 order:source.filter(function(p){return p.defaultSelected!==false}).map(function(p){return p.id}),
 days:{},from:'ningbo',to:'wenzhou',start:begin,end:plusDays(begin,2),
 mode:'car',legs:{},locked:new Set(),proposal:null,undo:null,tab:'order',
 panel:false,cardId:null
};
source.forEach(function(p,i){state.days[p.id]=i<2?1:i<4?2:3});
window.__fpRoutePreviewMode=state.mode;
var timer=0,drag=null,card={height:0,velocity:0,frame:0,gesture:null,snap:'peek',current:null};
var anchorMap=null,anchorQueued=false;
function toast(s){
 var t=el('fpRouteToast');if(!t)return;
 clearTimeout(timer);t.textContent=s;t.classList.add('show');
 timer=setTimeout(function(){t.classList.remove('show')},2600);
}
function create(){
 body.classList.add('fp-route-review');
 var badge=document.createElement('div');badge.id='fpRouteBadge';badge.textContent='路线交互演示 · 使用示例地点，不改动收藏';
 document.body.appendChild(badge);
 var tools=document.createElement('div');tools.id='fpRouteTools';
 tools.innerHTML=[
  ['pick','选地点'],['order','推荐顺序'],['mode','交通方式'],['setup','起终点']
 ].map(function(x){return '<button type="button" data-open="'+x[0]+'">'+toolIcons[x[0]]+'<span>'+x[1]+'</span></button>'}).join('');
 (el('stopsDock')||document.body).appendChild(tools);
 var anchors=document.createElement('div');anchors.id='fpRouteAnchors';
 anchors.innerHTML='<svg id="fpRouteAnchorLines" aria-hidden="true"><path id="fpRouteStartLine"></path><path id="fpRouteEndLine"></path></svg>'+
 '<button type="button" id="fpRouteStartPin" aria-label="设置路线起点">起</button><button type="button" id="fpRouteEndPin" aria-label="设置路线终点">终</button>';
 document.body.appendChild(anchors);
 var backdrop=document.createElement('div');backdrop.className='fp-r-backdrop';backdrop.id='fpRoutePanelBackdrop';
 document.body.appendChild(backdrop);
 var panel=document.createElement('section');panel.id='fpRoutePanel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-label','规划路线交互');
 panel.innerHTML='<div class="fp-r-grab"></div><div class="fp-r-panel-head"><strong>规划路线</strong><button class="fp-r-close" type="button" data-close-panel aria-label="关闭">×</button></div>'+
  '<div id="fpRoutePanelTabs">'+
  '<button type="button" data-tab="pick">选地点</button><button type="button" data-tab="order">安排行程</button><button type="button" data-tab="mode">交通方式</button><button type="button" data-tab="setup">行程设置</button>'+
  '</div><div id="fpRoutePanelBody"></div>';
 document.body.appendChild(panel);
 var cover=document.createElement('div');cover.id='fpRouteCardBackdrop';document.body.appendChild(cover);
 var sheet=document.createElement('section');sheet.id='fpRouteCard';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-label','地点详情');
 sheet.innerHTML='<div class="fp-r-card-header" id="fpRouteCardGrip">'+
  '<div class="fp-r-card-handle" aria-hidden="true"></div>'+
  '<div class="fp-r-card-kicker" id="fpRouteCardKicker"></div>'+
  '<h2 class="fp-r-card-name" id="fpRouteCardTitle"></h2>'+
  '<button class="fp-r-card-close" type="button" data-card-close aria-label="关闭地点卡片">×</button></div>'+
  '<div class="fp-r-card-content" id="fpRouteCardContent"></div>'+
  '<div class="fp-r-card-footer"><button type="button" data-card-action="start">设为起点</button><button type="button" data-card-action="destination">设为终点</button><button class="primary" type="button" data-card-action="back">返回路线</button></div>';
 document.body.appendChild(sheet);
 var tip=document.createElement('div');tip.id='fpRouteToast';tip.setAttribute('role','status');document.body.appendChild(tip);
 bind();
}
function renderPanel(){
 var tabs=el('fpRoutePanelTabs'),content=el('fpRoutePanelBody');
 if(!tabs||!content)return;
 tabs.querySelectorAll('button').forEach(function(b){b.classList.toggle('active',b.dataset.tab===state.tab)});
 if(state.tab==='pick')renderPick(content);
 if(state.tab==='order')renderOrder(content);
 if(state.tab==='mode')renderModes(content);
 if(state.tab==='setup')renderSetup(content);
}
function renderPick(root){
 root.innerHTML='<div class="fp-r-section"><h3>选择想去的地点</h3>'+
  '<p class="fp-r-hint">与产品现有地图选点／收藏点流程一致。这里用示例收藏演示添加、移除和线路更新。</p>'+
  '<span class="fp-r-pill">已选 '+state.order.length+' 个地点</span></div>'+
  '<div class="fp-r-section">'+source.map(function(p){
   var chosen=state.order.indexOf(p.id)>=0;
   return '<div class="fp-r-listing"><img src="./icons/active_04_star_saved.svg" alt="">'+
    '<div class="fp-r-stop-main"><strong>'+escapeText(p.title)+'</strong><small>'+escapeText(p.address||'示例地点')+'</small></div>'+
    '<button type="button" class="'+(chosen?'selected':'')+'" data-pick="'+escapeText(p.id)+'">'+(chosen?'已选择':'＋ 加入')+'</button></div>'
  }).join('')+'</div>'+
  '<div class="fp-r-section"><p class="fp-r-note">选择顺序不等于游览顺序。进入「安排行程」后可以接受系统建议或手动拖动。</p></div>';
}
function orderRows(){
 return state.order.map(function(id,i){
  var p=find(id),locked=state.locked.has(id);
  var days=daysTotal(),options='';
  for(var d=1;d<=days;d++)options+='<option value="'+d+'" '+(state.days[id]===d?'selected':'')+'>D'+d+'</option>';
  return '<div class="fp-r-stop" data-row="'+escapeText(id)+'">'+
   '<button type="button" class="fp-r-drag" data-drag="'+escapeText(id)+'" aria-label="按住拖动地点排序">⠿</button>'+
   '<span class="fp-r-num">'+(i+1)+'</span>'+
   '<div class="fp-r-stop-main"><strong>'+escapeText(p?.title||id)+'</strong>'+
   '<small>'+escapeText(p?.address||'')+'</small></div>'+
   '<select aria-label="选择旅行日" class="fp-r-select" style="width:53px;min-width:53px;height:33px;font-size:11px;padding:5px" data-day="'+escapeText(id)+'">'+options+'</select>'+
   '<button class="fp-r-icon-btn '+(locked?'locked':'')+'" data-lock="'+escapeText(id)+'" aria-label="'+(locked?'解除固定':'固定站点')+'">'+(locked?'◆':'◇')+'</button>'+
   '<button class="fp-r-icon-btn" data-move="'+escapeText(id)+'" data-dir="-1" aria-label="上移">↑</button>'+
   '<button class="fp-r-icon-btn" data-move="'+escapeText(id)+'" data-dir="1" aria-label="下移">↓</button>'+
   '</div>'
 }).join('');
}
function renderOrder(root){
 var result='<div class="fp-r-section"><h3>访问顺序</h3>'+
  '<p class="fp-r-hint">起点 <span class="fp-r-strong">'+escapeText(endpointName(state.from,false))+'</span> · '+
  '终点 <span class="fp-r-strong">'+escapeText(endpointName(state.to,true))+'</span> · '+daysTotal()+' 天</p>'+
  '<div class="fp-r-actions"><button class="primary" data-action="recommend" type="button">✧ 系统推荐顺序</button>'+
  '<button type="button" data-action="undo" '+(!state.undo?'disabled':'')+'>↶ 撤销调整</button></div>'+
  '<p class="fp-r-note">优先考虑起终点与地理位置。锁定的站点不会移动；真实路网、营业时间和预约条件暂不参与本交互演示。</p></div>';
 if(state.proposal){
  var proposal=state.proposal;
  var percentage=directDistance(state.order)>0?Math.max(0,Math.round((1-proposal.length/directDistance(state.order))*100)):0;
  result+='<div class="fp-r-section"><h3>系统建议 · 先对比再决定</h3><div class="fp-r-metric">'+
   '<div><small>当前顺序 · 直线合计</small><b>'+Math.round(directDistance(state.order))+' km</b></div><div class="fp-r-arrow">→</div>'+
   '<div><small>推荐顺序 · 直线合计</small><b>'+Math.round(proposal.length)+' km</b></div></div>'+
   '<div class="fp-r-ordered-preview">'+proposal.order.map(function(id,i){return (i+1)+' '+escapeText(find(id)?.title||'')}).join('　›　')+'</div>'+
   '<p class="fp-r-note">该建议比当前直线合计约少 '+percentage+'%。这不等于真实道路节约，也不是实际驾车时间。</p>'+
   '<div class="fp-r-actions"><button type="button" data-action="dismiss">保留原顺序</button><button class="primary" type="button" data-action="apply">采用建议</button></div></div>';
 }
 result+='<div class="fp-r-section"><h3>手动调整</h3>'+
  '<p class="fp-r-note">抓住 ⠿ 排序，或用 ↑ ↓ 微调；D1、D2 可直接修改日期。◇ 可以锁定不想移动的站点。</p>'+
  (state.order.length?orderRows():'<p class="fp-r-hint">还没有选地点，先到「选地点」添加。</p>')+'</div>';
 root.innerHTML=result;
}
function renderModes(root){
 var options=Object.keys(modeLabels).map(function(m){
  return '<button type="button" class="fp-r-mode '+(m===state.mode?'active':'')+'" data-mode="'+m+'">'+modeIcons[m]+'<span>'+modeLabels[m]+'</span></button>'
 }).join('');
 var legs=[];
 for(var i=0;i<state.order.length-1;i++){
  var a=state.order[i],b=state.order[i+1],key=a+'|'+b;
  var value=state.legs[key]||state.mode;
  var selects=Object.keys(modeLabels).map(function(m){return '<option value="'+m+'" '+(m===value?'selected':'')+'>'+modeLabels[m]+'</option>'}).join('');
  legs.push('<div class="fp-r-leg"><div class="fp-r-stop-main"><strong>'+escapeText(find(a)?.title||'')+' → '+escapeText(find(b)?.title||'')+'</strong><small>'+(state.legs[key]?'单段已调整':'跟随主要交通方式')+'</small></div>'+
  '<select data-leg="'+escapeText(key)+'" aria-label="修改这段交通方式">'+selects+'</select></div>');
 }
 root.innerHTML='<div class="fp-r-section"><h3>主要交通方式</h3><div class="fp-r-modes">'+options+'</div>'+
  '<p class="fp-r-hint">先选择整段旅行的主要方式，再针对不同路段单独调整。切换仅演示交互，未接入多模式实时路线服务。</p></div>'+
  '<div class="fp-r-section"><h3>逐路段调整</h3>'+
  '<p class="fp-r-note">例如：驾车到古镇入口，再步行游览。这里的交通方式附着在相邻地点之间。</p>'+legs.join('')+
  '<p class="fp-r-note">步行、骑行、公共交通的道路线与耗时需要相应地图服务支持；当前不展示虚构时间。</p></div>';
}
function endpointOptions(active,isDest){
 var choices=preset.map(function(x){return '<option value="'+x.id+'" '+(active===x.id?'selected':'')+'>'+escapeText(x.name)+'</option>'}).join('');
 if(isDest)choices='<option value="same" '+(active==='same'?'selected':'')+'>返回起点（往返）</option>'+choices;
 source.forEach(function(x){choices+='<option value="place:'+escapeText(x.id)+'" '+(active==='place:'+x.id?'selected':'')+'>'+escapeText(x.title)+'</option>'});
 return choices;
}
function renderSetup(root){
 root.innerHTML='<div class="fp-r-section"><h3>起点和终点</h3>'+
  '<p class="fp-r-note">起点、终点是固定的行程边界，不会被推荐算法自动替换；可以选择往返，也可以在不同城市结束。</p>'+
  '<div class="fp-r-fields"><label class="fp-r-field"><span>从哪里出发</span><select class="fp-r-select" data-setting="from">'+endpointOptions(state.from,false)+'</select></label>'+
  '<label class="fp-r-field"><span>到哪里结束</span><select class="fp-r-select" data-setting="to">'+endpointOptions(state.to,true)+'</select></label></div></div>'+
  '<div class="fp-r-section"><h3>旅行日期</h3>'+
  '<div class="fp-r-fields"><label class="fp-r-field"><span>出发日期</span><input class="fp-r-input" type="date" value="'+escapeText(state.start)+'" data-setting="start"></label>'+
  '<label class="fp-r-field"><span>结束日期</span><input class="fp-r-input" type="date" value="'+escapeText(state.end)+'" data-setting="end"></label></div>'+
  '<p class="fp-r-hint">当前共 '+daysTotal()+' 天。更改天数后，超出范围的站点将顺延至最后一天，并提示检查行程。</p></div>'+
  '<div class="fp-r-section"><h3>方案保存</h3>'+
  '<p class="fp-r-note">正式产品将保存路线、日期、站点顺序和路段交通方式，并继续引用原有收藏内容。这里不会修改你的私人数据。</p>'+
  '<div class="fp-r-actions"><button type="button" data-action="reset">恢复演示初始方案</button><button class="primary" type="button" data-action="preview-save">确认方案（演示）</button></div></div>';
}
function openPanel(tab){
 if(state.cardId)closeCard();
 state.panel=true;state.tab=tab;
 body.classList.add('fp-route-panel-open');renderPanel();
 var root=el('fpRoutePanelBody');if(root)root.scrollTop=0;
}
function closePanel(){state.panel=false;body.classList.remove('fp-route-panel-open');state.proposal=null}
function syncRoute(){
 var api=window.__atlasRV;
 if(api?.setSelection)api.setSelection(state.order,state.days);
 else if(api?.applyOrder)api.applyOrder(state.order);
 updateSummary();scheduleAnchors();
}
function updateSummary(){
 var status=el('fpRouteBadge');
 if(status)status.textContent='交互演示 · '+state.order.length+'站 · '+daysTotal()+'天 · '+modeLabels[state.mode]+' · 不改动收藏';
 var edit=el('routeEditV5');if(edit){edit.textContent='调整路线';edit.setAttribute('aria-label','打开路线规划')}
 window.__atlasRV?.setTripDetails?.({startDate:state.start,endDate:state.end,origin:endpointName(state.from,false),destination:endpointName(state.to,true)});
 scheduleAnchors();
}
function choosePoint(id){
 var idx=state.order.indexOf(id);
 if(idx>=0){
  if(state.order.length===1){toast('至少保留一个地点');return}
  state.order.splice(idx,1);state.locked.delete(id);
  if(state.from==='place:'+id)state.from='ningbo';
  if(state.to==='place:'+id)state.to='wenzhou';
 }else{
  state.order.push(id);
  state.days[id]=Math.min(daysTotal(),Math.max(1,state.order.length-2));
 }
 state.proposal=null;state.undo=null;
 syncRoute();renderPanel();toast(idx>=0?'已从这条路线移除地点':'已加入路线，可继续调整顺序');
}
function moveStop(id,by){
 var ix=state.order.indexOf(id),next=ix+by;
 if(ix<0||next<0||next>=state.order.length)return;
 if(state.locked.has(id)||state.locked.has(state.order[next])){toast('先解除锁定，再调整顺序');return}
 state.undo=snapshot();
 state.order.splice(ix,1);state.order.splice(next,0,id);
 state.proposal=null;syncRoute();renderPanel();
}
function recommendation(){
 if(state.order.length<2){toast('至少选择两个地点才能推荐顺序');return}
 var freePositions=state.order.map(function(id,i){return state.locked.has(id)?-1:i}).filter(function(i){return i>=0});
 var items=freePositions.map(function(i){return state.order[i]});
 var current=state.order.slice(),best=current.slice(),bestLen=directDistance(current),trials=0;
 function scan(prefix,remaining){
  if(!remaining.length){
   var trial=current.slice();
   freePositions.forEach(function(pos,i){trial[pos]=prefix[i]});
   var length=directDistance(trial);trials++;
   if(length<bestLen-.001){bestLen=length;best=trial}
   return;
  }
  for(var i=0;i<remaining.length;i++){
   if(trials>45000)return;
   scan(prefix.concat(remaining[i]),remaining.slice(0,i).concat(remaining.slice(i+1)));
  }
 }
 scan([],items);
 state.proposal={order:best,length:bestLen};
 renderPanel();
 if(best.join('|')===current.join('|'))toast('当前已经接近此示例的最短直线连接顺序');
}
function undo(){
 if(!state.undo)return;
 var s=state.undo;state.undo=null;state.proposal=null;
 restoreSnapshot(s);renderPanel();toast('已恢复调整前的顺序');
}
function apply(){
 if(!state.proposal)return;
 state.undo=snapshot();state.order=state.proposal.order.slice();state.proposal=null;
 syncRoute();renderPanel();toast('已采用推荐顺序，可随时撤销');
}
function reset(){
 state.order=source.filter(function(p){return p.defaultSelected!==false}).map(function(p){return p.id});
 state.days={};source.forEach(function(p,i){state.days[p.id]=i<2?1:i<4?2:3});
 state.from='ningbo';state.to='wenzhou';state.start=begin;state.end=plusDays(begin,2);
 state.mode='car';state.legs={};state.locked.clear();state.proposal=null;state.undo=null;
 window.__fpRoutePreviewMode='car';window.__fpRouteHasNonDrivingLegs=false;
 syncRoute();renderPanel();toast('已恢复演示方案');
}
function changeSetting(type,value){
 if(type==='start'||type==='end'){
  var dateValue=/^\d{4}-\d{2}-\d{2}$/.test(value)?value:null;
  if(!dateValue)return;
  var start=type==='start'?dateValue:state.start,end=type==='end'?dateValue:state.end;
  var n=Math.round((new Date(end+'T12:00:00')-new Date(start+'T12:00:00'))/86400000)+1;
  if(n<1||n>30){toast('日期范围须为 1—30 天，请重新选择');renderPanel();return}
  state[type]=dateValue;
  Object.keys(state.days).forEach(function(id){state.days[id]=Math.min(state.days[id],daysTotal())});
  window.__atlasRV?.setStopDays?.(state.days);
  toast('日期已更新，请检查每日站点分配');
 }else if(type==='from'||type==='to'){state[type]=value;state.proposal=null}
 renderPanel();updateSummary();
}
function onPanelClick(e){
 var n=e.target.closest('[data-tab],[data-close-panel],[data-pick],[data-action],[data-mode],[data-lock],[data-move]');
 if(!n)return;
 if(n.dataset.tab){state.tab=n.dataset.tab;renderPanel();return}
 if(n.hasAttribute('data-close-panel')){closePanel();return}
 if(n.dataset.pick){choosePoint(n.dataset.pick);return}
 if(n.dataset.lock){var id=n.dataset.lock;if(state.locked.has(id))state.locked.delete(id);else state.locked.add(id);renderPanel();return}
 if(n.dataset.move){moveStop(n.dataset.move,Number(n.dataset.dir));return}
 if(n.dataset.mode){state.mode=n.dataset.mode;state.proposal=null;window.__fpRoutePreviewMode=state.mode;
  document.dispatchEvent(new CustomEvent('atlas:route-stops-changed'));renderPanel();updateSummary();toast('已切换主要交通方式（交互演示）');return}
 switch(n.dataset.action){
 case 'recommend':recommendation();break;
 case 'apply':apply();break;
 case 'dismiss':state.proposal=null;renderPanel();break;
 case 'undo':undo();break;
 case 'reset':reset();break;
 case 'preview-save':toast('演示方案已确认，不会修改你的实际路线');break;
 }
}
function onPanelChange(e){
 var n=e.target;
 if(n.dataset.day){state.days[n.dataset.day]=Math.max(1,Math.min(daysTotal(),Number(n.value)||1));
  window.__atlasRV?.setStopDays?.(state.days);
  renderPanel();toast('所属旅行日已更新');return}
 if(n.dataset.leg){state.legs[n.dataset.leg]=n.value;
  window.__fpRouteHasNonDrivingLegs=Object.keys(state.legs).some(function(key){return state.legs[key]!=='car'});
  document.dispatchEvent(new CustomEvent('atlas:route-stops-changed'));
  renderPanel();toast('已单独调整该路段方式（演示）');return}
 if(n.dataset.setting)changeSetting(n.dataset.setting,n.value);
}
function bind(){
 el('fpRouteTools').addEventListener('click',function(e){var b=e.target.closest('[data-open]');if(!b)return;openPanel(b.dataset.open)});
 el('fpRoutePanelBackdrop').addEventListener('click',closePanel);
 el('fpRouteStartPin').addEventListener('click',function(){openPanel('setup')});
 el('fpRouteEndPin').addEventListener('click',function(){openPanel('setup')});
 el('fpRoutePanel').addEventListener('click',onPanelClick);
 el('fpRoutePanel').addEventListener('change',onPanelChange);
 el('fpRoutePanel').addEventListener('pointerdown',onPointerDown);
 el('fpRoutePanel').addEventListener('pointermove',onPointerMove);
 el('fpRoutePanel').addEventListener('pointerup',onPointerUp);
 el('fpRoutePanel').addEventListener('pointercancel',onPointerUp);
 el('fpRouteCardBackdrop').addEventListener('click',closeCard);
 el('fpRouteCard').addEventListener('click',function(e){
  if(e.target.closest('[data-card-close]')){closeCard();return}
  var a=e.target.closest('[data-card-action]');if(!a)return;
  if(a.dataset.cardAction==='back'){closeCard();return}
  var id=state.cardId;
  if(!id)return;
  if(a.dataset.cardAction==='start')state.from='place:'+id;
  if(a.dataset.cardAction==='destination')state.to='place:'+id;
  closeCard();updateSummary();openPanel('setup');
  toast(a.dataset.cardAction==='start'?'已设为路线起点':'已设为路线终点');
 });
 el('fpRouteCardGrip').addEventListener('pointerdown',cardPointerDown);
 el('fpRouteCardGrip').addEventListener('pointermove',cardPointerMove);
 el('fpRouteCardGrip').addEventListener('pointerup',cardPointerUp);
 el('fpRouteCardGrip').addEventListener('pointercancel',cardPointerCancel);
 var edit=el('routeEditV5');
 edit?.addEventListener('click',function(e){e.preventDefault();openPanel('order')},true);
 var map=el('atlasMap');map?.addEventListener('click',function(e){if(!e.target.closest('.route-pin'))closeCard()});
 document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  if(state.cardId){closeCard();e.preventDefault()}
  else if(state.panel){closePanel();e.preventDefault()}
 });
 window.addEventListener('resize',function(){if(state.cardId)snapCard(card.snap)},{passive:true});
}
function onPointerDown(e){
 var grip=e.target.closest('[data-drag]');
 if(!grip)return;
 var id=grip.dataset.drag;
 if(state.locked.has(id)){toast('先解除该地点的锁定');return}
 drag={id:id,pointer:e.pointerId,y:e.clientY,start:e.clientY,over:id,elem:grip.closest('.fp-r-stop')};
 try{grip.setPointerCapture(e.pointerId)}catch(_){}
 e.preventDefault();
}
function onPointerMove(e){
 if(!drag||e.pointerId!==drag.pointer)return;
 var offset=e.clientY-drag.start;
 if(drag.elem)drag.elem.style.transform='translateY('+Math.max(-180,Math.min(180,offset))+'px)';
 var entries=Array.from(el('fpRoutePanelBody').querySelectorAll('[data-row]'));
 var closest=entries.reduce(function(best,n){
  var r=n.getBoundingClientRect(),distance=Math.abs(e.clientY-(r.top+r.bottom)/2);
  return !best||distance<best.distance?{node:n,distance:distance}:best;
 },null);
 entries.forEach(function(n){n.classList.toggle('fp-r-target',closest?.node===n&&n.dataset.row!==drag.id)});
 drag.over=closest?.node?.dataset.row||drag.id;
 e.preventDefault();
}
function onPointerUp(e){
 if(!drag||e.pointerId!==drag.pointer)return;
 if(drag.elem)drag.elem.style.transform='';
 el('fpRoutePanelBody').querySelectorAll('.fp-r-target').forEach(function(n){n.classList.remove('fp-r-target')});
 var orig=drag.id,to=drag.over;drag=null;
 if(orig===to)return;
 if(state.locked.has(to)){toast('目标站点已锁定');return}
 var from=state.order.indexOf(orig),dest=state.order.indexOf(to);
 if(state.order.slice(Math.min(from,dest),Math.max(from,dest)+1).some(function(id){return id!==orig&&state.locked.has(id)})){toast('锁定站点不能被拖动跨越');return}
 if(from<0||dest<0)return;
 state.undo=snapshot();state.order.splice(from,1);state.order.splice(dest,0,orig);
 state.proposal=null;syncRoute();renderPanel();toast('站点顺序已更新');
}
function limits(){
 var vh=window.visualViewport?.height||innerHeight||844;
 return {peek:Math.min(300,Math.max(218,vh*.36)),half:Math.min(vh*.64,520),full:Math.max(540,vh-45)};
}
function stopFrame(){if(card.frame)cancelAnimationFrame(card.frame);card.frame=0}
function paintCard(){var n=el('fpRouteCard');if(n)n.style.setProperty('height',Math.max(180,card.height).toFixed(1)+'px','important')}
function spring(goal){
 stopFrame();
 var reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 if(reduced){card.height=goal;card.velocity=0;paintCard();return}
 var ticks=0;
 function frame(){
  card.velocity=(card.velocity+(goal-card.height)*.105)*.75;
  card.height+=card.velocity;paintCard();
  if((Math.abs(goal-card.height)<.6&&Math.abs(card.velocity)<.35)||ticks++>100){
   card.height=goal;card.velocity=0;card.frame=0;paintCard();return
  }
  card.frame=requestAnimationFrame(frame);
 }
 card.frame=requestAnimationFrame(frame);
}
function snapCard(level){
 if(!state.cardId)return;
 card.snap=level;
 spring(limits()[level]||limits().peek);
}
function showCard(place,index){
 if(!place)return;
 closePanel();
 var other=state.cardId&&state.cardId!==place.id;
 state.cardId=String(place.id);card.current=place;
 var p=place;
 var idIndex=state.order.indexOf(state.cardId);
 el('fpRouteCardKicker').textContent='第 '+(idIndex+1)+' 站 · 第 '+(state.days[p.id]||1)+' 天 · 地点详情';
 el('fpRouteCardTitle').textContent=p.title||p.name||'地点';
 el('fpRouteCardContent').innerHTML=
  '<div class="fp-r-section"><h4>地址</h4><p>'+escapeText(p.address||'地图标记地点')+'</p></div>'+
  '<div class="fp-r-section"><h4>想去原因 · Brief</h4><p>'+escapeText(p.note||p.brief||'这里可以阅读你在主页保存的地点 Brief。')+'</p></div>'+
  '<div class="fp-r-section"><h4>旅行影像</h4><div class="fp-r-card-empty">演示地点没有附带真实照片或视频。正式产品将直接读取此地点原有的媒体内容。</div></div>'+
  '<div class="fp-r-section"><h4>与路线的关系</h4><p>第 '+(state.days[p.id]||1)+' 天，第 '+(idIndex+1)+' 站。可在规划面板修改顺序或交通方式。</p></div>';
 el('fpRouteCardContent').scrollTop=0;
 if(!body.classList.contains('fp-route-place-open')){
  card.height=Math.max(200,limits().peek-38);card.velocity=0;paintCard();
  requestAnimationFrame(function(){body.classList.add('fp-route-place-open');snapCard('peek')});
 }else if(other){snapCard(card.snap)}
 else{snapCard(card.snap)}
}
function closeCard(){
 if(!state.cardId)return;
 stopFrame();card.gesture=null;state.cardId=null;card.current=null;
 body.classList.remove('fp-route-place-open');
}
function cardPointerDown(e){
 if(e.target.closest('button'))return;
 if(!state.cardId||card.gesture)return;
 stopFrame();
 card.gesture={id:e.pointerId,y:e.clientY,start:e.clientY,initial:card.height,last:e.clientY,at:performance.now(),v:0};
 try{el('fpRouteCardGrip').setPointerCapture(e.pointerId)}catch(_){}
}
function cardPointerMove(e){
 var g=card.gesture;if(!g||e.pointerId!==g.id)return;
 var bounds=limits(),dy=e.clientY-g.y,desired=g.initial-dy;
 var h=desired<bounds.peek?bounds.peek-(bounds.peek-desired)*.21:desired>bounds.full?bounds.full+(desired-bounds.full)*.19:desired;
 card.height=h;
 var at=performance.now();g.v=(e.clientY-g.last)/Math.max(8,at-g.at);g.last=e.clientY;g.at=at;
 paintCard();if(e.cancelable)e.preventDefault();
}
function cardPointerUp(e){
 var g=card.gesture;if(!g||e.pointerId!==g.id)return;
 card.gesture=null;
 var bounds=limits(),dy=e.clientY-g.start;
 if(dy>80&&card.height<bounds.peek-12){closeCard();return}
 var arr=['peek','half','full'],best='peek',distance=Infinity;
 arr.forEach(function(level){var dist=Math.abs(bounds[level]-card.height);if(dist<distance){distance=dist;best=level}});
 if(Math.abs(g.v)>.5){var i=arr.indexOf(best);best=arr[Math.max(0,Math.min(2,i+(g.v<0?1:-1)))]}
 snapCard(best);
}
function cardPointerCancel(){if(card.gesture){card.gesture=null;snapCard(card.snap)}}
function scheduleAnchors(){
 if(anchorQueued)return;
 anchorQueued=true;
 requestAnimationFrame(function(){anchorQueued=false;paintAnchors()});
}
function positionPin(id,xy,visible){
 var pin=el(id);if(!pin)return;
 if(!visible){pin.hidden=true;return}
 pin.hidden=false;pin.style.left=xy.x+'px';pin.style.top=xy.y+'px';
}
function paintAnchors(){
 var map=window.__atlasRV?.currentMap||anchorMap;
 var svg=el('fpRouteAnchorLines');if(!svg||!map||typeof map.project!=='function')return;
 var w=innerWidth,h=innerHeight;
 svg.setAttribute('viewBox','0 0 '+w+' '+h);
 var from=pickOrigin(),to=pickDestination();
 var a=map.project([+from.lng,+from.lat]),b=map.project([+to.lng,+to.lat]);
 var first=find(state.order[0]),last=find(state.order[state.order.length-1]);
 var p=first?map.project([+first.lng,+first.lat]):a,q=last?map.project([+last.lng,+last.lat]):b;
 var valid=function(pt){return pt&&Number.isFinite(pt.x)&&Number.isFinite(pt.y)};
 if(![a,b,p,q].every(valid))return;
 el('fpRouteStartLine').setAttribute('d','M '+a.x.toFixed(1)+' '+a.y.toFixed(1)+' L '+p.x.toFixed(1)+' '+p.y.toFixed(1));
 el('fpRouteEndLine').setAttribute('d','M '+q.x.toFixed(1)+' '+q.y.toFixed(1)+' L '+b.x.toFixed(1)+' '+b.y.toFixed(1));
 positionPin('fpRouteStartPin',a,a.x>35&&a.x<w-35&&a.y>145&&a.y<h-175);
 positionPin('fpRouteEndPin',b,b.x>35&&b.x<w-35&&b.y>145&&b.y<h-175);
}
function bindMapProjection(){
 var tries=0;
 function attempt(){
  var map=window.__atlasRV?.currentMap;
  if(map&&typeof map.project==='function'){
   anchorMap=map;
   // Fit the real map ONCE to both fixed endpoints and all selected route stops.
   // This avoids a start pin crowding the navigation header while preserving
   // camera freedom during manual route edits.
   if(!map.__fpRoutePreviewFitted && typeof map.fitBounds==='function'){
    try{
     const pts=[pickOrigin(),pickDestination()].concat(state.order.map(find).filter(Boolean));
     const lat=pts.map(p=>Number(p.lat)),lng=pts.map(p=>Number(p.lng));
     map.fitBounds([[Math.min(...lng),Math.min(...lat)],[Math.max(...lng),Math.max(...lat)]],
       {padding:{top:155,bottom:245,left:46,right:46},duration:330,maxZoom:10});
     map.__fpRoutePreviewFitted=true;
    }catch(_){}
   }
   try{map.on?.('move',scheduleAnchors)}catch(_){}
   try{map.on?.('zoom',scheduleAnchors)}catch(_){}
   scheduleAnchors();return;
  }
  if(++tries<75)setTimeout(attempt,240);
 }
 attempt();
 window.addEventListener('resize',scheduleAnchors,{passive:true});
 document.addEventListener('atlas:route-stops-changed',scheduleAnchors);
}
window.__fpRouteLogicUI={
 openPlace:showCard,
 closePlace:closeCard,
 openPanel:openPanel,
 getState:function(){return {order:state.order.slice(),days:Object.assign({},state.days),mode:state.mode,origin:endpointName(state.from,false),destination:endpointName(state.to,true),panel:state.panel,place:state.cardId}}
};
window.__fpRouteMakeFallbackMap=function(){
 body.classList.add('fp-route-fallback');
 var bg=document.createElement('div');bg.id='fpRouteOffline';
 bg.innerHTML='<svg viewBox="0 0 400 820" preserveAspectRatio="none" aria-hidden="true">'+
 '<rect width="400" height="820" fill="#eaf0e9"/><path d="M312-20 C360 80 290 160 340 250 S295 440 342 520 S320 720 410 840 L420 0Z" fill="#c8e5e5"/>'+
 '<path d="M0 0L108 0Q50 120 124 212L17 330 0 335Z" fill="#d5e6cf"/><path d="M0 480L90 450 166 553 113 710 0 695Z" fill="#d8e8d0"/>'+
 '<g stroke="#fffefa" stroke-width="9" fill="none"><path d="M20 10L160 815"/><path d="M-20 180Q190 200 330 400L415 640"/><path d="M-20 520Q100 460 290 515L405 480"/><path d="M90 0L95 820"/><path d="M245-10Q175 230 235 450T280 830"/></g>'+
 '<g stroke="#c3d0c3" stroke-width="2" fill="none"><path d="M20 10L160 815"/><path d="M-20 180Q190 200 330 400L415 640"/><path d="M-20 520Q100 460 290 515L405 480"/><path d="M245-10Q175 230 235 450T280 830"/></g>'+
 '<g fill="#a1afa3" font-family="Arial" font-size="12"><text x="35" y="122">宁波</text><text x="176" y="315">象山</text><text x="30" y="455">台州</text><text x="215" y="675">温州</text></g></svg><div class="caption">离线示意底图 · 站点与交互仍可验收</div>';
 var canvas=el('atlasMap');canvas?.appendChild(bg);
 return {
  project:function(pair){
   var w=innerWidth,h=innerHeight;
   return {x:(Number(pair[0])-120.55)/(122.0-120.55)*w*.83+w*.08,
    y:(30.10-Number(pair[1]))/(30.10-27.70)*h*.86+h*.04}
  },
  easeTo:function(){},getZoom:function(){return 8},on:function(){},once:function(){},isStyleLoaded:function(){return true},
  loaded:function(){return true},getContainer:function(){return canvas||body},fitBounds:function(){}
 };
};
function initialize(){
 create();updateSummary();bindMapProjection();
 toast('已载入真实产品路线界面 · 可点选黄色星标');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
