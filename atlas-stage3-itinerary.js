/* Travel Atlas stage 3 | Read-only D1–Dn roadbook, driving preview opt-in. */
(function(root){
'use strict';
let bridge=null,dialog=null,days=null,summary=null,status=null,roadButton=null,resetButton=null;
let result=null,controller=null,busy=false;
const $=id=>document.getElementById(id);
const make=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x};
const name=p=>String(p.title||p.name||'收藏地点').slice(0,90);
const stops=()=>bridge?.getPlaces()||[];
const engine=()=>root.AtlasRoadRouting;
function amapLeg(previous,point){
 if(!previous)return bridge.navigationUrl(point);
 const [flng,flat]=bridge.toGCJ(+previous.lng,+previous.lat),[tlng,tlat]=bridge.toGCJ(+point.lng,+point.lat);
 const format=(lng,lat,p)=>lng.toFixed(6)+','+lat.toFixed(6)+','+name(p).slice(0,60);
 return 'https://uri.amap.com/navigation?'+new URLSearchParams({
  from:format(flng,flat,previous),to:format(tlng,tlat,point),
  mode:'car',src:'travel_atlas',callnative:'1'
 }).toString();
}
function build(){
 if(dialog)return;
 const dock=$('stopsDock')?.querySelector('.dock-actions');
 if(!dock)throw Error('路线工具栏不存在');
 const entry=make('button','atlas-day-entry','每日行程');entry.id='atlasDayEntry';entry.type='button';
 entry.setAttribute('aria-label','查看旅行每日行程');entry.onclick=open;
 dock.insertBefore(entry,$('saveRoute'));
 dialog=make('dialog','atlas-day-dialog');dialog.id='atlasDayDialog';
 dialog.setAttribute('aria-label','每日行程与道路规划');
 dialog.innerHTML='<div class="atlas-day-head"><div><small>TRAVEL ATLAS / ROADBOOK</small><h2>每日行程</h2></div><button id="atlasDayClose" type="button" class="atlas-day-close" aria-label="关闭">×</button></div>'+
 '<div id="atlasDayList" class="atlas-day-scroll"></div>'+
 '<div class="atlas-day-foot"><div class="atlas-day-summary" id="atlasDaySummary"></div>'+
 '<p class="atlas-day-disclosure">只有主动点击「道路试算」，才会将所选地点的经纬度发送到 OSRM 公共试算服务；不会发送 Brief、图片或视频。结果不含实时路况，也不是正式导航。</p>'+
 '<div class="atlas-day-actions"><button id="atlasRoadRun" class="atlas-road-run" type="button">道路试算（需联网）</button><button id="atlasRoadReset" type="button" hidden>恢复示意线</button><button id="atlasRoadExport" type="button">导出路书</button></div>'+
 '<p id="atlasRoadStatus" class="atlas-day-status" role="status" aria-live="polite"></p>'+
 '<small class="atlas-day-attribution">道路：© OpenStreetMap contributors · OSRM demo；正式导航：高德地图</small></div>';
 document.body.append(dialog);
 days=$('atlasDayList');summary=$('atlasDaySummary');status=$('atlasRoadStatus');
 roadButton=$('atlasRoadRun');resetButton=$('atlasRoadReset');
 $('atlasDayClose').onclick=close;
 roadButton.onclick=calculate;
 resetButton.onclick=reset;
 $('atlasRoadExport').onclick=exportMarkdown;
 dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
 dialog.addEventListener('click',e=>{if(e.target===dialog)close()});
 root.addEventListener('pagehide',()=>controller?.abort());
}
function render(){
 if(!dialog)return;
 days.replaceChildren();
 const list=stops(),count=Math.max(1,Math.min(60,bridge?.dayCount()||1)),service=engine();
 for(let day=1;day<=count;day++){
  const section=make('section','atlas-day-card');
  const date=bridge.dateForDay(day);
  section.append(make('h3','', 'D'+day+' · '+(date||'日期待定')));
  const items=list.map((p,i)=>({p,i})).filter(x=>bridge.dayForStop(x.i)===day);
  if(!items.length)section.append(make('p','atlas-day-empty','这一天尚未安排地点。'));
  for(const item of items){
   const p=item.p,i=item.i,box=make('article','atlas-day-stop'),head=make('div','atlas-day-stop-head');
   head.append(make('span','atlas-day-stop-number',String(i+1)),make('strong','atlas-day-stop-title',name(p)));
   box.append(head);
   const note=String(p.note||p.brief||p.description||'').slice(0,180).trim();
   if(note)box.append(make('p','atlas-day-note',note));
   const nav=make('a','atlas-day-nav',i?'上一站 → 本站 · 高德导航 ↗':'从当前位置导航 ↗');
   nav.href=amapLeg(i?list[i-1]:null,p);nav.target='_blank';nav.rel='noopener noreferrer';box.append(nav);
   if(i){
    const l=result?.legs?.[i-1];
    const txt=l&&service?
      '道路试算：'+service.formatDistance(l.distanceM)+' · 约 '+service.formatDuration(l.durationSec):
      '上一站至本站的道路距离、车程尚未核实';
    box.append(make('small','atlas-day-metric',txt));
   }
   section.append(box);
  }
  days.append(section);
 }
 summary.textContent=result&&service?
  'OSRM 道路试算总计：'+service.formatDistance(result.distanceM)+' · 约 '+service.formatDuration(result.durationSec):
  list.length+' 站 · '+count+' 天 · 按收藏顺序规划';
 roadButton.disabled=busy||!!result||list.length<2||list.length>(service?.MAX_STOPS||12);
 roadButton.textContent=busy?'道路计算中…':result?'✓ 道路已试算':list.length>12?'超过 12 站，请逐段导航':'道路试算（需联网）';
 resetButton.hidden=!result;
}
function open(){if(!stops().length)return;build();render();if(!dialog.open)dialog.showModal()}
function close(){controller?.abort();controller=null;busy=false;if(dialog?.open)dialog.close()}
function redraw(){
 document.body.classList.toggle('atlas-real-road',!!result);
 const legend=$('routeLegend');
 if(legend)legend.textContent=result?'OSRM / OpenStreetMap 道路试算 · 非实时路况':
  '依照选择顺序连线 · 线路仅供规划示意，非真实道路导航';
 bridge?.redraw?.();
}
function reset(){
 controller?.abort();controller=null;result=null;busy=false;
 if(status)status.textContent='已恢复地点顺序示意线。';
 redraw();render();
}
async function calculate(){
 if(busy||result||stops().length<2)return;
 const service=engine();if(!service){status.textContent='试算服务组件未加载，请使用高德导航';return}
 if(stops().length>service.MAX_STOPS){status.textContent='公开试算最多支持 12 站';return}
 busy=true;controller=new AbortController();const signal=controller.signal;
 status.textContent='正在联系 OSRM 公共道路试算服务…';render();
 try{
  const data=await service.calculate(stops(),{signal});
  if(signal.aborted)return;
  result=data;status.textContent='道路试算成功。请在高德核实实时路况、限行与道路施工。';
  redraw();
 }catch(e){
  if(!signal.aborted)status.textContent='道路试算失败：'+String(e?.message||'网络不可用').slice(0,170)+'。保留原示意线，请使用高德导航。';
 }finally{busy=false;if(controller?.signal===signal)controller=null;render()}
}
function roadPath(map){
 const coords=result?.coordinates;if(!coords?.length||!map)return null;
 const stride=Math.max(1,Math.ceil(coords.length/1250));let d='';
 for(let i=0;i<coords.length;i+=stride){
  const p=map.project(coords[i]);d+=(d?' L ':'M ')+p.x.toFixed(1)+' '+p.y.toFixed(1);
 }
 if((coords.length-1)%stride!==0){
  const p=map.project(coords[coords.length-1]);d+=' L '+p.x.toFixed(1)+' '+p.y.toFixed(1);
 }
 return d;
}
function sourceLinks(p){
 const raw=[...(Array.isArray(p.references)?p.references:[]),...(Array.isArray(p.guides)?p.guides:[]),p.url,p.link];
 const valid=[];
 for(const item of raw){
  const u=typeof item==='string'?item:item?.url||item?.link||'';
  try{const url=new URL(u);if(['https:','http:'].includes(url.protocol)&&!valid.includes(url.href))valid.push(url.href)}catch(_){}
 }
 return valid.slice(0,5);
}
function markdown(){
 const list=stops(),service=engine(),p=bridge.getPayload()||{};
 const lines=['# '+String(p.title||'我的旅行').slice(0,100),'',
  '日期：'+String(p.startDate||'待定')+' 至 '+String(p.endDate||'待定'),
  '来源：Footprint Map 私人收藏引用（未复制媒体文件）',
  result&&service?'OSRM 道路试算：'+service.formatDistance(result.distanceM)+'，约 '+service.formatDuration(result.durationSec):'道路时间：未试算',
  '注意：道路试算不含实时路况，实际行程请使用高德导航。'];
 for(let day=1;day<=Math.max(1,Math.min(60,bridge.dayCount()));day++){
  lines.push('','## D'+day+' · '+(bridge.dateForDay(day)||'日期待定'));
  const entries=list.map((p,i)=>({p,i})).filter(x=>bridge.dayForStop(x.i)===day);
  if(!entries.length){lines.push('尚未安排地点');continue}
  for(const x of entries){
   lines.push('','### '+(x.i+1)+'. '+name(x.p));
   if(x.p.address)lines.push('地址：'+String(x.p.address).slice(0,180));
   const brief=String(x.p.note||x.p.brief||x.p.description||'').slice(0,1200);
   if(brief)lines.push('Brief：'+brief);
   if(result?.legs?.[x.i-1]&&service){
    const l=result.legs[x.i-1];lines.push('上一站至本站道路试算：'+service.formatDistance(l.distanceM)+' / 约 '+service.formatDuration(l.durationSec));
   }
   lines.push('高德导航：'+amapLeg(x.i?list[x.i-1]:null,x.p));
   for(const link of sourceLinks(x.p))lines.push('收藏链接：'+link);
  }
 }
 lines.push('','## 待核实','- 高德道路交通、限行、施工','- 景点时间、门票和住宿','- 社交来源信息是否有效');
 return lines.join('\n');
}
function exportMarkdown(){
 if(!stops().length)return;
 const b=new Blob([markdown()],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(b),a=make('a');
 a.href=url;a.download='TravelAtlas_行程路书_'+new Date().toLocaleDateString('sv-SE')+'.md';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2200);
 status.textContent='已导出 Markdown 路书；个人照片和视频仍保存在本机。';
}
function attach(api){
 if(!api?.getPlaces||!api?.dayForStop||!api?.redraw)throw Error('路线页面未正确准备');
 bridge=api;build();
}
const exported={attach,open,close,reset,roadPath,markdown,get road(){return result}};
root.AtlasStage3Itinerary=exported;
if(typeof module==='object'&&module.exports)module.exports=exported;
})(typeof window!=='undefined'?window:globalThis);
