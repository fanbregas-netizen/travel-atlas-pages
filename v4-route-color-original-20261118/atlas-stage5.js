/* Travel Atlas V4 · Stage 5 experiential pass.
   Full-bleed travel gallery, kinetic touch, photographic filmstrip and iOS-safe insets.
   Preserves the approved map and four independent SVG orbit cards. */
(()=>{
 'use strict';
 const viewer=document.getElementById('viewer'),picture=document.getElementById('viewerImage');
 const video=document.getElementById('viewerVideo'),close=document.getElementById('closeViewer');
 const editor=document.getElementById('editor');
 if(!viewer||!picture||!video||!close||!editor)return;
 viewer.setAttribute('role','dialog');viewer.setAttribute('aria-modal','true');
 viewer.setAttribute('aria-label','旅行照片与视频');close.setAttribute('aria-label','返回旅行地图');
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const viewport=window.visualViewport;
 function syncViewport(){
   if(viewport)document.documentElement.style.setProperty('--atlas-visual-height',Math.round(viewport.height)+'px');
   if(editor.open&&editor.contains(document.activeElement)&&/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||'')){
     document.activeElement.scrollIntoView({block:'nearest',behavior:'instant'});
   }
 }
 viewport?.addEventListener('resize',syncViewport,{passive:true});
 viewport?.addEventListener('scroll',syncViewport,{passive:true});syncViewport();
 editor.addEventListener('focusin',event=>{if(event.target.matches('input,textarea'))requestAnimationFrame(syncViewport)});
 const rail=document.createElement('div');rail.id='atlasFilmstrip';rail.className='atlas-filmstrip';
 rail.setAttribute('role','group');rail.setAttribute('aria-label','旅行照片与视频缩略图');
 const filmLabel=document.createElement('span');filmLabel.className='atlas-film-label';filmLabel.textContent='TRAVEL MEMORIES';
 const filmList=document.createElement('div');filmList.className='atlas-film-list';
 rail.append(filmLabel,filmList);viewer.append(rail);
 const hint=document.createElement('span');hint.className='atlas-gallery-hint';hint.textContent='左右滑动浏览 · 向下轻扫返回';
 viewer.append(hint);
 let start=null,pinch=null,zoom=1,ignoreTapUntil=0,wasVisible=false,focusReturn=null,mediaKey='',lastTap=null;
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const setZoom=n=>{zoom=clamp(n,1,3.5);viewer.style.setProperty('--atlas-photo-zoom',String(zoom));viewer.classList.toggle('is-zoomed',zoom>1.01)};
 const distance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
 const navigation=direction=>document.getElementById(direction>0?'viewerNext':'viewerPrev')?.click();
 function resetPull(){viewer.style.setProperty('--atlas-pull','0px');viewer.style.setProperty('--atlas-pull-scale','1');viewer.style.setProperty('--atlas-pull-dim','1')}
 function captionIndex(){const m=(document.getElementById('viewerCaption')?.textContent||'').match(/^(\d+)\s*\/\s*(\d+)/);return m?{index:+m[1]-1,total:+m[2]}:{index:0,total:0}}
 function syncFilmstrip(){
   if(!viewer.classList.contains('visible'))return;
   const {index,total}=captionIndex();
   const sources=[...document.querySelectorAll('#memorySheet .atlas-photo[data-action="photo"]')].sort((a,b)=>Number(a.dataset.idx)-Number(b.dataset.idx));
   const ids=sources.map(n=>n.dataset.id+'-'+n.dataset.idx).join('|');
   if(mediaKey!==ids||filmList.children.length!==sources.length){
     mediaKey=ids;filmList.replaceChildren();
     sources.forEach((node,i)=>{
       const b=document.createElement('button');b.type='button';b.className='atlas-film-item';
       b.dataset.index=String(i);b.setAttribute('aria-label','查看第 '+(i+1)+' 项影像');
       const img=node.querySelector('img');
       if(img?.src){const frame=document.createElement('img');frame.src=img.src;frame.alt='';frame.loading='lazy';b.append(frame)}
       else{const badge=document.createElement('span');badge.className='atlas-film-video';badge.textContent='▶';b.append(badge)}
       b.addEventListener('click',()=>{
         const current=captionIndex().index,diff=i-current;
         const step=diff>0?'viewerNext':'viewerPrev';
         for(let x=0;x<Math.abs(diff);x++)document.getElementById(step)?.click();
       });
       filmList.append(b);
     });
   }
   for(const b of filmList.children){
     const active=Number(b.dataset.index)===index;
     b.classList.toggle('is-current',active);
     if(active){b.setAttribute('aria-current','true');if(!reduced())b.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'})}
     else b.removeAttribute('aria-current');
   }
   rail.hidden=total<2;viewer.style.setProperty('--atlas-gallery-progress',total?String((index+1)/total):'0');
 }
 function animateChange(){
   if(reduced())return;
   const target=picture.style.display==='none'?video:picture;
   target.classList.remove('atlas-slide-in');
   void target.offsetWidth;
   target.classList.add('atlas-slide-in');
 }
 function viewerChanged(){
   const open=viewer.classList.contains('visible');
   if(open&&!wasVisible){
     focusReturn=document.activeElement;viewer.classList.remove('chrome-hidden');
     mediaKey='';setZoom(1);resetPull();syncFilmstrip();
     requestAnimationFrame(()=>close.focus({preventScroll:true}));
   }
   if(!open&&wasVisible){
     video.pause();setZoom(1);resetPull();mediaKey='';pinch=null;start=null;
     viewer.classList.remove('chrome-hidden');
     if(focusReturn?.isConnected)focusReturn.focus({preventScroll:true});
     // Return to the same saved destination's four-card memory view, not a dead end.
     if(document.getElementById('memorySheet')?.classList.contains('visible')){
       document.dispatchEvent(new CustomEvent('atlas:memory-open'));
     }
   }
   wasVisible=open;document.body.classList.toggle('atlas-viewer-open',open);
 }
 new MutationObserver(viewerChanged).observe(viewer,{attributes:true,attributeFilter:['class']});
 new MutationObserver(()=>{if(viewer.classList.contains('visible')){setZoom(1);syncFilmstrip();animateChange()}})
   .observe(document.getElementById('viewerCaption'),{childList:true,characterData:true,subtree:true});
 viewer.addEventListener('touchstart',event=>{
   if(!viewer.classList.contains('visible'))return;
   if(event.touches.length===2&&picture.style.display!=='none'){
     pinch={distance:distance(event.touches[0],event.touches[1]),zoom};start=null;return;
   }
   if(event.touches.length!==1||event.target.closest('button,.atlas-filmstrip')||zoom>1.01){start=null;return}
   const t=event.touches[0];start={x:t.clientX,y:t.clientY,time:performance.now(),onVideo:!!event.target.closest('video')};
 },{passive:true});
 viewer.addEventListener('touchmove',event=>{
   if(pinch&&event.touches.length===2){
     const next=pinch.zoom*distance(event.touches[0],event.touches[1])/Math.max(1,pinch.distance);
     setZoom(next);ignoreTapUntil=performance.now()+450;return;
   }
   if(!start||event.touches.length!==1)return;
   const t=event.touches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;
   if(dy>0&&dy>Math.abs(dx)*1.3){
     const pull=Math.min(210,dy*.76);
     viewer.style.setProperty('--atlas-pull',pull+'px');
     viewer.style.setProperty('--atlas-pull-scale',String(1-Math.min(.16,pull/1100)));
     viewer.style.setProperty('--atlas-pull-dim',String(1-Math.min(.36,pull/600)));
   }
 },{passive:true});
 viewer.addEventListener('touchcancel',()=>{start=null;pinch=null;resetPull()},{passive:true});
 viewer.addEventListener('touchend',event=>{
   if(pinch){if(event.touches.length<2)pinch=null;ignoreTapUntil=performance.now()+400;return}
   if(!start||event.changedTouches.length!==1){start=null;resetPull();return}
   const g=start;start=null;const t=event.changedTouches[0],dx=t.clientX-g.x,dy=t.clientY-g.y;
   resetPull();
   if(Math.abs(dx)>16||Math.abs(dy)>16)ignoreTapUntil=performance.now()+420;
   if(dy>110&&dy>Math.abs(dx)*1.3){close.click();return}
   if(Math.abs(dx)<14&&Math.abs(dy)<14&&!g.onVideo){
     const now=performance.now();
     if(lastTap&&now-lastTap.time<320&&Math.hypot(t.clientX-lastTap.x,t.clientY-lastTap.y)<38){
       setZoom(zoom>1?1:2.3);lastTap=null;ignoreTapUntil=now+420;
     }else lastTap={time:now,x:t.clientX,y:t.clientY};
   }else lastTap=null;
   // Existing image touch handler changes the current photo. Video uses the same navigation buttons.
   if(g.onVideo&&Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.25)document.getElementById(dx<0?'viewerNext':'viewerPrev')?.click();
 },{passive:true});
 picture.addEventListener('click',()=>{
   if(performance.now()<ignoreTapUntil)return;
   viewer.classList.toggle('chrome-hidden');
 });
 picture.addEventListener('dblclick',event=>{event.preventDefault();setZoom(zoom>1?1:2.2);ignoreTapUntil=performance.now()+350});
 document.addEventListener('keydown',e=>{
   if(!viewer.classList.contains('visible'))return;
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close.click();return}
   if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
     if(e.target.matches('input,textarea,[contenteditable="true"]'))return;
     e.preventDefault();e.stopImmediatePropagation();navigation(e.key==='ArrowRight'?1:-1);return;
   }
   if(e.key==='Tab'){
     const focusables=[...viewer.querySelectorAll('button:not([disabled]):not([hidden]),[tabindex="0"]')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
     if(!focusables.length)return;
     const first=focusables[0],last=focusables[focusables.length-1];
     if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
     else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
   }
 },true);
 viewerChanged();
})();
