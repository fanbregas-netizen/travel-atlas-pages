(function orbitModule(){
'use strict';
if(window.__atlasInteractionMode==='swipe-card')return;
const sheet=document.getElementById('memorySheet');
if(!sheet||document.getElementById('atlasOrbit'))return;
const root=document.createElement('section');root.id='atlasOrbit';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','星标旅行记忆：四向展开');
const backdrop=document.createElement('div');backdrop.className='orbit-backdrop';root.append(backdrop);
const regions=[['tl','为什么想去'],['tr','照片与视频'],['bl','相关攻略'],['br','附近地点']];
const cards=new Map();
for(const [key,title] of regions){
 const card=document.createElement('article');card.className='orbit-bubble '+key;card.setAttribute('aria-label',title);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','orbit-svg');svg.setAttribute('aria-hidden','true');
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');svg.append(path);
 const content=document.createElement('div');content.className='orbit-content';card.append(svg,content);root.append(card);
 cards.set(key,{card,svg,path,content});
 card.tabIndex=0;
 card.addEventListener('click',e=>{
  if(e.target.closest('button,a'))return;
  const action=content.querySelector('button.orbit-premium-media,button.orbit-ref-small-action,a.orbit-ref-guide-link');
  action?.click();
 });
 card.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&e.target===card){e.preventDefault();content.querySelector('button.orbit-premium-media,button.orbit-ref-small-action,a.orbit-ref-guide-link')?.click()}
 });
}
// Fixed-proportion consolidated card: used ONLY if separate cards cannot breathe.
const combined=document.createElement('article');combined.className='orbit-bubble combo';combined.setAttribute('aria-label','地点内容');
const combinedSVG=document.createElementNS('http://www.w3.org/2000/svg','svg');combinedSVG.classList.add('orbit-svg');combinedSVG.setAttribute('aria-hidden','true');
const combinedPath=document.createElementNS('http://www.w3.org/2000/svg','path');combinedSVG.append(combinedPath);
const combinedContent=document.createElement('div');combinedContent.className='orbit-content orbit-combo-content';
combined.append(combinedSVG,combinedContent);root.append(combined);
cards.set('combo',{card:combined,svg:combinedSVG,path:combinedPath,content:combinedContent});
// Stage1.34.7: the geographic map bookmark is the ONLY visible star.
// This independent overlay owns only four SVG silhouettes and their content.
document.body.append(root);window.__atlasOrbitEnabled=true;document.body.classList.add('atlas-orbit-installed');
let shownId='',dismissedId='',requestController=null,scheduled=false,closeTimer=null,openFrame=null;
let shapeFrame=null,shapeProgress=1;
const reduceMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const text=(tag,cls,value)=>{const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=value||'';return el};
const kicker=(label,icon)=>{const el=text('div','orbit-kicker');if(icon){const img=document.createElement('img');img.className='orbit-kicker-icon';img.src=window.__atlasInlineIconPaths?.[icon]||icon;img.alt='';img.setAttribute('aria-hidden','true');el.append(img)}el.append(document.createTextNode(label));return el};
const action=(label,fn)=>{const b=text('button','orbit-action',label);b.type='button';b.addEventListener('click',fn);return b};
// One shared module for all four cards: corner radius 2u, tail reach 1.4u,
// shoulder 3u. Reflect a single closed contour, so the lower-right tail cannot
// diverge from the other three. Module size is independent of each card's area.
// Faithful to the user-confirmed iPhone UI screenshot: a rounded rectangle per
// region; top-row tails point DOWN, bottom-row tails UP. Tails are deliberately
// inset from each card's edge (NOT on the four corner diagonals).
// Each SVG is a self-contained rounded silhouette. A continuous tail points
// towards the ACTUAL saved star, even when the layout has to flip at an edge.
const Core=window.AtlasConstellationCore;
if(!Core)throw new Error('Constellation geometry missing: refuse divergent layout');
const clamp=Core.clamp;
const layoutKeys=['tl','tr','bl','br'];
let anchor=null,placements={},geometry=null;
let currentMode='closed',pendingFocus=0,lastMarker=null;
function findAnchor(place){
 const id=String(place?.id??'');
 const markers=[...document.querySelectorAll('#atlasBookmarkOverlay .atlas-bookmark-hit[data-place-id],.star-pin[data-place-id]')];
 const marker=markers.find(el=>el.isConnected&&el.dataset.placeId===id&&el.getBoundingClientRect().width>0&&getComputedStyle(el).display!=='none');
 if(marker){const b=marker.getBoundingClientRect();lastMarker=marker;return{x:b.left+b.width/2,y:b.top+b.height/2,source:'star'}}
 // The geographic projection is ONLY a fallback for an existing star clipped
 // during a transient map-frame. It never creates a synthetic star on screen.
 const bridge=window.__atlasPOIBridge;
 if(!bridge||!Number.isFinite(+place?.lat)||!Number.isFinite(+place?.lng))return null;
 const project=(map,convert)=>{if(!map)return null;try{
  const q=convert(map),rect=map.getContainer?.()?.getBoundingClientRect?.();
  if(Number.isFinite(q?.x)&&Number.isFinite(q?.y))return{x:q.x+(rect?.left||0),y:q.y+(rect?.top||0),source:'projection'};
 }catch(_){}return null};
 return project(bridge.vector?.(),map=>map.project([+place.lng,+place.lat]))||
        project(bridge.official?.(),()=>bridge.projectOfficial?.(place))||
        project(bridge.raster?.(),map=>map._pixel(+place.lng,+place.lat));
}
function orbitGeometry(W=innerWidth,H=innerHeight){
 const dockTop=document.getElementById('appDock')?.getBoundingClientRect()?.top;
 return Core.measure(W,H,dockTop,window.visualViewport?.offsetTop||0);
}
window.__atlasOrbitGeometry=orbitGeometry;
function targetRectForTiny(anchor,g){
 const unit=Math.min(.96,(g.W-34)/288,(g.safe.bottom-g.safe.top-12)/308);
 const w=288*unit,h=280*unit,gap=28*unit;
 const below=anchor.y+gap+h<=g.safe.bottom;
 const y=below?anchor.y+gap:clamp(anchor.y-gap-h,g.safe.top,g.safe.bottom-h);
 return {combo:{key:'combo',x:clamp(anchor.x-w/2,g.safe.left,g.safe.right-w),y,w,h,
    side:below?'top':'bottom',attach:.5,tilt:0}};
}
function adaptiveLayout(){
 if(root.hidden||!shownId)return;
 const place=state();if(!place||String(place.id)!==String(shownId))return;
 const projected=findAnchor(place);if(projected)anchor=projected;
 if(!anchor)return;
 geometry=orbitGeometry();
 const g=geometry;
 let next,mode;
 if(g.fullFourPossible){
  // The camera focuses to THIS corridor before the overlay opens. No cards are
  // ever positioned at some unrelated 'screen center' while the bookmark moves.
  next=Core.layout(anchor.x,anchor.y,g);
  if(!Core.fits(next,g)){
   // While an opened constellation follows a user's small map pan, keep it
   // attached. Only dismiss if a card would truly leave the visible viewport;
   // NEVER make the camera chase the star after opening.
   const visible=Object.values(next).every(r=>r.x>=3&&r.y>=Math.max(40,g.safe.top-22)&&r.x+r.w<=g.W-3&&r.y+r.h<=Math.min(g.H-72,g.safe.bottom+22));
   if(root.classList.contains('is-open')){
    if(!visible){hide(true);return}
    // Allow a little breathing outside the focus corridor during a gesture.
    pendingFocus=0;
   }else{
   root.dataset.orbitMode='focusing';
   if(pendingFocus<2&&!document.body.classList.contains('atlas-map-reframing')){
    pendingFocus++;
    const didFocus=window.__atlasOrbitRequestFocus?.(place);
    if(didFocus){root.style.visibility='hidden';return}
   }
   // Never expose crossed arrows or off-screen cards. Let the map settle.
   root.style.visibility='hidden';return;
   }
  }
  mode='four';pendingFocus=0;
 }else{mode='one';next=targetRectForTiny(anchor,g)}
 root.style.visibility='visible';placements=next;currentMode=mode;
 root.dataset.orbitMode=mode;root.dataset.orbitLayout=mode;
 for(const key of [...layoutKeys,'combo']){
  const {card}=cards.get(key),r=next[key];card.hidden=!r;
  if(!r)continue;
  card.style.setProperty('left',r.x.toFixed(2)+'px','important');
  card.style.setProperty('top',r.y.toFixed(2)+'px','important');
  card.style.setProperty('width',r.w.toFixed(2)+'px','important');
  card.style.setProperty('height',r.h.toFixed(2)+'px','important');
  card.style.setProperty('transform-origin',`${(anchor.x-r.x).toFixed(2)}px ${(anchor.y-r.y).toFixed(2)}px`,'important');
 }
 if(mode==='one'&&!cards.get('combo').content.children.length)drawCombined(place);
 updateShapes();renderMotion();
}
function updateShapes(){
 for(const [key,r] of Object.entries(placements)){
  const {svg,path}=cards.get(key);
  const pad=32;
  svg.style.setProperty('left',-pad+'px','important');svg.style.setProperty('top',-pad+'px','important');
  svg.style.setProperty('width',r.w+2*pad+'px','important');svg.style.setProperty('height',r.h+2*pad+'px','important');
  svg.setAttribute('viewBox',`${-pad} ${-pad} ${r.w+pad*2} ${r.h+pad*2}`);
  path.setAttribute('d',Core.shape(r,geometry));
 }
}
function renderMotion(){
 if(root.hidden||!anchor)return;
 const t=clamp(shapeProgress,0,1);
 const progress=1-Math.pow(1-t,2.5);
 for(const [key,r] of Object.entries(placements)){
  const {card,content}=cards.get(key);
  const dx=anchor.x-(r.x+r.w/2),dy=anchor.y-(r.y+r.h/2),back=1-progress;
  card.style.setProperty('transform',`translate3d(${(dx*back).toFixed(2)}px,${(dy*back).toFixed(2)}px,0) scale(${(.35+.65*progress).toFixed(4)})`,'important');
  card.style.setProperty('opacity',String(clamp(progress*1.8,0,1)),'important');
  content.style.setProperty('opacity',String(clamp((progress-.45)/.47,0,1)),'important');
  card.style.pointerEvents=progress>.97?'auto':'none';
 }
}
function animateShapes(open){
 if(shapeFrame){cancelAnimationFrame(shapeFrame);shapeFrame=null}
 if(reduceMotion()){shapeProgress=open?1:0;renderMotion();return}
 const start=performance.now(),from=shapeProgress,to=Number(open),duration=open?420:260;
 function step(now){
  const t=clamp((now-start)/duration,0,1),ease=t*t*(3-2*t);
  shapeProgress=from+(to-from)*ease;
  renderMotion();
  if(t<1)shapeFrame=requestAnimationFrame(step);
  else{shapeFrame=null;shapeProgress=to;renderMotion()}
 }
 shapeFrame=requestAnimationFrame(step);
}
function state(){try{return window.__atlasOrbitState?.()||null}catch(_){return null}}
const clear=key=>{const el=cards.get(key).content;el.replaceChildren();return el};
function icon(src){
 const img=document.createElement('img');img.className='orbit-ref-action-icon';img.src=window.__atlasInlineIconPaths?.[src]||src;img.alt='';img.setAttribute('aria-hidden','true');return img;
}
function smallAction(label,iconName,callback){
 const b=action(label,callback);b.classList.add('orbit-ref-small-action');
 if(iconName)b.prepend(icon('./icons/'+iconName+'.svg'));
 return b;
}
function drawBrief(p){
 const c=clear('tl');
 c.append(kicker('为什么想去','./icons/07_brief.svg'));
 const note=String(p.note||'').replace(/^原高德地址[：:][^\n]*\n?/,'').trim();
 const summary=text('p','orbit-ref-sub orbit-ref-brief-text',note||'写下为什么想去这个地方');
 c.append(summary);
 c.append(smallAction('编辑','14_edit',()=>{sheet.querySelector('.memo-edit')?.click()}));
}
function drawMedia(p){
 const c=clear('tr');
 c.append(kicker('照片与视频','./icons/08_photo_video.svg'));
 const source=sheet.querySelector('[data-action="photo"]');
 const still=sheet.querySelector('[data-action="photo"] img');
 const openMedia=()=>{if(source)source.click();else document.getElementById('memoryUpload')?.click()};
 const upload=()=>document.getElementById('memoryUpload')?.click();
 const count=(Number(p.photoCount)||0)+(Number(p.videoCount)||0);
 const hero=document.createElement('button');hero.type='button';hero.className='orbit-premium-media';
 hero.setAttribute('aria-label',count?'查看地点影像':'为地点添加照片或视频');
 if(still?.src){
  const image=document.createElement('img');image.className='orbit-premium-cover';image.src=still.src;
  image.alt='这个地点的旅行影像';image.onerror=()=>{if(!hero.isConnected)return;image.remove();hero.classList.add('is-empty');hero.append(icon('./icons/08_photo_video.svg'))};hero.append(image);
  hero.classList.add('has-photo');
 }else{
  hero.classList.add('is-empty');hero.append(icon('./icons/08_photo_video.svg'));
  const prompt=text('span','orbit-premium-placeholder','收藏一个瞬间');hero.append(prompt);
 }
 const plus=text('span','orbit-premium-plus',count?'↗':'+');plus.setAttribute('aria-hidden','true');hero.append(plus);
 hero.addEventListener('click',count?openMedia:upload);c.append(hero);
 const foot=text('div','orbit-premium-media-foot');foot.append(text('span','',count?count+' 项影像':'暂无影像'));
 const edit=text('button','orbit-premium-media-edit',count?'查看图库':'添加影像');edit.type='button';edit.onclick=count?openMedia:upload;foot.append(edit);c.append(foot);
}

