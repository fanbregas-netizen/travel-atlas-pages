(function orbitModule(){
'use strict';
const sheet=document.getElementById('memorySheet');
if(!sheet||document.getElementById('atlasOrbit'))return;
const root=document.createElement('section');root.id='atlasOrbit';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','星标旅行记忆：四向展开');
const backdrop=document.createElement('div');backdrop.className='orbit-backdrop';root.append(backdrop);
const regions=[['tl','为什么想去 · BRIEF'],['tr','照片与视频 · MEDIA'],['bl','相关攻略 · GUIDES'],['br','附近景点 · NEARBY']];
const cards=new Map();
for(const [key,title] of regions){
 const card=document.createElement('article');card.className='orbit-bubble '+key;card.setAttribute('aria-label',title);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','orbit-svg');svg.setAttribute('aria-hidden','true');
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');svg.append(path);
 const content=document.createElement('div');content.className='orbit-content';card.append(svg,content);root.append(card);
 cards.set(key,{card,svg,path,content});
}
const star=document.createElement('button');star.type='button';star.className='orbit-center';star.innerHTML='<svg viewBox="0 0 32 32" width="25" height="25" aria-hidden="true"><path d="M16 2.8 20.15 11.3 29.5 12.65 22.75 19.25 24.35 28.55 16 24.15 7.65 28.55 9.25 19.25 2.5 12.65 11.85 11.3Z" fill="currentColor" stroke="currentColor" stroke-linejoin="round" stroke-width="1.4"/></svg>';star.setAttribute('aria-label','收起四向气泡');root.append(star);
document.body.append(root);window.__atlasOrbitEnabled=true;
let shownId='',dismissedId='',requestController=null,scheduled=false,closeTimer=null,openFrame=null;
let shapeFrame=null,shapeProgress=1;
const reduceMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const text=(tag,cls,value)=>{const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=value||'';return el};
const kicker=(label)=>text('div','orbit-kicker',label);
const action=(label,fn)=>{const b=text('button','orbit-action',label);b.type='button';b.addEventListener('click',fn);return b};
function pathFor(w,h,direction){
 // Rounded bubble and a single smoothly attached inward tail per quadrant.
 // Keep the tip within the central gap and away from the yellow star.
 const r=Math.min(18,w/7,h/7),reach=Math.min(17,w*.1,h*.12),base=Math.min(42,w*.28);
 if(direction==='tl')return `M ${r} 0 H ${w-r} Q ${w} 0 ${w} ${r} V ${h-r} Q ${w} ${h-5} ${w-8} ${h-3} C ${w+2} ${h+2} ${w+reach-6} ${h+reach-5} ${w+reach} ${h+reach} C ${w+1} ${h+reach-3} ${w-base+13} ${h+2} ${w-base} ${h} H ${r} Q 0 ${h} 0 ${h-r} V ${r} Q 0 0 ${r} 0 Z`;
 if(direction==='tr')return `M ${r} 0 H ${w-r} Q ${w} 0 ${w} ${r} V ${h-r} Q ${w} ${h} ${w-r} ${h} H ${base} C ${base-13} ${h+2} -1 ${h+reach-3} ${-reach} ${h+reach} C ${-reach+6} ${h+reach-5} -2 ${h+2} 8 ${h-3} Q 0 ${h-5} 0 ${h-r} V ${r} Q 0 0 ${r} 0 Z`;
 if(direction==='bl')return `M ${r} 0 H ${w-base} C ${w-base+13} -2 ${w+1} ${-reach+3} ${w+reach} ${-reach} C ${w+reach-6} ${-reach+5} ${w+2} -2 ${w-8} 3 Q ${w} 5 ${w} ${r} V ${h-r} Q ${w} ${h} ${w-r} ${h} H ${r} Q 0 ${h} 0 ${h-r} V ${r} Q 0 0 ${r} 0 Z`;
 return `M ${r} 0 Q 0 0 0 ${r} Q 0 5 8 3 C -2 -2 ${-reach+6} ${-reach+5} ${-reach} ${-reach} C -1 ${-reach+3} ${base-13} -2 ${base} 0 H ${w-r} Q ${w} 0 ${w} ${r} V ${h-r} Q ${w} ${h} ${w-r} ${h} H ${r} Q 0 ${h} 0 ${h-r} V ${r} Z`;
}
function resizeShapes(){
 if(root.hidden)return;
 for(const [key,{card,svg,path}] of cards){
  const w=card.offsetWidth,h=card.offsetHeight;
  if(w<20||h<20)continue;
  svg.setAttribute('viewBox',`${-24} ${-24} ${w+48} ${h+48}`);
  // Animate the four actual SVG silhouettes, not a scaled screenshot or a card layer.
  const progress=Math.max(0,Math.min(1,shapeProgress));
  const pw=Math.max(26,w*(.115+.885*progress));
  const ph=Math.max(26,h*(.115+.885*progress));
  const x=(key==='tl'||key==='bl')?w-pw:0;
  const y=(key==='tl'||key==='tr')?h-ph:0;
  path.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)})`);
  path.setAttribute('d',pathFor(pw,ph,key));
 }
}
function animateShapes(open){
 if(shapeFrame){cancelAnimationFrame(shapeFrame);shapeFrame=null}
 if(reduceMotion()){shapeProgress=open?1:0;resizeShapes();return}
 const from=shapeProgress,started=performance.now(),duration=open?710:310;
 function frame(now){
  const t=Math.min(1,(now-started)/duration);
  // Critically damped travel with a restrained spring overshoot on expansion.
  // A monotonic spring-like ease avoids the overshoot folding SVG corners
  // into themselves on narrow phones.
  const eased=open?1-Math.pow(1-t,3)*(1+2.2*t):1-Math.pow(1-t,2.25);
  shapeProgress=from+((open?1:0)-from)*eased;
  if(t===1)shapeProgress=open?1:0;
  resizeShapes();
  if(t<1)shapeFrame=requestAnimationFrame(frame);else shapeFrame=null;
 }
 shapeFrame=requestAnimationFrame(frame);
}
function state(){try{return window.__atlasOrbitState?.()||null}catch(_){return null}}
const clear=key=>{const el=cards.get(key).content;el.replaceChildren();return el};
function drawBrief(p){
 const c=clear('tl');c.append(kicker('01 / BRIEF · 想去理由'),text('h3','orbit-title',p.title||'未命名地点'),text('p','orbit-note',p.note||'还没有写下想去的理由。'));
 c.append(action('编辑 Brief ↗',()=>{sheet.querySelector('.memo-edit')?.click()}));
}
function drawMedia(p){
 const c=clear('tr');c.append(kicker('02 / PHOTO & VIDEO'));
 const source=sheet.querySelector('[data-action="photo"]');
 const button=document.createElement('button');button.type='button';button.className='orbit-media-hero';button.setAttribute('aria-label','打开旅行照片与视频');
 const img=sheet.querySelector('[data-action="photo"] img');
 if(img?.src){const cover=document.createElement('img');cover.src=img.src;cover.alt=(p.title||'地点')+' · 旅行照片';button.append(cover)}
 else button.append(text('span','orbit-media-placeholder',p.videoCount?'▶ 旅行视频':'Add memories\n照片 · 视频'));
 if((p.photoCount||0)+(p.videoCount||0)>0)button.append(text('span','orbit-media-count',`${p.photoCount||0} 照片 · ${p.videoCount||0} 视频`));
 button.addEventListener('click',()=>{if(source)source.click();else document.getElementById('memoryUpload')?.click()});c.append(button);
 c.append(action('＋ 添加影像',()=>{document.getElementById('memoryUpload')?.click()}));
}
function drawGuides(p){
 const c=clear('bl');c.append(kicker('03 / GUIDES · 攻略'),text('h3','orbit-title','发现更多灵感'));
 const links=document.createElement('div');links.className='orbit-links';const list=[];
 for(const match of String(p.note||'').matchAll(/https?:\/\/[^\s，。；<>"']+/g)){
  try{const url=new URL(match[0]);if(['https:','http:'].includes(url.protocol)){list.push({label:'已保存 · '+url.hostname,url:url.href});if(list.length>=2)break}}catch(_){}
 }
 const name=p.title||'旅行目的地';
 list.push({label:'小红书 · 相关旅行笔记',url:'https://www.xiaohongshu.com/search_result?keyword='+encodeURIComponent(name)});
 list.push({label:'搜索 · '+name+' 攻略',url:'https://www.bing.com/search?q='+encodeURIComponent(name+' 旅行攻略')});
 for(const entry of list.slice(0,3)){
  const a=document.createElement('a');a.className='orbit-link';a.href=entry.url;a.target='_blank';a.rel='noopener noreferrer';
  a.append(text('span','',entry.label),text('span','','↗'));links.append(a);
 }
 c.append(links);c.append(action('记录攻略 ↗',()=>{sheet.querySelector('.memo-edit')?.click()}));
}
function drawNearby(p){
 const c=clear('br');c.append(kicker('04 / NEARBY · 附近'),text('h3','orbit-title','周边值得看看'));
 const list=text('div','orbit-near-list','');list.append(text('p','orbit-small','正在查找附近真实地点…'));c.append(list);
 // Cancel any previous place's lookup before validating this destination.
 if(requestController){requestController.abort();requestController=null}
 const m=p.lat==null||p.lat===''?NaN:Number(p.lat),n=p.lng==null||p.lng===''?NaN:Number(p.lng);
 if(!Number.isFinite(m)||!Number.isFinite(n)){list.replaceChildren(text('p','orbit-small','位置暂不可用'));return}
 if(typeof window.AtlasServices?.nearby!=='function'){list.replaceChildren(text('p','orbit-small','附近查询暂时不可用。'));return}
 requestController=new AbortController();
 const controller=requestController,originId=p.id;
 window.AtlasServices.nearby(m,n,{signal:controller.signal})
  .then(data=>{
   if(controller.signal.aborted||shownId!==originId)return;
   list.replaceChildren();const places=Array.isArray(data.places)?data.places:[];
   if(!places.length){list.append(text('p','orbit-small','这里暂时没有收录的附近景点。'));return}
   for(const place of places){
    const b=document.createElement('button');b.className='orbit-near-item';b.type='button';b.title=String(place.address||place.name||'');
    b.append(text('span','orbit-near-name',String(place.name||'地点')));
    const distance=place.distance==null||place.distance===''?NaN:Number(place.distance);b.append(text('span','orbit-near-dist',Number.isFinite(distance)&&distance>=0?(distance<1000?Math.round(distance)+'m':(distance/1000).toFixed(1)+'km'):'附近'));
    b.addEventListener('click',()=>{
     hide(true);if(Number.isFinite(Number(place.lat))&&Number.isFinite(Number(place.lng)))window.__atlasDemo?.select?.(String(place.name||'景点'),Number(place.lat),Number(place.lng));
    });list.append(b);
   }
  }).catch(()=>{if(!controller.signal.aborted&&shownId===originId)list.replaceChildren(text('p','orbit-small','附近查询暂时不可用。'),action('重新查询',()=>drawNearby(p)))});
}
function show(p){
 if(closeTimer){clearTimeout(closeTimer);closeTimer=null}
 if(openFrame)cancelAnimationFrame(openFrame);
 const reopeningDuringCollapse=root.classList.contains('is-closing')&&!root.hidden;
 root.classList.remove('is-closing','is-open');
 dismissedId='';shownId=p.id;root.hidden=false;document.body.classList.add('atlas-orbit-active');
 drawBrief(p);drawMedia(p);drawGuides(p);drawNearby(p);
 // Reverse from the current SVG geometry when a second tap interrupts collapse.
 // Resetting to the tiny initial shape caused a visible flash on iOS.
 shapeProgress=reduceMotion()?1:(reopeningDuringCollapse?shapeProgress:.025);resizeShapes();
 openFrame=requestAnimationFrame(()=>{openFrame=null;if(!root.hidden&&shownId===p.id){root.classList.add('is-open');animateShapes(true)}});
}
function hide(closeOriginal=false){
 if(root.hidden||root.classList.contains('is-closing'))return;
 if(requestController){requestController.abort();requestController=null}
 if(openFrame){cancelAnimationFrame(openFrame);openFrame=null}
 if(!closeOriginal&&shownId)dismissedId=shownId;
 shownId='';root.classList.remove('is-open');root.classList.add('is-closing');animateShapes(false);
 // Keep the vector shapes visible for the short collapse instead of hiding instantly.
 if(closeTimer)clearTimeout(closeTimer);
 closeTimer=setTimeout(()=>{closeTimer=null;if(!shownId){root.hidden=true;root.classList.remove('is-closing');document.body.classList.remove('atlas-orbit-active');if(shapeFrame){cancelAnimationFrame(shapeFrame);shapeFrame=null}shapeProgress=0}},reduceMotion()?0:330);
 if(closeOriginal){
  // Close the underlying memory panel synchronously. The legacy navMap click can
  // defer its class mutation and race a subsequent iOS reopen gesture.
  const nav=document.getElementById('navMap');
  nav?.click();
 }
}
function sync(){
 scheduled=false;
 if(!sheet.classList.contains('visible')){dismissedId='';if(!root.hidden&&!root.classList.contains('is-closing'))hide();return}
 const p=state();if(!p){if(!root.hidden)hide();return}
 if(root.hidden||shownId!==p.id||root.classList.contains('is-closing')){show(p);return}
 drawBrief(p);drawMedia(p);drawGuides(p);resizeShapes();
}
function scheduleSync(){if(scheduled)return;scheduled=true;requestAnimationFrame(sync)}
new MutationObserver(scheduleSync).observe(sheet,{attributes:true,attributeFilter:['class'],childList:false,subtree:false});
document.addEventListener('atlas:memory-open',()=>{dismissedId='';scheduleSync()});
backdrop.addEventListener('click',()=>hide(true));star.addEventListener('click',()=>hide(true));
// Touch outside the cards should dismiss with the same spring return as tapping the star.
root.addEventListener('pointerdown',event=>{if(event.target===root)hide(true)});
// iOS Safari changes the visual viewport when browser chrome collapses or orientation changes.
// Recompute the four real SVG silhouettes after CSS viewport dimensions settle.
// ResizeObserver catches font loading, card content changes and browser UI resizing
// that do not always dispatch a window resize event on iOS Safari.
let resizeFrame=null;
function queueShapeResize(){
 if(root.hidden||resizeFrame!==null)return;
 resizeFrame=requestAnimationFrame(()=>{resizeFrame=null;resizeShapes()});
}
if(typeof ResizeObserver!=='undefined'){
 const shapeObserver=new ResizeObserver(queueShapeResize);
 for(const {card} of cards.values())shapeObserver.observe(card);
}
window.addEventListener('resize',queueShapeResize,{passive:true});
window.visualViewport?.addEventListener('resize',queueShapeResize,{passive:true});
window.addEventListener('orientationchange',()=>requestAnimationFrame(resizeShapes),{passive:true});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!root.hidden&&!document.getElementById('editor')?.open){event.preventDefault();hide(true)}});
scheduleSync();
})();
