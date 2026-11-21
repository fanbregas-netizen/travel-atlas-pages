/* Footprint Map · in-place Apple-Maps-inspired search, then a compact saved-star photo collage.
 * No personal content is uploaded to this site. Keeps existing private-travel-footprints-v1.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const h=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e};
const getList=()=>{try{return JSON.parse(localStorage.getItem('fp-search-history-v1')||'[]').filter(x=>x&&typeof x.q==='string').slice(0,8)}catch{return []}};
const saveHistory=item=>{try{const all=getList().filter(x=>x.q!==item.q);all.unshift(item);localStorage.setItem('fp-search-history-v1',JSON.stringify(all.slice(0,8)))}catch{}};
const urlOf=x=>{try{const u=new URL(String(x||'').trim());return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
const safe=(n,lo,hi)=>n!==null&&n!==undefined&&String(n).trim()!==''&&Number.isFinite(+n)&&+n>=lo&&+n<=hi;
const isPhoto=file=>file.type.startsWith('image/')||/\.(jpe?g|png|webp|heic)$/i.test(file.name);
let searchSheet,searchVeil,searchInput,searchBody,searchTopPortal,searchTimer,searchController=null,searchToken=0,activeSearch=false,searchUsed=false;
let placeCard,activePlaceId='',editMode='',busy=false;
/* Stage21: unsaved local drafts stay tied to the original place ID when the
   physical sheet closes or another place opens. No second persistence store. */
const editorDrafts=new Map();
const draftKey=(id,kind)=>String(id)+':'+kind;
function editorDraft(id,kind,initial){
 const key=draftKey(id,kind);let d=editorDrafts.get(key);
 if(!d){d={initial,value:initial,dirty:false};editorDrafts.set(key,d)}
 return d;
}
function discardEditorDraft(id,kind){
 const key=draftKey(id,kind),d=editorDrafts.get(key);
 if(d?.dirty&&!window.confirm('放弃尚未保存的修改？\n选择「取消」继续编辑。'))return false;
 editorDrafts.delete(key);return true;
}
function pendingDraftMode(id){
 if(editorDrafts.get(draftKey(id,'brief'))?.dirty)return 'brief';
 if(editorDrafts.get(draftKey(id,'link'))?.dirty)return 'link';
 return '';
}
/* Stage23: play only visible videos while scrolling the real place card. */
const tileVideos=new Set();let tileVisibilityObserver=null;
/* Media D · restore approved LIVE small-card video thumbnails.
 * Play only clipped-in-viewport muted/looping tiles. Full-screen media pauses
 * every tile; visibility/closing gates playback without allocating another URL. */
function tileShouldPlay(v){
 return tileVideos.has(v)&&v.isConnected&&v.dataset.inViewport==='yes'&&
  !document.hidden&&!placeCard?.hidden&&
  !document.getElementById('fpMediaViewer');
}
function syncTilePlayback(v){
 if(!tileVideos.has(v))return;
 if(!tileShouldPlay(v)){
  try{v.pause()}catch(_){}
  return;
 }
 if(!v.paused||v.dataset.fpPlaying==='yes')return;
 // Allocate a video Blob URL only when the thumbnail is visible.
 // Large MOV/MP4 buffers must not all be copied while opening the card.
 try{v.__fpEnsureSource?.()}catch(error){console.warn('无法载入视频预览',error);return}
 v.dataset.fpPlaying='yes';
 let play;
 try{play=v.play()}catch(_){delete v.dataset.fpPlaying;return}
 Promise.resolve(play).catch(()=>{}).then(()=>{
  delete v.dataset.fpPlaying;
  if(!tileShouldPlay(v))try{v.pause()}catch(_){}
 });
}
function watchTileVideo(v){
 if(!('IntersectionObserver' in window)){
  v.dataset.inViewport='yes';syncTilePlayback(v);return;
 }
 if(!tileVisibilityObserver)tileVisibilityObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){
   entry.target.dataset.inViewport=entry.isIntersecting&&entry.intersectionRatio>=.18?'yes':'no';
   syncTilePlayback(entry.target);
  }
 },{threshold:[0,.18,.5]});
 tileVisibilityObserver.observe(v);
}
function stopTileVideos(){
 tileVisibilityObserver?.disconnect();tileVisibilityObserver=null;
 for(const v of tileVideos){try{v.pause();v.removeAttribute('src');v.load();if(v.dataset.sourceUrl)URL.revokeObjectURL(v.dataset.sourceUrl);delete v.__fpEnsureSource}catch(_){}}
 tileVideos.clear()
}
document.addEventListener('visibilitychange',()=>{for(const v of tileVideos)syncTilePlayback(v)})
const btn=(label,fn,cls='')=>{const b=h('button',cls,label);b.type='button';b.addEventListener('click',fn);return b};
function setViewport(){if(!searchSheet)return;const vv=window.visualViewport;const visible=vv?.height||window.innerHeight;const bottom=vv?Math.max(0,window.innerHeight-vv.height-vv.offsetTop):0;document.documentElement.style.setProperty('--fp-vh',visible+'px');document.documentElement.style.setProperty('--fp-keyboard',bottom+'px')}
function searchReset(){searchController?.abort();searchController=null;clearTimeout(searchTimer);searchToken++}
/* Real saved search results belong to the same visual identity as the B card.
   Thumbnails and counts are drawn only from the actual persisted place object. */
function savedSearchRow(p){
 const photo=(Array.isArray(p.photos)?p.photos:[]).find(x=>typeof x?.src==='string'&&/^data:image\/(jpeg|png|webp);base64,/i.test(x.src));
 const photoCount=Array.isArray(p.photos)?p.photos.length:0;
 const videoCount=Array.isArray(p.videos)?p.videos.length:0;
 return {id:p.id,name:p.title,saved:true,lat:p.lat,lon:p.lng,
  stage:p.starred===false?'未收藏':p.stage==='visited'?'已到访':'想去',preview:photo?.src||'',
  mediaCount:photoCount+videoCount,
  description:String(p.address||p.note||'').trim().slice(0,72)};
}
function searchRows(rows,header){
 const wrap=h('div','fp-search-group');
 if(header){const heading=h('div','fp-search-label');heading.append(h('strong','',header),h('span','',String(rows.length).padStart(2,'0')));wrap.append(heading)}
 for(const x of rows){
  const row=btn('',()=>chooseResult(x),'fp-search-row'+(x.saved?' is-saved':''));
  if(x.preview){
   const image=h('img','fp-row-photo');image.src=x.preview;image.alt=(x.name||'地点')+'的已保存照片';
   image.loading='lazy';image.decoding='async';row.append(image);
  }else{
   const fallback=h('span','fp-row-icon',x.saved?'☆':x.history?'↗':'⌖');
   fallback.setAttribute('aria-hidden','true');row.append(fallback);
  }
  const main=h('span','fp-row-main');
  main.append(h('strong','',x.name||x.q));
  const description=x.history?'':(x.description||x.display_name||x.address||(!x.saved?'地图地点':''));
  if(description)main.append(h('small','',description));
  if(x.saved){
   const info=h('span','fp-row-context');info.append(h('span','fp-row-stage',x.stage||'想去'));
   if(x.mediaCount)info.append(h('span','',x.mediaCount+' 件影像'));
   main.append(info);
  }
  row.append(main,h('span','fp-row-arrow','›'));wrap.append(row);
 }
 return wrap;
}
/* Search-start is a compact anchored history list, not another full-screen page.
   Saved places remain available through the single real query engine. */
