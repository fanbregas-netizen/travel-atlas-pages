(function routeCardsV3(){
'use strict';
const screen=document.querySelector('.screen');
if(!screen||window.__batchC)return;
const reduce=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const defs=[
 ['C01','路线入口方式','从收藏或地图选择想去的地点'],
 ['C02','日期与起终点','轻量小卡片、自动匹配、手输与定位入口'],
 ['C03','路线站点排序','抓起、跟手、让位、回弹'],
 ['C04','路线地图站点详情','不遮挡路线的三档详情卡片'],
 ['C05','保存路线／添加停靠点','地图与收藏双入口，即时回显'],
 ['C06','失败、权限与空状态','轻量反馈、重试及恢复']
];
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allPlaces=[
 {id:'p1',name:'平江路',sub:'苏州 · 老城',day:1,brief:'清晨沿河道慢慢走，看看临水街巷。'},
 {id:'p2',name:'拙政园',sub:'苏州 · 园林',day:1,brief:'体会古典园林中的光影与空间。'},
 {id:'p3',name:'金鸡湖',sub:'苏州 · 湖滨',day:2,brief:'傍晚看日落，顺路走走湖岸。'},
 {id:'p4',name:'寒山寺',sub:'苏州 · 收藏',day:2,brief:'在古寺附近散步，看看河岸风景。'},
 {id:'p5',name:'虎丘',sub:'苏州 · 收藏',day:2,brief:'走上旧山路，看塔和周围绿意。'},
 {id:'p6',name:'苏州博物馆',sub:'苏州 · 收藏',day:1,brief:'看看建筑、展览与园林交织的空间。'},
 {id:'p7',name:'山塘街',sub:'苏州 · 地图选点',day:1,brief:'沿街观察水巷建筑与生活场景。'},
 {id:'p8',name:'盘门',sub:'苏州 · 地图选点',day:2,brief:'顺着城墙与水道步行。'},
 {id:'p9',name:'留园',sub:'苏州 · 地图选点',day:2,brief:'记录廊道与庭院的空间转换。'}
];
const pointPositions=[[20,60],[49,27],[78,53],[33,33],[71,19],[87,71],[17,25],[44,77],[65,70]];
function localDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function datePlus(days){const x=new Date();x.setHours(12,0,0,0);x.setDate(x.getDate()+days);return localDate(x)}
function fmt(date){const s=(date||'').split('-');return s.length===3?Number(s[1])+'月'+Number(s[2])+'日':'选择日期'}
function diffDays(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000)+1}
const storeKey='__footprint_v4_batch_c_review_20261111_v1';
let checks={};
try{checks=JSON.parse(localStorage.getItem(storeKey)||'{}')||{}}catch(_){}
checks.C01='ok';
function persist(){try{localStorage.setItem(storeKey,JSON.stringify(checks))}catch(_){}}
persist();
const state={
 active:false,stage:'select',source:'saved',selected:['p1','p2','p3'],
 stops:allPlaces.slice(0,3).map(p=>({...p})),start:datePlus(2),end:datePlus(4),
 originMode:'auto',destinationMode:'auto',origin:'',destination:'',
 routeName:'苏州慢行',saved:false,activeStop:0,newStop:null,undo:null,
 mini:null,miniMode:null,miniSource:'saved',calendarStep:'start',
 calendarMonth:new Date(),errorKind:'offline',errorRecovered:false
};
const toggle=document.createElement('button');
toggle.id='rc-toggle';toggle.textContent='C批 1/6';toggle.setAttribute('aria-label','打开 C 批路线规划交互验收');
const shell=document.createElement('section');shell.id='rc-shell';shell.setAttribute('aria-label','Footprint Map 路线规划 V3');
shell.innerHTML=`<div id="rc-map"><div class="rc-map-caption"><span>路线规划 · V4 卡片交互</span></div><svg class="rc-route" viewBox="0 0 100 100" preserveAspectRatio="none"></svg><div id="rc-map-pins"></div></div>
<section id="rc-main" aria-label="路线主卡片"><div id="rc-grab"><div class="rc-handle"></div><div class="rc-upper"><div><small class="rc-eyebrow" id="rc-step"></small><h2 id="rc-title"></h2><small class="rc-byline" id="rc-subtitle"></small></div><button type="button" data-rc="close" class="rc-dismiss" aria-label="关闭规划">×</button></div></div><div id="rc-body"></div><footer id="rc-footer"></footer></section>
<div id="rc-mini-layer"><button type="button" id="rc-mini-mask" data-rc="mini-close" aria-label="关闭次级卡片"></button><section id="rc-mini"><div id="rc-mini-grab"><div class="rc-handle"></div><h3 id="rc-mini-title"></h3><p id="rc-mini-caption"></p></div><div id="rc-mini-body"></div><footer id="rc-mini-bottom"></footer></section></div>
<div id="rc-toast" role="status" aria-live="polite"></div>`;
const review=document.createElement('section');review.id='rc-review';
review.innerHTML=`<div class="rc-review-mask" data-review="close"></div><div class="rc-review-sheet"><header><div><strong>第二轮 · C 批</strong><p>第一轮 17/17、A 6/6、B 6/6 已锁定。<br>只复验路线规划与异常状态。</p></div><button data-review="close" aria-label="关闭验收面板">×</button></header><div class="rc-review-list" id="rc-review-list"></div><footer><button data-review="reset">清空未通过标记</button><button data-review="copy">复制 C 批结果</button></footer></div>`;
const mapArt=document.querySelector('#map .map-art');
if(mapArt){const clone=mapArt.cloneNode(true);clone.removeAttribute('id');shell.querySelector('#rc-map').prepend(clone)}
else shell.querySelector('#rc-map').style.background='linear-gradient(155deg,#e5eee3,#dce7dc)';
screen.append(toggle,shell,review);
const el=id=>shell.querySelector('#'+id);
const body=el('rc-body'),footer=el('rc-footer'),main=el('rc-main'),routeMap=el('rc-map'),miniLayer=el('rc-mini-layer'),miniSheet=el('rc-mini');
const button=(name,action,cls='rc-soft')=>`<button type="button" class="${cls}" data-rc="${action}">${name}</button>`;
const counts=()=>{const a=defs.map(([id])=>checks[id]||'todo');return {ok:a.filter(x=>x==='ok').length,issue:a.filter(x=>x==='issue').length,remaining:a.filter(x=>x==='todo').length}};
function report(){const n=counts();return `Footprint Map V4｜第二轮 C 批路线与异常状态验收\n已确认：${n.ok}/6；需修改：${n.issue}；未标记：${n.remaining}\n`+defs.map((d,i)=>`${i+1}. ${d[1]}：${checks[d[0]]==='ok'?'通过':checks[d[0]]==='issue'?'需要修改':'待验收'}`).join('\n')+'\n\n说明：第一轮17/17 + A批6/6 + B批6/6 已通过；C批为独立交互原型，真实跨模块路线功能仍待验证。'}
function renderReview(){
 const n=counts();toggle.textContent=`C批 ${n.ok}/6`;
 review.querySelector('#rc-review-list').innerHTML=defs.map(([id,name,desc])=>`<article class="rc-review-row"><small>${id}</small><div><b>${name}</b><p>${desc}</p></div><button data-review="open-${id}">打开</button><button class="mark" data-review="mark-${id}" data-mark="${checks[id]||'todo'}" ${id==='C01'?'disabled':''}>${checks[id]==='ok'?'✓':checks[id]==='issue'?'!':'○'}</button></article>`).join('')+`<p class="rc-fineprint" style="padding:9px">C01 已由用户确认。V3 仅改变隔离预览，不读取或覆盖真实 IndexedDB。所有真实地图路线计算与 iPhone Safari 手感仍需验收。</p>`;
}
renderReview();
function toast(msg){
 const t=el('rc-toast');t.textContent=msg;t.classList.add('is-on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('is-on'),1900);
}
function smoothEntry(node){
 if(!node||reduce()||!node.animate)return;
 node.animate([{opacity:.4,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,easing:'cubic-bezier(.18,.94,.2,1)'});
}
function autoName(which){
 const p=which==='origin'?state.stops[0]:state.stops.at(-1);
 return p?.name||'未选择';
}
function nameFor(which){
 const mode=state[which+'Mode'];
 if(mode==='current')return '当前位置 · 待授权';
 if(mode==='manual')return state[which]||'输入地址';
 return autoName(which);
}
function snapFractions(){
 if(state.stage==='preview')return {peek:.34,half:.49,full:.64};
 if(state.stage==='order')return {peek:.48,half:.69,full:.85};
 if(state.stage==='select')return {peek:.47,half:.67,full:.81};
 return {peek:.45,half:.63,full:.77};
}
let height=0,targetHeight=0,sheetMotion=0,sheetVelocity=0,sheetLevel='half',gesture=null,drag=null,miniGesture=null;
const screenH=()=>screen.clientHeight||844;
function snapPx(level){return Math.round(screenH()*(snapFractions()[level]||.58))}
function paintHeight(h){height=h;main.style.height=Math.round(h)+'px';routeMap.style.bottom=Math.max(0,Math.round(h))+'px'}
function springTo(target){
 cancelAnimationFrame(sheetMotion);
 targetHeight=target;
 if(reduce()){sheetVelocity=0;paintHeight(target);return}
 function tick(){
  sheetVelocity=(sheetVelocity+(targetHeight-height)*.105)*.75;
  paintHeight(height+sheetVelocity);
  if(Math.abs(targetHeight-height)<.65&&Math.abs(sheetVelocity)<.4){paintHeight(targetHeight);sheetVelocity=0;sheetMotion=0;return}
  sheetMotion=requestAnimationFrame(tick);
 }
 sheetMotion=requestAnimationFrame(tick);
}
function snap(level){
 sheetLevel=level;
 const choices=snapFractions();
 if(!choices[level])level='half';
 springTo(snapPx(level));
}
function mainGestureBounds(){const v=snapFractions();return [snapPx('peek'),snapPx('full')]}
function rubber(value,min,max){
 if(value<min)return min-(min-value)*.21;
 if(value>max)return max+(value-max)*.19;
 return value;
}
function selectMarkup(){
 const pool=state.source==='saved'?allPlaces.slice(0,6):allPlaces.slice(3);
 return `<p class="rc-note">从收藏或地图添加地点；至少选择两个。你可以直接点击地点，不需要先进入复杂的设置页。</p>
 <div class="rc-tabs"><button data-rc="source-saved" class="${state.source==='saved'?'is-active':''}">☆ 从收藏选择</button><button data-rc="source-map" class="${state.source==='map'?'is-active':''}">⌖ 地图选点</button></div>
 <div class="rc-rowhead"><span class="rc-section">想去的地方</span><small class="rc-note">已选 ${state.selected.length} 处</small></div>
 ${pool.map(p=>`<div class="rc-stop ${state.selected.includes(p.id)?'selected':''}"><span class="rc-index">${state.selected.includes(p.id)?'✓':'＋'}</span><div class="rc-name"><strong>${safe(p.name)}</strong><small>${safe(p.sub)}</small></div><button class="rc-select ${state.selected.includes(p.id)?'is-on':''}" data-rc="pick-${p.id}" aria-label="${state.selected.includes(p.id)?'移除':'选择'}${safe(p.name)}">${state.selected.includes(p.id)?'✓':'＋'}</button></div>`).join('')}
 <p class="rc-fineprint">地图入口仅模拟 POI 选择，不创建第二颗黄色星标。</p>`;
}
function orderMarkup(){
 return `<div class="rc-meta">
 <button data-rc="mini-date"><small>旅行日期</small><b>${fmt(state.start)} — ${fmt(state.end)} ▾</b></button>
 <button data-rc="mini-origin"><small>出发地 · 点按调整</small><b>${safe(nameFor('origin'))} ▾</b></button>
 <button data-rc="mini-destination"><small>目的地 · 点按调整</small><b>${safe(nameFor('destination'))} ▾</b></button>
 <button data-rc="stage-select"><small>已选择地点</small><b>${state.stops.length} 个 · 添加 / 删除 ↗</b></button>
 </div>
 <div class="rc-rowhead"><span class="rc-section">路线顺序</span><small class="rc-note">抓住 ⠿ 上下拖动</small></div>
 <div id="rc-order-list">${state.stops.map((p,i)=>`<div class="rc-stop ${state.newStop===p.id?'new':''}" data-stop-id="${p.id}"><span class="rc-grip-icon" data-drag="${i}" role="button" tabindex="0" aria-label="拖动第 ${i+1} 站">⠿</span><span class="rc-index">${i+1}</span><div class="rc-name"><strong>${safe(p.name)}</strong><small>${safe(p.sub)} · D${p.day}</small></div></div>`).join('')}</div>
 <div class="rc-summary">${state.stops[0]?.name||'起点'} → ${state.stops.at(-1)?.name||'终点'}<br><span style="color:#8ca18c;font-size:10px">默认自动匹配首末站；也可选择当前位置或输入地址。</span></div>
 ${state.undo?button('↶ 撤销上一次排序','undo','rc-soft'):''}`;
}
function previewMarkup(){
 const p=state.stops[Math.min(state.activeStop,state.stops.length-1)]||state.stops[0];
 if(!p)return `<p class="rc-note">没有站点。请先从地图或收藏中选点。</p>`;
 return `<div class="rc-shortcut"><b>第 ${state.activeStop+1} 站 · ${safe(p.name)}</b><small>第 ${p.day} 天</small></div>
 <p class="rc-preview-brief">${safe(p.brief)}</p>
 <div class="rc-meta">
 <button data-rc="mini-date"><small>旅行日期</small><b>${fmt(state.start)} — ${fmt(state.end)}</b></button>
 <button data-rc="stage-order"><small>站点顺序</small><b>共 ${state.stops.length} 站 · 调整 ↗</b></button></div>
 <div class="rc-summary">出发：${safe(nameFor('origin'))}<br>终点：${safe(nameFor('destination'))}</div>
 ${state.newStop?`<div class="rc-summary">✓ 已添加 ${safe(allPlaces.find(p=>p.id===state.newStop)?.name||'站点')}，路线图已即时更新。</div>`:''}
 <p class="rc-fineprint">路线连线和点位为交互演示，不代表道路导航计算。展开详情仍会保留上方地图。</p>`;
}
function errorMarkup(){
 const errs=[['offline','地图加载失败','重试而不清空已选站点'],['permission','定位被拒绝','仍可手动选地点'],['empty','尚未选择地点','引导返回选点'],['loading','路线加载中','允许取消与退出']];
 return `<p class="rc-note">异常不应盖住地图或导致数据消失。只呈现一张简洁反馈卡片，保留重试和手动继续。</p>
 ${errs.map(([k,title,desc])=>`<div class="rc-error-item"><strong>${title}</strong><p>${desc}</p><button data-rc="error-${k}">预览状态 ›</button></div>`).join('')}
 <p class="rc-fineprint">所有异常都是模拟状态，没有实际网络请求或定位授权。</p>`;
}
function mapRender(){
 const label=routeMap.querySelector('.rc-map-caption span'),svg=routeMap.querySelector('svg.rc-route'),pins=routeMap.querySelector('#rc-map-pins');
 const pts=state.stops.slice(0,9).map((p,i)=>pointPositions[i]);
 if(state.stage==='preview'||state.stage==='order'){
  label.textContent=state.stage==='preview'?`路线预览 · ${state.stops.length} 站`:`路线草稿 · ${state.stops.length} 站`;
  svg.innerHTML=`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" stroke="#fffdf7" stroke-width="2.5" fill="none" opacity=".95" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${pts.map(p=>p.join(',')).join(' ')}" stroke="#597f62" stroke-width="1.15" fill="none" stroke-linecap="round" stroke-dasharray="2 2.5"/>`;
  pins.innerHTML=state.stops.slice(0,9).map((p,i)=>`<button class="rc-pin ${i===state.activeStop?'rc-current':''}" style="left:${pts[i][0]}%;top:${pts[i][1]}%" data-rc="pin-${i}" aria-label="查看 ${safe(p.name)}">${i+1}</button>`).join('');
 }else{
  label.textContent=state.stage==='select'?'先选择地点 · 路线随后出现':'异常与恢复 · 保留已选择地点';
  svg.innerHTML='';pins.innerHTML='';
 }
}
function renderStage(){
 const stage=state.stage;
 el('rc-step').textContent=stage==='select'?'ROUTE / 01':stage==='order'?'ROUTE / 02':stage==='preview'?'ROUTE / 03':'ROUTE / RECOVERY';
 el('rc-title').textContent=stage==='select'?'选几个想去的地方':stage==='order'?'安排站点顺序':stage==='preview'?'路线预览':'故障与恢复';
 el('rc-subtitle').textContent=stage==='select'?'轻点收藏或地图，开始规划':stage==='order'?'拖动排序 · 日期和地址轻点即可编辑':stage==='preview'?'轻扫卡片读详情，地图始终可见':'操作可撤销，也可以安全退出';
 body.innerHTML=stage==='select'?selectMarkup():stage==='order'?orderMarkup():stage==='preview'?previewMarkup():errorMarkup();
 footer.innerHTML=stage==='select'?button('取消','close')+button('安排站点  →','stage-order','rc-primary'):
 stage==='order'?button('‹ 选点','stage-select')+button('查看路线  →','stage-preview','rc-primary'):
 stage==='preview'?button('＋','mini-add','rc-soft rc-icon-btn')+button(state.saved?'✓ 已保存（演示）':'保存路线','mini-save','rc-primary'):
 button('‹ 返回路线','stage-preview')+button('继续选择地点','stage-select','rc-primary');
 mapRender();body.scrollTop=0;smoothEntry(body);
}
function setStage(stage){
 if(stage==='order'&&state.stops.length<2){toast('请至少选择两处地点');return}
 if(stage==='preview'&&state.stops.length<2){toast('至少选择两处地点才能预览');return}
 state.stage=stage;state.activeStop=Math.max(0,Math.min(state.activeStop,state.stops.length-1));
 renderStage();snap(stage==='preview'?'peek':stage==='order'?'half':'half');
}
function openFor(id){
 if(review.classList.contains('open'))review.classList.remove('open');
 if(window.__batchB?.exit)window.__batchB.exit();
 if(window.__batchA?.exit)window.__batchA.exit();
 if(window.__acceptanceV4?.hide)window.__acceptanceV4.hide();
 state.active=true;document.body.classList.add('rc-v3-on');
 const stage=id==='C01'?'select':id==='C02'||id==='C03'?'order':id==='C04'||id==='C05'?'preview':'error';
 shell.classList.add('rc-active');state.stage=stage;renderStage();
 paintHeight(snapPx(stage==='preview'?'peek':'half'));sheetLevel=stage==='preview'?'peek':'half';
 if(id==='C02')setTimeout(()=>{if(state.active&&state.stage==='order')openMini('date')},380);
 if(id==='C05')setTimeout(()=>{if(state.active&&state.stage==='preview')openMini('add')},380);
}
function closeAll(){
 closeMini(true);
 state.active=false;shell.classList.remove('rc-active');document.body.classList.remove('rc-v3-on');
 cancelAnimationFrame(sheetMotion);gesture=null;drag=null;
}
function showReview(){
 closeAll();renderReview();review.classList.add('open');
}
const miniTitle=el('rc-mini-title'),miniCaption=el('rc-mini-caption'),miniBody=el('rc-mini-body'),miniBottom=el('rc-mini-bottom');
function miniBase(title,caption,content,buttons=''){
 miniTitle.textContent=title;miniCaption.textContent=caption;
 miniBody.innerHTML=content;miniBottom.innerHTML=buttons;
}
function calendarBody(){
 const d=state.calendarMonth,year=d.getFullYear(),month=d.getMonth();
 const first=(new Date(year,month,1).getDay()+6)%7,total=new Date(year,month+1,0).getDate();
 const today=datePlus(0),selected=state.calendarStep==='start'?state.start:state.end;
 let days='';for(let i=0;i<first;i++)days+='<span></span>';
 for(let i=1;i<=total;i++){
  const v=localDate(new Date(year,month,i));
  const disabled=v<today||(state.calendarStep==='end'&&v<state.start);
  const chosen=v===selected;
  days+=`<button data-rc="date-pick-${v}" class="${chosen?'picked':''} ${v===today?'today':''}" ${disabled?'disabled':''}>${i}</button>`;
 }
 return `<p class="rc-calendar-hint">${state.calendarStep==='start'?'① 选择出发日期':'② 选择结束日期'}　·　${fmt(state.start)} — ${fmt(state.end)}</p>
 <div class="rc-calendar-head"><button data-rc="month-prev" aria-label="上个月">‹</button><b>${year}年 ${month+1}月</b><button data-rc="month-next" aria-label="下个月">›</button></div>
 <div class="rc-week">${'一二三四五六日'.split('').map(x=>`<span>${x}</span>`).join('')}</div><div class="rc-cal">${days}</div><p class="rc-fineprint">今天以前及不符合顺序的日期灰显不可选择。</p>`;
}
function edgeContent(which){
 const origin=which==='origin',mode=state[which+'Mode'];
 return `<div class="rc-section">${origin?'当前出发地':'当前目的地'}：${safe(nameFor(which))}</div>
 <button class="rc-choice ${mode==='auto'?'selected':''}" data-rc="edge-auto"><span>按${origin?'首':'末'}站自动匹配</span><span class="rc-check">${mode==='auto'?'✓':'○'}</span></button>
 <button class="rc-choice ${mode==='current'?'selected':''}" data-rc="edge-current"><span>⌖ 使用当前位置</span><span class="rc-check">${mode==='current'?'✓':'○'}</span></button>
 <button class="rc-choice ${mode==='manual'?'selected':''}" data-rc="edge-manual"><span>输入城市或具体地址</span><span class="rc-check">${mode==='manual'?'✓':'○'}</span></button>
 ${mode==='manual'?`<label class="rc-form-field">地址<input id="rc-edge-input" value="${safe(state[which])}" placeholder="输入城市、车站或地址" maxlength="80"></label>`:''}
 <p class="rc-fineprint">“当前位置”仅为交互入口，真实产品需单独获得定位权限。</p>`;
}
function addContent(){
 const pool=state.miniSource==='saved'?allPlaces.slice(3,6):allPlaces.slice(6,9);
 return `<div class="rc-tabs"><button data-rc="add-source-saved" class="${state.miniSource==='saved'?'is-active':''}">☆ 从收藏添加</button><button data-rc="add-source-map" class="${state.miniSource==='map'?'is-active':''}">⌖ 地图选点</button></div>
 <p class="rc-note">点击即加入当前路线，并在卡片和地图中即时显示。</p>
 ${state.miniSource==='map'?`<div class="rc-mini-map">${document.querySelector('#map .map-art')?.outerHTML||''}${pool.map((p,i)=>`<button style="left:${[23,54,77][i]}%;top:${[65,38,69][i]}%" data-rc="add-${p.id}" aria-label="从地图加入${safe(p.name)}">${safe(p.name)}</button>`).join('')}</div>`:''}
 ${pool.map(p=>`<button class="rc-choice" data-rc="add-${p.id}" ${state.stops.some(x=>x.id===p.id)?'disabled':''}><span><b>${safe(p.name)}</b><br><small>${safe(p.sub)}</small></span><span class="rc-check">${state.stops.some(x=>x.id===p.id)?'已添加':'＋'}</span></button>`).join('')}
 <p class="rc-fineprint">这里展示示意地点，真实地图取点与 POI 搜索仍由地图模块集成。</p>`;
}
function errorContent(){
 const variants={
 offline:['地图暂时无法连接','保留已选站点。网络恢复后可重试，不会清空内容。'],
 permission:['暂时无法使用当前位置','你可以不授权定位，继续手动输入出发地。'],
 empty:['路线还没有站点','从收藏或地图加入至少两处地点，即可继续规划。'],
 loading:['正在尝试加载路线','加载时仍可返回编辑，不显示全屏遮挡。']
 };
 const v=variants[state.errorKind]||variants.offline;
 return `<div class="rc-error-item"><strong>${v[0]}</strong><p>${v[1]}</p></div>
 <div class="rc-summary">当前为交互模拟，不会实际联网、请求定位权限或覆盖已保存数据。</div>`;
}
function openMini(kind){
 if(!state.active)return;
 clearTimeout(closeMini.t);
 state.mini=kind;
 if(kind==='date'){
  state.calendarStep='start';
  const base=new Date((state.start<datePlus(0)?datePlus(0):state.start)+'T12:00:00');
  state.calendarMonth=new Date(base.getFullYear(),base.getMonth(),1);
  miniBase('旅行日期','选择完成后自动回到路线卡片',calendarBody(),button('完成','mini-close','rc-primary'));
 }else if(kind==='origin'||kind==='destination'){
  state.miniMode=kind;
  miniBase(kind==='origin'?'设置出发地':'设置目的地','默认随路线首末站自动匹配',edgeContent(kind),button('完成','edge-done','rc-primary'));
 }else if(kind==='add'){
  miniBase('添加停靠点','从收藏或地图添加，路线即时更新',addContent(),button('返回路线','mini-close','rc-soft'));
 }else if(kind==='save'){
  miniBase('保存路线','一项操作完成后，卡片自然收回',`<label class="rc-form-field">路线名称<input id="rc-save-name" maxlength="55" value="${safe(state.routeName)}"></label><p class="rc-summary">${state.stops.length} 站 · ${fmt(state.start)} — ${fmt(state.end)}<br>${safe(nameFor('origin'))} → ${safe(nameFor('destination'))}</p><p class="rc-fineprint">仅在当前演示页模拟保存，不写入真实数据库。</p>`,button('取消','mini-close')+button('确认保存','save-confirm','rc-primary'));
 }else if(kind==='error'){
  miniBase('恢复选项','保持路线内容，不触发真实权限请求',errorContent(),button('手动继续','error-manual')+button('重试','error-retry','rc-primary'));
 }
 miniLayer.classList.add('is-open');
 if(!reduce())smoothEntry(miniBody);
}
function refreshMini(){
 if(state.mini==='date')miniBody.innerHTML=calendarBody();
 if(state.mini==='add')miniBody.innerHTML=addContent();
 if(state.mini==='origin'||state.mini==='destination')miniBody.innerHTML=edgeContent(state.mini);
 if(state.mini==='error')miniBody.innerHTML=errorContent();
}
function closeMini(immediate=false){
 if(!state.mini&&!miniLayer.classList.contains('is-open'))return;
 state.mini=null;miniLayer.classList.remove('is-open');
 miniSheet.style.transform='';
 clearTimeout(closeMini.t);
 if(immediate){miniLayer.classList.remove('is-open');return}
 closeMini.t=setTimeout(()=>{miniBody.innerHTML=''},490);
}
function chooseDate(v){
 const today=datePlus(0);
 if(v<today||(state.calendarStep==='end'&&v<state.start))return;
 if(state.calendarStep==='start'){
  state.start=v;if(state.end<v)state.end=v;
  state.calendarStep='end';refreshMini();
 }else{
  const span=diffDays(state.start,v);
  if(span>30){toast('演示最多支持 30 天行程');return}
  state.end=v;renderStage();
  closeMini();toast('旅行日期已更新');
 }
}
function addStop(id){
 const p=allPlaces.find(x=>x.id===id);
 if(!p)return;
 if(state.stops.some(x=>x.id===id)){toast('此地点已经在路线中');return}
 state.stops.push({...p});state.newStop=p.id;state.activeStop=state.stops.length-1;
 closeMini();renderStage();toast('已加入 '+p.name+' · 路线同步更新');
}
function handleAction(cmd){
 if(cmd==='close'){closeAll();return}
 if(cmd==='mini-close'){closeMini();return}
 if(cmd==='source-saved'||cmd==='source-map'){state.source=cmd.slice(7);renderStage();return}
 if(cmd.startsWith('pick-')){
  const id=cmd.slice(5);state.selected=state.selected.includes(id)?state.selected.filter(x=>x!==id):[...state.selected,id];
  state.stops=state.selected.map(i=>allPlaces.find(p=>p.id===i)).filter(Boolean).map(p=>({...p}));
  state.undo=null;renderStage();return;
 }
 if(cmd==='stage-select'||cmd==='stage-order'||cmd==='stage-preview'){setStage(cmd.slice(6));return}
 if(cmd==='mini-date'){openMini('date');return}
 if(cmd==='mini-origin'||cmd==='mini-destination'){openMini(cmd.slice(5));return}
 if(cmd==='mini-add'||cmd==='mini-save'){openMini(cmd.slice(5));return}
 if(cmd==='month-prev'||cmd==='month-next'){
  const d=state.calendarMonth;
  const m=new Date(d.getFullYear(),d.getMonth()+(cmd==='month-prev'?-1:1),1);
  if(cmd==='month-prev'&&localDate(new Date(m.getFullYear(),m.getMonth()+1,0))<datePlus(0))return;
  state.calendarMonth=m;refreshMini();return;
 }
 if(cmd.startsWith('date-pick-')){chooseDate(cmd.slice(10));return}
 if(cmd.startsWith('edge-')){
  const mode=cmd.slice(5),which=state.miniMode;
  if(!which)return;
  state[which+'Mode']=mode;
  if(mode==='current')state[which]='当前位置 · 待授权';
  if(mode==='manual'&&state[which]==='当前位置 · 待授权')state[which]='';
  refreshMini();
  if(mode==='manual')miniBody.querySelector('#rc-edge-input')?.focus();
  else if(mode==='auto'||mode==='current'){closeMini();renderStage()}
  return;
 }
 if(cmd==='edge-done'){
  const which=state.miniMode;
  if(state[which+'Mode']==='manual'){
   const v=miniBody.querySelector('#rc-edge-input')?.value.trim()||'';
   if(!v){toast('请先输入地址');return}
   state[which]=v;
  }
  closeMini();renderStage();return;
 }
 if(cmd==='add-source-saved'||cmd==='add-source-map'){state.miniSource=cmd.slice(11);refreshMini();return}
 if(cmd.startsWith('add-')){addStop(cmd.slice(4));return}
 if(cmd==='save-confirm'){
  const v=miniBody.querySelector('#rc-save-name')?.value.trim()||'';
  if(!v){toast('请输入路线名称');return}
  state.routeName=v;state.saved=true;closeMini();renderStage();toast('路线已保存（演示数据）');return;
 }
 if(cmd.startsWith('pin-')){
  state.activeStop=Number(cmd.slice(4));if(state.stage==='preview'){renderStage();snap('peek')}return;
 }
 if(cmd==='undo'){
  if(!state.undo)return;
  state.stops=state.undo.map(p=>({...p}));state.undo=null;renderStage();toast('已恢复上一次顺序');return;
 }
 if(cmd.startsWith('error-')){
  state.errorKind=cmd.slice(6);state.errorRecovered=false;openMini('error');return;
 }
 if(cmd==='error-retry'){state.errorRecovered=true;closeMini();toast('示意恢复成功：内容已保留');return}
 if(cmd==='error-manual'){closeMini();setStage('order');return}
}
toggle.addEventListener('click',showReview);
review.addEventListener('click',async e=>{
 const b=e.target.closest('button[data-review],.rc-review-mask');if(!b)return;
 const a=b.dataset.review;if(!a)return;
 if(a==='close'){review.classList.remove('open');return}
 if(a.startsWith('open-')){openFor(a.slice(5));return}
 if(a.startsWith('mark-')){
  const id=a.slice(5);if(id==='C01')return;
  const curr=checks[id]||'todo';if(curr==='todo')checks[id]='ok';else if(curr==='ok')checks[id]='issue';else delete checks[id];
  persist();renderReview();return;
 }
 if(a==='reset'){checks={C01:'ok'};persist();renderReview();return}
 if(a==='copy'){
  const t=report();
  try{await navigator.clipboard.writeText(t)}
  catch(_){const x=document.createElement('textarea');x.value=t;document.body.append(x);x.select();document.execCommand('copy');x.remove()}
  b.textContent='已复制';return;
 }
});
shell.addEventListener('click',e=>{const b=e.target.closest('[data-rc]');if(b)handleAction(b.dataset.rc)});
shell.addEventListener('keydown',e=>{
 if(e.key==='Escape'){if(state.mini)closeMini();else closeAll()}
 if((e.key==='ArrowUp'||e.key==='ArrowDown')&&e.target.matches('[data-drag]')){
  const i=Number(e.target.dataset.drag),j=i+(e.key==='ArrowUp'?-1:1);
  if(j>=0&&j<state.stops.length){
   state.undo=state.stops.map(p=>({...p}));[state.stops[i],state.stops[j]]=[state.stops[j],state.stops[i]];renderStage();
   body.querySelector(`[data-drag="${j}"]`)?.focus();
  }
 }
});
window.addEventListener('resize',()=>{if(state.active)snap(sheetLevel)});
shell.addEventListener('pointerdown',e=>{
 const handle=e.target.closest('[data-drag]');
 if(handle&&state.stage==='order'&&!state.mini){
  const index=Number(handle.dataset.drag),node=handle.closest('.rc-stop');
  const rowNodes=[...body.querySelectorAll('#rc-order-list .rc-stop')];
  if(!node)return;
  drag={id:e.pointerId,index,target:index,startY:e.clientY,prevY:e.clientY,items:rowNodes,node,step:node.getBoundingClientRect().height+7,original:state.stops.map(p=>({...p}))};
  node.classList.add('is-dragging');
  e.preventDefault();try{handle.setPointerCapture(e.pointerId)}catch(_){}
  return;
 }
 const isMain=!e.target.closest('#rc-grab button')&&e.target.closest('#rc-grab'),isMini=e.target.closest('#rc-mini-grab');
 if(isMain&&!state.mini){
  cancelAnimationFrame(sheetMotion);
  gesture={id:e.pointerId,startY:e.clientY,startHeight:height,lastY:e.clientY,lastAt:performance.now(),velocity:0};
  try{isMain.setPointerCapture(e.pointerId)}catch(_){}
  e.preventDefault();
 }else if(isMini&&state.mini){
  miniGesture={id:e.pointerId,startY:e.clientY,lastY:e.clientY,lastAt:performance.now()};
  try{isMini.setPointerCapture(e.pointerId)}catch(_){}
  e.preventDefault();
 }
});
shell.addEventListener('pointermove',e=>{
 if(drag&&drag.id===e.pointerId){
  e.preventDefault();const d=drag,delta=e.clientY-d.startY;
  d.target=Math.max(0,Math.min(d.items.length-1,d.index+Math.round(delta/d.step)));
  d.items.forEach((it,i)=>{
   if(i===d.index){it.style.transform=`translateY(${delta}px) scale(1.03)`;it.style.transition='none'}
   else{
    let val=0;if(d.target>d.index&&i>d.index&&i<=d.target)val=-d.step;
    if(d.target<d.index&&i<d.index&&i>=d.target)val=d.step;
    it.style.transition='transform .15s cubic-bezier(.22,.85,.23,1)';it.style.transform=val?`translateY(${val}px)`:'';
   }
  });
  return;
 }
 if(gesture&&gesture.id===e.pointerId){
  e.preventDefault();const [min,max]=mainGestureBounds();
  const h=rubber(gesture.startHeight+gesture.startY-e.clientY,min,max);
  const at=performance.now(),dt=Math.max(8,at-gesture.lastAt);
  gesture.velocity=(e.clientY-gesture.lastY)/dt;gesture.lastY=e.clientY;gesture.lastAt=at;
  paintHeight(h);return;
 }
 if(miniGesture&&miniGesture.id===e.pointerId){
  e.preventDefault();
  const delta=e.clientY-miniGesture.startY,shift=delta>0?delta*.82:delta*.18;
  miniSheet.style.transition='none';miniSheet.style.transform=`translateY(${shift}px)`;
  miniGesture.lastY=e.clientY;miniGesture.lastAt=performance.now();
 }
});
function finish(e,cancel){
 if(drag&&drag.id===e.pointerId){
  const d=drag;drag=null;e.preventDefault();
  if(!cancel&&d.target!==d.index){
   const oldRects=new Map(d.items.map(it=>[it.dataset.stopId,it.getBoundingClientRect().top-(it===d.node?e.clientY-d.startY:0)]));
   state.undo=d.original;
   const [move]=state.stops.splice(d.index,1);state.stops.splice(d.target,0,move);
   renderStage();
   const rows=[...body.querySelectorAll('[data-stop-id]')];
   rows.forEach(it=>{
    const first=oldRects.get(it.dataset.stopId);if(first===undefined)return;
    const dy=first-it.getBoundingClientRect().top;
    if(it.animate&&Math.abs(dy)>2)it.animate([{transform:`translateY(${dy}px)`},{transform:'translateY(0)'}],{duration:350,easing:'cubic-bezier(.17,1.02,.21,1)'});
   });
   toast('顺序已更新 · 起终点自动同步');
  }else d.items.forEach(it=>{it.classList.remove('is-dragging');it.style.transition='';it.style.transform=''});
  return;
 }
 if(gesture&&gesture.id===e.pointerId){
  const g=gesture;gesture=null;e.preventDefault();
  if(cancel){snap(sheetLevel);return}
  const values=['peek','half','full'],dist=values.map(v=>Math.abs(snapPx(v)-height));
  let ix=dist.indexOf(Math.min(...dist));
  if(Math.abs(g.velocity)>.42)ix=Math.max(0,Math.min(2,ix+(g.velocity<0?1:-1)));
  snap(values[ix]);return;
 }
 if(miniGesture&&miniGesture.id===e.pointerId){
  const dy=e.clientY-miniGesture.startY;miniGesture=null;e.preventDefault();
  miniSheet.style.transition='';
  if(cancel||dy<85){miniSheet.style.transform='';return}
  miniSheet.style.transform='';closeMini();
 }
}
shell.addEventListener('pointerup',e=>finish(e,false));
shell.addEventListener('pointercancel',e=>finish(e,true));
shell.addEventListener('lostpointercapture',e=>finish(e,true));
window.__batchC={version:'V3-card-first',show:showReview,open:openFor,exit:closeAll,report,summary:counts,items:defs,state:()=>({active:state.active,stage:state.stage,mini:state.mini,stops:state.stops.map(p=>p.id),starCount:document.querySelectorAll('#savedStar').length,dockCount:document.querySelectorAll('#dock').length}),mark(id){if(id==='C01')return;checks[id]='ok';persist();renderReview()}};
(function fixRouteV4(){
  const coord=new Map(allPlaces.map((p,i)=>[p.id,pointPositions[i]]));
  const at=p=>coord.get(p.id)||null;
  const properCross=(a,b,c,d)=>{
    const o=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
    const a1=o(a,b,c),a2=o(a,b,d),b1=o(c,d,a),b2=o(c,d,b);
    return a1*a2 < -0.00001 && b1*b2 < -0.00001;
  };
  function intersections(stops){
    let pairs=[];
    for(let i=0;i<stops.length-1;i++)for(let j=i+2;j<stops.length-1;j++){
      const ps=[at(stops[i]),at(stops[i+1]),at(stops[j]),at(stops[j+1])];
      if(ps.every(Boolean)&&properCross(...ps))pairs.push([i,j]);
    }
    return pairs;
  }
  const length=stops=>stops.slice(1).reduce((sum,p,i)=>{
    const a=at(stops[i]),b=at(p);return sum+(a&&b?Math.hypot(a[0]-b[0],a[1]-b[1]):0);
  },0);
  function suggestedOrder(stops){
    let best=stops.slice(),max=stops.length*stops.length*4;
    // Geometric 2-opt. Keep the explicitly selected first and last stops fixed.
    while(max-->0){
      let baseX=intersections(best).length,baseLength=length(best),selected=null;
      for(let i=0;i<best.length-2;i++)for(let j=i+2;j<best.length-1;j++){
        const candidate=[...best.slice(0,i+1),...best.slice(i+1,j+1).reverse(),...best.slice(j+1)];
        const x=intersections(candidate).length,dist=length(candidate);
        if(x<baseX||(x===baseX&&dist<baseLength-.01)){
          if(!selected||x<selected.cross||(x===selected.cross&&dist<selected.dist)){
            selected={items:candidate,cross:x,dist};
          }
        }
      }
      if(!selected)break;
      best=selected.items;
      if(intersections(best).length===0)break;
    }
    return best;
  }
  function previewAlert(){
    const x=intersections(state.stops);
    if(!x.length)return '';
    return `<div class="rc-cross-alert"><b>路线出现 ${x.length} 处示意连线交叉</b><p>当前顺序可能绕路。建议调整站点，但不会自动修改你原本的顺序。</p><button data-rc="route-suggest">查看更顺的建议顺序 →</button></div>`;
  }
  const oldPreview=previewMarkup;
  previewMarkup=function(){return previewAlert()+oldPreview()};
  const oldOrder=orderMarkup;
  orderMarkup=function(){return previewAlert()+oldOrder()};
  const oldMap=mapRender;
  mapRender=function(){
    // Stable place identity, not the position a stop happens to occupy in the list.
    const label=routeMap.querySelector('.rc-map-caption span');
    const svg=routeMap.querySelector('svg.rc-route'),pins=routeMap.querySelector('#rc-map-pins');
    if(state.stage==='order'||state.stage==='preview'){
      const stops=state.stops.slice(0,9);
      const p=stops.map(at);
      const crosses=intersections(stops);
      label.textContent=crosses.length?
        `待优化 · ${crosses.length} 处路线交叉（暂不绘线）`:
        `路线草稿 · ${stops.length} 站 · 地点位置固定`;
      if(!crosses.length&&p.every(Boolean)){
        const points=p.map(x=>x.join(',')).join(' ');
        svg.innerHTML=`<polyline points="${points}" stroke="#fffdf7" stroke-width="2.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${points}" stroke="#597f62" stroke-width="1.15" fill="none" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="2 2.5"/>`;
      }else svg.innerHTML='';
      pins.innerHTML=stops.map((spot,i)=>{
        const pt=at(spot);if(!pt)return '';
        return `<button class="rc-pin ${state.activeStop===i?'rc-current':''}" style="left:${pt[0]}%;top:${pt[1]}%" data-rc="pin-${i}" data-place-id="${safe(spot.id)}" aria-label="查看第 ${i+1} 站 ${safe(spot.name)}">${i+1}</button>`;
      }).join('');
    }else oldMap();
  };
  selectMarkup=function(){
    const pool=state.source==='saved'?allPlaces.slice(0,6):allPlaces.slice(3);
    return `<p class="rc-note">轻触整行即可选择／取消，不会改变地图视角或回到列表顶部。</p>
      <div class="rc-tabs"><button data-rc="source-saved" class="${state.source==='saved'?'is-active':''}">☆ 我的收藏</button><button data-rc="source-map" class="${state.source==='map'?'is-active':''}">⌖ 地图选点</button></div>
      <div class="rc-rowhead"><span class="rc-section">想去的地方</span><small class="rc-note" id="rc-select-count">已选 ${state.selected.length} 处</small></div>
      ${pool.map(p=>`<button type="button" data-rc="pick-${p.id}" data-place-id="${p.id}" aria-pressed="${state.selected.includes(p.id)}" class="rc-stop rc-stop-pick ${state.selected.includes(p.id)?'selected':''}"><span class="rc-index">${state.selected.includes(p.id)?'✓':'＋'}</span><span class="rc-name"><strong>${safe(p.name)}</strong><small>${safe(p.sub)}</small></span><span aria-hidden="true" class="rc-pick-check">${state.selected.includes(p.id)?'✓':'＋'}</span></button>`).join('')}
      <p class="rc-fineprint">原型中的地点只用于交互测试；不会额外创建黄色星标。</p>`;
  };
  // No destructive full-screen rerenders when the user merely touches one place.
  const originalAction=handleAction;
  handleAction=function(cmd){
    if(cmd.startsWith('pick-')&&state.stage==='select'){
      const id=cmd.slice(5);
      const selected=state.selected.includes(id);
      if(selected)state.selected=state.selected.filter(s=>s!==id);
      else state.selected=[...state.selected,id];
      const prev=new Map(state.stops.map(p=>[p.id,p]));
      state.stops=state.selected.map(k=>prev.get(k)||allPlaces.find(p=>p.id===k)).filter(Boolean).map(p=>({...p}));
      state.undo=null;state.saved=false;
      if(state.activeStop>=state.stops.length)state.activeStop=Math.max(0,state.stops.length-1);
      const row=[...body.querySelectorAll('[data-place-id]')].find(x=>x.dataset.placeId===id);
      if(row){
        row.classList.toggle('selected',!selected);
        row.setAttribute('aria-pressed',String(!selected));
        row.querySelector('.rc-index').textContent=selected?'＋':'✓';
        row.querySelector('.rc-pick-check').textContent=selected?'＋':'✓';
      }
      const counter=body.querySelector('#rc-select-count');if(counter)counter.textContent=`已选 ${state.selected.length} 处`;
      return;
    }
    if(cmd.startsWith('pin-')&&state.stage==='preview'){
      const idx=Number(cmd.slice(4));if(!state.stops[idx])return;
      state.activeStop=idx;
      const pos=body.scrollTop;
      body.innerHTML=previewMarkup();
      body.scrollTop=pos;
      routeMap.querySelectorAll('.rc-pin').forEach((node,i)=>node.classList.toggle('rc-current',i===idx));
      return;
    }
    if(cmd==='route-suggest'){
      const candidate=suggestedOrder(state.stops);
      const after=intersections(candidate).length;
      if(candidate.map(x=>x.id).join('|')===state.stops.map(x=>x.id).join('|')){
        toast('没有找到满足固定起终点的更好顺序');
        return;
      }
      state.routeSuggestion=candidate.map(p=>({...p}));
      state.routeBefore=state.stops.map(p=>({...p}));
      const changes=candidate.map(p=>p.name).join(' → ');
      openMini('suggest');
      miniBase('减少绕路的排序建议','不使用 AI，也不会擅自覆盖你设定的顺序',
        `<div class="rc-summary">${safe(changes)}</div>
        <p class="rc-note">${after?`仍有 ${after} 处交叉，需要再手动调整。`:'此建议消除了示意连线交叉。'}<br>真实路线需使用道路数据计算，不能将示意直线当作导航路线。</p>`,
        button('保持原顺序','mini-close')+button('采用建议','route-accept','rc-primary'));
      return;
    }
    if(cmd==='route-accept'){
      if(!state.routeSuggestion)return;
      const chosenId=state.stops[state.activeStop]?.id;
      state.undo=state.stops.map(p=>({...p}));
      state.stops=state.routeSuggestion.map(p=>({...p}));
      state.activeStop=Math.max(0,state.stops.findIndex(p=>p.id===chosenId));
      state.routeSuggestion=null;state.saved=false;
      closeMini();renderStage();toast('已采用建议顺序 · 可以撤销');return;
    }
    if(cmd==='date-commit'){
      if(!dateDraft?.start||!dateDraft?.end||dateDraft.end<dateDraft.start){toast('请选择有效的出发与结束日期');return}
      if(dateDraft.start<datePlus(0)){toast('过去日期不能选择');return}
      if(diffDays(dateDraft.start,dateDraft.end)>30){toast('演示最多选择30天');return}
      state.start=dateDraft.start;state.end=dateDraft.end;
      closeMini();
      // Let the secondary card retreat before refreshing the underlying card.
      setTimeout(()=>{if(state.active)renderStage()},220);
      toast('旅行日期已更新');
      return;
    }
    if(cmd==='date-cancel'){dateDraft=null;closeMini();return}
    if(cmd==='date-start'||cmd==='date-end'){
      if(!dateDraft)return;dateDraft.phase=cmd==='date-start'?'start':'end';
      const v=dateDraft[dateDraft.phase],d=new Date(v+'T12:00:00');
      state.calendarMonth=new Date(d.getFullYear(),d.getMonth(),1);refreshMini();return;
    }
    if(cmd.startsWith('date-pick-')){
      const v=cmd.slice(10);
      if(!dateDraft||v<datePlus(0)||(dateDraft.phase==='end'&&v<dateDraft.start))return;
      if(dateDraft.phase==='start'){
        dateDraft.start=v;if(dateDraft.end<v)dateDraft.end=v;
        dateDraft.phase='end';
      }else{
        if(diffDays(dateDraft.start,v)>30){toast('演示最多选择30天');return}
        dateDraft.end=v;dateDraft.phase='done';
      }
      refreshMini();
      if(dateDraft.phase==='done'){
        miniBody.querySelector('.rc-dates-complete')?.classList.add('is-finished');
        clearTimeout(dateAutoFinish);
        dateAutoFinish=setTimeout(()=>{if(state.mini==='date'&&dateDraft?.phase==='done')handleAction('date-commit')},470);
      }
      return;
    }
    if(cmd==='date-weekend'){
      // Local upcoming Saturday and Sunday.
      let sat=new Date();sat.setHours(12,0,0,0);
      sat.setDate(sat.getDate()+(6-sat.getDay()+7)%7);
      const sun=new Date(sat);sun.setDate(sun.getDate()+1);
      dateDraft={start:localDate(sat),end:localDate(sun),phase:'done'};
      refreshMini();clearTimeout(dateAutoFinish);
      dateAutoFinish=setTimeout(()=>{if(state.mini==='date')handleAction('date-commit')},470);
      return;
    }
    if(cmd==='undo'&&state.undo){
      state.stops=state.undo.map(p=>({...p}));
      state.undo=null;state.activeStop=Math.min(state.activeStop,state.stops.length-1);
      renderStage();toast('已恢复原有站点顺序');return;
    }
    return originalAction(cmd);
  };
  // Calendar is a two-tap range with a persistent visible selection and rubber-band dismissal.
  let dateDraft=null,dateAutoFinish=0;
  const formerOpenMini=openMini;
  openMini=function(kind){
    if(kind==='date'){
      clearTimeout(dateAutoFinish);
      dateDraft={start:state.start,end:state.end,phase:'start'};
      formerOpenMini('date');
      miniBase('旅行日期','先点出发日，再点结束日；选完后自动收起',
        calendarBody(),button('取消','date-cancel')+button('完成','date-commit','rc-primary'));
      return;
    }
    formerOpenMini(kind);
  };
  calendarBody=function(){
    const d=state.calendarMonth,y=d.getFullYear(),m=d.getMonth(),first=(new Date(y,m,1).getDay()+6)%7,last=new Date(y,m+1,0).getDate();
    const draft=dateDraft||{start:state.start,end:state.end,phase:'start'};
    let out='';
    for(let i=0;i<first;i++)out+='<span></span>';
    for(let n=1;n<=last;n++){
      const value=localDate(new Date(y,m,n)),disabled=value<datePlus(0)||(draft.phase==='end'&&value<draft.start);
      const selected=value===draft.start||value===draft.end,range=value>=draft.start&&value<=draft.end;
      out+=`<button type="button" data-rc="date-pick-${value}" ${disabled?'disabled':''} aria-label="${value}" class="${selected?'picked':''} ${range&&!selected?'between':''} ${value===datePlus(0)?'today':''}">${n}</button>`;
    }
    return `<div class="rc-date-range">
      <button type="button" class="${draft.phase==='start'?'is-current':''}" data-rc="date-start"><small>出发</small><b>${fmt(draft.start)}</b></button>
      <span class="rc-range-arrow">→</span>
      <button type="button" class="${draft.phase==='end'?'is-current':''}" data-rc="date-end"><small>结束</small><b>${fmt(draft.end)}</b></button>
    </div>
    <div class="rc-calendar-head"><button data-rc="month-prev" aria-label="上个月">‹</button><b>${y}年 ${m+1}月</b><button data-rc="month-next" aria-label="下个月">›</button></div>
    <div class="rc-week">${'一二三四五六日'.split('').map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="rc-cal">${out}</div>
    <div class="rc-dates-complete">${draft.phase==='done'?`✓ 已选 ${diffDays(draft.start,draft.end)} 天，正在返回路线`:
      draft.phase==='start'?'请选择出发日期':`请选择结束日期（${fmt(draft.start)} 之后）`}</div>
    <button data-rc="date-weekend" class="rc-weekend-shortcut">快速选择本周末 · 两天</button>
    <p class="rc-fineprint">灰色日期不能点选；取消不会更改原行程。</p>`;
  };
  const previousCloseMini=closeMini;
  closeMini=function(immediate=false){
    clearTimeout(dateAutoFinish);
    previousCloseMini(immediate);
    dateDraft=null;
  };
  // Preserve context if the underlying card rerenders for stage changes and order changes.
  const priorRender=renderStage;
  renderStage=function(){
    const sc=body.scrollTop,kind=state.stage;
    priorRender();
    if(kind==='select'||kind==='order')body.scrollTop=sc;
  };
  // Ensure selection review doesn't overwrite the already approved C01.
  renderReview();
  window.__batchC.crossings=()=>intersections(state.stops).length;
  window.__batchC.suggest=()=>suggestedOrder(state.stops).map(x=>x.id);
  window.__batchC.testRoute=ids=>{state.stops=ids.map(id=>allPlaces.find(p=>p.id===id)).filter(Boolean).map(p=>({...p}));state.stage='preview';renderStage();};
})();
})();