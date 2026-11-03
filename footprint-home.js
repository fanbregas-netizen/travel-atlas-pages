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
let placeCard,activePlaceId='',editMode='',busy=false,videoURL='';
const tileVideos=new Set();
function stopTileVideos(){for(const v of tileVideos){try{v.pause();v.removeAttribute('src');v.load();URL.revokeObjectURL(v.dataset.sourceUrl)}catch(_){}}tileVideos.clear()}
const btn=(label,fn,cls='')=>{const b=h('button',cls,label);b.type='button';b.addEventListener('click',fn);return b};
function setViewport(){if(!searchSheet)return;const vv=window.visualViewport;const visible=vv?.height||window.innerHeight;const bottom=vv?Math.max(0,window.innerHeight-vv.height-vv.offsetTop):0;document.documentElement.style.setProperty('--fp-vh',visible+'px');document.documentElement.style.setProperty('--fp-keyboard',bottom+'px')}
function searchReset(){searchController?.abort();searchController=null;clearTimeout(searchTimer);searchToken++}
function searchRows(rows,header){const wrap=h('div');if(header)wrap.append(h('div','fp-search-label',header));for(const x of rows){const row=btn('',()=>chooseResult(x),'fp-search-row');row.append(h('span','fp-row-icon',x.saved?'★':x.history?'↗':'⌖'));const label=h('span','fp-row-main');label.append(h('strong','',x.name||x.q),h('small','',x.description||x.display_name||x.address|| (x.saved?'已收藏的地点':'地图地点')));row.append(label,h('span','fp-row-arrow','›'));wrap.append(row)}return wrap}
function drawSearchStart(){searchBody.replaceChildren();const heading=h('div','fp-search-label','探索附近与我的收藏');const grid=h('div','fp-quick-grid');for(const [icon,title,word] of [['☕','咖啡','咖啡馆'],['♧','景点','景点'],['▤','博物馆','博物馆'],['♧','公园','公园']]){const a=btn('',()=>{searchInput.value=word;searchNow(word,true)},'fp-quick');a.append(h('span','',icon),h('b','',title));grid.append(a)}searchBody.append(heading,grid);const recent=getList();if(recent.length)searchBody.append(searchRows(recent.map(x=>({...x,history:true})), '最近搜索'));searchBody.append(h('p','fp-search-notice','搜索真实地点，也可查找已经收藏的黄色星标。地图与照片仍保存在当前浏览器。'))}
function initSearch(){const dock=$('searchDock'),original=$('searchInput'),form=$('searchForm');if(!dock||!original||!form)return;
 searchVeil=h('div');searchVeil.id='fpSearchVeil';searchVeil.hidden=true;searchVeil.addEventListener('click',closeSearch);
 searchSheet=h('section');searchSheet.id='fpSearchSheet';searchSheet.hidden=true;searchSheet.setAttribute('role','dialog');searchSheet.setAttribute('aria-label','搜索地点');searchSheet.setAttribute('aria-modal','true');
 const top=h('div','fp-search-top'),grip=h('div','fp-search-grip'),head=h('div','fp-search-head'),title=h('h2','','搜索地点');head.append(title,btn('×',closeSearch,'fp-search-close'));const bar=h('form','fp-search-bar');bar.setAttribute('role','search');bar.addEventListener('submit',e=>{e.preventDefault();searchNow(searchInput.value,true)});const icon=h('span','fp-magnify','⌕');searchInput=h('input');searchInput.id='fpSearchField';searchInput.type='search';searchInput.placeholder='地点、地址、景点、咖啡馆…';searchInput.autocomplete='off';searchInput.setAttribute('enterkeyhint','search');searchInput.setAttribute('aria-label','搜索真实地图地点');const clear=btn('×',()=>{searchInput.value='';drawSearchStart();searchInput.focus()},'fp-search-clear');bar.append(icon,searchInput,clear);top.append(grip,head,bar);searchBody=h('div','fp-search-body');searchSheet.append(top,searchBody);document.body.append(searchVeil,searchSheet);drawSearchStart();
 // A readonly 16px launcher prevents Safari from focusing the map's original input and zooming the page.
 original.readOnly=true;original.setAttribute('aria-haspopup','dialog');original.setAttribute('aria-controls','fpSearchSheet');original.setAttribute('inputmode','none');original.style.fontSize='16px';
 dock.addEventListener('pointerdown',e=>{if(e.target.closest('#searchForm')){e.preventDefault();openSearch()}},true);
 form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();openSearch()},true);
 original.addEventListener('click',e=>{e.stopImmediatePropagation();openSearch()},true);
 original.addEventListener('focus',()=>{original.blur();openSearch()},true);
 searchInput.addEventListener('input',()=>{const q=searchInput.value.trim();searchReset();if(q.length<2){if(!q)drawSearchStart();else searchBody.replaceChildren(h('div','fp-search-empty','继续输入地点名称…'));return}searchTimer=setTimeout(()=>searchNow(q,false),370)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(activeSearch)closeSearch();else if(activePlaceId)closePlace()}});
 window.visualViewport?.addEventListener('resize',setViewport,{passive:true});window.visualViewport?.addEventListener('scroll',setViewport,{passive:true});window.addEventListener('resize',setViewport,{passive:true});
}
function openSearch(){if(activeSearch)return;if(activePlaceId)closePlace();searchReset();activeSearch=true;searchUsed=false;searchVeil.hidden=false;searchSheet.hidden=false;setViewport();document.body.classList.add('fp-search-open');searchInput.value='';drawSearchStart();searchInput.focus({preventScroll:true})}
function closeSearch(){if(!activeSearch)return;activeSearch=false;searchReset();searchInput.blur();document.body.classList.remove('fp-search-open');searchSheet.hidden=true;searchVeil.hidden=true;const old=$('searchInput');if(old)old.value='';setViewport()}
async function searchNow(q,submitted){q=String(q||'').trim();searchReset();if(!q){drawSearchStart();return}searchUsed=true;const token=++searchToken;const matches=await readPlaces().then(rows=>rows.filter(p=>p.starred!==false&&String(p.title||'').toLocaleLowerCase().includes(q.toLocaleLowerCase())).slice(0,7).map(p=>({id:p.id,name:p.title,saved:true,lat:p.lat,lon:p.lng,description:'★ 我的收藏 · Brief 与旅行照片'}))).catch(()=>[]);if(token!==searchToken||!activeSearch)return;searchBody.replaceChildren();if(matches.length)searchBody.append(searchRows(matches,'我的收藏'));
 if(!submitted&&q.length<2)return;
 if(!window.AtlasServices?.search){if(!matches.length)searchBody.append(h('div','fp-search-empty','地图搜索服务未准备好，请重试。'));return}
 searchController=new AbortController();const controller=searchController;const status=h('div','fp-search-empty','正在搜索真实地点…');searchBody.append(status);
 try{const results=await window.AtlasServices.search(q,{signal:controller.signal,center:window.__fpSearchCenter?.(),allowFallback:submitted});if(token!==searchToken||!activeSearch)return;status.remove();const existing=new Set(matches.map(x=>String(x.name).trim()+':'+Number(x.lat).toFixed(3)));const filtered=(Array.isArray(results)?results:[]).map(x=>({...x,lon:Number(x.lon??x.lng),lat:Number(x.lat)})).filter(x=>safe(x.lat,-90,90)&&safe(x.lon,-180,180)&&!existing.has(String(x.name).trim()+':'+x.lat.toFixed(3))).slice(0,12);if(filtered.length)searchBody.append(searchRows(filtered,'地图地点'));else if(!matches.length)searchBody.append(h('div','fp-search-empty','没有找到这个地点。试试「城市 + 地点名」，或返回地图手动选点。'));if(submitted)saveHistory({q,name:q,description:'搜索记录'})}
 catch(err){if(!controller.signal.aborted&&token===searchToken&&activeSearch){status.textContent='搜索暂时不可用。可以重试或继续查看已经收藏的地点。'}}
}
function chooseResult(place){closeSearch();const name=place.name||place.q||'地点';if(place.saved&&place.id){window.__atlasDemo?.openSaved?.(place.id);return}if(!safe(place.lat,-90,90)||!safe(place.lon??place.lng,-180,180)){openSearch();searchInput.value=name;searchNow(name,true);return}saveHistory({q:name,name,lat:place.lat,lon:place.lon,description:place.display_name||place.description||''});const data={name,lat:Number(place.lat),lng:Number(place.lon??place.lng),address:place.display_name||place.address||'',category:place.type||'地点',id:place.id||''};if(typeof window.__fpSearchSelect==='function')window.__fpSearchSelect(data);else window.__atlasDemo?.select?.(data.name,data.lat,data.lng)}
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open('private-travel-footprints-v1',1);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains('places'))d.createObjectStore('places',{keyPath:'id'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function readPlaces(){
 if(typeof window.__atlasPlaceStore?.readAll==='function')return window.__atlasPlaceStore.readAll();
 try{if(!('indexedDB' in window))throw Error('not supported');const db=await openDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('places','readonly');const r=tx.objectStore('places').getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);tx.onabort=()=>reject(tx.error||Error('数据库读取中断'))})}finally{db.close()}}
 catch{try{const v=JSON.parse(localStorage.getItem('travel-places')||'[]');return Array.isArray(v)?v:[]}catch{return []}}
}
async function readPlace(id){const ps=await readPlaces();return ps.find(x=>x.id===id)||null}
async function writePlace(p){
 if(!p?.id)throw Error('地点没有 ID');
 // Prefer the EXACT store used by the original bookmark map. A quota error
 // must never silently fall back to another copy of the user's collection.
 if(typeof window.__atlasPlaceStore?.save==='function'){await window.__atlasPlaceStore.save(p);return}
 if(!('indexedDB' in window))throw Error('此浏览器无法访问主要收藏数据库，请先导出备份');
 const db=await openDb();
 try{await new Promise((resolve,reject)=>{
  const tx=db.transaction('places','readwrite');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('数据库写入失败'));
  tx.onabort=()=>reject(tx.error||Error('存储中断，未保存'));
  tx.objectStore('places').put(p);
 })}finally{db.close()}
 try{await window.__atlasFlowRefresh?.()}catch(e){console.warn('地图刷新延迟',e)}
}
const mediaOf=p=>[...(Array.isArray(p.photos)?p.photos:[]).filter(x=>typeof x.src==='string'&&/^data:image\/(jpeg|png|webp);base64,/i.test(x.src)).map(x=>({...x,kind:'photo'})),...(Array.isArray(p.videos)?p.videos:[]).filter(x=>x.bytes||x.blob).map(x=>({...x,kind:'video'}))];
const linksOf=p=>{const o=[...(Array.isArray(p.references)?p.references:[]),...(Array.isArray(p.guides)?p.guides:[])];if(p.url)o.push(p.url);if(p.link)o.push(p.link);const u=new Set();return o.map(x=>typeof x==='string'?{url:x,title:''}:{url:x?.url||x?.link||'',title:x?.title||''}).filter(x=>{x.url=urlOf(x.url);if(!x.url||u.has(x.url))return false;u.add(x.url);return true})};
function sourceName(url){try{const host=new URL(url).hostname.replace(/^www\./,'');return /xiaohongshu/.test(host)?'小红书':/bilibili/.test(host)?'Bilibili':/youtube|youtu\.be/.test(host)?'YouTube':/weixin|qq\.com/.test(host)?'微信公众号':host}catch{return '社交链接'}}
function sectionHeading(number,name,button){const bar=h('div','fp-subheading');bar.append(h('strong','',number+' / '+name));if(button)bar.append(button);return bar}
function feedback(msg){const e=$('fpCardFeedback');if(e)e.textContent=msg}