function drawSearchStart(){
 searchBody.replaceChildren();
 const recent=getList().slice(0,3);
 if(!recent.length){
  // The live top field already explains what to type. Never show an empty,
  // duplicate prompt card (it was obscuring the map on iPhone).
  if(activeSearch)searchSheet.hidden=true;
  return;
 }
 if(activeSearch)searchSheet.hidden=false;
 const head=h('div','fp-history-head');
 head.append(h('strong','','最近搜索'));
 const clear=btn('清除',()=>{try{localStorage.removeItem('fp-search-history-v1')}catch(_){}drawSearchStart()},'fp-history-clear');
 clear.setAttribute('aria-label','清除搜索历史');
 head.append(clear);
 searchBody.append(head,searchRows(recent.map(x=>({...x,history:true,description:'',display_name:''})),null));
}
function initSearch(){const dock=$('searchDock'),original=$('searchInput'),form=$('searchForm');if(!dock||!original||!form)return;
 searchVeil=h('div');searchVeil.id='fpSearchVeil';searchVeil.hidden=true;
 searchSheet=h('section');searchSheet.id='fpSearchSheet';searchSheet.hidden=true;searchSheet.dataset.searchLayout='anchored';searchSheet.setAttribute('role','dialog');searchSheet.setAttribute('aria-label','搜索地点');searchSheet.setAttribute('aria-modal','false');
 const top=h('div','fp-search-top'),grip=h('div','fp-search-grip'),head=h('div','fp-search-head');const heading=h('div','fp-search-title');heading.append(h('h2','','搜索地点'));head.append(heading,btn('×',closeSearch,'fp-search-close'));const bar=h('form','fp-search-bar');bar.setAttribute('role','search');bar.addEventListener('submit',e=>{e.preventDefault();searchNow(searchInput.value,true)});const icon=h('span','fp-magnify');const originalSearchIcon=$('dockSearch')?.querySelector('img');
 if(originalSearchIcon)icon.append(originalSearchIcon.cloneNode(true));else icon.textContent='⌕';
 searchInput=h('input');searchInput.id='fpSearchField';searchInput.type='search';searchInput.placeholder='搜索城市、地点或收藏';searchInput.autocomplete='off';searchInput.setAttribute('enterkeyhint','search');searchInput.setAttribute('aria-label','搜索真实地图地点');const clear=btn('×',()=>{searchInput.value='';clear.hidden=true;drawSearchStart();searchInput.focus()},'fp-search-clear');clear.hidden=true;
 bar.append(icon,searchInput,clear);top.append(grip,head,bar);searchBody=h('div','fp-search-body');searchSheet.append(top,searchBody);
 // Single real input, relocated into the iPhone top search field only while open.
 // The saved-place and AtlasServices search handlers remain on the same form node.
 searchTopPortal=h('div');searchTopPortal.id='fpSearchActiveTop';searchTopPortal.hidden=true;
 const cancel=btn('取消',closeSearch,'fp-search-cancel');cancel.setAttribute('aria-label','取消搜索并返回地图');
 searchTopPortal.append(cancel);searchVeil.addEventListener('click',closeSearch);
 document.body.append(searchVeil,searchSheet,searchTopPortal);drawSearchStart();
 // A readonly 16px launcher prevents Safari from focusing the map's original input and zooming the page.
 original.readOnly=true;original.setAttribute('aria-haspopup','dialog');original.setAttribute('aria-controls','fpSearchSheet');original.setAttribute('inputmode','none');original.style.fontSize='16px';
 /* build .16 · 规划模式下 ↗ 归 trip-picker：不抢搜素大卡 */
 dock.addEventListener('pointerdown',e=>{if(e.target.closest('#searchForm')){if(document.body.classList.contains('route-pick-active')&&e.target.closest('.dock-go'))return;e.preventDefault();openSearch()}},true);
 form.addEventListener('submit',e=>{e.preventDefault();if(document.body.classList.contains('route-pick-active'))return;e.stopImmediatePropagation();openSearch()},true);
 original.addEventListener('click',e=>{e.stopImmediatePropagation();openSearch()},true);
 original.addEventListener('focus',()=>{original.blur();openSearch()},true);
 searchInput.addEventListener('input',()=>{const q=searchInput.value.trim();clear.hidden=!q;searchReset();if(q.length<2){if(!q)drawSearchStart();else searchBody.replaceChildren(h('div','fp-search-empty','继续输入地点名称…'));return}searchTimer=setTimeout(()=>searchNow(q,false),370)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('fpMediaViewer')){if(activeSearch)closeSearch();else if(activePlaceId)closePlace()}});
 window.visualViewport?.addEventListener('resize',setViewport,{passive:true});window.visualViewport?.addEventListener('scroll',setViewport,{passive:true});window.addEventListener('resize',setViewport,{passive:true});
}
function openSearch(){
 if(activeSearch){searchInput.focus({preventScroll:true});return}
 if($('drawer')?.classList.contains('visible'))$('closeDrawer')?.click();
 if(activePlaceId)closePlace(true);
 // Search owns the foreground. Dismiss the ordinary map POI, not only the
 // saved-place card; otherwise its old preview ghosts under the search veil.
 if($('destinationCard')?.classList.contains('visible'))window.__atlasDemo?.close?.();
 searchReset();activeSearch=true;searchUsed=false;
 const form=searchSheet.querySelector('.fp-search-bar');
 if(form&&searchTopPortal){searchTopPortal.prepend(form);searchTopPortal.hidden=false}
 searchSheet.hidden=false;searchVeil.hidden=false;setViewport();
 document.body.classList.remove('fp34-search-returning','fp34-searching');
 document.body.classList.add('fp-search-open');
 searchInput.value='';const clear=searchTopPortal?.querySelector('.fp-search-clear');if(clear)clear.hidden=true;drawSearchStart();
 // Focus synchronously in the tap handler: mobile Safari will open the keyboard.
 // Avoid the old 380 ms delayed re-focus that could make the keyboard jump.
 searchInput.focus({preventScroll:true});
 // Start the real dropdown physical motor AFTER the history rows have been
 // inserted and the same original field has moved into its top search slot.
 // Previously an observer-only trigger was missed after POI card handoffs.
 requestAnimationFrame(()=>{if(activeSearch&&!searchSheet.hidden)
   document.dispatchEvent(new Event('atlas:search-history-ready'))});
}
function closeSearch(){
 if(!activeSearch)return;
 window.__fpRealSearchMotion?.dismiss?.();activeSearch=false;searchReset();searchInput.blur();
 // Restore the very same input/form to the physical results sheet on dismissal.
 const form=searchTopPortal?.querySelector('.fp-search-bar');
 if(form)searchSheet.querySelector('.fp-search-top')?.append(form);
 if(searchTopPortal)searchTopPortal.hidden=true;
 document.body.classList.remove('fp-search-open','fp34-searching','fp34-search-returning');
 searchSheet.hidden=true;searchVeil.hidden=true;
 const old=$('searchInput');if(old)old.value='';setViewport();
}
window.__fpCloseSearch=()=>closeSearch();
async function searchNow(q,submitted){q=String(q||'').trim();searchReset();if(!q){drawSearchStart();return}
 // Only surface history/results if meaningful content is present.
 if(activeSearch)searchSheet.hidden=false;
 searchUsed=true;const token=++searchToken;const matches=await readPlaces().then(rows=>rows.filter(p=>String(p.title||'').toLocaleLowerCase().includes(q.toLocaleLowerCase())).slice(0,7).map(savedSearchRow)).catch(()=>[]);if(token!==searchToken||!activeSearch)return;searchBody.replaceChildren();if(matches.length)searchBody.append(searchRows(matches,'我的地点'));
 if(!submitted&&q.length<2){if(!matches.length)searchSheet.hidden=true;return}
 if(!window.AtlasServices?.search){if(!matches.length)searchBody.append(h('div','fp-search-empty','地图搜索服务未准备好，请重试。'));return}
 searchController=new AbortController();const controller=searchController;const status=h('div','fp-search-empty','正在搜索真实地点…');searchBody.append(status);
 try{const results=await window.AtlasServices.search(q,{signal:controller.signal,center:window.__fpSearchCenter?.(),allowFallback:submitted});if(token!==searchToken||!activeSearch)return;status.remove();const existing=new Set(matches.map(x=>String(x.name).trim()+':'+Number(x.lat).toFixed(3)));const filtered=(Array.isArray(results)?results:[]).map(x=>({...x,lon:x.lon??x.lng,lat:x.lat})).filter(x=>safe(x.lat,-90,90)&&safe(x.lon,-180,180)).map(x=>({...x,lon:Number(x.lon),lat:Number(x.lat)})).filter(x=>!existing.has(String(x.name).trim()+':'+x.lat.toFixed(3))).slice(0,12);if(filtered.length)searchBody.append(searchRows(filtered,'地图地点'));else if(!matches.length)searchBody.append(h('div','fp-search-empty','没有找到这个地点。试试「城市 + 地点名」，或返回地图手动选点。'));if(submitted)saveHistory({q,name:q,description:'搜索记录'})}
 catch(err){if(!controller.signal.aborted&&token===searchToken&&activeSearch){status.textContent='搜索暂时不可用。可以重试或继续查看已经收藏的地点。'}}
}
function chooseResult(place){
 const name=place.name||place.q||'地点';
 // A history entry without coordinates refines the SAME open search instead
 // of closing/reopening the keyboard and physical surface twice.
 if(!place.saved&&(!safe(place.lat,-90,90)||!safe(place.lon??place.lng,-180,180))){
  searchInput.value=name;
  const clear=searchTopPortal?.querySelector('.fp-search-clear');if(clear)clear.hidden=false;
  searchNow(name,true);searchInput.focus({preventScroll:true});
  return;
 }
 closeSearch();
 if(place.saved&&place.id){window.__atlasDemo?.openSaved?.(place.id);return}
 saveHistory({q:name,name,lat:place.lat,lon:place.lon,description:place.display_name||place.description||''});const data={name,lat:Number(place.lat),lng:Number(place.lon??place.lng),address:place.display_name||place.address||'',category:place.type||'地点',id:place.id||''};if(typeof window.__fpSearchSelect==='function')window.__fpSearchSelect(data);else window.__atlasDemo?.select?.(data.name,data.lat,data.lng)}
