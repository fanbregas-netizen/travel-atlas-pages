/* V12 approved route-detail visual / shared placeId adapter.
 * Reuses the V5 #sheet, onMapPin and B spring. NO new sheet, map, route state,
 * persistent store, gesture owner or media Gallery is instantiated here. */
(()=>{'use strict';
const $=id=>document.getElementById(id), pins=$('pins'), stage=$('stage'),
      sheetBody=$('sheet-body'), sheetTitle=$('sheet-title');
if(!pins||!stage||!sheetBody||!sheetTitle||window.__fpV12RouteDetail)return;
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e};
const readRepo=()=>window.FootprintMediaCore?.createRepository(window.indexedDB);
const urlSafe=value=>{try{const u=new URL(value);return /^(https?:)$/.test(u.protocol)?u.href:null}catch{return null}};
const idOf=el=>el?.closest('[data-pin]')?.getAttribute('data-pin')||'';
const titleOf=el=>el?.getAttribute('aria-label')||'路线地点';
const findPin=id=>[...pins.querySelectorAll('[data-pin]')].find(el=>idOf(el)===id)||null;
const isDetail=()=>{const t=sheetTitle.textContent.trim();return t==='地点详情'||!!(activeId&&sheetTitle.dataset.v12PlaceId===activeId&&t===currentTitle)};
let activeId='',currentTitle='',bypass=false,token=0,renderQueued=false,bubbleId='',pinWatcher=null;
const popup=make('button','');popup.id='v12-place-bubble';popup.hidden=true;popup.type='button';popup.setAttribute('aria-label','打开路线地点详情');
popup.append(make('img'),make('span','v12-bubble-text'),make('span','v12-bubble-more','查看 ›'));
popup.querySelector('img').src='./icons/04_star_saved.svg';popup.querySelector('img').alt='';
stage.append(popup);
function hideBubble(){popup.hidden=true;bubbleId='';pinWatcher?.disconnect();pinWatcher=null;}
function placeBubble(){
 if(popup.hidden||!bubbleId)return;
 const pin=findPin(bubbleId);
 if(!pin||pin.hidden){hideBubble();return}
 const st=stage.getBoundingClientRect(),r=pin.getBoundingClientRect(),
       sheetTop=$('sheet')?.getBoundingClientRect().top||st.bottom;
 const x=Math.max(92,Math.min(st.width-92,r.left-st.left+r.width/2));
 const y=Math.max(115,Math.min(sheetTop-st.top-8,r.top-st.top-13));
 popup.style.left=x+'px';popup.style.top=y+'px';
}
function showBubble(pin){
 hideBubble();bubbleId=idOf(pin);currentTitle=titleOf(pin);
 popup.dataset.placeId=bubbleId;popup.querySelector('.v12-bubble-text').textContent=currentTitle;
 popup.setAttribute('aria-label','查看'+currentTitle+'的详情');
 popup.hidden=false;placeBubble();
 const token=pin.querySelector('.fp-route-poi-token');
 if(token)window.AtlasPOIMotion?.popSelected?.(token);
 window.FootprintRouteV5Real?.focusPin?.(bubbleId);
 pinWatcher=new MutationObserver(()=>requestAnimationFrame(placeBubble));
 pinWatcher.observe(pins,{subtree:true,attributes:true,attributeFilter:['style','hidden'],childList:true});
}
pins.addEventListener('click',e=>{
 const pin=e.target.closest('[data-pin]');if(!pin||bypass)return;
 // The original onMapPin remains the sole owner in route setup/picking.
 if(window.__footprintV5Demo?.state?.()?.step!=='view')return;
 e.preventDefault();e.stopImmediatePropagation();showBubble(pin);
},true);
popup.addEventListener('click',()=>{
 const id=bubbleId, pin=findPin(id);if(!pin)return hideBubble();
 activeId=id;currentTitle=titleOf(pin);hideBubble();bypass=true;
 try{pin.click()}finally{bypass=false}
 queueDetail();
});
document.addEventListener('click',e=>{
 if(!popup.hidden&&!e.target.closest('#v12-place-bubble,[data-pin]'))hideBubble();
},true);
window.addEventListener('resize',()=>requestAnimationFrame(placeBubble),{passive:true});
function queueDetail(){
 if(renderQueued)return;renderQueued=true;
 queueMicrotask(()=>{renderQueued=false;if(!isDetail()){activeId='';return}if(activeId)void renderPlace(activeId)});
}
new MutationObserver(queueDetail).observe(sheetTitle,{childList:true,characterData:true,subtree:true});
function section(index,label,action,labelAction){
 const s=make('section','fp-block'),h=make('div','fp-subheading');
 h.append(make('span','fp-section-index',index),make('strong','fp-section-label',label));
 if(action){const b=make('button','v12-action',labelAction);b.type='button';b.dataset.v12Action=action;h.append(b)}
 s.append(h);return s;
}
function button(label,action,kind){const b=make('button','v12-'+(kind||'secondary'),label);b.type='button';b.dataset.v12Action=action;return b}
function anchors(place){
 const all=[...(Array.isArray(place.references)?place.references:[]),...(Array.isArray(place.guides)?place.guides:[])];
 if(place.url)all.push(place.url);if(place.link)all.push(place.link);
 const uniq=new Set(),out=[];
 for(const x of all){const link=urlSafe(typeof x==='string'?x:(x?.url||x?.link||''));if(!link||uniq.has(link))continue;uniq.add(link);out.push({url:link,title:typeof x==='string'?'查看原始内容':String(x.title||x.source||'查看原始内容')})}
 return out;
}
function near(place,records){
 const lat=+place.lat,lng=+place.lng;if(!Number.isFinite(lat)||!Number.isFinite(lng))return [];
 const rad=Math.PI/180;
 const list=records.filter(x=>x?.id!==place.id&&Number.isFinite(+x.lat)&&Number.isFinite(+x.lng)).map(x=>{
  const a=(+x.lat-lat)*rad,b=(+x.lng-lng)*rad;
  const h=Math.sin(a/2)**2+Math.cos(lat*rad)*Math.cos(+x.lat*rad)*Math.sin(b/2)**2;
  return {id:String(x.id),title:String(x.title||x.name||'收藏地点'),meters:Math.round(12742000*Math.asin(Math.sqrt(Math.min(1,h))))};
 }).filter(x=>x.meters<20000).sort((a,b)=>a.meters-b.meters);
 return list.slice(0,4);
}
function mediaButton(src,id,video){
 const e=make('button','v12-media-tile');e.type='button';e.dataset.v12Action='home-media';
 e.setAttribute('aria-label',video?'在地点卡片打开视频':'在地点卡片查看照片');
 if(video){const img=make('img','v12-video-symbol');img.src='./icons/12_video.svg';img.alt='';e.append(img)}
 else{const img=make('img');img.alt='已保存的旅行照片';img.loading='lazy';img.src=src;e.append(img)}
 return e;
}
let record=null,repo=null,busy=false,mode='';
async function renderPlace(id){
 const n=++token,owner=sheetBody;
 if(!isDetail()||activeId!==id)return;
 if(owner.querySelector('.v12-route-sections')?.dataset.placeId===id)return;
 try{
  repo=readRepo();if(!repo)throw Error('媒体数据接口未就绪');
  const [p,all]=await Promise.all([repo.read(id),repo.list()]);
  if(n!==token||activeId!==id||!isDetail())return;
  record=p||{id,title:currentTitle,stage:'plan',note:'',photos:[],videos:[],guides:[]};
  mode='';
  const resolvedTitle=String(record.title||record.name||currentTitle);
  currentTitle=resolvedTitle;sheetTitle.dataset.v12PlaceId=id;sheetTitle.textContent=resolvedTitle;
  const order=window.__footprintV5Demo?.state?.()?.order||[];
  const position=order.indexOf(id),label=record.stage==='visited'?'已到访':'想去';
  const count=$('sheet-count');if(count)count.textContent=label+(position>=0?' · 第 '+(position+1)+' 站':' · 路线地点');
  const wrap=make('div','v12-route-sections');wrap.dataset.placeId=id;
  const summ=make('div','v12-summary');
  summ.append(make('div','v12-meta','与主页收藏地点共享 Brief、影像和相关资料'));
  wrap.append(summ);
  const brief=section('01',record.stage==='visited'?'旅行手记':'为什么想去','edit-brief','编辑');
  brief.append(make('p','v12-body',String(record.note||record.brief||'').trim()||'暂无记录'));
  wrap.append(brief);
  const media=section('02','照片与视频','home-media','打开影像');
  const photos=(Array.isArray(record.photos)?record.photos:[]).filter(p=>typeof p.src==='string'&&/^data:image\/(?:jpeg|png|webp);base64,/i.test(p.src));
  const videos=Array.isArray(record.videos)?record.videos:[];
  if(photos.length+videos.length){const grid=make('div','v12-media-grid');for(const p of photos.slice(0,4))grid.append(mediaButton(p.src,id,false));if(videos.length)grid.append(mediaButton('',id,true));media.append(grid,make('p','v12-hint',photos.length+' 张照片 · '+videos.length+' 条视频 · 点选在主页使用 V9 全屏影像'))}
  else media.append(make('div','v12-empty','还没有照片或视频。可从主页地点卡片添加'));
  wrap.append(media);
  const links=section('03','相关资料','edit-link','＋ 链接'),list=make('div','v12-link-list');
  const entries=anchors(record);
  for(const item of entries.slice(0,12)){const a=make('a','',item.title);a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';list.append(a)}
  links.append(entries.length?list:make('div','v12-empty','还没有相关资料'));
  wrap.append(links);
  const neighbors=section('04','附近地点','home-place','在地图查看'),nearlist=make('div','v12-near-list'),nearby=near(record,all);
  for(const item of nearby){const a=make('a','',item.title+' · '+(item.meters>=1000?(item.meters/1000).toFixed(1)+' 公里':item.meters+' 米'));a.href='./index.html?openPlace='+encodeURIComponent(item.id);nearlist.append(a)}
  neighbors.append(nearby.length?nearlist:make('div','v12-empty','附近没有已收藏的地点'));
  wrap.append(neighbors);
  if(n!==token||!isDetail()||activeId!==id)return;
  owner.replaceChildren(wrap);
 }catch(error){if(activeId===id){owner.replaceChildren(make('p','v12-hint','地点内容读取失败：'+(error?.message||'请检查存储权限')));console.warn('[V12] route place content unavailable',error)}}
}
const navigate=(kind,id)=>{
 const url='./index.html?'+kind+'='+encodeURIComponent(id);
 location.assign(url);
};
sheetBody.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-v12-action]');if(!btn||!activeId||busy)return;
 const action=btn.dataset.v12Action;
 if(action==='home-media')return navigate('mediaPlace',activeId);
 if(action==='home-place')return navigate('openPlace',activeId);
 if(!record||!repo)return;
 const section=btn.closest('.fp-block');if(!section)return;
 if(action==='edit-brief'||action==='edit-link'){
  const kind=action==='edit-brief'?'brief':'link';mode=kind;
  const value=make('div','v12-editor'),fields=[];
  const a=make('textarea');a.placeholder=kind==='brief'?'记录想去的理由或旅行手记…':'粘贴包含 https:// 的分享链接';
  a.maxLength=kind==='brief'?12000:4200;a.value=kind==='brief'?String(record.note||record.brief||''):'';
  fields.push(a);value.append(a);
  if(kind==='link'){const b=make('input');b.type='text';b.maxLength=150;b.placeholder='资料标题（可选）';fields.push(b);value.append(b)}
  const row=make('div','v12-actions');row.append(button('取消','cancel'),button('保存','save-'+kind,'primary'));value.append(row);
  const existing=section.querySelector('.v12-editor');if(existing)existing.remove();
  section.append(value);a.focus();return;
 }
 if(action==='cancel'){section.querySelector('.v12-editor')?.remove();mode='';window.__footprintV5Demo?.snap?.('half');return}
 if(action==='save-brief'||action==='save-link'){
  const editor=section.querySelector('.v12-editor');if(!editor)return;
  const inputs=editor.querySelectorAll('textarea,input'),raw=inputs[0]?.value||'';
  busy=true;btn.disabled=true;
  try{
   if(action==='save-brief')await repo.saveBrief(activeId,raw.trim());
   else{
    const m=raw.match(/https?:\/\/[^\s<>，。；;）)]+/i),href=urlSafe(m?.[0]||'');
    if(!href)throw Error('请粘贴有效的 http(s) 链接');
    if(anchors(record).some(x=>x.url===href))throw Error('这个链接已经收藏过了');
    await repo.saveGuide(activeId,{url:href,title:inputs[1]?.value?.trim()||'查看原始内容',createdAt:new Date().toISOString()});
   }
   sheetBody.querySelector('.v12-route-sections')?.remove();await renderPlace(activeId);
   window.__footprintV5Demo?.snap?.('half');
   document.dispatchEvent(new Event('atlas:source-updated'));
  }catch(error){const tip=editor.querySelector('.v12-error')||make('p','v12-hint v12-error');tip.textContent='保存失败：'+(error?.message||'请重试');editor.append(tip)}
  finally{busy=false;btn.disabled=false}return;
 }
});
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&activeId&&isDetail()){sheetBody.querySelector('.v12-route-sections')?.remove();void renderPlace(activeId)}
});
window.__fpV12RouteDetail=Object.freeze({version:'V12-shared-placeId',getState:()=>({activeId,bubbleId,open:isDetail(),hasSharedSections:!!sheetBody.querySelector('.v12-route-sections')})});
})();