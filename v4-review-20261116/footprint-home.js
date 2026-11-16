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
function syncTilePlayback(v){
 if(!tileVideos.has(v))return;
 const active=v.dataset.inViewport==='yes'&&!document.hidden&&!placeCard?.hidden&&!document.getElementById('fpMediaViewer');
 if(active)v.play().catch(()=>{});else try{v.pause()}catch(_){}
}
function watchTileVideo(v){
 if(!('IntersectionObserver' in window)){v.dataset.inViewport='yes';syncTilePlayback(v);return}
 if(!tileVisibilityObserver)tileVisibilityObserver=new IntersectionObserver(entries=>{
  for(const e of entries){e.target.dataset.inViewport=e.isIntersecting&&e.intersectionRatio>=.18?'yes':'no';syncTilePlayback(e.target)}
 },{threshold:[0,.18,.5]});
 tileVisibilityObserver.observe(v);
}
function stopTileVideos(){
 tileVisibilityObserver?.disconnect();tileVisibilityObserver=null;
 for(const v of tileVideos){try{v.pause();v.removeAttribute('src');v.load();if(v.dataset.sourceUrl)URL.revokeObjectURL(v.dataset.sourceUrl)}catch(_){}}
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
 try{return await repository().read(id)}catch(error){
  if(window.__atlasPlaceStore)return (await window.__atlasPlaceStore.readAll()).find(place=>place.id===id)||null;
  throw error;
 }
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
 if(!await renderPlace(id)||revision!==selectionRevision||id!==activePlaceId)return;
 placeCard.dataset.placeId=id;
 placeCard.hidden=false;
 window.__atlasSheetIntegration?.card.open(id);
 document.body.classList.add('fp-place-open');
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
 titlewrap.append(stageBtn);
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
 if(!media.length){const box=h('div','fp-media-empty');box.append(h('span','fp-empty-text','还没有照片或视频'));cardMedia.append(box)}else{const tiles=media.slice(0,5);const mosaic=h('div','fp-media-mosaic'+(tiles.length===1?' one':tiles.length===2?' two':''));tiles.forEach((m,i)=>{const tile=btn('',()=>openViewer(media,i,tile),m.kind==='video'?'fp-video-tile':'');if(m.kind==='photo'){const img=h('img');img.src=m.src;img.alt='旅行照片 '+(i+1);img.loading='lazy';tile.append(img)}else {const video=h('video');video.muted=true;video.defaultMuted=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.loop=true;video.autoplay=false;video.preload='metadata';video.controls=false;video.setAttribute('aria-label','旅行视频动态预览');try{const blob=m.blob instanceof Blob?m.blob:new Blob([m.bytes],{type:m.type||'video/mp4'});const objectUrl=URL.createObjectURL(blob);video.dataset.sourceUrl=objectUrl;video.src=objectUrl;tileVideos.add(video);video.addEventListener('canplay',()=>{if(activePlaceId===id)syncTilePlayback(video)},{once:true});watchTileVideo(video)}catch(err){console.debug('视频预览不可用',err)}tile.append(video,h('span','fp-video-indicator','▶'))}if(i===tiles.length-1&&media.length>tiles.length)tile.append(h('span','fp-tile-more','+'+(media.length-tiles.length)));mosaic.append(tile)});cardMedia.append(mosaic);cardMedia.append(h('div','fp-photo-count',`${(p.photos||[]).length} 张照片 · ${(p.videos||[]).length} 条视频`))}
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
   for(const v of tileVideos)syncTilePlayback(v);
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
function openViewer(items,index,originTile=null,navDir=0){closeViewer(true);const x=items[index];if(!x)return;const viewer=h('dialog');viewer.id='fpMediaViewer';viewer.tabIndex=-1;viewer.setAttribute('role','dialog');viewer.setAttribute('aria-modal','true');viewer.setAttribute('aria-label','查看旅行照片或视频');const viewerClose=btn('×',()=>closeViewer(),'fp-viewer-close');viewerClose.setAttribute('aria-label','关闭全屏影像');viewerClose.title='关闭';viewer.append(viewerClose);if(x.kind==='photo'){const img=h('img');img.src=x.src;img.alt='旅行照片';img.setAttribute('aria-label','旅行照片，点按隐藏控制项');viewer.append(img)}else{const blob=x.blob instanceof Blob?x.blob:new Blob([x.bytes],{type:x.type||'video/mp4'});viewer.__videoURL=URL.createObjectURL(blob);const v=h('video');v.src=viewer.__videoURL;v.controls=true;v.playsInline=true;v.autoplay=true;viewer.append(v)}viewer.append(h('div','fp-viewer-caption',`${index+1} / ${items.length} · ${x.name||'旅行影像'}`));viewer.addEventListener('click',e=>{
 if(e.target===viewer){closeViewer();return}
 if(e.target.tagName==='IMG'){viewer.classList.toggle('fp-viewer-immersive');
  e.target.setAttribute('aria-label',viewer.classList.contains('fp-viewer-immersive')?'旅行照片，点按显示控制项':'旅行照片，点按隐藏控制项')}
});
 /* B01 final acceptance: horizontal gallery + iOS Photos-like downward drag.
  * The existing source thumbnail owns the shared-element close animation.
  * The background/media gesture must not steal native video controls. */
 let swipe=null,resetTimer=null;
 const motionMedia=()=>viewer.querySelector('img,video');
 const resetViewerDrag=()=>{
  const media=motionMedia();if(!media)return;
  if(resetTimer!==null)clearTimeout(resetTimer);
  media.style.transition='transform 260ms cubic-bezier(.2,.85,.3,1),opacity 260ms ease';
  viewer.style.transition='background-color 260ms ease';
  media.style.transform='none';media.style.opacity='';
  viewer.style.backgroundColor='';
  resetTimer=setTimeout(()=>{resetTimer=null;if(!viewer.isConnected)return;media.style.removeProperty('transition');media.style.removeProperty('transform');media.style.removeProperty('opacity');viewer.style.removeProperty('transition')},280);
 };
 viewer.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||e.target.closest('video,button')){swipe=null;return}
  const t=e.touches[0];swipe={x:t.clientX,y:t.clientY,mode:null};
  if(resetTimer!==null){clearTimeout(resetTimer);resetTimer=null}
 },{passive:true});
 viewer.addEventListener('touchmove',e=>{
  if(!swipe||e.touches.length!==1)return;
  const t=e.touches[0],dx=t.clientX-swipe.x,dy=t.clientY-swipe.y;
  if(!swipe.mode&&Math.max(Math.abs(dx),Math.abs(dy))>9)
   swipe.mode=dy>0&&Math.abs(dy)>Math.abs(dx)*1.25?'down':'horizontal';
  if(swipe.mode!=='down')return;
  if(e.cancelable)e.preventDefault();
  const media=motionMedia();if(!media)return;
  media.getAnimations?.().forEach(a=>{try{a.cancel()}catch(_){}});
  media.style.transition='none';viewer.style.transition='none';
  media.style.transform='translate3d(0,'+Math.min(Math.max(dy,0),380)+'px,0) scale('+Math.max(.78,1-Math.max(0,dy)*.00065)+')';
  const a=Math.max(.25,.93-Math.max(0,dy)*.002);
  viewer.style.backgroundColor='rgba(19,20,21,'+a.toFixed(3)+')';
 },{passive:false});
 viewer.addEventListener('touchend',e=>{
  if(!swipe||e.changedTouches.length!==1){swipe=null;return}
  const dx=e.changedTouches[0].clientX-swipe.x,dy=e.changedTouches[0].clientY-swipe.y,mode=swipe.mode;
  swipe=null;
  if(mode==='down'){
   if(dy>=110){
    const media=motionMedia();if(media){media.style.removeProperty('transform');media.style.removeProperty('opacity');media.style.removeProperty('transition')}
    viewer.style.removeProperty('background-color');viewer.style.removeProperty('transition');
    closeViewer();return;
   }
   resetViewerDrag();return;
  }
  if(Math.abs(dx)<52||Math.abs(dx)<Math.abs(dy)*1.35)return;
  if(dx<0&&index<items.length-1)openViewer(items,index+1,null,1);
  else if(dx>0&&index>0)openViewer(items,index-1,null,-1);
 },{passive:true});
 viewer.addEventListener('touchcancel',()=>{if(swipe?.mode==='down')resetViewerDrag();swipe=null},{passive:true});
 viewer.__origin=originTile&&originTile.isConnected?originTile:null;
 viewer.addEventListener('cancel',event=>{event.preventDefault();closeViewer()});
 viewer.addEventListener('keydown',event=>{
  if(event.target.closest('video'))return;
  if(event.key==='ArrowRight'&&index<items.length-1){event.preventDefault();openViewer(items,index+1,null,1)}
  else if(event.key==='ArrowLeft'&&index>0){event.preventDefault();openViewer(items,index-1,null,-1)}
 });
 document.body.append(viewer);
 viewer.showModal();
 // Keep native iOS dialog auto-focus from drawing a false action border on X.
 // Keyboard users can still Tab to the real close button and see focus feedback.
 if(matchMedia('(pointer:coarse)').matches)viewer.focus({preventScroll:true});
 for(const v of tileVideos){try{v.pause()}catch(_){}}
 const media=viewer.querySelector('img,video');
 if(navDir&&media?.animate&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
  media.animate([{transform:'translate3d('+(navDir*36)+'px,0,0)',opacity:.45},
   {transform:'none',opacity:1}],{duration:245,easing:'cubic-bezier(.22,1,.36,1)'});
 }
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