function repository(){return window.FootprintMediaCore.createRepository(window.indexedDB)}
async function readPlaces(){
 try{return await repository().list()}catch(error){
  if(window.__atlasPlaceStore)return window.__atlasPlaceStore.readAll();
  throw error;
 }
}
async function readPlace(id){
 let item=null,failed=null;
 try{item=await repository().read(id)}catch(error){failed=error}
 if(item)return item;
 try{const all=await window.__atlasPlaceStore?.readAll?.();
  const found=Array.isArray(all)?all.find(p=>String(p.id)===String(id)):null;
  if(found)return found;
 }catch(error){failed=error}
 if(failed)throw failed;
 return null;
}
const mediaOf=p=>[...(Array.isArray(p.photos)?p.photos:[]).filter(x=>typeof x.src==='string'&&/^data:image\/(jpeg|png|webp);base64,/i.test(x.src)).map(x=>({...x,kind:'photo'})),...(Array.isArray(p.videos)?p.videos:[]).filter(x=>x.bytes||x.blob).map(x=>({...x,kind:'video'}))];
const linksOf=p=>{const o=[...(Array.isArray(p.references)?p.references:[]),...(Array.isArray(p.guides)?p.guides:[])];if(p.url)o.push(p.url);if(p.link)o.push(p.link);const u=new Set();return o.map(x=>typeof x==='string'?{url:x,title:''}:{...x,url:x?.url||x?.link||'',title:x?.title||''}).filter(x=>{x.url=urlOf(x.url);if(!x.url||u.has(x.url))return false;u.add(x.url);return true})};
function sourceName(url){return window.FootprintGuideLinks?.provider?.(url)||'网页'}
function sectionHeading(number,name,button){const bar=h('div','fp-subheading');bar.append(h('span','fp-section-index',number),h('strong','fp-section-label',name));if(button)bar.append(button);return bar}
function feedback(msg){const e=$('fpCardFeedback');if(e)e.textContent=msg}
function mountPlace(){if(placeCard)return;placeCard=h('article');placeCard.id='fpPlaceCard';placeCard.hidden=true;placeCard.setAttribute('role','dialog');placeCard.setAttribute('aria-modal','false');placeCard.setAttribute('aria-label','收藏地点详情');document.body.append(placeCard); /* V3 physical B owns all card swipes: no additional legacy touch handlers. */
 document.addEventListener('atlas:memory-open',e=>{if(window.__atlasPreferCollage!==false)showPlaceCard(e.detail?.id)});
 // Unified B controller owns backdrop dismissal after pointerup; map dragging must not close the card.
 document.addEventListener('atlas:source-updated',()=>{if(activePlaceId&&!editMode&&!placeCard.classList.contains('fp-editing'))renderPlace(activePlaceId)});
 const originalSheet=$('memorySheet');if(originalSheet)new MutationObserver(()=>{if(activePlaceId&&!originalSheet.classList.contains('visible'))closePlace()}).observe(originalSheet,{attributes:true,attributeFilter:['class']});
 const qs=new URLSearchParams(location.search);const source=qs.get('sourcePlace'),media=qs.get('mediaPlace');if(source||media){const target=source||media;let count=0;const t=setInterval(()=>{count++;if(typeof window.__atlasDemo?.openSaved==='function'){clearInterval(t);window.__atlasDemo.openSaved(target);editMode=source?'link':'media';setTimeout(()=>renderPlace(target),120);history.replaceState(null,'',location.pathname)}if(count>32)clearInterval(t)},250)}
}
function closePlace(immediate=false){
 if(!activePlaceId)return;
 const controller=window.__atlasSheetIntegration?.card;
 // Regular dismissals follow the same V3 physical spring as a downward swipe.
 // The unified bridge calls back after the animation and completes teardown.
 // Switching to search is immediate so the old card cannot cover the keyboard.
 if(!immediate&&controller&&controller.getState().sheet!=='closed'){
  controller.close();
  return;
 }
 ++selectionRevision;++renderRevision;
 closeViewer(true);stopTileVideos();activePlaceId='';editMode='';
 placeCard.hidden=true;controller?.close();
 document.body.classList.remove('fp-place-open');
 const close=$('closeMemory');if(close)close.click();
}
window.__atlasClosePlace=closePlace;
/* build .21 · 用户批注：划卡片要有响应——捏住眉头/内容到顶继续下拉即随手势下滑，松手过阈值关闭（对齐抽屉与高德/苹果 sheet） */
let selectionRevision=0,renderRevision=0;
async function showPlaceCard(id){
 if(!id)return;
 const revision=++selectionRevision;
 if(activePlaceId!==id){
  closeViewer(true);
  placeCard.classList.remove('fp-editing');
  editMode=pendingDraftMode(id);
 }
 activePlaceId=id;
 closeSearch();
 let rendered=false;
 try{rendered=await renderPlace(id)}catch(error){console.warn('[V5 place] render failed',error)}
 if(revision!==selectionRevision||id!==activePlaceId)return false;
 if(!rendered){
  placeCard.replaceChildren();
  const head=h('header','fp-card-header'),label=h('div','fp-card-title-wrap');
  label.append(h('h2','fp-card-name','地点内容暂未载入'));
  const exit=btn('×',()=>closePlace(),'fp-card-close');
  exit.setAttribute('aria-label','关闭地点卡片');head.append(label,exit);
  const content=h('div','fp-card-scroll');
  content.append(h('p','fp-brief-text','收藏仍保存在本机。请重新打开地点；不会删除照片、文字或星标。'));
  content.append(btn('重新读取',()=>{void showPlaceCard(id)},'fp-btn-primary'));
  placeCard.append(head,content);
 }
 placeCard.dataset.placeId=id;
 placeCard.hidden=false;
 window.__atlasSheetIntegration?.card.open(id);
 document.body.classList.add('fp-place-open');
 return rendered;
}
async function renderPlace(id){const revision=++renderRevision;const p=await readPlace(id);if(!p||id!==activePlaceId||revision!==renderRevision)return false;const media=mediaOf(p);const keepReadingPosition=placeCard.dataset.placeId===id;
 const previousScroll=keepReadingPosition?(placeCard.querySelector('.fp-card-scroll')?.scrollTop||0):0;
 stopTileVideos();placeCard.replaceChildren();placeCard.classList.remove('fp-editing');// One actual, keyboard-accessible grip is installed by real-product-bridge.
 // The old decorative sheet-grab occupied a second row and overlapped titles.
 const head=h('header','fp-card-header'),titlewrap=h('div','fp-card-title-wrap');titlewrap.append(h('h2','fp-card-name',p.title||'未命名地点'));const address=String(p.address||'').trim();if(address)titlewrap.append(h('p','fp-card-location',address.slice(0,120)));const stageBtn=btn(p.stage==='visited'?'已到访':'想去',async()=>{
  if(busy)return;busy=true;
  try{
   const next=p.stage==='visited'?'plan':'visited';
   await window.__atlasSetPlaceStage(id,next);
   if(activePlaceId===id){await renderPlace(id);feedback(next==='visited'?'已标记为已到访':'已调整为想去');}
  }catch(error){feedback('状态更新失败：'+error.message)}
  finally{busy=false}
 },'fp-place-stage');
 stageBtn.setAttribute('aria-label','当前'+(p.stage==='visited'?'已到访':'想去')+'，点按切换');
 stageBtn.title='点按切换想去／已到访';
 // Stage toggling is preserved in the Brief content section instead of
 // occupying a redundant second header row. No data/handler changes.

/* V4 .14: replace the header thumbnail with the approved drawn navigation icon.
   Photos remain in Media, and the Brief stays in its single reading section. */
const navButton=btn('',()=>{
 const location={lat:Number(p.lat),lng:Number(p.lng),title:p.title||'目的地'};
 if(!Number.isFinite(location.lat)||!Number.isFinite(location.lng))return;
 if(typeof window.__atlasOpenNavigation==='function')window.__atlasOpenNavigation(location);
 else window.open('https://maps.apple.com/?daddr='+encodeURIComponent(location.lat+','+location.lng),'_blank','noopener,noreferrer');
},'fp-place-navigation');
navButton.setAttribute('aria-label','导航前往'+(p.title||'这个地点'));
navButton.title='导航';
const navigationIcon=h('img');navigationIcon.src='./icons/40_direction.svg';navigationIcon.alt='';navigationIcon.setAttribute('aria-hidden','true');
navButton.append(navigationIcon);
/* Reversible bookmark; retained place/media/Brief remain accessible. */
const isStarred=p.starred!==false;
const starButton=btn('',async()=>{
 if(busy)return;busy=true;
 try{
  const changed=await window.__atlasSetBookmarkStarred(id,!isStarred);
  if(changed&&activePlaceId===id){
   await renderPlace(id);
   feedback(changed.starred?'已加入收藏':'已取消收藏；地点、文字、照片和攻略仍保留。');
  }
 }catch(error){feedback('收藏状态更新失败：'+error.message)}
 finally{busy=false}
},'fp-unstar-btn fp-star-toggle');
starButton.dataset.starred=String(isStarred);
starButton.setAttribute('aria-pressed',String(isStarred));
starButton.setAttribute('aria-label',isStarred?'取消收藏地点':'收藏地点');
starButton.title=isStarred?'已收藏 · 点按取消':'未收藏 · 点按收藏';
const starImage=h('img');starImage.src=isStarred?'./icons/04_star_saved.svg':'./icons/03_star.svg';
starImage.alt='';starImage.setAttribute('aria-hidden','true');starButton.append(starImage);
const headActions=h('div','fp-card-head-actions');headActions.append(starButton,navButton);
const closeButton=btn('×',()=>closePlace(),'fp-card-close');
closeButton.setAttribute('aria-label','关闭地点卡片');
head.append(titlewrap,headActions,closeButton);placeCard.append(head);
const sc=h('div','fp-card-scroll');
 /* build .16 · 详情大卡规整为三块卡片（参考苹果排版）：Brief / 影像 / 社交资料 */
 const cardBrief=h('section','fp-block');
 cardBrief.append(sectionHeading('01',p.stage==='visited'?'旅行手记':'为什么想去',btn(editMode==='brief'?'收起':editorDrafts.get(draftKey(id,'brief'))?.dirty?'继续编辑':'编辑',()=>{editMode=editMode==='brief'?'':'brief';renderPlace(id)},'fp-subaction fp-section-edit')));
 if(editMode==='brief'){const edit=h('div','fp-inline-editor');const draft=editorDraft(id,'brief',p.note||'');const area=h('textarea');area.value=draft.value;area.addEventListener('input',()=>{draft.value=area.value;draft.dirty=draft.value!==draft.initial;});area.placeholder=p.stage==='visited'?'记下这次旅程的细节与感受…':'为什么想去这个地方？记录你的旅行灵感…';area.maxLength=12000;area.addEventListener('focus',()=>setTimeout(()=>edit.scrollIntoView({block:'center',behavior:'smooth'}),380)); /* build .18 · 键盘弹起后输入区与保存按钮跟随到可视区 */const actions=h('div','fp-inline-actions');actions.append(btn('保存记录',async()=>{if(busy)return;busy=true;try{const fresh=await readPlace(id);if(!fresh)throw Error('找不到地点');if(!window.FootprintMediaCore)throw Error('存储模块未加载');await window.FootprintMediaCore.createRepository(window.indexedDB).saveBrief(id,area.value.trim());editorDrafts.delete(draftKey(id,'brief'));try{await window.__atlasFlowRefresh?.()}catch(_){}if(activePlaceId===id){editMode='';await renderPlace(id)}}catch(e){if(activePlaceId===id)feedback('保存失败：'+e.message)}finally{busy=false}},'fp-btn-primary'),btn('取消',()=>{if(!discardEditorDraft(id,'brief'))return;editMode='';renderPlace(id)},'fp-btn-muted'));edit.append(area,h('small','fp-editor-draft-hint','未保存的草稿会在当前页面保留；点取消可选择放弃。'),actions);cardBrief.append(edit)}else{const briefText=String(p.note||'').replace(/^原高德地址[：:][^\n]*\n?/,'').trim();cardBrief.append(h('p','fp-brief-text'+(!briefText?' is-empty':''),briefText||(p.stage==='visited'?'暂无旅行手记':'暂无记录')))}
 const cardMedia=h('section','fp-block');
 placeCard.dataset.hasMedia=media.length?'yes':'no';cardMedia.append(sectionHeading('02','照片与视频',btn('＋ 添加',()=>filePicker.click(),'fp-subaction')));
 const filePicker=h('input');filePicker.type='file';filePicker.accept='image/*,video/*';filePicker.multiple=true;filePicker.hidden=true;filePicker.addEventListener('change',()=>addMedia(id,[...filePicker.files]));cardMedia.append(filePicker);
 if(!media.length){const box=h('div','fp-media-empty');box.append(h('span','fp-empty-text','还没有照片或视频'));cardMedia.append(box)}else{const tiles=media.slice(0,5);const mosaic=h('div','fp-media-mosaic'+(tiles.length===1?' one':tiles.length===2?' two':''));tiles.forEach((m,i)=>{const tile=btn('',()=>openViewer(media,i,tile),m.kind==='video'?'fp-video-tile':'');tile.dataset.fpMediaIndex=String(i);if(m.kind==='photo'){const img=h('img');img.src=m.src;img.alt='旅行照片 '+(i+1);img.loading='lazy';tile.append(img)}else {const video=h('video');video.muted=true;video.defaultMuted=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.loop=true;video.autoplay=false;video.preload='metadata';video.controls=false;video.setAttribute('aria-label','旅行视频动态预览');video.__fpEnsureSource=()=>{
 if(video.dataset.sourceUrl)return;
 const blob=m.blob instanceof Blob?m.blob:new Blob([m.bytes],{type:m.type||'video/mp4'});
 const objectUrl=URL.createObjectURL(blob);
 video.dataset.sourceUrl=objectUrl;video.src=objectUrl;
};
tileVideos.add(video);
video.addEventListener('canplay',()=>{if(activePlaceId===id)syncTilePlayback(video)},{once:true});
watchTileVideo(video);tile.append(video,h('span','fp-video-indicator','▶'))}if(i===tiles.length-1&&media.length>tiles.length)tile.append(h('span','fp-tile-more','+'+(media.length-tiles.length)));mosaic.append(tile)});cardMedia.append(mosaic);cardMedia.append(h('div','fp-photo-count',`${(p.photos||[]).length} 张照片 · ${(p.videos||[]).length} 条视频`))}
 const cardLinks=h('section','fp-block');
 cardLinks.append(sectionHeading('03','相关攻略',btn(editMode==='link'?'收起':editorDrafts.get(draftKey(id,'link'))?.dirty?'继续编辑':'＋ 链接',()=>{editMode=editMode==='link'?'':'link';renderPlace(id)},'fp-subaction fp-section-edit')));
 const links=linksOf(p);
  if(links.length){
   const list=h('div','fp-guide-list');
   links.slice(0,12).forEach(x=>{
    const row=h('div','fp-guide-row');
    const link=h('a','fp-guide-open');
    link.href=x.url;link.target='_blank';link.rel='noopener noreferrer';
    link.title='使用浏览器或对应平台打开：'+x.url;
    const identity=h('span','fp-guide-identity');
    identity.append(h('small','fp-guide-source',x.source||sourceName(x.url)),
      h('strong','fp-guide-title',x.title||'查看原始内容'));
    link.append(identity,h('span','fp-guide-arrow','↗'));
    const copy=btn('复制',async()=>{
     try{await navigator.clipboard.writeText(x.url);feedback('攻略链接已复制')}
     catch{window.prompt('复制链接后在原平台打开',x.url)}
    },'fp-guide-copy');
    copy.setAttribute('aria-label','复制'+(x.title||'攻略')+'的链接');
    row.append(link,copy);list.append(row);
   });
   cardLinks.append(list,h('p','fp-guide-footnote','部分平台内容需要登录或在原 App 中打开。'));
  }else cardLinks.append(h('p','fp-guide-empty','还没有攻略链接。可从其他平台复制分享文字到这里。'));
  if(editMode==='link'){
   const edit=h('div','fp-inline-editor fp-guide-editor');
   const draft=editorDraft(id,'link',{url:'',title:''});
   const url=h('textarea');url.rows=3;
   url.placeholder='粘贴微信公众号、小红书、抖音或视频平台的分享文字／链接';
   url.autocomplete='off';url.maxLength=4200;
   const name=h('input');name.type='text';
   name.placeholder='攻略标题（可选，留空自动识别）';name.maxLength=150;
   url.value=draft.value.url||'';name.value=draft.value.title||'';
   const detection=h('p','fp-guide-detection','粘贴分享文字后自动识别链接，不访问第三方内容。');
   const updateDetection=()=>{
    const matched=window.FootprintGuideLinks?.parse(url.value,name.value);
    if(!url.value.trim()){detection.textContent='粘贴分享文字后自动识别链接，不访问第三方内容。';return}
    detection.textContent=matched?.ok?'已识别：'+matched.source+(matched.isShortLink?' · 平台短链接':''):'未找到完整链接，请确认分享内容中包含 https://';
   };
   const keep=()=>{
    draft.value={url:url.value,title:name.value};
    draft.dirty=!!url.value.trim()||!!name.value.trim();updateDetection();
   };
   url.addEventListener('input',keep);
   name.addEventListener('input',keep);
   updateDetection();
   const acts=h('div','fp-inline-actions');
   acts.append(btn('保存链接',async()=>{
     const parsed=window.FootprintGuideLinks?.parse(url.value,name.value);
     if(!parsed?.ok){feedback(parsed?.error||'请粘贴包含 https:// 的有效分享链接');return}
     if(busy)return;busy=true;
     try{
      const fresh=await readPlace(id);
      if(!fresh)throw Error('地点不存在');
      const before=linksOf(fresh);
      if(before.some(x=>x.url===parsed.url)){
       feedback('这个链接已经收藏过了');return;
      }
      if(!window.FootprintMediaCore)throw Error('存储模块未加载');
      await window.FootprintMediaCore.createRepository(window.indexedDB).saveGuide(id,{
       url:parsed.url,title:parsed.title,source:parsed.source,
       originalText:parsed.originalText,createdAt:new Date().toISOString()
      });
      editorDrafts.delete(draftKey(id,'link'));
      try{await window.__atlasFlowRefresh?.()}catch(_){}
      if(activePlaceId===id){editMode='';await renderPlace(id);feedback('攻略链接已保存');}
     }catch(error){if(activePlaceId===id)feedback('保存失败：'+error.message)}
     finally{busy=false}
    },'fp-btn-primary'),btn('取消',()=>{
     if(!discardEditorDraft(id,'link'))return;editMode='';renderPlace(id)
    },'fp-btn-muted'));
   edit.append(url,name,detection,acts);
   cardLinks.append(edit);
   queueMicrotask(()=>{if(activePlaceId===id&&editMode==='link')edit.scrollIntoView({block:'nearest',behavior:'smooth'})});
  }
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
   }catch{if(nearby.isConnected&&activePlaceId===id)status.textContent='附近地点暂时无法读取，可重试'}
   finally{load.disabled=false}
 },'fp-subaction');
 nearby.append(sectionHeading('04','附近地点',load),status);
 cardBrief.append(stageBtn);
 sc.append(cardBrief,cardMedia,cardLinks,nearby);
 const f=h('div','fp-card-feedback');f.id='fpCardFeedback';sc.append(f);placeCard.append(sc);
 // Preserve reading position while editing the SAME real place; another
 // place starts with its own content rather than inheriting old scroll.
 if(keepReadingPosition&&previousScroll>1){
  requestAnimationFrame(()=>{
   if(activePlaceId!==id||placeCard.querySelector('.fp-card-scroll')!==sc)return;
   sc.scrollTop=Math.min(previousScroll,Math.max(0,sc.scrollHeight-sc.clientHeight));
  });
 }
 return true;
}
async function shrinkPhoto(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('无法读取图片'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(Error('无法解码图片，请改用 JPEG/PNG'));img.onload=()=>{const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve({name:file.name,src:canvas.toDataURL('image/jpeg',.82),addedAt:new Date().toISOString()})};img.src=reader.result};reader.readAsDataURL(file)})}
async function addMedia(id,files){
 if(!files?.length||busy)return;
 busy=true;if(activePlaceId===id)feedback('正在验证并保存影像…');
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
  if(activePlaceId===id){await renderPlace(id);if(activePlaceId===id)feedback('已保存 '+prepared.length+' 项影像到当前地点；刷新后仍可查看。')}
 }catch(e){console.error('地点媒体保存失败',e);if(activePlaceId===id)feedback('保存失败，原有内容未改动：'+(e?.message||'请检查权限或空间'))}
 finally{busy=false}
}
/* Media D · iPhone-style continuous gallery V2.
 * Separate motion owner, same existing place/media data and same sheet UI.
 * Never tear down the modal between adjacent photos or videos. */
