/* Footprint Map · in-place Apple-Maps-inspired search, then a compact saved-star photo collage.
 * No personal content is uploaded to this site. Keeps existing private-travel-footprints-v1.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const h=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e};
const getList=()=>{try{return JSON.parse(localStorage.getItem('fp-search-history-v1')||'[]').filter(x=>x&&typeof x.q==='string').slice(0,8)}catch{return []}};
const saveHistory=item=>{try{const all=getList().filter(x=>x.q!==item.q);all.unshift(item);localStorage.setItem('fp-search-history-v1',JSON.stringify(all.slice(0,8)))}catch{}};
const urlOf=x=>{try{const u=new URL(String(x||'').trim());return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
const safe=(n,lo,hi)=>Number.isFinite(+n)&&+n>=lo&&+n<=hi;
const isPhoto=file=>file.type.startsWith('image/')||/\.(jpe?g|png|webp|heic)$/i.test(file.name);
let searchSheet,searchVeil,searchInput,searchBody,searchTimer,searchController=null,searchToken=0,activeSearch=false,searchUsed=false;
let placeCard,activePlaceId='',editMode='',busy=false;
const tileVideos=new Set();
function stopTileVideos(){for(const v of tileVideos){try{v.pause();v.removeAttribute('src');v.load();URL.revokeObjectURL(v.dataset.sourceUrl)}catch(_){}}tileVideos.clear()}
const btn=(label,fn,cls='')=>{const b=h('button',cls,label);b.type='button';b.addEventListener('click',fn);return b};
function setViewport(){if(!searchSheet)return;const vv=window.visualViewport;const visible=vv?.height||window.innerHeight;const bottom=vv?Math.max(0,window.innerHeight-vv.height-vv.offsetTop):0;document.documentElement.style.setProperty('--fp-vh',visible+'px');document.documentElement.style.setProperty('--fp-keyboard',bottom+'px')}
function searchReset(){searchController?.abort();searchController=null;clearTimeout(searchTimer);searchToken++}
function searchRows(rows,header){const wrap=h('div');if(header)wrap.append(h('div','fp-search-label',header));for(const x of rows){const row=btn('',()=>chooseResult(x),'fp-search-row');row.append(h('span','fp-row-icon',x.saved?'☆':x.history?'↗':'⌖'));const label=h('span','fp-row-main');label.append(h('strong','',x.name||x.q),h('small','',x.description||x.display_name||x.address|| (x.saved?'已收藏的地点':'地图地点')));row.append(label,h('span','fp-row-arrow','›'));wrap.append(row)}return wrap}
function drawSearchStart(){searchBody.replaceChildren();const recent=getList();if(recent.length)searchBody.append(searchRows(recent.map(x=>({...x,history:true})), '最近搜索'))}
function initSearch(){const dock=$('searchDock'),original=$('searchInput'),form=$('searchForm');if(!dock||!original||!form)return;
 searchVeil=h('div');searchVeil.id='fpSearchVeil';searchVeil.hidden=true;
 searchSheet=h('section');searchSheet.id='fpSearchSheet';searchSheet.hidden=true;searchSheet.setAttribute('role','dialog');searchSheet.setAttribute('aria-label','搜索地点');searchSheet.setAttribute('aria-modal','false');
 const top=h('div','fp-search-top'),grip=h('div','fp-search-grip'),head=h('div','fp-search-head');head.append(btn('×',closeSearch,'fp-search-close'));const bar=h('form','fp-search-bar');bar.setAttribute('role','search');bar.addEventListener('submit',e=>{e.preventDefault();searchNow(searchInput.value,true)});const icon=h('span','fp-magnify','⌕');searchInput=h('input');searchInput.id='fpSearchField';searchInput.type='search';searchInput.placeholder='地点、地址、景点、咖啡馆…';searchInput.autocomplete='off';searchInput.setAttribute('enterkeyhint','search');searchInput.setAttribute('aria-label','搜索真实地图地点');const clear=btn('×',()=>{searchInput.value='';drawSearchStart();searchInput.focus()},'fp-search-clear');bar.append(icon,searchInput,clear);top.append(grip,head,bar);searchBody=h('div','fp-search-body');searchSheet.append(top,searchBody);document.body.append(searchVeil,searchSheet);drawSearchStart();
 // A readonly 16px launcher prevents Safari from focusing the map's original input and zooming the page.
 original.readOnly=true;original.setAttribute('aria-haspopup','dialog');original.setAttribute('aria-controls','fpSearchSheet');original.setAttribute('inputmode','none');original.style.fontSize='16px';
 /* build .16 · 规划模式下 ↗ 归 trip-picker：不抢搜素大卡 */
 dock.addEventListener('pointerdown',e=>{if(e.target.closest('#searchForm')){if(document.body.classList.contains('route-pick-active')&&e.target.closest('.dock-go'))return;e.preventDefault();openSearch()}},true);
 form.addEventListener('submit',e=>{e.preventDefault();if(document.body.classList.contains('route-pick-active'))return;e.stopImmediatePropagation();openSearch()},true);
 original.addEventListener('click',e=>{e.stopImmediatePropagation();openSearch()},true);
 original.addEventListener('focus',()=>{original.blur();openSearch()},true);
 searchInput.addEventListener('input',()=>{const q=searchInput.value.trim();searchReset();if(q.length<2){if(!q)drawSearchStart();else searchBody.replaceChildren(h('div','fp-search-empty','继续输入地点名称…'));return}searchTimer=setTimeout(()=>searchNow(q,false),370)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('fpMediaViewer')){if(activeSearch)closeSearch();else if(activePlaceId)closePlace()}});
 window.visualViewport?.addEventListener('resize',setViewport,{passive:true});window.visualViewport?.addEventListener('scroll',setViewport,{passive:true});window.addEventListener('resize',setViewport,{passive:true});
}
function openSearch(){if(activeSearch)return;if(activePlaceId)closePlace();searchReset();activeSearch=true;searchUsed=false;searchSheet.hidden=false;setViewport();document.body.classList.remove('fp34-search-returning');document.body.classList.add('fp34-searching','fp-search-open');searchInput.value='';drawSearchStart();window.setTimeout(()=>{document.body.classList.remove('fp34-searching');if(activeSearch)searchInput.focus({preventScroll:true})},380)}
function closeSearch(){if(!activeSearch)return;activeSearch=false;searchReset();searchInput.blur();document.body.classList.remove('fp-search-open','fp34-searching');document.body.classList.add('fp34-search-returning');searchSheet.hidden=true;searchVeil.hidden=true;window.setTimeout(()=>document.body.classList.remove('fp34-search-returning'),350);const old=$('searchInput');if(old)old.value='';setViewport()}
window.__fpCloseSearch=()=>closeSearch();
async function searchNow(q,submitted){q=String(q||'').trim();searchReset();if(!q){drawSearchStart();return}searchUsed=true;const token=++searchToken;const matches=await readPlaces().then(rows=>rows.filter(p=>p.starred!==false&&String(p.title||'').toLocaleLowerCase().includes(q.toLocaleLowerCase())).slice(0,7).map(p=>({id:p.id,name:p.title,saved:true,lat:p.lat,lon:p.lng,description:'我的收藏 · 想去原因与旅行照片'}))).catch(()=>[]);if(token!==searchToken||!activeSearch)return;searchBody.replaceChildren();if(matches.length)searchBody.append(searchRows(matches,'我的收藏'));
 if(!submitted&&q.length<2)return;
 if(!window.AtlasServices?.search){if(!matches.length)searchBody.append(h('div','fp-search-empty','地图搜索服务未准备好，请重试。'));return}
 searchController=new AbortController();const controller=searchController;const status=h('div','fp-search-empty','正在搜索真实地点…');searchBody.append(status);
 try{const results=await window.AtlasServices.search(q,{signal:controller.signal,center:window.__fpSearchCenter?.(),allowFallback:submitted});if(token!==searchToken||!activeSearch)return;status.remove();const existing=new Set(matches.map(x=>String(x.name).trim()+':'+Number(x.lat).toFixed(3)));const filtered=(Array.isArray(results)?results:[]).map(x=>({...x,lon:Number(x.lon??x.lng),lat:Number(x.lat)})).filter(x=>safe(x.lat,-90,90)&&safe(x.lon,-180,180)&&!existing.has(String(x.name).trim()+':'+x.lat.toFixed(3))).slice(0,12);if(filtered.length)searchBody.append(searchRows(filtered,'地图地点'));else if(!matches.length)searchBody.append(h('div','fp-search-empty','没有找到这个地点。试试「城市 + 地点名」，或返回地图手动选点。'));if(submitted)saveHistory({q,name:q,description:'搜索记录'})}
 catch(err){if(!controller.signal.aborted&&token===searchToken&&activeSearch){status.textContent='搜索暂时不可用。可以重试或继续查看已经收藏的地点。'}}
}
function chooseResult(place){closeSearch();const name=place.name||place.q||'地点';if(place.saved&&place.id){window.__atlasDemo?.openSaved?.(place.id);return}if(!safe(place.lat,-90,90)||!safe(place.lon??place.lng,-180,180)){openSearch();searchInput.value=name;searchNow(name,true);return}saveHistory({q:name,name,lat:place.lat,lon:place.lon,description:place.display_name||place.description||''});const data={name,lat:Number(place.lat),lng:Number(place.lon??place.lng),address:place.display_name||place.address||'',category:place.type||'地点',id:place.id||''};if(typeof window.__fpSearchSelect==='function')window.__fpSearchSelect(data);else window.__atlasDemo?.select?.(data.name,data.lat,data.lng)}
function repository(){return window.FootprintMediaCore.createRepository(window.indexedDB)}
async function readPlaces(){
 try{return await repository().list()}catch(error){
  if(window.__atlasPlaceStore)return window.__atlasPlaceStore.readAll();
  throw error;
 }
}
async function readPlace(id){
 try{return await repository().read(id)}catch(error){
  if(window.__atlasPlaceStore)return (await window.__atlasPlaceStore.readAll()).find(place=>place.id===id)||null;
  throw error;
 }
}
const mediaOf=p=>[...(Array.isArray(p.photos)?p.photos:[]).filter(x=>typeof x.src==='string'&&/^data:image\/(jpeg|png|webp);base64,/i.test(x.src)).map(x=>({...x,kind:'photo'})),...(Array.isArray(p.videos)?p.videos:[]).filter(x=>x.bytes||x.blob).map(x=>({...x,kind:'video'}))];
const linksOf=p=>{const o=[...(Array.isArray(p.references)?p.references:[]),...(Array.isArray(p.guides)?p.guides:[])];if(p.url)o.push(p.url);if(p.link)o.push(p.link);const u=new Set();return o.map(x=>typeof x==='string'?{url:x,title:''}:{url:x?.url||x?.link||'',title:x?.title||''}).filter(x=>{x.url=urlOf(x.url);if(!x.url||u.has(x.url))return false;u.add(x.url);return true})};
function sourceName(url){try{const host=new URL(url).hostname.replace(/^www\./,'');return /xiaohongshu/.test(host)?'小红书':/bilibili/.test(host)?'Bilibili':/youtube|youtu\.be/.test(host)?'YouTube':/weixin|qq\.com/.test(host)?'微信公众号':host}catch{return '社交链接'}}
function sectionHeading(number,name,button){const bar=h('div','fp-subheading');bar.append(h('strong','',number+' / '+name));if(button)bar.append(button);return bar}
function feedback(msg){const e=$('fpCardFeedback');if(e)e.textContent=msg}
function mountPlace(){if(placeCard)return;placeCard=h('article');placeCard.id='fpPlaceCard';placeCard.hidden=true;placeCard.setAttribute('role','dialog');placeCard.setAttribute('aria-modal','false');placeCard.setAttribute('aria-label','收藏地点详情');document.body.append(placeCard); /* V3 physical B owns all card swipes: no additional legacy touch handlers. */
 document.addEventListener('atlas:memory-open',e=>{if(window.__atlasPreferCollage!==false)showPlaceCard(e.detail?.id)});
 // Unified B controller owns backdrop dismissal after pointerup; map dragging must not close the card.
 document.addEventListener('atlas:source-updated',()=>{if(activePlaceId)showPlaceCard(activePlaceId,false)});
 const originalSheet=$('memorySheet');if(originalSheet)new MutationObserver(()=>{if(activePlaceId&&!originalSheet.classList.contains('visible'))closePlace()}).observe(originalSheet,{attributes:true,attributeFilter:['class']});
 const qs=new URLSearchParams(location.search);const source=qs.get('sourcePlace'),media=qs.get('mediaPlace');if(source||media){const target=source||media;let count=0;const t=setInterval(()=>{count++;if(typeof window.__atlasDemo?.openSaved==='function'){clearInterval(t);window.__atlasDemo.openSaved(target);editMode=source?'link':'media';setTimeout(()=>renderPlace(target),120);history.replaceState(null,'',location.pathname)}if(count>32)clearInterval(t)},250)}
}
function closePlace(){if(!activePlaceId)return;++selectionRevision;++renderRevision;closeViewer(true);stopTileVideos();activePlaceId='';editMode='';placeCard.hidden=true;window.__atlasSheetIntegration?.card.close();document.body.classList.remove('fp-place-open');const close=$('closeMemory');if(close)close.click();}
window.__atlasClosePlace=closePlace;
/* build .21 · 用户批注：划卡片要有响应——捏住眉头/内容到顶继续下拉即随手势下滑，松手过阈值关闭（对齐抽屉与高德/苹果 sheet） */
let selectionRevision=0,renderRevision=0;
async function showPlaceCard(id){
 if(!id)return;
 const revision=++selectionRevision;
 if(activePlaceId!==id){
  closeViewer(true);
  placeCard.classList.remove('fp-editing');
 }
 activePlaceId=id;
 editMode='';
 closeSearch();
 if(!await renderPlace(id)||revision!==selectionRevision||id!==activePlaceId)return;
 placeCard.dataset.placeId=id;
 placeCard.hidden=false;
 window.__atlasSheetIntegration?.card.open(id);
 document.body.classList.add('fp-place-open');
}
async function renderPlace(id){const revision=++renderRevision;const p=await readPlace(id);if(!p||id!==activePlaceId||revision!==renderRevision)return false;stopTileVideos();placeCard.replaceChildren();if(editMode)placeCard.classList.add('fp-editing');const grab=h('div','sheet-grab');grab.setAttribute('aria-hidden','true');placeCard.append(grab);const head=h('header','fp-card-header'),titlewrap=h('div','fp-card-title-wrap');titlewrap.append(h('h2','fp-card-name',p.title||'未命名地点'));const stageBtn=btn(p.stage==='visited'?'已到访 · 足迹':'想去 · 灵感',()=>window.__atlasEditPlace?.(id),'fp-place-stage');stageBtn.setAttribute('aria-label','更改地点状态，当前：'+(p.stage==='visited'?'已到访':'想去'));titlewrap.append(stageBtn);const editToggle=btn(placeCard.classList.contains('fp-editing')?'完成':'编辑',()=>{placeCard.classList.toggle('fp-editing');if(!placeCard.classList.contains('fp-editing'))editMode='';renderPlace(id)},'fp-subaction fp-edit-toggle');
 /* build .20 · 用户批注：收藏点卡片上始终要有「取消收藏」——金星即已收藏，点它取消（影像保留） */
 const unstarBtn=btn('',async()=>{const changed=await window.__atlasCancelBookmark?.(id);if(changed)closePlace()},'fp-unstar-btn');
 unstarBtn.innerHTML='<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0IiBhcmlhLWxhYmVsPSJTYXZlZCI+CiA8ZyBmaWxsPSJub25lIiBzdHJva2U9IiMxNjE2MTYiIHN0cm9rZS13aWR0aD0iMy40IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPgogIDxwYXRoIGQ9Ik0zMiA4IEwzOS4yIDIzLjIgTDU2IDI1LjQgTDQzLjIgMzcuMiBMNDYuMSA1NC40IEwzMS43IDQ1LjggTDE2LjggNTQuNCBMMjAgMzcuNCBMOC4xIDI1LjMgTDI0LjggMjNaIiBmaWxsPSIjRjZDQzNCIi8+CiAgPHBhdGggZD0iTTI1IDI1IEwzMCAxNCIgc3Ryb2tlLXdpZHRoPSIxLjMiLz4KIDwvZz4KPC9zdmc+" alt="" aria-hidden="true">';unstarBtn.setAttribute('aria-label','取消收藏这颗星');unstarBtn.title='已收藏 · 点按取消收藏';
 head.append(titlewrap,unstarBtn,editToggle,btn('×',closePlace,'fp-card-close'));placeCard.append(head);const sc=h('div','fp-card-scroll');
 /* build .16 · 详情大卡规整为三块卡片（参考苹果排版）：Brief / 影像 / 社交资料 */
 const cardBrief=h('section','fp-block');
 cardBrief.append(sectionHeading('01',p.stage==='visited'?'旅行手记':'为什么想去',btn(editMode==='brief'?'收起':'编辑',()=>{editMode=editMode==='brief'?'':'brief';renderPlace(id)},'fp-subaction')));
 if(editMode==='brief'){const edit=h('div','fp-inline-editor');const area=h('textarea');area.value=p.note||'';area.placeholder=p.stage==='visited'?'记下这次旅程的细节与感受…':'为什么想去这个地方？记录你的旅行灵感…';area.maxLength=12000;area.addEventListener('focus',()=>setTimeout(()=>edit.scrollIntoView({block:'center',behavior:'smooth'}),380)); /* build .18 · 键盘弹起后输入区与保存按钮跟随到可视区 */const actions=h('div','fp-inline-actions');actions.append(btn('保存 Brief',async()=>{if(busy)return;busy=true;try{const fresh=await readPlace(id);if(!fresh)throw Error('找不到地点');if(!window.FootprintMediaCore)throw Error('存储模块未加载');await window.FootprintMediaCore.createRepository(window.indexedDB).saveBrief(id,area.value.trim());try{await window.__atlasFlowRefresh?.()}catch(_){}if(activePlaceId===id){editMode='';await renderPlace(id)}}catch(e){feedback('保存失败：'+e.message)}finally{busy=false}},'fp-btn-primary'),btn('取消',()=>{editMode='';renderPlace(id)},'fp-btn-muted'));edit.append(area,actions);cardBrief.append(edit)}else{const briefText=String(p.note||'').replace(/^原高德地址[：:][^\n]*\n?/,'').trim();cardBrief.append(h('p','fp-brief-text'+(!briefText?' is-empty':''),briefText||(p.stage==='visited'?'还没有旅行手记。点「编辑」记录这段经历。':'还没有 Brief。点「编辑」写下为什么想去这里。')))}
 const cardMedia=h('section','fp-block');
 const media=mediaOf(p);placeCard.dataset.hasMedia=media.length?'yes':'no';cardMedia.append(sectionHeading('02','照片与视频',btn('＋ 添加',()=>filePicker.click(),'fp-subaction')));
 const filePicker=h('input');filePicker.type='file';filePicker.accept='image/*,video/*';filePicker.multiple=true;filePicker.hidden=true;filePicker.addEventListener('change',()=>addMedia(id,[...filePicker.files]));cardMedia.append(filePicker);
 if(!media.length){const box=h('div','fp-media-empty');box.append(h('div','fp-empty-icon','＋'));const info=h('div','fp-empty-text');info.append(h('strong','','添加照片、视频或社交灵感'),h('small','','内容会出现在这一地点的拼贴中'));box.append(info,btn('添加影像',()=>filePicker.click(),'fp-btn-primary'));cardMedia.append(box)}else{const tiles=media.slice(0,5);const mosaic=h('div','fp-media-mosaic'+(tiles.length===1?' one':tiles.length===2?' two':''));tiles.forEach((m,i)=>{const tile=btn('',()=>openViewer(media,i,tile),m.kind==='video'?'fp-video-tile':'');if(m.kind==='photo'){const img=h('img');img.src=m.src;img.alt='旅行照片 '+(i+1);img.loading='lazy';tile.append(img)}else {const video=h('video');video.muted=true;video.defaultMuted=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.loop=true;video.autoplay=true;video.preload='metadata';video.controls=false;video.setAttribute('aria-label','旅行视频动态预览');try{const blob=m.blob instanceof Blob?m.blob:new Blob([m.bytes],{type:m.type||'video/mp4'});const objectUrl=URL.createObjectURL(blob);video.dataset.sourceUrl=objectUrl;video.src=objectUrl;tileVideos.add(video);video.addEventListener('canplay',()=>{if(activePlaceId===id)video.play().catch(()=>{})},{once:true});video.play().catch(()=>{})}catch(err){console.debug('视频预览不可用',err)}tile.append(video,h('span','fp-video-indicator','▶'))}if(i===tiles.length-1&&media.length>tiles.length)tile.append(h('span','fp-tile-more','+'+(media.length-tiles.length)));mosaic.append(tile)});cardMedia.append(mosaic);cardMedia.append(h('div','fp-photo-count',`${(p.photos||[]).length} 张照片 · ${(p.videos||[]).length} 条视频`))}
 const cardLinks=h('section','fp-block');
 cardLinks.append(sectionHeading('03','相关攻略',btn('＋ 链接',()=>{editMode=editMode==='link'?'':'link';renderPlace(id)},'fp-subaction')));
 const links=linksOf(p);if(links.length){const list=h('div','fp-social-list');links.slice(0,12).forEach(x=>{const a=h('a');a.href=x.url;a.target='_blank';a.rel='noopener noreferrer';a.title=x.url;a.append(h('span','',`${sourceName(x.url)} · ${x.title||'查看原文'}`),h('b','','↗'));list.append(a)});cardLinks.append(list)}else cardLinks.append(h('p','fp-social-empty','还没有保存公众号、小红书、Bilibili 或 YouTube 链接。'));
 if(editMode==='link'){const edit=h('div','fp-inline-editor');edit.style.marginTop='12px';const url=h('input');url.type='url';url.placeholder='粘贴微信、小红书或视频链接';url.setAttribute('inputmode','url');url.autocomplete='off';const name=h('input');name.type='text';name.placeholder='给这条资料写个标题（可选）';name.maxLength=150;const acts=h('div','fp-inline-actions');acts.append(btn('保存链接',async()=>{const u=urlOf(url.value);if(!u){feedback('请输入有效的 http 或 https 链接');return}if(busy)return;busy=true;try{const fresh=await readPlace(id);const before=linksOf(fresh);if(before.some(x=>x.url===u)){feedback('这个链接已经保存过了');return}if(!window.FootprintMediaCore)throw Error('存储模块未加载');await window.FootprintMediaCore.createRepository(window.indexedDB).saveGuide(id,{url:u,title:name.value.trim()||sourceName(u),createdAt:new Date().toISOString()});try{await window.__atlasFlowRefresh?.()}catch(_){}if(activePlaceId===id){editMode='';await renderPlace(id)}}catch(e){feedback('保存链接失败：'+e.message)}finally{busy=false}},'fp-btn-primary'),btn('取消',()=>{editMode='';renderPlace(id)},'fp-btn-muted'));edit.append(url,name,acts);cardLinks.append(edit);queueMicrotask(()=>{if(activePlaceId===id&&editMode==='link')edit.scrollIntoView({block:'nearest',behavior:'smooth'})})}
 const nearby=h('section','fp-block');
 const status=h('div','fp-social-list');
 const load=btn('查看附近',async()=>{
   load.disabled=true;status.textContent='正在查找…';
   try{
     const result=await window.AtlasServices.nearby(p.lat,p.lng);
     if(!nearby.isConnected||activePlaceId!==id)return;
     status.replaceChildren();
     if(!result.places.length)status.textContent='附近未找到景点';
     for(const place of result.places){
       const row=btn(place.name+' · '+place.distance+' 米',()=>chooseResult(place),'fp-subaction');
       status.append(row);
     }
   }catch{status.textContent='附近地点暂时无法读取，可重试'}
   finally{load.disabled=false}
 },'fp-subaction');
 nearby.append(sectionHeading('04','附近地点',load),status);
 sc.append(cardBrief,cardMedia,cardLinks,nearby);
 const f=h('div','fp-card-feedback');f.id='fpCardFeedback';sc.append(f);placeCard.append(sc);return true;
}
async function shrinkPhoto(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('无法读取图片'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(Error('无法解码图片，请改用 JPEG/PNG'));img.onload=()=>{const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve({name:file.name,src:canvas.toDataURL('image/jpeg',.82),addedAt:new Date().toISOString()})};img.src=reader.result};reader.readAsDataURL(file)})}
async function addMedia(id,files){
 if(!files?.length||busy)return;
 busy=true;feedback('正在验证并保存影像…');
 try{
  if(!window.FootprintMediaCore)throw Error('媒体存储模块未加载，请重新打开页面');
  const core=window.FootprintMediaCore,repo=core.createRepository(window.indexedDB);
  if(!(await repo.read(id)))throw Error('地点不存在，影像未保存');
  const prepared=await core.prepareSelectedFiles(files,{
    encodePhoto:async file=>(await shrinkPhoto(file)).src
  });
  // A single validated place ID and one atomic IndexedDB transaction per upload.
  await repo.addMedia(id,prepared);
  try{await window.__atlasFlowRefresh?.()}catch(e){console.warn('地图媒体缩略图刷新延迟',e)}
  if(activePlaceId===id){await renderPlace(id);feedback('已保存 '+prepared.length+' 项影像到当前地点；刷新后仍可查看。')}
 }catch(e){console.error('地点媒体保存失败',e);feedback('保存失败，原有内容未改动：'+(e?.message||'请检查权限或空间'))}
 finally{busy=false}
}
function closeViewer(immediate=false){
 const panel=$('fpMediaViewer');
 if(!panel)return;
 // A top-layer <dialog> must always be closed before removal. WebKit can keep
 // WAAPI .finished pending after a full-screen gesture or interrupted spring.
 const cleanup=()=>{
   if(panel.__closed)return;
   panel.__closed=true;
   if(panel.__closeFallback){clearTimeout(panel.__closeFallback);panel.__closeFallback=null}
   try{panel.querySelector('video')?.pause()}catch(_){}
   try{if(panel.open)panel.close()}catch(_){}
   if(panel.isConnected)panel.remove();
   if(panel.__videoURL){URL.revokeObjectURL(panel.__videoURL);panel.__videoURL=null}
 };
 if(immediate){cleanup();return}
 if(panel.__closing)return;
 panel.__closing=true;
 const media=panel.querySelector('img,video'),origin=panel.__origin;
 if(!media||!origin?.isConnected||!media.animate||matchMedia('(prefers-reduced-motion:reduce)').matches){cleanup();return}
 const from=origin.getBoundingClientRect(),dest=media.getBoundingClientRect();
 const dx=from.left+from.width/2-dest.left-dest.width/2,dy=from.top+from.height/2-dest.top-dest.height/2;
 const sx=from.width/Math.max(1,dest.width),sy=from.height/Math.max(1,dest.height);
 const options={duration:390,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'};
 // Do not let a stalled WAAPI Promise strand an invisible modal above the map.
 panel.__closeFallback=setTimeout(cleanup,options.duration+250);
 try{
   media.animate([{transform:'none',borderRadius:'0px'},{transform:`translate3d(${dx}px,${dy}px,0) scale(${sx},${sy})`,borderRadius:'15px'}],options);
   const animation=panel.animate([{backgroundColor:'rgba(19,20,21,.93)',opacity:1},{backgroundColor:'rgba(19,20,21,0)',opacity:.02}],options);
   animation.finished.then(cleanup,cleanup);
 }catch(error){console.warn('Media closing motion fell back to immediate teardown',error);cleanup()}
}
function openViewer(items,index,originTile=null){closeViewer(true);const x=items[index];if(!x)return;const viewer=h('dialog');viewer.id='fpMediaViewer';viewer.setAttribute('role','dialog');viewer.setAttribute('aria-modal','true');viewer.setAttribute('aria-label','查看旅行照片或视频');viewer.append(btn('×',()=>closeViewer(),'fp-viewer-close'));if(x.kind==='photo'){const img=h('img');img.src=x.src;img.alt='旅行照片';viewer.append(img)}else{const blob=x.blob instanceof Blob?x.blob:new Blob([x.bytes],{type:x.type||'video/mp4'});viewer.__videoURL=URL.createObjectURL(blob);const v=h('video');v.src=viewer.__videoURL;v.controls=true;v.playsInline=true;v.autoplay=true;viewer.append(v)}viewer.append(h('div','fp-viewer-caption',`${index+1} / ${items.length} · ${x.name||'旅行影像'}`));viewer.addEventListener('click',e=>{if(e.target===viewer)closeViewer()});
 /* build .21 · 用户批注：全屏看图必须能左右滑切换 */
 let sx=null,sy2=0;viewer.addEventListener('touchstart',e=>{if(e.touches.length!==1||e.target.closest('video,button')){sx=null;return}sx=e.touches[0].clientX;sy2=e.touches[0].clientY},{passive:true});
 viewer.addEventListener('touchend',e=>{if(sx===null)return;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy2;sx=null;if(Math.abs(dx)<52||Math.abs(dx)<Math.abs(dy)*1.35)return;if(dx<0&&index<items.length-1)openViewer(items,index+1);else if(dx>0&&index>0)openViewer(items,index-1)},{passive:true});
 viewer.addEventListener('touchcancel',()=>{sx=null},{passive:true});
 viewer.__origin=originTile&&originTile.isConnected?originTile:null;
 viewer.addEventListener('cancel',event=>{event.preventDefault();closeViewer()});
 document.body.append(viewer);
 viewer.showModal();
 const media=viewer.querySelector('img,video');
 if(viewer.__origin&&media?.animate&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
   const from=viewer.__origin.getBoundingClientRect(),dest=media.getBoundingClientRect();
   const dx=from.left+from.width/2-dest.left-dest.width/2,dy=from.top+from.height/2-dest.top-dest.height/2;
   const sx=from.width/Math.max(dest.width,1),sy=from.height/Math.max(dest.height,1);
   const opts={duration:465,easing:'cubic-bezier(.19,1,.32,1)',fill:'both'};
   media.animate([{transform:`translate3d(${dx}px,${dy}px,0) scale(${sx},${sy})`,borderRadius:'15px',opacity:.8},{transform:'none',borderRadius:'0px',opacity:1}],opts);
   viewer.animate([{backgroundColor:'rgba(19,20,21,0)'},{backgroundColor:'rgba(19,20,21,.93)'}],{duration:350,fill:'both',easing:'ease-out'});
 }
}
function init(){initSearch();mountPlace();window.__footprintHome={openSearch,closeSearch,openSaved:showPlaceCard,readPlaces};}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