function drawGuides(p){
 const c=clear('bl');c.append(kicker('相关攻略','./icons/09_guides.svg'));
 const stored=[...(Array.isArray(p.references)?p.references:[]),...(Array.isArray(p.guides)?p.guides:[])];
 let first=null;
 for(const record of stored){
  const raw=typeof record==='string'?record:record?.url||record?.link||'';
  try{const url=new URL(raw);if(['http:','https:'].includes(url.protocol)){first={url:url.href,label:(typeof record==='object'&&record?.title)||'旅行攻略 · 路线笔记'};break}}catch(_){}
 }
 if(first){const a=document.createElement('a');a.className='orbit-ref-sub orbit-ref-guide-link';a.textContent=String(first.label).slice(0,26);a.href=first.url;a.target='_blank';a.rel='noopener noreferrer';c.append(a)}
 else c.append(text('p','orbit-ref-sub','旅行攻略 · 路线笔记'));
 c.append(smallAction('添加攻略','32_add_guide',()=>{if(window.__footprintFlow?.open)window.__footprintFlow.open('sources',p.id);else sheet.querySelector('.memo-edit')?.click()}));
}
function drawNearby(p){
 const c=clear('br');c.append(kicker('附近地点','./icons/10_nearby.svg'));
 const summary=text('p','orbit-ref-sub orbit-ref-nearby-copy','发现周边值得探索的地方');c.append(summary);
 const list=text('div','orbit-near-list','');list.append(text('p','orbit-small','正在寻找附近地点…'));
 const toggle=smallAction('查看周边','40_direction',()=>{
  const card=cards.get('br').card,expanded=card.classList.toggle('is-near-expanded');
  toggle.lastChild.textContent=expanded?'收起':'查看周边';
 });
 c.append(toggle,list);
 if(requestController){requestController.abort();requestController=null}
 const m=p.lat==null||p.lat===''?NaN:Number(p.lat),n=p.lng==null||p.lng===''?NaN:Number(p.lng);
 if(!Number.isFinite(m)||!Number.isFinite(n)){list.replaceChildren(text('p','orbit-small','位置暂不可用'));return}
 if(typeof window.AtlasServices?.nearby!=='function'){list.replaceChildren(text('p','orbit-small','附近查询暂不可用'));return}
 requestController=new AbortController();
 const controller=requestController,originId=p.id;
 window.AtlasServices.nearby(m,n,{signal:controller.signal}).then(data=>{
  if(controller.signal.aborted||shownId!==originId)return;
  list.replaceChildren();const places=Array.isArray(data?.places)?data.places:[];
  if(!places.length){list.append(text('p','orbit-small','暂未找到附近地点'));return}
  for(const place of places.slice(0,4)){
   const b=document.createElement('button');b.className='orbit-near-item';b.type='button';b.title=String(place.address||place.name||'');
   b.append(text('span','orbit-near-name',String(place.name||'地点')));
   const distance=place.distance==null||place.distance===''?NaN:Number(place.distance);
   b.append(text('span','orbit-near-dist',Number.isFinite(distance)&&distance>=0?(distance<1000?Math.round(distance)+'m':(distance/1000).toFixed(1)+'km'):'附近'));
   b.addEventListener('click',()=>{hide(true);if(Number.isFinite(Number(place.lat))&&Number.isFinite(Number(place.lng)))window.__atlasDemo?.select?.(String(place.name||'景点'),Number(place.lat),Number(place.lng))});list.append(b);
  }
 }).catch(()=>{if(!controller.signal.aborted&&shownId===originId)list.replaceChildren(text('p','orbit-small','附近查询暂不可用'))});
}
function drawCombined(p){
 const c=clear('combo');
 const note=String(p?.note||'').replace(/^原高德地址[：:][^\n]*\n?/,'').trim();
 const name=text('div','orbit-combo-title',String(p?.title||'这个地方'));c.append(name);
 const why=text('div','orbit-combo-section');
 why.append(kicker('为什么想去','./icons/07_brief.svg'));
 why.append(text('p','orbit-combo-brief',note||'还没有记录想去的理由'));
 why.addEventListener('click',()=>sheet.querySelector('.memo-edit')?.click());why.setAttribute('role','button');why.tabIndex=0;
 why.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();sheet.querySelector('.memo-edit')?.click()}});
 c.append(why);
 const media=text('div','orbit-combo-section orbit-combo-media');
 media.append(kicker('照片与视频','./icons/08_photo_video.svg'));
 const pic=sheet.querySelector('[data-action="photo"] img');
 const launch=()=>{const trigger=sheet.querySelector('[data-action="photo"]');trigger?trigger.click():document.getElementById('memoryUpload')?.click()};
 const preview=document.createElement('button');preview.type='button';preview.className='orbit-combo-preview';
 preview.setAttribute('aria-label','查看或添加影像');
 if(pic?.src){const img=document.createElement('img');img.src=pic.src;img.alt='地点照片';preview.append(img)}
 else preview.append(icon('./icons/08_photo_video.svg'),text('span','','添加照片或视频'));
 preview.addEventListener('click',launch);media.append(preview);c.append(media);
 const shortcuts=text('div','orbit-combo-shortcuts');
 shortcuts.append(smallAction('相关攻略','09_guides',()=>{if(window.__footprintFlow?.open)window.__footprintFlow.open('sources',p.id);else sheet.querySelector('.memo-edit')?.click()}));
 shortcuts.append(smallAction('附近地点','10_nearby',()=>{
  let tray=c.querySelector('.orbit-combo-nearby');
  if(tray){tray.remove();return}
  tray=text('div','orbit-combo-nearby','');
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='orbit-combo-nearby-close';dismiss.textContent='‹ 返回内容';dismiss.addEventListener('click',()=>tray.remove());
  tray.append(dismiss,text('p','','正在查找附近地点…'));c.append(tray);
  if(typeof window.AtlasServices?.nearby!=='function'||p.lat==null||p.lng==null){tray.append(text('p','','附近资料暂不可用'));return}
  window.AtlasServices.nearby(Number(p.lat),Number(p.lng)).then(data=>{
    if(!tray.isConnected)return;
    tray.replaceChildren(dismiss);const entries=Array.isArray(data?.places)?data.places.slice(0,3):[];
    if(!entries.length){tray.append(text('p','','附近暂时没有地点'));return}
    for(const entry of entries){
      const b=document.createElement('button');b.type='button';b.textContent=String(entry.name||'附近地点');
      b.addEventListener('click',()=>{
        if(!Number.isFinite(Number(entry.lat))||!Number.isFinite(Number(entry.lng)))return;
        hide(true);window.__atlasDemo?.select?.(String(entry.name||'地点'),Number(entry.lat),Number(entry.lng));
      });tray.append(b);
    }
  }).catch(()=>{if(tray.isConnected)tray.append(text('p','','附近查询暂不可用'))});
 }));
 c.append(shortcuts);
}
function show(p){
 if(closeTimer){clearTimeout(closeTimer);closeTimer=null}
 if(openFrame){cancelAnimationFrame(openFrame);openFrame=null}
 if(requestController){requestController.abort();requestController=null}
 const restarting=root.classList.contains('is-closing');
 root.classList.remove('is-closing','is-open');
 cards.get('br').card.classList.remove('is-near-expanded');
 dismissedId='';shownId=String(p.id);pendingFocus=0;
 root.hidden=false;root.style.visibility='hidden';document.body.classList.add('atlas-orbit-active');
 drawBrief(p);drawMedia(p);drawGuides(p);drawNearby(p);
 shapeProgress=reduceMotion()?1:(restarting?shapeProgress:0);
 adaptiveLayout();
 openFrame=requestAnimationFrame(()=>{
  openFrame=null;if(root.hidden||String(shownId)!==String(p.id))return;
  if(root.dataset.orbitMode==='focusing')return;
  root.classList.add('is-open');animateShapes(true);
 });
}
function hide(closeOriginal=false){
 if(root.hidden)return;
 if(requestController){requestController.abort();requestController=null}
 if(openFrame){cancelAnimationFrame(openFrame);openFrame=null}
 if(shownId&&!closeOriginal)dismissedId=String(shownId);
 shownId='';root.classList.remove('is-open');root.classList.add('is-closing');
 animateShapes(false);
 if(closeTimer)clearTimeout(closeTimer);
 closeTimer=setTimeout(()=>{
  if(shownId)return;
  root.hidden=true;root.classList.remove('is-closing');document.body.classList.remove('atlas-orbit-active');
  if(shapeFrame)cancelAnimationFrame(shapeFrame);shapeFrame=null;shapeProgress=0;placements={};anchor=null;root.dataset.orbitMode='closed';
 },reduceMotion()?0:285);
 if(closeOriginal){
  if(window.__atlasDismissSavedPlace)window.__atlasDismissSavedPlace();
  else document.getElementById('navMap')?.click();
 }
}
function sync(){
 scheduled=false;
 if(document.body.classList.contains('atlas-map-reframing'))return;
 if(window.__atlasPreferCollage===true){if(!root.hidden)hide();return}
 if(!sheet.classList.contains('visible')){dismissedId='';if(!root.hidden)hide();return}
 const p=state();if(!p){if(!root.hidden)hide();return}
 if(dismissedId===String(p.id))return;
 if(root.hidden||shownId!==String(p.id)||root.classList.contains('is-closing')){show(p);return}
 drawBrief(p);drawMedia(p);drawGuides(p);
 adaptiveLayout();
 if(root.dataset.orbitMode!=='focusing'&&!root.classList.contains('is-open')){
  root.classList.add('is-open');animateShapes(true);
 }
}
function scheduleSync(){if(scheduled)return;scheduled=true;requestAnimationFrame(sync)}
function scheduleReflow(){
 if(root.hidden||!shownId||positionFrame!==null)return;
 positionFrame=requestAnimationFrame(()=>{positionFrame=null;adaptiveLayout();
  if(root.dataset.orbitMode!=='focusing'&&!root.classList.contains('is-open')){
    root.classList.add('is-open');animateShapes(true);
  }
 });
}
let positionFrame=null;
new MutationObserver(scheduleSync).observe(sheet,{attributes:true,attributeFilter:['class'],childList:false});
document.addEventListener('atlas:memory-open',()=>{dismissedId='';scheduleSync()});
document.addEventListener('atlas:focus-settled',()=>requestAnimationFrame(()=>requestAnimationFrame(scheduleSync)));
// The background remains owned by the map: no invisible full-screen pane can
// intercept swipes and cause an apparently floating bookmark.
backdrop.addEventListener('click',()=>hide(true));
root.addEventListener('pointerdown',e=>{if(e.target===root)hide(true)});
window.addEventListener('resize',scheduleReflow,{passive:true});
window.visualViewport?.addEventListener('resize',scheduleReflow,{passive:true});
window.visualViewport?.addEventListener('scroll',scheduleReflow,{passive:true});
window.addEventListener('orientationchange',scheduleReflow,{passive:true});
document.addEventListener('atlas:map-position',scheduleReflow);
window.__atlasOrbitReflow=scheduleReflow;
window.__atlasOrbitStatus=()=>({id:shownId,mode:root.dataset.orbitMode||'closed',phase:root.classList.contains('is-closing')?'closing':root.hidden?'closed':root.classList.contains('is-open')?'open':'opening',open:!root.hidden&&!root.classList.contains('is-closing'),anchor:anchor?{...anchor}:null,cards:Object.keys(placements)});
const pane=document.getElementById('atlasBookmarkOverlay');
if(pane)new MutationObserver(scheduleReflow).observe(pane,{attributes:true,attributeFilter:['style','class'],subtree:true,childList:true});
// Extra fallback for renderers that update map position without changing a DOM
// attribute (e.g. canvas transform on iOS). Run only while the constellation is open.
let sampled=0;
function trackRealStar(){
 if(!root.hidden&&shownId){
  const p=state();const q=p&&findAnchor(p);
  if(q&&(!anchor||Math.hypot(q.x-anchor.x,q.y-anchor.y)>.5))scheduleReflow();
 }
 sampled=requestAnimationFrame(trackRealStar);
}
sampled=requestAnimationFrame(trackRealStar);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!root.hidden&&!document.getElementById('editor')?.open){e.preventDefault();hide(true)}});

scheduleSync();
})();
