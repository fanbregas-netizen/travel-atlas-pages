/* Footprint Map -> Travel Atlas: journey view. No user data is sent to a server. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const PREFIX='./';const placesDB='private-travel-footprints-v1';
let places=[],selected=[],planId='',allPlans=[],demoMode=false,objectUrls=[],changed=false,lastProposal=null;
const copyStops=()=>selected.map(x=>({...x}));
function clearProposal(){lastProposal=null;const b=document.getElementById('undoProposal');if(b)b.hidden=true}
function rememberProposal(){lastProposal=copyStops();const b=document.getElementById('undoProposal');if(b)b.hidden=false}
function sortByDay(){selected=selected.map((s,i)=>({s,i})).sort((a,b)=>(Number(a.s.day)||1)-(Number(b.s.day)||1)||a.i-b.i).map(x=>x.s)}
function undoProposal(){if(!lastProposal)return;selected=lastProposal;clearProposal();changed=true;renderChosen();renderPlaces();renderRoute();report('已恢复到建议编排前的路线；未修改收藏。')}

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const daysBetween=(s,e)=>{if(!s||!e)return 1;const a=new Date(s+'T12:00:00'),b=new Date(e+'T12:00:00');return Math.max(1,Math.min(60,Math.round((b-a)/86400000)+1))};
const dateAdd=(s,d)=>{const dt=new Date(s+'T12:00:00');dt.setDate(dt.getDate()+d);return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`};
const safe=(s,n=400)=>String(s??'').slice(0,n);
const uniqueId=()=>globalThis.crypto?.randomUUID?.()||('journey-'+Date.now()+'-'+Math.random().toString(16).slice(2));
const validCoord=p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lng))<=180&&p.lat!==null&&p.lng!==null&&p.lat!==''&&p.lng!=='';
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
/* build .18 · 校验改提交时报、4.5s 自消;填写过程不再挂常驻红条 */
let reportTimer=0;const report=(message,isError=false)=>{const bar=$('status');bar.textContent=message;bar.classList.toggle('error',isError);clearTimeout(reportTimer);if(isError&&message)reportTimer=setTimeout(()=>{bar.textContent='';bar.classList.remove('error')},4500)};
function openDB(name,version,upgrade){return new Promise((resolve,reject)=>{const r=indexedDB.open(name,version);r.onupgradeneeded=()=>upgrade?.(r.result);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('其他标签页正占用数据库'))})}
function getAll(db,store){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),rq=tx.objectStore(store).getAll();rq.onsuccess=()=>resolve(rq.result||[]);rq.onerror=()=>reject(rq.error)})}
const routeRepository=window.FootprintMediaCore.createRepository(indexedDB);
const putPlan=plan=>routeRepository.saveRoute(plan);
async function loadPlans(){
 try{allPlans=await routeRepository.listRoutes();renderPlans()}
 catch(err){report('浏览器未开放路线存储：'+err.message,true)}
}
async function loadPlaces(){try{const db=await openDB(placesDB,1,d=>{if(!d.objectStoreNames.contains('places'))d.createObjectStore('places',{keyPath:'id'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'})});places=(await getAll(db,'places')).filter(p=>p&&p.starred!==false&&!p.demo&&validCoord(p));db.close()}catch(err){try{places=(JSON.parse(localStorage.getItem('travel-places')||'[]')||[]).filter(p=>p&&p.starred!==false&&!p.demo&&validCoord(p))}catch{places=[]}report('暂时不能读取星标数据库；仍可预览产品结构。',true)}places.sort((a,b)=>safe(a.title||a.name).localeCompare(safe(b.title||b.name),'zh-CN'));renderPlaces();renderChosen();$('starTotal').textContent=places.length+' 个收藏';if(!places.length)report('未找到已定位的个人星标。可先到 Footprint Map 收藏或导入高德地点，也可点击下方演示按钮。');else report('已连接 Footprint Map：读取 '+places.length+' 个有坐标的私人星标。')}
function renderPlans(){$('savedPlans').replaceChildren(new Option('创建新路线',''));for(const p of allPlans)$('savedPlans').add(new Option(safe(p.title,70),p.id));$('savedPlans').value=planId||''}
function renderPlaces(){const root=$('places');root.replaceChildren();const q=$('placeFilter').value.trim().toLowerCase();const items=places.filter(p=>(safe(p.title||p.name)+' '+safe(p.address||'')+' '+safe(p.note||'')).toLowerCase().includes(q)).slice(0,120);if(!items.length){root.append(make('p','empty-list',places.length?'没有匹配的收藏地点。':'当前没有可用星标。请先在 Footprint Map 收藏地点，或导入高德带坐标的地点。'));return}for(const p of items){const exists=selected.some(s=>s.id===p.id);const b=make('button','place');b.type='button';b.disabled=exists;b.append(make('span','star-dot',exists?'✓':'★'));const body=make('span','place-body');body.append(make('span','place-name',safe(p.title||p.name,100)),make('span','place-location',safe(p.address||p.note||'保存的地图位置',65)));b.append(body,make('span','plus',exists?'':'+'));b.addEventListener('click',()=>{if(demoMode){selected=[];places=places.filter(x=>!String(x.id).startsWith('_demo_'));demoMode=false}clearProposal();selected.push({id:p.id,day:Math.min(currentDays(),Math.max(1,selected.length+1)),time:''});sortByDay();changed=true;renderPlaces();renderChosen();renderRoute()});root.append(b)}if(items.length===120)root.append(make('p','hint','只展示前 120 项，可输入关键词搜索更多收藏。'))}
function currentDays(){return daysBetween($('startDate').value,$('endDate').value)}
function haversine(a,b){const r=v=>Number(v)*Math.PI/180,dy=r(b.lat)-r(a.lat),dx=r(b.lng)-r(a.lng);return 12742*Math.asin(Math.min(1,Math.sqrt(Math.sin(dy/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dx/2)**2)))}
function autoArrange(){if(selected.length<2){report('至少选择 2 个地点才能按邻近关系编排。',true);return}rememberProposal();const candidates=[...selected],route=[candidates.shift()];while(candidates.length){const curr=places.find(p=>p.id===route[route.length-1].id);candidates.sort((a,b)=>haversine(curr,places.find(p=>p.id===a.id))-haversine(curr,places.find(p=>p.id===b.id)));route.push(candidates.shift())}const days=currentDays();route.forEach((s,i)=>{s.day=Math.min(days,Math.floor(i*days/route.length)+1);/* 人工到达时间保持不变，不能编造时间 */});selected=route;sortByDay();changed=true;renderChosen();renderPlaces();renderRoute();report('已生成 D1—D'+days+' 地理邻近建议（可撤销）。人工到达时间保持原样，请重新核对；实际驾驶距离与耗时应在高德核实。')}
function downloadMarkdown(){if(!selected.length){report('请选择收藏点后再导出。',true);return}const t=record(),out=['# '+t.title,'','日期：'+t.startDate+' 至 '+t.endDate,'出发地：'+(t.origin||'待填'),'目的地：'+(t.destination||'待填'),'','> 基于已收藏的 Brief 与链接生成的可编辑路书；不包含虚构营业时间或行车时长。'];let prevDay=0;for(const [i,s] of selected.entries()){const p=places.find(x=>x.id===s.id);if(!p)continue;if(s.day!==prevDay){out.push('','## D'+s.day+' · '+dateAdd(t.startDate,s.day-1));prevDay=s.day}out.push('','### '+(s.time||'待定时间')+' '+(p.title||p.name),'地址：'+(p.address||'未提供'),formatNote(p)||'Brief：待补充');for(const l of sourceLinks(p))out.push('素材链接：'+l);out.push('高德导航：'+amapLink(p))}out.push('','## 待核实事项','- 根据实际道路与交通计算行车时间','- 核对景点营业时间、门票与预约要求','- 检查社交平台来源的有效性','- 为旅行照片选择或校验对应星标');const file=new Blob([out.join('\n')],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(file),a=make('a');a.href=url;a.download='TravelAtlas_'+today()+'.md';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);report('已导出包含 D1—D'+currentDays()+'、Brief、来源链接及高德导航的 Markdown 路书。')}

// Stage1.34.2 · direct-touch reorder with explicit handle. Native browser scroll
// remains available everywhere except that handle, which is intentionally drag-only.
function moveSelected(from,to){
 if(from===to||from<0||to<0||from>=selected.length||to>=selected.length)return false;
 clearProposal();
 const targetDay=selected[to].day;
 const moved=selected.splice(from,1)[0];
 selected.splice(to,0,moved);
 moved.day=targetDay;
 sortByDay();changed=true;renderChosen();renderRoute();
 report('已调整站点顺序。D'+targetDay+' 的路线已更新，记得保存。');
 return true;
}
function enableDragHandle(handle,wrap,id){
 handle.addEventListener('keydown',e=>{
   if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;
   e.preventDefault();const i=selected.findIndex(s=>String(s.id)===String(id));
   if(i<0)return;moveSelected(i,i+(e.key==='ArrowUp'?-1:1));
 });
 handle.addEventListener('pointerdown',e=>{
   if(e.button!==0&&e.pointerType==='mouse')return;
   const origin=selected.findIndex(s=>String(s.id)===String(id));if(origin<0)return;
   let target=origin,moved=false,active=true;
   const startY=e.clientY,startX=e.clientX;
   handle.setPointerCapture?.(e.pointerId);
   const clear=()=>{wrap.classList.remove('is-dragging');document.querySelectorAll('#chosen .choice.is-drop-target').forEach(x=>x.classList.remove('is-drop-target'))};
   const point=e2=>{
     if(!active)return;
     if(Math.abs(e2.clientY-startY)+Math.abs(e2.clientX-startX)>7)moved=true;
     if(!moved)return;
     wrap.classList.add('is-dragging');
     // Auto-scroll the main page on long itineraries; the short nested scroller
     // is disabled on mobile so a finger can drag between distant days.
     if(window.innerWidth<=600){
       const edge=64,y=e2.clientY,vh=window.visualViewport?.height||innerHeight;
       if(y>vh-edge)window.scrollBy(0,Math.min(24,(y-(vh-edge))*.65));
       else if(y<edge+70)window.scrollBy(0,-Math.min(24,((edge+70)-y)*.65));
     }
     let hover=document.elementFromPoint(e2.clientX,e2.clientY)?.closest('#chosen .choice[data-stop-id]');
     if(!hover){
       const list=$('chosen'),bounds=list.getBoundingClientRect();
       if(e2.clientY>=bounds.top-30&&e2.clientY<=bounds.bottom+30){
         const rows=[...list.querySelectorAll('.choice[data-stop-id]')];
         hover=rows.reduce((best,row)=>Math.abs(row.getBoundingClientRect().top+row.getBoundingClientRect().height/2-e2.clientY)<Math.abs((best?.getBoundingClientRect().top||0)+(best?.getBoundingClientRect().height||0)/2-e2.clientY)?row:best,null);
       }
     }
     document.querySelectorAll('#chosen .choice.is-drop-target').forEach(x=>x.classList.remove('is-drop-target'));
     if(hover){const next=selected.findIndex(s=>String(s.id)===hover.dataset.stopId);if(next>=0){target=next;if(next!==origin)hover.classList.add('is-drop-target')}}
   };
   const finish=e2=>{
     if(!active)return;active=false;handle.removeEventListener('pointermove',point);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);clear();
     if(moved&&target!==origin)moveSelected(origin,target);
   };
   const cancel=()=>{active=false;handle.removeEventListener('pointermove',point);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);clear()};
   handle.addEventListener('pointermove',point);
   handle.addEventListener('pointerup',finish);
   handle.addEventListener('pointercancel',cancel);
 });
}
function renderChosen(){const root=$('chosen');root.replaceChildren();$('selectedCount').textContent=selected.length+' 站';if(!selected.length){root.append(make('p','empty-list','还没有加入路线的地点。'));return}let previousDay=0;selected.forEach((s,i)=>{const p=places.find(x=>x.id===s.id);if(!p)return;if(s.day!==previousDay){const heading=make('div','choice-day-label',`D${s.day} · ${$('startDate').value?dateAdd($('startDate').value,s.day-1):'旅行日'}`);root.append(heading);previousDay=s.day}const wrap=make('div','choice');wrap.dataset.stopId=String(s.id);const idx=make('span','choice-index',String(i+1)),body=make('div','choice-body');body.append(make('span','choice-name',safe(p.title||p.name,90)));const handle=make('button','choice-drag','⠿');handle.type='button';handle.title='按住拖动站点排序';handle.setAttribute('aria-label',`拖动${safe(p.title||p.name)}排序；也可以用上下方向键`);enableDragHandle(handle,wrap,s.id);const controls=make('div','choice-controls');const sel=make('select','day-picker');sel.setAttribute('aria-label',`指定${safe(p.title||p.name)}的行程日`);for(let d=1;d<=currentDays();d++)sel.add(new Option('D'+d,d));sel.value=String(Math.min(s.day,currentDays()));sel.onchange=()=>{clearProposal();s.day=Number(sel.value);sortByDay();changed=true;renderChosen();renderRoute()};controls.append(sel);const tm=make('input','time-picker');tm.type='time';tm.value=s.time||'';tm.title='计划到达时间（可选）';tm.setAttribute('aria-label',`到达${safe(p.title||p.name)}的时间`);tm.onchange=()=>{clearProposal();s.time=tm.value;changed=true;renderRoute()};controls.append(tm);for(const [glyph,diff,label] of [['↑',-1,'上移'],['↓',1,'下移']]){const b=make('button','',glyph);b.title=label+'站点';b.disabled=(i+diff<0||i+diff>=selected.length);b.onclick=()=>moveSelected(i,i+diff);controls.append(b)}const del=make('button','','×');del.title='移除站点';del.onclick=()=>{clearProposal();selected.splice(i,1);changed=true;renderChosen();renderPlaces();renderRoute()};controls.append(del);wrap.append(idx,body,handle,controls);root.append(wrap)})}
function formatNote(p){return safe(p.note||p.brief||p.description||'',320).trim()}
function sourceEntries(p){const items=[...(Array.isArray(p.references)?p.references:[]),...(Array.isArray(p.guides)?p.guides:[]),...(Array.isArray(p.sources)?p.sources:[])];if(p.url)items.push(p.url);if(p.link)items.push(p.link);const seen=new Set(),out=[];for(const x of items){const raw=typeof x==='string'?x:x?.url||x?.link||'';let u;try{u=new URL(raw)}catch{continue}if(!['https:','http:'].includes(u.protocol)||!u.hostname||seen.has(u.href))continue;seen.add(u.href);const host=u.hostname.replace(/^www\./,'');const label=/xiaohongshu|xhslink/.test(host)?'小红书':/weixin|mp\.weixin|qq\.com/.test(host)?'微信':/douyin|iesdouyin/.test(host)?'抖音':/bilibili|b23\.tv/.test(host)?'Bilibili':/youtube|youtu\.be/.test(host)?'YouTube':host;out.push({url:u.href,title:safe(typeof x==='object'&&x?.title||'原始内容',65),platform:label});}return out.slice(0,15)}
function sourceLinks(p){return sourceEntries(p).map(x=>x.url)}
function wgsToGcj(lon,lat){if(lon<72.004||lon>137.8347||lat<0.8293||lat>55.8271)return[lon,lat];const x=lon-105,y=lat-35;const rad=lat*Math.PI/180,ee=.006693421622965943,a=6378245,magic=1-ee*Math.sin(rad)**2;const latDelta=-100+2*x+3*y+.2*y*y+.1*x*y+.2*Math.sqrt(Math.abs(x))+(20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3+(20*Math.sin(y*Math.PI)+40*Math.sin(y/3*Math.PI))*2/3+(160*Math.sin(y/12*Math.PI)+320*Math.sin(y*Math.PI/30))*2/3;const lngDelta=300+x+2*y+.1*x*x+.1*x*y+.1*Math.sqrt(Math.abs(x))+(20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3+(20*Math.sin(x*Math.PI)+40*Math.sin(x/3*Math.PI))*2/3+(150*Math.sin(x/12*Math.PI)+300*Math.sin(x/30*Math.PI))*2/3;return[lon+lngDelta*180/(a/Math.sqrt(magic)*Math.cos(rad)*Math.PI),lat+latDelta*180/((a*(1-ee))/(magic*Math.sqrt(magic))*Math.PI)]}
function amapLink(p){const [lon,lat]=wgsToGcj(Number(p.lng),Number(p.lat));const target=[lon.toFixed(6),lat.toFixed(6),safe(p.title||p.name,65)].join(',');return 'https://uri.amap.com/navigation?'+new URLSearchParams({to:target,mode:'car',src:'travel_atlas',callnative:'1'}).toString()}
function mediaSrc(media){if(!media)return null;const src=typeof media==='string'?media:media.src||media.dataUrl||'';if(typeof src==='string'&&(src.startsWith('data:image/')||/^https:\/\//.test(src)))return src;if(media.blob instanceof Blob&&media.blob.type.startsWith('image/')){const u=URL.createObjectURL(media.blob);objectUrls.push(u);return u}return null}
function renderCard(p,i){const card=make('article','stop-card '+(i%2===0?'left':'right'));const head=make('div','card-head');head.append(make('span','flag','⚑'),make('h3','card-title',safe(p.title||p.name||'未命名地点',100)));card.append(head,make('p','card-location',safe(p.address||`${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)}`,160)));const note=formatNote(p);const s=selected[i];if(s?.time){const eta=make('div','arrival-time','计划到达 '+s.time+' · 具体交通时间待高德核实');card.append(eta)}card.append(make('p',note?'card-note':'card-note card-empty-note',note||'在 Footprint Map 中写下为什么想去这里…'));const imgs=(Array.isArray(p.photos)?p.photos:[]).map(mediaSrc).filter(Boolean).slice(0,2);if(imgs.length){const media=make('div','card-media');for(const src of imgs){const im=document.createElement('img');im.src=src;im.alt='该地点保存的旅行照片';im.loading='lazy';media.append(im)}card.append(media)}const links=sourceEntries(p);if(links.length){const box=make('div','card-links');for(const entry of links.slice(0,3)){const a=make('a','route-source-link',`${entry.platform} · ${entry.title} ↗`);a.href=entry.url;a.rel='noreferrer noopener';a.target='_blank';a.title='在外部平台打开；本路线与地图收藏将保留';box.append(a)}if(links.length>3){
  const more=make('details','route-source-details');
  const summary=make('summary','',`展开另外 ${links.length-3} 条来源`);
  const full=make('div','card-links route-source-extra');
  for(const entry of links.slice(3)){
    const a=make('a','route-source-link',`${entry.platform} · ${entry.title} ↗`);
    a.href=entry.url;a.rel='noreferrer noopener';a.target='_blank';
    a.title='打开原始平台内容';full.append(a);
  }
  more.append(summary,full);box.append(more);
 }card.append(box)}const act=make('div','card-actions');const nav=make('a','','高德导航 ↗');nav.href=amapLink(p);nav.target='_blank';nav.rel='noreferrer noopener';const origin=make('a','','地图星标 ↗');origin.href=PREFIX+'index.html?openPlace='+encodeURIComponent(p.id);const mediaAction=make('button','return-media','＋ 归档影像');mediaAction.type='button';mediaAction.onclick=()=>{location.href=PREFIX+'index.html?mediaPlace='+encodeURIComponent(p.id)};act.append(nav,origin,mediaAction);card.append(act);return card}
function clearObjectUrls(){for(const u of objectUrls)URL.revokeObjectURL(u);objectUrls=[]}
// Distances below are straight-line coordinates only, not inferred driving times.
// We warn about potentially crowded days / time conflicts, but never fabricate ETA.
function renderRouteReview(){
 const panel=$('routeReview'),body=$('routeReviewContent'),summary=$('routeReviewSummary');
 if(!panel||!body||!summary)return;
 body.replaceChildren();if(!selected.length){panel.hidden=true;return}
 panel.hidden=false;
 const groups=new Map();for(const stop of selected){const day=Number(stop.day)||1;if(!groups.has(day))groups.set(day,[]);groups.get(day).push(stop)}
 let issueCount=0;const rows=[];
 for(const [day,stops] of groups){
   let kilometers=0,hasDistance=false,clockReversed=false,farApart=false,prevClock='';
   for(let i=0;i<stops.length;i++){
     if(stops[i].time){if(prevClock&&stops[i].time<prevClock)clockReversed=true;prevClock=stops[i].time}
     if(i>0){const a=places.find(p=>p.id===stops[i-1].id),b=places.find(p=>p.id===stops[i].id);if(a&&b&&validCoord(a)&&validCoord(b)){
       const km=haversine(a,b);kilometers+=km;hasDistance=true;if(km>120)farApart=true;
     }}
   }
   const flags=[];if(stops.length>=5)flags.push('一天 '+stops.length+' 站，请核实停留时间');
   if(farApart)flags.push('有相邻地点直线距离超过 120 km');
   if(clockReversed)flags.push('计划到达时间与站点先后不一致');
   issueCount+=flags.length;
   const label=make('div','route-review-day');
   label.append(make('strong','',`D${day} · ${stops.length} 站`));
   label.append(make('span','',hasDistance?`相邻站点直线距离合计约 ${Math.round(kilometers)} km（不是驾车里程）`:'请先确认地点坐标'));
   if(flags.length){for(const flag of flags)label.append(make('span','route-review-warning','注意：'+flag))}
   else label.append(make('span','route-review-ok','暂无明显顺序冲突；路况与营业时间仍待核实'));
   rows.push(label);
 }
 body.append(...rows);
 body.append(make('p','route-review-note','这里只根据收藏坐标与手动时间做初步提醒，不是道路路线、实时交通或营业时间验证。'));
 summary.textContent=issueCount?`${issueCount} 项值得核对`:'查看每日站点和距离提示';
}

function renderRoute(){renderRouteReview();clearObjectUrls();const root=$('journey');root.replaceChildren();const stops=selected.map((s,i)=>({s,i,p:places.find(x=>x.id===s.id)})).filter(x=>x.p);if(!stops.length){const empty=make('div','route-empty');empty.append(make('div','route-empty-icon','✦'),make('h3','','从一颗星开始'),make('p','','从左侧选择收藏地点，或查看交互示例。'));const demo=make('button','outline','看看手绘路线的交互示例');demo.id='demo';demo.onclick=showDemo;empty.append(demo);root.append(empty);return}const header=make('div','route-intro'),name=make('div','route-name',safe($('planTitle').value||'我的旅程',80)),meta=make('div','route-meta',`${stops.length} 个地点 · ${currentDays()} 天 · ${safe($('origin').value||'出发地待填',40)} → ${safe($('destination').value||'自由探索',40)}`);header.append(name,meta);root.append(header);const caveat=make('p','route-caveat','这条曲线路径表达旅程叙事，不是实际道路；请以高德导航确认距离、路线和时间。');root.append(caveat);if(demoMode)root.append(make('div','demo-banner','这是视觉与交互演示数据，不是你的真实收藏，也不会写入你的星标库。'));
 const stage=make('div','route-diagram'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('route-line');svg.setAttribute('aria-hidden','true');svg.setAttribute('preserveAspectRatio','none');const path=document.createElementNS('http://www.w3.org/2000/svg','path');svg.append(path);stage.append(svg);let last=0;for(const {s,i,p} of stops){const d=Math.min(currentDays(),Math.max(1,Number(s.day)||1));if(d!==last){const grp=make('div','route-day');const text=make('span','day-label');text.append(make('strong','',`D${d}`),document.createTextNode($('startDate').value?dateAdd($('startDate').value,d-1):'旅行日 '+d));grp.append(text);stage.append(grp);last=d}const st=make('section','route-stop'),pin=make('span','pin',String(i+1));pin.setAttribute('aria-label',`第${i+1}站 ${safe(p.title||p.name,50)}`);st.append(pin,renderCard(p,i));stage.append(st)}root.append(stage);requestAnimationFrame(()=>drawPath(stage,path));}
function drawPath(stage,path){if(!stage.isConnected)return;const pins=[...stage.querySelectorAll('.pin')],box=stage.getBoundingClientRect();if(!pins.length)return;const points=pins.map(el=>{const r=el.getBoundingClientRect();return{x:r.left+r.width/2-box.left,y:r.top+r.height/2-box.top}});let d=`M ${points[0].x.toFixed(1)} ${(points[0].y-45).toFixed(1)} L ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dy=(b.y-a.y)*.55;d+=` C ${a.x+(i%2?25:-25)} ${a.y+dy}, ${b.x+(i%2?-25:25)} ${b.y-dy}, ${b.x} ${b.y}`}const last=points[points.length-1];d+=` L ${last.x} ${last.y+35}`;path.setAttribute('d',d);svgSize(stage)}
function svgSize(stage){const svg=stage.querySelector('svg');svg.setAttribute('viewBox',`0 0 ${Math.ceil(stage.clientWidth)} ${Math.ceil(stage.scrollHeight)}`)}
const record=()=>({schema:'travel-atlas-journey-v1',id:planId||uniqueId(),title:safe($('planTitle').value||'未命名旅程',80),startDate:$('startDate').value,endDate:$('endDate').value,origin:safe($('origin').value,70),destination:safe($('destination').value,70),stops:selected.map(s=>({placeId:s.id,day:Math.min(currentDays(),Math.max(1,Number(s.day)||1)),time:/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time||'')?s.time:''})),updatedAt:new Date().toISOString()});
function normalizeStops(rec){if(Array.isArray(rec.stops)&&rec.stops.length)return rec.stops.map(x=>({placeId:safe(x.placeId,160),day:Math.max(1,Math.min(60,Number(x.day)||1)),time:/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time||'')?x.time:''}));if(Array.isArray(rec.selected)&&rec.selected.length)return rec.selected.slice().sort((a,b)=>(Number(a.day)||1)-(Number(b.day)||1)||(Number(a.order)||0)-(Number(b.order)||0)).map(x=>({placeId:safe(x.id,160),day:Math.max(1,Math.min(60,Number(x.day)||1)),time:''}));if(Array.isArray(rec.placeIds))return rec.placeIds.map(id=>({placeId:safe(id,160),day:1,time:''}));return[]}
function fill(record){clearProposal();places=places.filter(p=>!String(p.id).startsWith('_demo_'));planId=record.id||'';$('planTitle').value=record.title||'我的新旅程';$('startDate').value=record.startDate||today();$('endDate').value=record.endDate||today();$('origin').value=record.origin||'';$('destination').value=record.destination||'';const stops=normalizeStops(record);selected=stops.filter(x=>places.some(p=>String(p.id)===x.placeId)).map(x=>({id:x.placeId,day:x.day,time:x.time||''}));demoMode=false;sortByDay();renderPlans();renderChosen();renderPlaces();renderRoute();changed=false;const missing=stops.length-selected.length;report(missing?'已载入路线，但 '+missing+' 个地点不在本浏览器收藏中。':'路线已载入，可继续编辑。',missing>0)}
async function save(){if(selected.some(s=>String(s.id).startsWith('_demo_'))) {report('演示地点不能保存为个人路线，请移除演示站点。',true);return}if(demoMode){report('演示地点不能保存为个人路线。先在 Footprint Map 添加自己的星标。',true);return}if(!selected.length){report('先从左侧加入至少一个收藏地点。',true);return}if(!requirePrereqs())return;const r=record();try{await putPlan(r);planId=r.id;changed=false;await loadPlans();report('已保存旅行计划：'+r.title+'。个人星标与媒体未被修改。')}catch(err){report('保存失败：'+err.message,true)}}
function newPlan(){if(changed&&!demoMode&&!confirm('当前路线有未保存的修改。新建路线将放弃这些修改，是否继续？'))return;clearProposal();planId='';selected=[];places=places.filter(p=>!String(p.id).startsWith('_demo_'));demoMode=false;$('planTitle').value='我的新旅程';$('startDate').value=today();$('endDate').value=dateAdd(today(),2);$('origin').value='';$('destination').value='';changed=false;renderPlans();renderPlaces();renderChosen();renderRoute();report('新路线已准备好，请选择收藏地点。')}
function showDemo(){demoMode=true;planId='';const demo=[{id:'_demo_shanghai',title:'示例 · 上海',lat:31.2304,lng:121.4737,address:'上海市',note:'D1：从这里出发，开始自己的旅行。',photos:[]},{id:'_demo_ningbo',title:'示例 · 宁波',lat:29.8683,lng:121.5440,address:'宁波市',note:'D2：沿途发现感兴趣的目的地。',photos:[]},{id:'_demo_wenzhou',title:'示例 · 温州',lat:27.9938,lng:120.6994,address:'温州市',note:'D3：带着相机抵达终点，将旅行照片留在地图上。',photos:[]}];places=places.filter(p=>!String(p.id).startsWith('_demo_')).concat(demo);selected=demo.map((p,i)=>({id:p.id,day:i+1,time:['09:00','11:00','15:00'][i]}));$('planTitle').value='示例 · 沿海旅行';$('origin').value='上海';$('destination').value='温州';$('startDate').value=today();$('endDate').value=dateAdd(today(),2);renderPlans();renderPlaces();renderChosen();renderRoute();report('演示模式：展示路线视觉和 D1—D3 交互。真实收藏不会改变。')}
function download(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function promptText(){const lines=[`请以这些由 Footprint Map 收藏地点生成的资料为基础，规划一份可执行的旅行路书。禁止编造未验证的店铺、营业时间、距离或路线耗时。`,`旅行名称：${$('planTitle').value}`,`日期：${$('startDate').value} 至 ${$('endDate').value}`,`出发地：${$('origin').value}`,`目的地：${$('destination').value}`,`路线（请按 D1、D2… 和先后顺序安排，并保留原 Brief）：`];selected.forEach((s,i)=>{const p=places.find(x=>x.id===s.id);if(!p)return;lines.push(`${i+1}. D${s.day} ${s.time||'时间待定'} ${p.title||p.name} | 地址：${p.address||''} | WGS84：${p.lng},${p.lat} | placeId：${p.id}`);if(formatNote(p))lines.push('   Brief：'+formatNote(p));for(const link of sourceLinks(p))lines.push('   参考链接：'+link)});lines.push('请输出：每日时间表、真实导航顺序、景点与文化背景、就餐与住宿建议、可行性检查、风险及待核实事项。外部社交链接若无法访问，请明确标注待人工核对。','———','最后，请额外输出一个可直接导入的路线 JSON，放在 ```json 代码块里，且只包含以下字段：','{"schema":"travel-atlas-journey-v1","stops":[{"placeId":"<沿用上面的 placeId>","day":1,"time":"09:00"}]}','规则：day 从 1 开始、不超过旅行总天数；time 用 24 小时制 HH:MM，不确定就留空 ""。你可以按地理顺序与体验合理性调整 stops 的先后与分天，但不要新增资料之外的地点。');return lines.join('\n')}
const PREREQS=[['startDate','出发日期'],['endDate','结束日期'],['origin','出发地'],['destination','目的地']];
function markPrereqs(ids){for(const [id] of PREREQS){const bad=ids.includes(id);$(id).classList.toggle('field-missing',bad);if(bad)$(id).setAttribute('aria-invalid','true');else $(id).removeAttribute('aria-invalid')}}
function requirePrereqs(){const missing=PREREQS.filter(([id])=>!$(id).value.trim());markPrereqs(missing.map(m=>m[0]));if(missing.length){report('请先补全规划先决条件：'+missing.map(m=>m[1]).join('、')+'。',true);$(missing[0][0]).scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>$(missing[0][0]).focus({preventScroll:true}),320);return false}if($('endDate').value<$('startDate').value){markPrereqs(['startDate','endDate']);report('结束日期不能早于开始日期。',true);$('endDate').focus();return false}return true}
function enable(){for(const id of ['planTitle','startDate','endDate','origin','destination'])$(id).addEventListener('change',()=>{clearProposal();if(id==='startDate'||id==='endDate'){selected.forEach(s=>{s.day=Math.min(currentDays(),Math.max(1,Number(s.day)||1))});sortByDay()}changed=true;renderChosen();renderRoute()});for(const [id] of PREREQS)$(id).addEventListener('input',()=>{$(id).classList.remove('field-missing');$(id).removeAttribute('aria-invalid');const bar=$('status');if(bar.classList.contains('error')){bar.textContent='';bar.classList.remove('error')}});$('placeFilter').oninput=renderPlaces;$('autoArrange').onclick=autoArrange;const undo=document.getElementById('undoProposal');if(undo){undo.hidden=true;undo.onclick=undoProposal};$('exportMarkdown').onclick=downloadMarkdown;$('savedPlans').onchange=()=>{const id=$('savedPlans').value;if(changed&&!demoMode&&!confirm('当前路线有未保存的修改。切换路线会放弃这些修改，是否继续？')){renderPlans();return}if(!id){changed=false;newPlan()}else{const r=allPlans.find(p=>p.id===id);if(r)fill(r)}};$('newPlan').onclick=newPlan;$('savePlan').onclick=save;$('generate').onclick=()=>{if(!requirePrereqs())return;renderRoute();$('atlasTitle').scrollIntoView({behavior:'smooth',block:'start'});report(selected.length?'旅行视觉路书已更新。可以继续调整站点或保存。':'先从左侧选择至少一处已收藏的地点。',!selected.length)};$('printPlan').onclick=()=>window.print();$('exportPlan').onclick=()=>{if(!selected.length){report('没有可导出的路线。',true);return}download(record(),'TravelAtlas_我的路线_'+today()+'.json');report('路线 JSON 已导出，不含私密照片文件。')};$('copyPrompt').onclick=()=>{if(!selected.length){report('先选择地点，才能整理 AI 规划素材。',true);return}if(!requirePrereqs())return;$('aiJsonInput').value='';$('aiImportError').textContent='';$('aiDialog').showModal();$('aiCopy').focus()};$('aiClose').onclick=()=>$('aiDialog').close();$('aiCopy').onclick=async()=>{const text=promptText();try{await navigator.clipboard.writeText(text);report('已复制规划素材（含先决条件、站点坐标、Brief 与 placeId）。粘贴给任意 AI，把返回的 JSON 带回这里导入。')}catch{download({prompt:text},'TravelAtlas_AI规划素材.json');report('浏览器不支持直接复制，已下载 AI 规划素材文件。')}$('aiDialog').close()};$('aiImport').onclick=()=>{const raw=$('aiJsonInput').value.trim();if(!raw){$('aiImportError').textContent='请先粘贴 AI 返回的 JSON。';return}let r;try{const m=raw.match(/```(?:json)?\s*([\s\S]*?)```/);r=JSON.parse(m?m[1]:raw)}catch{$('aiImportError').textContent='无法解析 JSON，请确认完整粘贴了 AI 返回的 ```json 代码块。';return}try{if(r.schema!=='travel-atlas-journey-v1'||!Array.isArray(r.stops))throw Error('不是 Travel Atlas 路线格式');if(r.stops.length>300)throw Error('路线站点过多');const stops=r.stops.map(x=>({placeId:safe(x.placeId,160),day:Math.max(1,Math.min(60,Number(x.day)||1)),time:/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time||'')?x.time:''})).filter(x=>x.placeId);if(!stops.length)throw Error('JSON 里没有有效站点');if(stops.some(x=>x.day>currentDays()))throw Error('建议行程包含超出旅行日期范围的 D 编号');const ids=stops.map(x=>x.placeId);if(new Set(ids).size!==ids.length)throw Error('建议路线包含重复地点');const unknown=ids.filter(id=>!places.some(p=>String(p.id)===id));if(unknown.length)throw Error('AI 返回了 '+unknown.length+' 个不属于当前收藏的地点，请重新规划');rememberProposal();selected=stops.map(x=>({id:x.placeId,day:x.day,time:x.time}));sortByDay();demoMode=false;changed=true;renderChosen();renderPlaces();renderRoute();$('aiDialog').close();report('AI 建议已暂时应用（可撤销）。当前路线尚未保存，请核对 D1/D2、顺序与时间后点「保存路线」。')}catch(err){$('aiImportError').textContent='导入失败：'+err.message}};$('importPlan').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>2e6)throw Error('路线文件过大');const r=JSON.parse(await file.text());if(r.schema!=='travel-atlas-journey-v1'||!Array.isArray(r.stops))throw Error('不是 Travel Atlas 路线格式');if(r.stops.length>300)throw Error('路线站点过多');fill({...r,id:uniqueId(),title:safe(r.title,80),stops:normalizeStops(r)});report('路线已载入，确认后可保存。')}catch(err){report('导入失败：'+err.message,true)}e.target.value=''};window.addEventListener('resize',()=>{const stage=document.querySelector('.route-diagram');if(stage)requestAnimationFrame(()=>drawPath(stage,stage.querySelector('path')))});window.addEventListener('beforeunload',e=>{if(changed&&selected.length&&!demoMode){e.preventDefault()}})}
function takePickerHandoff(){
 if(new URLSearchParams(location.search).get('from')!=='footprint')return;
 let raw=null;try{raw=sessionStorage.getItem('footprint-to-travel-atlas-selection-v1');sessionStorage.removeItem('footprint-to-travel-atlas-selection-v1')}catch{}
 if(!raw){report('未找到主地图的选点记录。请从 Footprint Map 点击「路线」并选择收藏地点。',true);return}
 try{const v=JSON.parse(raw);if(v.schema!=='footprint-to-travel-atlas-selection-v1'||!Array.isArray(v.placeIds)||Date.now()-v.createdAt>3600000||v.createdAt>Date.now()+60000)throw Error('选点记录无效或已过期');
 const ids=[...new Set(v.placeIds.filter(x=>typeof x==='string'&&x.length<200))].slice(0,100);
 selected=ids.filter(id=>places.some(p=>String(p.id)===id)).map(id=>({id,day:1,time:''}));
 const missing=ids.length-selected.length;
 if(selected.length){const last=places.find(p=>String(p.id)===selected.at(-1).id);$('destination').value=last?.title||last?.name||'';renderChosen();renderPlaces();renderRoute();report(`已从 Footprint Map 带入 ${selected.length} 颗收藏星标。下一步请设置旅行日期、出发地，再调整 D1/D2 路线。`+(missing?` 另有 ${missing} 个点未找到，请检查浏览器收藏。`:''),missing>0);changed=true}
 else report('已打开 Travel Atlas，但选中的收藏地点不在当前浏览器数据库。请返回主地图确认。',true);
 }catch(e){report('读取选点记录失败：'+e.message,true)}
 try{history.replaceState(null,'',location.pathname)}catch{}
}
async function init(){newPlan();enable();await Promise.all([loadPlaces(),loadPlans()]);takePickerHandoff();renderRoute();}
init().catch(err=>report('路线功能初始化失败：'+err.message,true));
})();