// Stage 4 | A local, opt-in visit and album archive. iOS Safari cannot read
// the Photos library without the visitor selecting files, so never imply passive sync.
let visitSaving=false,albumDialog=null,albumInput=null,albumRows=null,albumStatus=null,albumSave=null,albumClose=null,albumStaged=[],albumSaving=false;
const visitCore=()=>window.AtlasVisitMedia;
function visitTime(p){
 if(!p?.visitedAt)return '';
 const date=new Date(p.visitedAt);
 return Number.isFinite(date.getTime())?date.toLocaleDateString('zh-CN',{year:'numeric',month:'short',day:'numeric'}):'';
}
async function updateVisited(id,source,meters=null){
 if(visitSaving)return;
 visitSaving=true;
 try{
  const fresh=await readPlace(id);if(!fresh)throw Error('星标不存在');
  if(source==='undo'){
   delete fresh.visitedAt;delete fresh.visitSource;delete fresh.checkinDistanceMeters;
   if(fresh.stage==='visited')fresh.stage='planned';
  }else{
   fresh.visitedAt=fresh.visitedAt||new Date().toISOString();
   fresh.visitSource=source;fresh.stage='visited';
   if(Number.isFinite(meters))fresh.checkinDistanceMeters=Math.round(meters);
  }
  await writePlace(fresh);
  if(activePlaceId===id)await renderPlace(id);
  feedback(source==='undo'?'已撤销到访记录；影像和 Brief 未删除':'到访记录已保存到此星标。旅行照片可以继续整理到这里。');
 }catch(err){feedback('保存到访记录失败：'+String(err?.message||err))}
 finally{visitSaving=false}
}
function checkLocationForVisit(id){
 if(!navigator.geolocation){feedback('当前浏览器不支持定位，可选择手动确认到访。');return}
 feedback('正在使用当前位置核对星标距离…');
 navigator.geolocation.getCurrentPosition(async position=>{
  const place=await readPlace(id);
  if(!place){feedback('该星标已不存在');return}
  const core=visitCore();
  if(!core){feedback('位置核对组件尚未加载');return}
  const meters=core.distanceMeters({lat:position.coords.latitude,lng:position.coords.longitude},place);
  const accuracy=Number(position.coords.accuracy);
  if(!Number.isFinite(accuracy)||accuracy>2000){feedback('当前定位精度较低，无法可靠核对。可改用手动确认到访。');return}
  if(!Number.isFinite(meters)||meters>2000){feedback('当前距该星标约 '+Math.round(meters/1000*10)/10+' 公里，未自动标记到访。');return}
  await updateVisited(id,'gps-confirmed',meters);
 },error=>feedback(error?.code===1?'未获得定位权限。可手动确认到访。':'定位不可用，请稍后重试或手动确认。'),
 {enableHighAccuracy:true,timeout:13000,maximumAge:30000});
}
function visitWidget(p){
 const box=h('div','fp-visit-panel'),info=h('div','fp-visit-info');
 info.append(h('strong','',p.visitedAt?'✓ 已到访 · '+visitTime(p):'○ 尚未记录到访'));
 info.append(h('small','',p.visitedAt?(p.visitSource==='gps-confirmed'?'通过当前位置核对 · 记录保存在本机':'手动到访记录 · 保存在本机'):'记录旅行足迹后，可把相册影像归档到这颗星标。'));
 box.append(info);
 const controls=h('div','fp-visit-controls');
 if(!p.visitedAt){
  controls.append(btn('✓ 我到过这里',()=>updateVisited(p.id,'manual'),'fp-visit-button'));
  controls.append(btn('◎ 定位核对',()=>checkLocationForVisit(p.id),'fp-visit-button secondary'));
 }else controls.append(btn('撤销到访',()=>{if(confirm('仅撤销到访标记？已有 Brief、照片和视频不会删除。'))updateVisited(p.id,'undo')},'fp-visit-button secondary'));
 controls.append(btn('从相册归档',()=>openAlbumImport(p.id),'fp-visit-button accent'));
 box.append(controls);
 return box;
}
function createAlbumImport(){
 if(albumDialog)return;
 albumDialog=h('dialog','fp-album-dialog');albumDialog.id='fpAlbumImport';
 albumDialog.setAttribute('aria-label','把相册影像整理到收藏星标');
 albumDialog.innerHTML='<div class="fp-album-head"><div><small>LOCAL PHOTO ARCHIVE</small><h2>整理旅行相册</h2></div><button class="fp-album-close" id="fpAlbumClose" type="button" aria-label="关闭">×</button></div>'+
 '<p class="fp-album-note">从 iPhone 相册主动选择照片或视频。JPEG 如含 GPS，可在本机建议最近的黄色星标；归属必须由你确认。没有 GPS 的照片请手动选择，不会自动读取整个相册或上传云端。</p>'+
 '<div class="fp-album-pick"><button id="fpAlbumChoose" type="button">＋ 选择照片 / 视频</button><input id="fpAlbumFiles" type="file" accept="image/*,video/*" multiple hidden></div>'+
 '<div id="fpAlbumRows" class="fp-album-rows"></div><p id="fpAlbumStatus" class="fp-album-status" role="status" aria-live="polite">每次最多 24 项，单个视频最多 40MB。</p>'+
 '<div class="fp-album-actions"><button id="fpAlbumSave" type="button" disabled>确认归档到星标</button></div>';
 document.body.append(albumDialog);
 albumInput=$('fpAlbumFiles');albumRows=$('fpAlbumRows');albumStatus=$('fpAlbumStatus');
 albumSave=$('fpAlbumSave');albumClose=$('fpAlbumClose');
 $('fpAlbumChoose').onclick=()=>{if(!albumSaving)albumInput.click()};
 albumInput.onchange=()=>stageAlbumFiles([...albumInput.files]);
 albumSave.onclick=saveAlbumArchive;
 albumClose.onclick=()=>{if(!albumSaving)albumDialog.close()};
 albumDialog.addEventListener('cancel',e=>{if(albumSaving)e.preventDefault()});
}
async function openAlbumImport(defaultId=''){
 createAlbumImport();albumDialog.dataset.defaultId=defaultId;
 albumStaged=[];albumRows.replaceChildren();albumSave.disabled=true;
 albumInput.value='';
 albumStatus.textContent='选择照片/视频后，可逐项核对目标星标。所有处理只在本机进行。';
 if(!albumDialog.open)albumDialog.showModal();
}
async function stageAlbumFiles(files){
 const core=visitCore();
 if(!core){albumStatus.textContent='相册整理组件尚未加载，请刷新后重试。';return}
 if(albumSaving)return;
 albumSave.disabled=true;albumRows.replaceChildren();albumStaged=[];
 const candidates=(await readPlaces()).filter(p=>p?.id&&p.starred!==false&&!p.demo).sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),'zh-CN'));
 if(!candidates.length){albumStatus.textContent='还没有可归档的黄色星标，请先在地图上收藏地点。';return}
 const good=files.slice(0,core.MAX_FILES).filter(f=>core.knownPhoto(f)||core.knownVideo(f));
 if(!good.length){albumStatus.textContent='没有可读取的照片或视频。';return}
 albumStatus.textContent='正在本机检查已选择文件的地点信息…';
 for(const file of good){
  const gps=await core.readFileGps(file);
  const closest=gps?core.nearestStar(gps,candidates):null;
  const defaultId=albumDialog.dataset.defaultId||'';
  const suggested=closest?.id||defaultId;
  const row=h('div','fp-album-row'),left=h('div','fp-album-file');
  left.append(h('strong','',String(file.name||'未命名影像').slice(0,100)));
  left.append(h('small','',closest?
   '📍 根据照片 GPS 推荐 · 距星标约 '+Math.round(closest.meters)+' m':
   gps?'照片 GPS 附近没有已收藏星标，请手动指定':
   '未发现可用 JPEG GPS · 请核对地点'));
  const select=h('select','fp-album-target');select.setAttribute('aria-label','为 '+String(file.name||'影像')+' 选择星标');
  select.add(new Option('请选择目标星标',''));
  for(const place of candidates)select.add(new Option(String(place.title||place.name||'未命名地点').slice(0,90),String(place.id)));
  select.value=suggested;select.onchange=validateAlbumSelection;
  row.append(left,select);albumRows.append(row);
  albumStaged.push({file,select,matchedByExif:!!closest&&closest.id===suggested});
 }
 albumStatus.textContent='已选择 '+albumStaged.length+' 项。请检查每个文件归属的星标，再点「确认归档」。'+(files.length>good.length?' 超出上限或不支持的文件已略过。':'');
 validateAlbumSelection();
}
function validateAlbumSelection(){
 if(!albumSave)return;
 albumSave.disabled=albumSaving||!albumStaged.length||albumStaged.some(row=>!row.select.value);
}
async function saveAlbumArchive(){
 if(albumSaving||!albumStaged.length||albumStaged.some(x=>!x.select.value))return;
 const core=visitCore();if(!core)return;
 albumSaving=true;albumSave.disabled=true;albumClose.disabled=true;
 const groups=new Map();
 for(const row of albumStaged){const id=row.select.value;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row)}
 let added=0,duplicate=0,failed=0;const errors=[];
 try{
  for(const [id,rows] of groups){
   const saved=await readPlace(id);if(!saved){failed+=rows.length;errors.push('星标不存在');continue}
   const photos=[...(saved.photos||[])],videos=[...(saved.videos||[])];
   let groupAdded=0;
   for(const {file} of rows){
    try{
     const fingerprint=core.fingerprint(file);
     if([...photos,...videos].some(v=>v.fingerprint===fingerprint)){duplicate++;continue}
     if(core.knownPhoto(file)){
      if(photos.length>=core.PHOTO_LIMIT){failed++;errors.push('照片超过上限');continue}
      const photo=await shrinkPhoto(file);
      photos.push({...photo,fingerprint,source:'local-album',capturedAt:Number.isFinite(file.lastModified)&&file.lastModified>0?new Date(file.lastModified).toISOString():null});
      groupAdded++;
     }else if(core.knownVideo(file)){
      if(videos.length>=core.VIDEO_LIMIT||file.size>core.MAX_VIDEO_BYTES){failed++;errors.push('视频达到数量或大小上限');continue}
      videos.push({name:file.name,type:file.type||'video/mp4',bytes:await file.arrayBuffer(),fingerprint,source:'local-album',addedAt:new Date().toISOString()});
      groupAdded++;
     }
    }catch(err){failed++;errors.push(String(err?.message||err))}
   }
   if(groupAdded){
    try{await writePlace({...saved,photos,videos});added+=groupAdded}
    catch(err){failed+=groupAdded;errors.push('本机保存失败：'+String(err?.message||err))}
   }
  }
  if(activePlaceId)await renderPlace(activePlaceId);
  albumStatus.textContent='归档完成：'+added+' 项保存到对应星标；'+duplicate+' 项重复；'+failed+' 项未保存。'+(errors.length?' 请检查存储空间或文件格式。':' 建议定期导出 ZIP 备份。');
  if(!failed&&added)albumStaged=[];
 }finally{albumSaving=false;albumClose.disabled=false;validateAlbumSelection()}
}
function mountAlbumEntry(){
 createAlbumImport();
 const actions=document.querySelector('#drawer .backuprow');
 if(actions&&!$('fpArchiveAlbum')){
  const b=btn('＋ 整理相册到星标',()=>openAlbumImport(),'fp-archive-entry');b.id='fpArchiveAlbum';
  actions.prepend(b);
 }
}

