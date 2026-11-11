/* Footprint Map V4 · Option A: mini POI callout first, saved star → collage.
   Original four-vector popover remains intact and can be restored in the preview. */
(()=>{'use strict';
 const DB='private-travel-footprints-v1-v4-real-e2e-review';
 const $=id=>document.getElementById(id);
 let root=null, panel=null, currentId='', viewer=null, videoUrls=[];
 let legacy=true;
 try{legacy=sessionStorage.getItem('atlas-popover-view')!=='collage'}catch{}
 window.__atlasPreferCollage=!legacy;
 const safeUrl=src=>{if(typeof src!=='string')return '';if(/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(src))return src;try{const u=new URL(src);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}};
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
 const num=p=>Array.isArray(p)?p:[];
 function getPlace(id){return new Promise(resolve=>{if(!id)return resolve(null);try{const r=indexedDB.open(DB,1);r.onerror=()=>resolve(null);r.onsuccess=()=>{const db=r.result;if(!db.objectStoreNames.contains('places')){db.close();resolve(null);return}const tx=db.transaction('places','readonly'),q=tx.objectStore('places').get(id);q.onsuccess=()=>{db.close();resolve(q.result||null)};q.onerror=()=>{db.close();resolve(null)}}}catch{resolve(null)}})}
 async function loadPlace(id){let found=await getPlace(id);if(found)return found;try{const a=JSON.parse(localStorage.getItem('travel-places-v4-real-e2e-review')||'[]');if(Array.isArray(a))found=a.find(p=>p.id===id)}catch{}return found||null}
 function decorate(){
  if(root)return;
  root=el('section','fp-collage-root');root.id='fpStarCollage';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','星标地点拼贴详情');
  const shade=el('button','fp-collage-shade');shade.type='button';shade.setAttribute('aria-label','关闭地点卡片');shade.onclick=close;
  panel=el('article','fp-collage-card');panel.tabIndex=-1;
  root.append(shade,panel);document.body.append(root);
  const four=el('button','fp-four-return','返回拼贴版');four.type='button';four.id='fpReturnCollage';four.hidden=true;
  four.onclick=()=>{setMode('collage');const selected=window.__atlasOrbitState?.();if(selected?.id){document.dispatchEvent(new CustomEvent('atlas:memory-open',{detail:{id:selected.id}}))}};
  document.body.append(four);
 }
 function clearVideos(){for(const u of videoUrls)try{URL.revokeObjectURL(u)}catch{}videoUrls=[]}
 function close(){if(!root||root.hidden)return;root.hidden=true;root.classList.remove('fp-visible');document.body.classList.remove('atlas-collage-active');currentId='';clearVideos();const b=$('closeMemory');if(b&&$('memorySheet')?.classList.contains('visible'))b.click();else document.dispatchEvent(new CustomEvent('atlas:collage-closed'))}
 function setMode(m){legacy=m==='four';window.__atlasPreferCollage=!legacy;try{sessionStorage.setItem('atlas-popover-view',legacy?'four':'collage')}catch{};if(root&&!root.hidden){root.hidden=true;document.body.classList.remove('atlas-collage-active');currentId='';clearVideos()}
  const back=$('fpReturnCollage');if(back)back.hidden=!legacy||!$('memorySheet')?.classList.contains('visible');
  if(legacy){document.dispatchEvent(new CustomEvent('atlas:memory-open'))}else{const p=window.__atlasOrbitState?.();if(p?.id)show(p.id)}
 }
 function action(text,cb,cls=''){const b=el('button','fp-collage-action '+cls,text);b.type='button';b.onclick=cb;return b}
 function openMedia(index){const buttons=[...document.querySelectorAll('#memorySheet [data-action="photo"]')];if(buttons[index])buttons[index].click();else{const p=$('fpStarCollage');const n=p?.querySelectorAll('.fp-collage-tile img')?.[index];if(n)window.open(n.src,'_blank','noopener,noreferrer')}}
 function render(place){panel.replaceChildren();clearVideos();
  const header=el('div','fp-collage-header'),title=el('div','fp-collage-title');title.append(el('span','fp-collage-kicker','FOOTPRINT MAP · MY PLACE'),el('h2','',place.title||place.name||'收藏地点'));
  const closeBtn=el('button','fp-collage-x','×');closeBtn.type='button';closeBtn.setAttribute('aria-label','关闭地点拼贴');closeBtn.onclick=close;header.append(title,closeBtn);panel.append(header);
  const brief=el('div','fp-collage-brief');brief.append(el('span','fp-collage-section','01 / BRIEF · 为什么想去'),el('p','',String(place.note||place.brief||'').replace(/^原高德地址[：:][^\n]*\n?/,'').trim()||'还没有 Brief。可以先写下为什么想去这个地方。'));panel.append(brief);
  const grid=el('div','fp-collage-media'),media=[...num(place.photos).map(p=>({kind:'photo',src:safeUrl(p?.src)})).filter(p=>p.src),...num(place.videos).map(p=>({kind:'video',value:p}))];
  const mediaHead=el('div','fp-collage-section-row');mediaHead.append(el('span','fp-collage-section','02 / PHOTO & VIDEO · 旅行影像'),el('span','fp-collage-count',media.length+' 项'));panel.append(mediaHead);
  if(media.length){media.slice(0,7).forEach((item,i)=>{const tile=el('button','fp-collage-tile '+(i===0?'lead':''));tile.type='button';tile.setAttribute('aria-label','查看第 '+(i+1)+' 个媒体');if(item.kind==='photo'){const image=el('img');image.src=item.src;image.alt='旅行照片 '+(i+1);image.loading='lazy';tile.append(image)}else{tile.classList.add('video');tile.append(el('span','fp-play','▶'));const v=item.value;const bytes=v?.bytes;try{if(bytes){const blob=new Blob([bytes],{type:v.type||'video/mp4'});const url=URL.createObjectURL(blob);videoUrls.push(url);const vid=el('video');vid.muted=true;vid.playsInline=true;vid.preload='metadata';vid.src=url;tile.prepend(vid)}}catch{}}tile.onclick=()=>openMedia(i);grid.append(tile)});if(media.length>7)grid.append(el('span','fp-collage-more','＋'+(media.length-7)))}
  else grid.append(action('＋ 添加第一张旅行照片或视频',()=>window.__footprintFlow?.open?.('media',place.id),'fp-collage-empty'));
  panel.append(grid);
  const saved=[...num(place.references),...num(place.guides)];const sources=saved.map(r=>({url:typeof r==='string'?r:r?.url||r?.link,title:typeof r==='object'?r?.title:''})).filter(r=>{try{return ['http:','https:'].includes(new URL(r.url).protocol)}catch{return false}});
  if(sources.length){const links=el('div','fp-collage-sources');links.append(el('span','fp-collage-section','03 / INSPIRATION · 灵感来源'));for(const s of sources.slice(0,4)){const a=el('a','fp-collage-source',s.title||new URL(s.url).hostname);a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';links.append(a)}panel.append(links)}
  const foot=el('div','fp-collage-actions');foot.append(
   action('编辑 Brief',()=>{const b=$('memoryNote')?.querySelector('.memo-edit');if(b)b.click();else window.__footprintFlow?.open?.('sources',place.id)}),
   action('保存灵感',()=>window.__footprintFlow?.open?.('sources',place.id)),
   action('＋ 影像',()=>window.__footprintFlow?.open?.('media',place.id)),
   action('规划旅行',()=>{$('atlasJourneyEntry')?.click()}),
   action('高德导航',()=>{$('memoryRoute')?.click()}),
   action('对比原四向版',()=>setMode('four'),'fp-collage-compare'));
  panel.append(foot)
 }
 async function show(id){if(window.__atlasPreferCollage!==true)return;decorate();const place=await loadPlace(id);if(!place||!place.starred&&place.starred===false||window.__atlasPreferCollage!==true||!$('memorySheet')?.classList.contains('visible'))return;const firstOpen=root.hidden||currentId!==id;currentId=id;render(place);root.hidden=false;document.body.classList.add('atlas-collage-active');requestAnimationFrame(()=>{if(!root.hidden){root.classList.add('fp-visible');panel.focus({preventScroll:true});if(firstOpen)window.__atlasReframeForCollage?.(id)}})}
 function handleEvent(e){if(window.__atlasPreferCollage!==true){const back=$('fpReturnCollage');if(back)back.hidden=false;return}const id=e?.detail?.id||window.__atlasOrbitState?.()?.id;if(id)show(id)}
 function init(){decorate();$('fpReturnCollage').hidden=true;document.addEventListener('atlas:memory-open',handleEvent);window.addEventListener('atlas:source-updated',()=>{if(currentId)show(currentId)});
 const memory=$('memorySheet');if(memory)new MutationObserver(()=>{if(!memory.classList.contains('visible')){const back=$('fpReturnCollage');if(back)back.hidden=true}if(!memory.classList.contains('visible')&&root&&!root.hidden){root.hidden=true;root.classList.remove('fp-visible');document.body.classList.remove('atlas-collage-active');currentId='';clearVideos()}}).observe(memory,{attributes:true,attributeFilter:['class']});
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&root&&!root.hidden){e.preventDefault();close()}});
 window.__footprintCollage={open:show,close,setMode};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();