const iphoneGallery=(()=>{
 const ease='cubic-bezier(.22,1,.36,1)';
 const photoEase='cubic-bezier(.2,.82,.2,1)';
 let current=null;
 const reduced=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 const transform=(x,y=0,scale=1)=>'translate3d('+x+'px,'+y+'px,0) scale('+scale+')';
 function styles(){
  if(document.getElementById('fp-ios-gallery-v2'))return;
  const style=document.createElement('style');style.id='fp-ios-gallery-v2';
  style.textContent=[
   '#fpMediaViewer.fp-ios-gallery{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;display:block!important;overflow:hidden!important;box-sizing:border-box!important;background-color:transparent!important;color:#fff;touch-action:none!important;overscroll-behavior:contain;isolation:isolate}',
   '#fpMediaViewer.fp-ios-gallery::backdrop{background:transparent!important}',
   '#fpMediaViewer .fp-gallery-scrim{position:fixed;inset:0;z-index:0;pointer-events:none;background:#131415;opacity:.93;will-change:opacity;transform:translateZ(0)}',
   '#fpMediaViewer .fp-gallery-stage{position:absolute;inset:0;z-index:1;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}',
   '#fpMediaViewer .fp-gallery-track{position:absolute;left:0;top:0;height:100%;display:flex;align-items:stretch;will-change:transform;transform-origin:center center;backface-visibility:hidden}',
   '#fpMediaViewer .fp-gallery-cell{height:100%;flex:none;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;padding:calc(env(safe-area-inset-top,0px) + 48px) 10px calc(env(safe-area-inset-bottom,0px) + 56px)}',
   '#fpMediaViewer .fp-gallery-cell>img,#fpMediaViewer .fp-gallery-cell>video{display:block;position:relative;width:auto!important;height:auto!important;max-width:min(96vw,900px)!important;max-height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 116px)!important;object-fit:contain!important;border-radius:0;transform:translateZ(0);-webkit-user-drag:none;user-select:none}',
   '#fpMediaViewer .fp-gallery-cell>video{touch-action:auto!important;max-width:96vw!important;width:min(96vw,900px)!important;min-height:180px!important;aspect-ratio:auto 16/9}',
   '#fpMediaViewer .fp-gallery-video-wrap{position:relative;display:flex;align-items:center;justify-content:center;width:min(96vw,900px);max-height:calc(100dvh - 116px);aspect-ratio:16/9}',
   '#fpMediaViewer .fp-gallery-video-wrap>video{display:block;position:relative;width:100%!important;height:auto!important;max-width:100%!important;max-height:calc(100dvh - 116px)!important;min-height:180px!important;object-fit:contain!important;touch-action:auto!important}',
   '#fpMediaViewer .fp-gallery-video-gesture{position:absolute;top:0;left:0;right:0;bottom:74px;z-index:2;cursor:grab;touch-action:none;background:transparent}',
   '#fpMediaViewer .fp-gallery-video-standby{position:relative;width:min(96vw,900px);height:min(53vw,50dvh);min-height:168px;max-height:54dvh;display:flex;align-items:center;justify-content:center;background:#222527;border-radius:9px;overflow:hidden;color:white}',
   '#fpMediaViewer .fp-gallery-video-standby img{width:100%;height:100%;object-fit:contain}',
   '#fpMediaViewer .fp-gallery-video-icon{position:absolute;display:grid;place-items:center;width:52px;height:52px;background:rgba(0,0,0,.48);border-radius:50%;font-size:20px}',
   '#fpMediaViewer .fp-viewer-close{position:absolute!important;z-index:11!important;top:calc(env(safe-area-inset-top,0px) + 12px)!important;right:16px!important;transition:opacity .18s ease!important}',
   // Override legacy [open] button typography and the v16 double pseudo X.
   '#fpMediaViewer[open].fp-ios-gallery .fp-viewer-close{position:absolute!important;top:calc(env(safe-area-inset-top,0px) + 12px)!important;right:max(16px,env(safe-area-inset-right,0px))!important;z-index:99!important;display:grid!important;place-items:center!important;width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;max-width:44px!important;max-height:44px!important;padding:0!important;font-size:0!important;line-height:0!important;background:rgba(41,47,44,.53)!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:14px!important;color:#fff!important}',
   '#fpMediaViewer[open].fp-ios-gallery .fp-viewer-close::before,#fpMediaViewer[open].fp-ios-gallery .fp-viewer-close::after{content:none!important;display:none!important;background:none!important}',
   '#fpMediaViewer[open].fp-ios-gallery .fp-viewer-close>.fp-close-svg{display:block!important;position:relative!important;width:21px!important;height:21px!important;min-width:21px!important;min-height:21px!important;color:#fff!important;pointer-events:none!important;flex:none!important;fill:none!important}',
   '#fpMediaViewer .fp-viewer-caption{position:absolute!important;z-index:9!important;left:24px!important;right:24px!important;bottom:calc(env(safe-area-inset-bottom,0px) + 14px)!important;text-align:center!important;pointer-events:none!important;font-size:12px!important;line-height:1.55!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:rgba(255,255,255,.88)!important;transition:opacity .18s ease!important}',
   '#fpMediaViewer.fp-viewer-immersive .fp-viewer-close,#fpMediaViewer.fp-viewer-immersive .fp-viewer-caption{opacity:0!important;pointer-events:none!important}',
   '#fpMediaViewer .fp-gallery-ghost{position:fixed!important;z-index:12!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;pointer-events:none!important;object-fit:contain!important;transform-origin:center center;will-change:transform,opacity,border-radius}',
   '@media(prefers-reduced-motion:reduce){#fpMediaViewer .fp-viewer-close,#fpMediaViewer .fp-viewer-caption{transition:none!important}}'
  ].join('\n');
  document.head.append(style);
 }
 function freezeScrim(s){
  const displayed=Number.parseFloat(getComputedStyle(s.scrim).opacity);
  for(const a of s.scrim.getAnimations?.()||[])try{a.cancel()}catch(_){}
  const alpha=Number.isFinite(displayed)?displayed:.93;
  s.scrim.style.opacity=String(alpha);
  return alpha;
 }
 function freezePhotoEntrance(s){
  const img=mediaAt(s);
  if(!s.enterAnimation||img?.tagName!=='IMG')return;
  const computed=getComputedStyle(img),pose=computed.transform,opacity=computed.opacity;
  img.style.transform=pose;img.style.opacity=opacity;
  try{s.enterAnimation.cancel()}catch(_){}
  s.enterAnimation=null;
 }
 function original(s,i){
  const tile=s.card?.querySelector('[data-fp-media-index="'+i+'"]');
  if(tile?.isConnected)return tile;
  return s.index===i&&s.firstOrigin?.isConnected?s.firstOrigin:null;
 }
 // Hide the source mosaic tile during shared-element photo animations;
 // restore its original inline visibility when the dialog is removed.
 function hideOrigin(s,tile){
  if(!tile?.isConnected)return;
  if(!s.hiddenOrigins.some(([n])=>n===tile)){
   s.hiddenOrigins.push([tile,tile.style.visibility]);
   tile.style.visibility='hidden';
  }
 }
 function videoURL(s,i){
  if(s.urls.has(i))return s.urls.get(i);
  // Reuse the pre-existing card thumbnail blob URL when possible;
  // allocating another 80MB Blob for the same video stalls mobile Safari.
  const tile=original(s,i),tileVideo=tile?.querySelector('video');
  if(tileVideo?.dataset.sourceUrl)return tileVideo.dataset.sourceUrl;
  const item=s.items[i],blob=item.blob instanceof Blob?item.blob:
   new Blob([item.bytes],{type:item.type||'video/mp4'});
  const url=URL.createObjectURL(blob);
  s.urls.set(i,url);
  while(s.urls.size>1){
   const old=s.urls.keys().next().value;
   URL.revokeObjectURL(s.urls.get(old));s.urls.delete(old);
  }
  return url;
 }
 function videoPlaceholder(s,i){
  const placeholder=h('div','fp-gallery-video-standby');
  placeholder.setAttribute('aria-label','视频预览');
  const item=s.items[i];
  const poster=(typeof item?.posterSrc==='string'&&item.posterSrc.startsWith('data:image/'))?item.posterSrc:null;
  if(poster){const img=h('img');img.src=poster;img.alt='视频封面';placeholder.append(img)}
  const symbol=h('span','fp-gallery-video-icon','▶');
  placeholder.append(symbol);
  return placeholder;
 }
 function attachVideo(s,cell,i){
  const item=s.items[i];if(!item||item.kind!=='video')return;
  const v=h('video');v.playsInline=true;
  v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');
  v.controls=true;v.preload='metadata';v.disablePictureInPicture=true;
  v.src=videoURL(s,i);
  const wrap=h('div','fp-gallery-video-wrap');
  const gesture=h('div','fp-gallery-video-gesture');
  gesture.setAttribute('aria-label','轻扫切换视频，点按播放或暂停');
  gesture.addEventListener('click',()=>{
   if(performance.now()<s.suppressClickUntil||s.closed||s.closing)return;
   if(v.paused){const play=v.play();play?.catch?.(()=>{})}
   else try{v.pause()}catch(_){}
  });
  wrap.append(v,gesture);cell.replaceChildren(wrap);v.muted=false;
 }
 function releaseVideo(s,cell){
  const v=cell.querySelector('video');if(!v)return;
  const i=+cell.dataset.itemIndex;
  try{v.pause();v.removeAttribute('src');v.load()}catch(_){}
  cell.replaceChildren(videoPlaceholder(s,i));
 }
 function makeSlide(s,i){
  const cell=h('div','fp-gallery-cell');cell.dataset.itemIndex=String(i);
  cell.style.width=s.width+'px';
  const item=s.items[i];if(!item)return cell;
  if(item.kind==='photo'){
   const img=h('img');img.src=item.src;img.alt='旅行照片 '+(i+1);img.draggable=false;
   img.decoding='async';img.loading='eager';img.fetchPriority=i===s.index?'high':'low';cell.append(img);
  }else if(i===s.index)attachVideo(s,cell,i);
  else cell.append(videoPlaceholder(s,i));
  return cell;
 }
 function mediaAt(s){return s.cells?.[1]?.querySelector('img,video')||null}
 function chrome(s,opacity){s.closeButton.style.opacity=String(opacity);s.caption.style.opacity=String(opacity)}
 function updateLabel(s){
  const item=s.items[s.index];s.caption.textContent=(s.index+1)+' / '+s.items.length+' · '+(item?.name||'旅行影像');
  s.viewer.__origin=original(s,s.index);
 }
 function activate(s,play=true){
  // Only one video decoder may exist while the viewer is open.
  s.cells.forEach((cell,i)=>{
   const item=s.items[+cell.dataset.itemIndex];
   if(item?.kind!=='video')return;
   if(i!==1){releaseVideo(s,cell);return}
   if(!cell.querySelector('video'))attachVideo(s,cell,+cell.dataset.itemIndex);
   const v=cell.querySelector('video');
   if(!v)return;
   v.controls=true;
   if(play){const promise=v.play();promise?.catch?.(()=>{})}
  });
 }
 function resetWidth(s){
  s.width=Math.max(1,Math.round(s.stage.getBoundingClientRect().width||window.innerWidth));
  s.track.style.width=(s.width*3)+'px';
  if(s.cells)for(const cell of s.cells)cell.style.width=s.width+'px';
  if(!s.drag&&!s.locked)s.track.style.transform=transform(-s.width);
 }
 function populate(s){
  resetWidth(s);
  s.cells=[makeSlide(s,s.index-1),makeSlide(s,s.index),makeSlide(s,s.index+1)];
  s.track.replaceChildren(...s.cells);
  s.track.style.transform=transform(-s.width);
  updateLabel(s);
  activate(s,false);
 }
 function animateTo(element,from,to,duration,easing,done){
  if(reduced()||!element?.animate||duration<=0){element.style.transform=to;done?.();return}
  let finished=false;
  const end=()=>{if(finished)return;finished=true;element.style.transform=to;try{a.cancel()}catch(_){};done?.()};
  let a;
  try{
   a=element.animate([{transform:from},{transform:to}],{duration,easing,fill:'both'});
   a.finished.then(end,end);setTimeout(end,duration+100);
  }catch(_){end()}
 }
 function cleanup(s){
  if(!s||s.closed)return;
  s.closed=true;s.locked=true;
  if(s.gestureRAF){cancelAnimationFrame(s.gestureRAF);s.gestureRAF=0}
  s.stage.removeEventListener('touchstart',s.onTouchStart,true);
  s.stage.removeEventListener('touchmove',s.onTouchMove,true);
  window.removeEventListener('touchend',s.onTouchEnd,true);
  window.removeEventListener('touchcancel',s.onTouchCancel,true);
  window.removeEventListener('pointerup',s.onPointerUp,true);
  window.removeEventListener('pointercancel',s.onPointerCancel,true);
  window.removeEventListener('resize',s.onResize);
  if(s.videoActivationTimer){clearTimeout(s.videoActivationTimer);s.videoActivationTimer=null}
  s.cells?.forEach(cell=>{
   const v=cell.querySelector('video');if(!v)return;
   try{v.pause();v.removeAttribute('src');v.load()}catch(_){}
  });
  try{if(s.viewer.open)s.viewer.close()}catch(_){}
  s.viewer.remove();
  for(const [tile,visibility] of s.hiddenOrigins||[])
   if(tile?.isConnected)tile.style.visibility=visibility;
  s.hiddenOrigins=[];
  for(const url of s.urls.values())URL.revokeObjectURL(url);
  if(current===s)current=null;
  for(const v of tileVideos)syncTilePlayback(v);
 }

 function close(immediate=false){
  const s=current;if(!s||s.closed)return;
  if(immediate||reduced()){cleanup(s);return}
  if(s.closing)return;
  s.closing=true;s.locked=true;s.viewer.dataset.gestureState='closing';
  if(s.gestureRAF){cancelAnimationFrame(s.gestureRAF);s.gestureRAF=0}
  const media=mediaAt(s),duration=mediaAt(s)?.tagName==='VIDEO'?350:425; // photo return matches iOS cadence
  const from=media?.getBoundingClientRect();
  const tile=original(s,s.index),to=tile?.getBoundingClientRect();
  hideOrigin(s,tile);
  chrome(s,0);
  const alpha=freezeScrim(s);
  if(s.scrim.animate)try{
   s.scrim.animate([{opacity:alpha},{opacity:0}],{
    duration:duration-12,easing:'cubic-bezier(.22,.7,.18,1)',fill:'forwards'});
  }catch(_){}
  if(media?.tagName==='VIDEO'){
   // Safari video renders in a separate hardware layer; never warp it.
   try{media.pause()}catch(_){}
   if(s.track.animate)try{s.track.animate([{opacity:1},{opacity:0}],{duration:duration-45,fill:'forwards'})}catch(_){}
   setTimeout(()=>cleanup(s),duration);
   return;
  }
  if(media&&from&&from.width>2&&from.height>2&&media.animate){
   // Single decoded photo stays attached to the existing slide throughout exit.
   // No DOM reparent, no second image, no raster re-upload, no aspect distortion.
   const pose=getComputedStyle(media).transform;
   let m;try{m=new DOMMatrixReadOnly(pose==='none'?undefined:pose)}catch(_){}
   const sx=m?Math.hypot(m.a,m.b):1,sy=m?Math.hypot(m.c,m.d):sx;
   const currentScale=Math.max(.01,(sx+sy)/2);
   const baseX=from.left+from.width/2-(m?.m41||0);
   const baseY=from.top+from.height/2-(m?.m42||0);
   const baseW=from.width/currentScale,baseH=from.height/currentScale;
   const found=to&&to.width>2&&to.height>2;
   const targetScale=found?Math.min(to.width/baseW,to.height/baseH):.68;
   const deltaX=found?to.left+to.width/2-baseX:0;
   const deltaY=found?to.top+to.height/2-baseY:Math.min(210,s.width*.45);
   const destination='translate3d('+deltaX+'px,'+deltaY+'px,0) scale('+targetScale+')';
   const firstOpacity=Number.parseFloat(getComputedStyle(media).opacity)||1;
   media.style.transition='none'; // prevent second CSS zoom during WAAPI return
   media.style.transform=pose==='none'?'none':pose;
   if(s.enterAnimation){try{s.enterAnimation.cancel()}catch(_){};s.enterAnimation=null}
   try{
    media.animate([
     {transform:pose==='none'?'none':pose,opacity:firstOpacity,borderRadius:'0px',offset:0},
     {transform:destination,opacity:1,borderRadius:'10px',offset:.78},
     {transform:destination,opacity:0,borderRadius:'10px',offset:1}
    ],{duration,easing:photoEase,fill:'forwards'});
   }catch(_){}
  }else if(s.track.animate){
   try{s.track.animate([{opacity:1},{opacity:0}],{duration:duration-55,fill:'forwards'})}catch(_){}
  }
  setTimeout(()=>cleanup(s),duration+22);
 }
 function reveal(s,origin){
  if(s.closed)return;
  const media=mediaAt(s),tile=origin?.isConnected?origin:null;
  const start=tile?.getBoundingClientRect(),to=media?.getBoundingClientRect();
  hideOrigin(s,tile);
  const duration=media?.tagName==='VIDEO'?340:410;
  if(reduced()){s.scrim.style.opacity='.93';if(media)media.style.opacity='1';chrome(s,1);return}
  s.scrim.style.opacity='0';chrome(s,0);
  if(s.scrim.animate){
   const fade=s.scrim.animate([{opacity:0},{opacity:.93}],{duration:duration-48,easing:'cubic-bezier(.2,.75,.2,1)',fill:'both'});
   fade.finished.then(()=>{if(!s.closed)s.scrim.style.opacity='.93';fade.cancel()},()=>{});
  }else s.scrim.style.opacity='.93';
  if(media?.tagName==='VIDEO'){
   // Safari video hardware layer must never share the photo thumbnail zoom.
   // Start full-screen immediately; defer decoder start until the fade ends.
   media.style.transform='none';media.style.opacity='1';
   setTimeout(()=>{if(!s.closed&&!s.closing&&media.isConnected){const play=media.play();play?.catch?.(()=>{})}},240);
  }else if(media?.animate){
   const valid=start&&to&&to.width>2&&to.height>2;
   const dx=valid?start.left+start.width/2-to.left-to.width/2:0;
   const dy=valid?start.top+start.height/2-to.top-to.height/2:0;
   const fit=valid?Math.min(start.width/to.width,start.height/to.height):1;
   const opening=media.animate([
    {transform:valid?'translate3d('+dx+'px,'+dy+'px,0) scale('+fit+')':'none',
     opacity:valid?1:0,borderRadius:valid?'14px':'0px'},
    {transform:'none',opacity:1,borderRadius:'0px'}
   ],{duration,easing:photoEase,fill:'both'});
   s.enterAnimation=opening;
   media.style.opacity='1';
   opening.finished.then(()=>{if(s.enterAnimation===opening){
    media.style.transform='none';opening.cancel();s.enterAnimation=null;
   }},()=>{});
  }else if(media)media.style.opacity='1';
  setTimeout(()=>{if(!s.closed&&!s.closing)chrome(s,1)},duration-44);
 }

 function settle(s){
  if(s.closed||s.closing)return;
  s.locked=true;
  const down=s.drag?.mode==='down';
  const target=down?mediaAt(s):s.track;
  if(!target){s.locked=false;s.drag=null;return}
  const from=target.style.transform||'none',to=down?'none':transform(-s.width);
  const alpha=Number(s.scrim.style.opacity||.93);
  animateTo(target,from,to,285,'cubic-bezier(.18,.86,.24,1)',()=>{
   if(s.closed)return;
   s.scrim.style.opacity='.93';chrome(s,1);s.locked=false;s.drag=null;
   s.viewer.dataset.gestureState='rest';
  });
  if(down&&!reduced()&&s.scrim.animate)try{
   const anim=s.scrim.animate([{opacity:alpha},{opacity:.93}],{duration:280,fill:'both'});
   anim.finished.then(()=>{if(!s.closed){s.scrim.style.opacity='.93';anim.cancel()}},()=>{});
  }catch(_){}
 }
 function navigate(s,dir){
  if(s.locked||s.closing||s.closed||!s.items[s.index+dir]){settle(s);return}
  s.locked=true;s.viewer.dataset.gestureState='changing';
  const from=s.track.style.transform,to=transform(-s.width-dir*s.width);
  const speed=clamp(270-Math.abs(s.drag?.vx||0)*60,160,285);
  animateTo(s.track,from,to,speed,ease,()=>{
   if(s.closed)return;
   const previous=s.cells;
   s.index+=dir;
   if(dir>0){
    const exiting=previous.shift();releaseVideo(s,exiting);
    exiting.remove();previous.push(makeSlide(s,s.index+1));
   }else{
    const exiting=previous.pop();releaseVideo(s,exiting);
    exiting.remove();previous.unshift(makeSlide(s,s.index-1));
   }
   s.cells=previous;s.track.replaceChildren(...previous);
   // Release the outgoing video BEFORE publishing the new index.
   // The new decoder begins only after the next paint, never overlaps.
   s.cells.forEach((cell,i)=>{if(i!==1)releaseVideo(s,cell)});
   s.track.style.transform=transform(-s.width);
   s.viewer.dataset.itemIndex=String(s.index);
   s.drag=null;s.locked=false;s.viewer.dataset.gestureState='rest';
   updateLabel(s);chrome(s,1);s.scrim.style.opacity='.93';
   if(s.queuedDir){
    const queued=s.queuedDir;s.queuedDir=0;
    // A rapid flick should not create/decode the intermediate video.
    requestAnimationFrame(()=>{if(!s.closed)navigate(s,queued)});
   }else if(s.items[s.index]?.kind==='video'){
    const activationIndex=s.index;
    // Defer creating/starting the video decoder until after the slide has painted.
    s.videoActivationTimer=setTimeout(()=>{
     s.videoActivationTimer=null;
     if(!s.closed&&!s.closing&&s.index===activationIndex)activate(s);
    },65);
   }else activate(s);
  });
 }
 function bindTouches(s){
  function paint(){
   s.gestureRAF=0;
   const g=s.drag;if(!g||s.closed||s.closing||s.locked)return;
   const dx=g.dx,dy=g.dy;
   if(g.mode==='horizontal'){
    let moved=dx;
    if((dx>0&&s.index===0)||(dx<0&&s.index===s.items.length-1))
     moved=Math.sign(dx)*Math.min(s.width*.28,Math.pow(Math.abs(dx),.83)*.68);
    s.track.style.transform=transform(-s.width+moved);
    s.viewer.dataset.gestureState='horizontal';
   }else if(g.mode==='down'){
    const pulled=Math.max(0,dy),scale=clamp(1-pulled*.00066,.79,1);
    const media=mediaAt(s);if(media)media.style.transform=transform(0,pulled,scale);
    s.scrim.style.opacity=String(clamp(.93-pulled*.0022,.12,.93));
    chrome(s,clamp(1-pulled/165,0,1));
    s.viewer.dataset.gestureState='down';
   }
  }
  function flush(){
   if(s.gestureRAF){cancelAnimationFrame(s.gestureRAF);s.gestureRAF=0}
   paint();
  }
  s.onTouchStart=e=>{
   if(s.closing||e.touches.length!==1||e.target.closest('button')){s.drag=null;return}
   freezePhotoEntrance(s);
   const touchedVideo=e.target.closest('video');
   if(touchedVideo){
    const rect=touchedVideo.getBoundingClientRect();
    if(e.touches[0].clientY>rect.bottom-74){s.drag=null;return}
   }
   const p=e.touches[0];
   s.drag={startX:p.clientX,startY:p.clientY,t0:performance.now(),mode:null,dx:0,dy:0,vx:0,vy:0};
  };
  s.onTouchMove=e=>{
   const g=s.drag;if(!g||e.touches.length!==1)return;
   const p=e.touches[0],dx=p.clientX-g.startX,dy=p.clientY-g.startY;
   if(!g.mode&&Math.max(Math.abs(dx),Math.abs(dy))>7){
    if(dy>0&&Math.abs(dy)>Math.abs(dx)*1.05)g.mode='down';
    else if(Math.abs(dx)>Math.abs(dy)*1.05)g.mode='horizontal';
    else return;
   }
   if(!g.mode)return;
   if(!g.backdropFrozen){freezeScrim(s);g.backdropFrozen=true}
   if(e.cancelable)e.preventDefault();
   g.dx=dx;g.dy=dy;
   const elapsed=Math.max(16,performance.now()-g.t0);
   g.vx=dx/elapsed;g.vy=dy/elapsed;
   if(!s.locked&&!s.gestureRAF)s.gestureRAF=requestAnimationFrame(paint);
  };
  s.onTouchEnd=e=>{
   const g=s.drag;if(!g||e.changedTouches.length!==1||s.closed)return;
   const p=e.changedTouches[0],dx=p.clientX-g.startX,dy=p.clientY-g.startY;
   if(s.locked){
    if(g.mode==='horizontal'){
     const dir=dx<0?1:-1;
     if(s.items[s.index+dir]&&Math.abs(dx)>55){
      s.queuedDir=dir;
      if(s.viewer.dataset.gestureState!=='changing'){
       // A rubber-band settle may also hold the animation lock.
       setTimeout(()=>{
        if(s.closed||s.closing||s.locked||!s.queuedDir)return;
        const queued=s.queuedDir;s.queuedDir=0;navigate(s,queued);
       },340);
      }
     }
    }
    s.drag=null;
    s.suppressClickUntil=performance.now()+350;
    return;
   }
   g.dx=dx;g.dy=dy;flush();
   if(g.mode==='down'){
    if(dy>105||(dy>36&&g.vy>.6))close(false);else settle(s);
   }else if(g.mode==='horizontal'){
    const dir=dx<0?1:-1;
    if(s.items[s.index+dir]&&(Math.abs(dx)>Math.min(94,s.width*.21)||(Math.abs(dx)>25&&Math.abs(g.vx)>.52)))navigate(s,dir);
    else settle(s);
   }else{s.drag=null;s.scrim.style.opacity='.93'}
   s.suppressClickUntil=performance.now()+350;
   // Touchend and pointerup can both fire for one physical finger release.
   // Consume the gesture once so it cannot navigate two items.
   s.drag=null;
  };
  s.onTouchCancel=()=>{
   if(s.gestureRAF){cancelAnimationFrame(s.gestureRAF);s.gestureRAF=0}
   if(s.drag?.mode&&!s.locked)settle(s);else s.drag=null;
  };
  s.stage.addEventListener('touchstart',s.onTouchStart,{passive:true,capture:true});
  s.stage.addEventListener('touchmove',s.onTouchMove,{passive:false,capture:true});
  window.addEventListener('touchend',s.onTouchEnd,{passive:true,capture:true});
  window.addEventListener('touchcancel',s.onTouchCancel,{passive:true,capture:true});
  // iOS WebKit may terminate a native video gesture with pointerup but no touchend.
  s.onPointerUp=e=>{
   if(e.pointerType!=='touch'||!s.drag)return;
   s.onTouchEnd({changedTouches:[{clientX:e.clientX,clientY:e.clientY}]});
  };
  s.onPointerCancel=e=>{if(e.pointerType==='touch'&&s.drag)s.onTouchCancel()};
  window.addEventListener('pointerup',s.onPointerUp,{passive:true,capture:true});
  window.addEventListener('pointercancel',s.onPointerCancel,{passive:true,capture:true});
 }
 function open(items,index,originTile){
  close(true);
  if(!Array.isArray(items)||!items[index])return;
  styles();
  const viewer=h('dialog','fp-ios-gallery');viewer.id='fpMediaViewer';
  viewer.tabIndex=-1;viewer.setAttribute('role','dialog');viewer.setAttribute('aria-modal','true');
  viewer.setAttribute('aria-label','查看旅行照片或视频');
  viewer.dataset.mediaMotion='iphone-v5';viewer.dataset.gestureState='rest';viewer.dataset.itemIndex=String(index);
  const stage=h('div','fp-gallery-stage'),track=h('div','fp-gallery-track');
  stage.append(track);
  // One SVG cross. Legacy × text plus ::before/after made duplicate Xs.
  const closeButton=btn('',()=>close(false),'fp-viewer-close');
  const closeIcon=document.createElementNS('http://www.w3.org/2000/svg','svg');
  closeIcon.setAttribute('viewBox','0 0 24 24');
  closeIcon.setAttribute('class','fp-close-svg');
  closeIcon.setAttribute('aria-hidden','true');closeIcon.setAttribute('focusable','false');
  for(const d of ['M5 5 L19 19','M19 5 L5 19']){
   const path=document.createElementNS('http://www.w3.org/2000/svg','path');
   path.setAttribute('d',d);path.setAttribute('fill','none');
   path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','2.5');
   path.setAttribute('stroke-linecap','round');closeIcon.append(path);
  }
  closeButton.append(closeIcon);
  closeButton.setAttribute('aria-label','关闭全屏影像');
  const caption=h('div','fp-viewer-caption');
  const scrim=h('div','fp-gallery-scrim');scrim.style.opacity='0';
  viewer.append(scrim,stage,closeButton,caption);
  document.body.append(viewer);
  try{viewer.showModal()}catch(_){viewer.setAttribute('open','')}
  if(window.matchMedia?.('(pointer:coarse)')?.matches)try{viewer.focus({preventScroll:true})}catch(_){}
  const s={viewer,stage,track,scrim,closeButton,caption,items,index,firstOrigin:originTile,card:placeCard,urls:new Map(),width:0,cells:null,drag:null,locked:false,closed:false,closing:false,suppressClickUntil:0,hiddenOrigins:[]};
  current=s;
  populate(s);
  if(!reduced()){const m=mediaAt(s);if(m)m.style.opacity='0'}
  bindTouches(s);
  s.onResize=()=>{if(!s.closed&&!s.locked)resetWidth(s)};
  window.addEventListener('resize',s.onResize,{passive:true});
  viewer.addEventListener('cancel',e=>{e.preventDefault();close(false)});
  viewer.addEventListener('click',e=>{
   if(performance.now()<s.suppressClickUntil)return;
   if(e.target===viewer){close(false);return}
   if(e.target.tagName==='IMG'&&e.target.closest('.fp-gallery-cell')){
    viewer.classList.toggle('fp-viewer-immersive');
    e.target.setAttribute('aria-label',viewer.classList.contains('fp-viewer-immersive')?'旅行照片，点按显示操作':'旅行照片，点按隐藏操作');
   }
  });
  viewer.addEventListener('keydown',e=>{
   if(e.target.closest('video'))return;
   if(e.key==='ArrowRight'&&s.items[s.index+1]){e.preventDefault();navigate(s,1)}
   if(e.key==='ArrowLeft'&&s.index>0){e.preventDefault();navigate(s,-1)}
   if(e.key==='Escape'){e.preventDefault();close(false)}
  });
  for(const v of tileVideos){try{v.pause()}catch(_){}}
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(current===s&&!s.closed)reveal(s,originTile)}));
 }
 return Object.freeze({open,close,getState:()=>current&&{itemIndex:current.index,gesture:current.viewer.dataset.gestureState,open:!current.closed,activeVideos:current.viewer.querySelectorAll('video[src]').length,blobUrls:current.urls.size}});
})();
function closeViewer(immediate=false){iphoneGallery.close(immediate)}
function openViewer(items,index,originTile=null){iphoneGallery.open(items,index,originTile)}
function init(){initSearch();mountPlace();window.__footprintHome={openSearch,closeSearch,openSaved:showPlaceCard,readPlaces};}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