function mountPlace(){if(placeCard)return;placeCard=h('article');placeCard.id='fpPlaceCard';placeCard.hidden=true;placeCard.setAttribute('role','dialog');placeCard.setAttribute('aria-modal','false');placeCard.setAttribute('aria-label','收藏地点详情');document.body.append(placeCard);
 document.addEventListener('atlas:memory-open',e=>{if(window.__atlasPreferCollage!==false)showPlaceCard(e.detail?.id)});
 document.addEventListener('pointerdown',e=>{if(!activePlaceId)return;if(e.target.closest('#fpPlaceCard,#fpMediaViewer,.star-pin,.atlas-bookmark-hit,.atlas-photo-location-pin,.atlas-vector-photo-pin,.atlas-official-star'))return;closePlace();},true);
 document.addEventListener('atlas:source-updated',()=>{if(activePlaceId)showPlaceCard(activePlaceId,false)});
 const originalSheet=$('memorySheet');if(originalSheet)new MutationObserver(()=>{if(activePlaceId&&!originalSheet.classList.contains('visible'))closePlace()}).observe(originalSheet,{attributes:true,attributeFilter:['class']});
 const qs=new URLSearchParams(location.search);const source=qs.get('sourcePlace'),media=qs.get('mediaPlace');if(source||media){const target=source||media;let count=0;const t=setInterval(()=>{count++;if(typeof window.__atlasDemo?.openSaved==='function'){clearInterval(t);window.__atlasDemo.openSaved(target);editMode=source?'link':'media';setTimeout(()=>renderPlace(target),120);history.replaceState(null,'',location.pathname)}if(count>32)clearInterval(t)},250)}
}
function closePlace(){if(!activePlaceId)return;stopTileVideos();activePlaceId='';editMode='';placeCard.hidden=true;document.body.classList.remove('fp-place-open');const close=$('closeMemory');if(close)close.click();}
async function showPlaceCard(id,reframe=true){if(!id)return;activePlaceId=id;editMode='';closeSearch();const fresh=await readPlace(id);if(!fresh||id!==activePlaceId)return;await renderPlace(id);placeCard.hidden=false;document.body.classList.add('fp-place-open');requestAnimationFrame(()=>{if(activePlaceId===id)for(const v of tileVideos){if(v.isConnected){v.muted=true;v.playsInline=true;v.play().catch(()=>{})}}});
 if(reframe){const token=id;setTimeout(()=>{if(token!==activePlaceId)return;const selected=[...document.querySelectorAll('.atlas-bookmark-hit')].find(el=>el.dataset.placeId===id)||document.querySelector('.star-pin.selected, .atlas-photo-location-pin.selected, .atlas-vector-photo-pin.selected');const card=placeCard.getBoundingClientRect();const marker=selected?.getBoundingClientRect();if(marker&&marker.bottom>card.top-50)window.__atlasReframeForCollage?.(id)},700)}
}
async function renderPlace(id){const p=await readPlace(id);if(!p||id!==activePlaceId)return;stopTileVideos();placeCard.replaceChildren();const head=h('header','fp-card-header'),titlewrap=h('div','fp-card-title-wrap');titlewrap.append(h('h2','fp-card-name',p.title||'未命名地点'));head.append(titlewrap,btn('×',closePlace,'fp-card-close'));placeCard.append(head);const sc=h('div','fp-card-scroll');
 sc.append(sectionHeading('01','BRIEF · 为什么想去',btn(editMode==='brief'?'收起':'编辑',()=>{editMode=editMode==='brief'?'':'brief';renderPlace(id)},'fp-subaction')));
 if(editMode==='brief'){const edit=h('div','fp-inline-editor');const area=h('textarea');area.value=p.note||'';area.placeholder='为什么想去这个地方？记录你的旅行灵感…';area.maxLength=12000;const actions=h('div','fp-inline-actions');actions.append(btn('保存 Brief',async()=>{if(busy)return;busy=true;try{const fresh=await readPlace(id);if(!fresh)throw Error('找不到地点');fresh.note=area.value.trim();await writePlace(fresh);editMode='';await renderPlace(id)}catch(e){feedback('保存失败：'+e.message)}finally{busy=false}},'fp-btn-primary'),btn('取消',()=>{editMode='';renderPlace(id)},'fp-btn-muted'));edit.append(area,actions);sc.append(edit)}else sc.append(h('p','fp-brief-text'+(!p.note?' is-empty':''),p.note||'还没有 Brief。点「编辑」写下为什么想去这里。'));
 sc.append(h('hr','fp-line'));
 const media=mediaOf(p);placeCard.dataset.hasMedia=media.length?'yes':'no';sc.append(sectionHeading('02','PHOTOS & VIDEOS',btn('＋ 添加',()=>filePicker.click(),'fp-subaction')));
 const filePicker=h('input');filePicker.type='file';filePicker.accept='image/*,video/*';filePicker.multiple=true;filePicker.hidden=true;filePicker.addEventListener('change',()=>addMedia(id,[...filePicker.files]));sc.append(filePicker);
 if(!media.length){const box=h('div','fp-media-empty');box.append(h('div','fp-empty-icon','＋'));const info=h('div','fp-empty-text');info.append(h('strong','','添加照片、视频或社交灵感'),h('small','','内容会出现在这一地点的拼贴中'));box.append(info,btn('添加影像',()=>filePicker.click(),'fp-btn-primary'));sc.append(box)}else{const tiles=media.slice(0,5);const mosaic=h('div','fp-media-mosaic'+(tiles.length===1?' one':tiles.length===2?' two':''));tiles.forEach((m,i)=>{const tile=btn('',()=>openViewer(media,i),m.kind==='video'?'fp-video-tile':'');if(m.kind==='photo'){const img=h('img');img.src=m.src;img.alt='旅行照片 '+(i+1);img.loading='lazy';tile.append(img)}else {const video=h('video');video.muted=true;video.defaultMuted=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.loop=true;video.autoplay=true;video.preload='metadata';video.controls=false;video.setAttribute('aria-label','旅行视频动态预览');try{const blob=m.blob instanceof Blob?m.blob:new Blob([m.bytes],{type:m.type||'video/mp4'});const objectUrl=URL.createObjectURL(blob);video.dataset.sourceUrl=objectUrl;video.src=objectUrl;tileVideos.add(video);video.addEventListener('canplay',()=>{if(activePlaceId===id)video.play().catch(()=>{})},{once:true});video.play().catch(()=>{})}catch(err){console.debug('视频预览不可用',err)}tile.append(video,h('span','fp-video-indicator','▶'))}if(i===tiles.length-1&&media.length>tiles.length)tile.append(h('span','fp-tile-more','+'+(media.length-tiles.length)));mosaic.append(tile)});sc.append(mosaic);sc.append(h('div','fp-photo-count',`${(p.photos||[]).length} 张照片 · ${(p.videos||[]).length} 条视频`))}
 sc.append(sectionHeading('03','SAVED SOURCES · 社交资料',btn('＋ 链接',()=>{editMode=editMode==='link'?'':'link';renderPlace(id)},'fp-subaction')));
 const links=linksOf(p);if(links.length){const list=h('div','fp-social-list');links.slice(0,12).forEach(x=>{const a=h('a');a.href=x.url;a.target='_blank';a.rel='noopener noreferrer';a.title=x.url;a.append(h('span','',`${sourceName(x.url)} · ${x.title||'查看原文'}`),h('b','','↗'));list.append(a)});sc.append(list)}else sc.append(h('p','fp-social-empty','还没有保存公众号、小红书、Bilibili 或 YouTube 链接。'));
 if(editMode==='link'){const edit=h('div','fp-inline-editor');edit.style.marginTop='12px';const url=h('input');url.type='url';url.placeholder='粘贴微信、小红书或视频链接';url.setAttribute('inputmode','url');url.autocomplete='off';const name=h('input');name.type='text';name.placeholder='给这条资料写个标题（可选）';name.maxLength=150;const acts=h('div','fp-inline-actions');acts.append(btn('保存链接',async()=>{const u=urlOf(url.value);if(!u){feedback('请输入有效的 http 或 https 链接');return}if(busy)return;busy=true;try{const fresh=await readPlace(id);const before=linksOf(fresh);if(before.some(x=>x.url===u)){feedback('这个链接已经保存过了');return}fresh.references=[...(Array.isArray(fresh.references)?fresh.references:[]),{url:u,title:name.value.trim()||sourceName(u),createdAt:new Date().toISOString()}];await writePlace(fresh);editMode='';await renderPlace(id)}catch(e){feedback('保存链接失败：'+e.message)}finally{busy=false}},'fp-btn-primary'),btn('取消',()=>{editMode='';renderPlace(id)},'fp-btn-muted'));edit.append(url,name,acts);sc.append(edit);queueMicrotask(()=>{if(activePlaceId===id&&editMode==='link')edit.scrollIntoView({block:'nearest',behavior:'smooth'})})}
 const f=h('div','fp-card-feedback');f.id='fpCardFeedback';sc.append(f);placeCard.append(sc);
 const foot=h('footer','fp-card-footer');foot.append(btn('✎ Brief',()=>{editMode='brief';renderPlace(id)},'fp-card-chip'),btn('＋ 影像',()=>filePicker.click(),'fp-card-chip'),btn('＋ 链接',()=>{editMode='link';renderPlace(id)},'fp-card-chip'),btn('路线 ↗',()=>{closePlace();$('atlasJourneyEntry')?.click()},'fp-card-chip accent'));placeCard.append(foot);
}
async function shrinkPhoto(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('无法读取图片'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(Error('无法解码图片，请改用 JPEG/PNG'));img.onload=()=>{const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve({name:file.name,src:canvas.toDataURL('image/jpeg',.82),addedAt:new Date().toISOString()})};img.src=reader.result};reader.readAsDataURL(file)})}
async function addMedia(id,files){if(!files?.length||busy)return;busy=true;feedback('正在处理影像…');try{const p=await readPlace(id);if(!p)throw Error('收藏地点已不存在');let done=0;for(const file of files.slice(0,20)){if(isPhoto(file)){if((p.photos||[]).length>=50)throw Error('单地点照片上限 50 张，请先备份');const photo=await shrinkPhoto(file);p.photos=[...(p.photos||[]),photo];done++}else if(file.type.startsWith('video/')||/\.(mov|mp4|webm)$/i.test(file.name)){if(file.size>40*1024*1024)throw Error('单条视频最大 40MB');p.videos=[...(p.videos||[]),{name:file.name,type:file.type||'video/mp4',bytes:await file.arrayBuffer(),addedAt:new Date().toISOString()}];done++}}if(!done)throw Error('没有识别出可用的照片或视频');await writePlace(p);await renderPlace(id);feedback(`已保存 ${done} 项影像到当前星标。建议定期导出 ZIP 备份。`)}catch(e){feedback('添加失败：'+e.message)}finally{busy=false}}
function closeViewer(){const panel=$('fpMediaViewer');if(panel)panel.remove();if(videoURL){URL.revokeObjectURL(videoURL);videoURL=''}}
function openViewer(items,index){closeViewer();const x=items[index];if(!x)return;const viewer=h('div');viewer.id='fpMediaViewer';viewer.setAttribute('role','dialog');viewer.setAttribute('aria-modal','true');viewer.setAttribute('aria-label','查看旅行照片或视频');viewer.append(btn('×',closeViewer,'fp-viewer-close'));if(x.kind==='photo'){const img=h('img');img.src=x.src;img.alt='旅行照片';viewer.append(img)}else{const blob=x.blob instanceof Blob?x.blob:new Blob([x.bytes],{type:x.type||'video/mp4'});videoURL=URL.createObjectURL(blob);const v=h('video');v.src=videoURL;v.controls=true;v.playsInline=true;v.autoplay=true;viewer.append(v)}viewer.append(h('div','fp-viewer-caption',`${index+1} / ${items.length} · ${x.name||'旅行影像'}`));viewer.addEventListener('click',e=>{if(e.target===viewer)closeViewer()});document.body.append(viewer)}
function init(){initSearch();mountPlace();window.__footprintHome={openSearch,closeSearch,openSaved:showPlaceCard,readPlaces};}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();