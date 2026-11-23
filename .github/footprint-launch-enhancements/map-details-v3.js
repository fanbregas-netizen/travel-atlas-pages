/* Footprint Map release · 03 map detail story. Uses unchanged actual screenshots and source icons. */
(()=>{
'use strict';
function install(){
  const page=document.querySelector('#page-system');
  if(!page||page.querySelector('.detail-story'))return;
  const head=page.querySelector('.chapter-head');
  head.querySelector('.kicker').textContent='03 / 05  ·  细节';
  head.querySelector('h2').textContent='地图，值得细看。';
  head.querySelector('p').textContent='从底图，到每一颗星。';
  const scenes=[
   {title:'底图与地理层次',subtitle:'水域、道路与地形保持清晰的视觉秩序。',src:'assets/actual-map.webp',pos:'50% 31%',alt:'真实地图局部：蓝灰底图、水系与道路层级'},
   {title:'中文标注与原版 POI',subtitle:'地名自然融入地图，图标保留原有手绘线条。',src:'assets/actual-map.webp',pos:'53% 16%',alt:'真实地图局部：中文地名与湖泊道路；下方另列产品原版 SVG 图标',icons:true},
   {title:'黄星与地点卡片',subtitle:'收藏星标是地图上清楚而克制的视觉焦点。',src:'assets/phone_02.webp',pos:'50% 53%',alt:'真实产品画面：黄星选中后，地点详情卡片出现在地图上'},
   {title:'路线连线与气泡',subtitle:'站点、路线和路段提示，在地图上同时可读。',src:'assets/actual-route.webp',pos:'50% 21%',alt:'真实路线地图局部：黄色站点、连线、路线信息气泡'},
   {title:'地图与卡片层级',subtitle:'卡片展开时，仍能看见地图与行程关系。',src:'assets/phone_11.webp',pos:'50% 59%',alt:'真实产品界面：路线地图与底部查看行程卡片共存'}
  ];
  const story=document.createElement('section');
  story.className='detail-story';story.setAttribute('aria-label','地图视觉细节');
  story.innerHTML=`
   <div class="detail-story-top">
    <div class="detail-story-index" id="detail-story-index" aria-live="polite">01 <span>/ 05</span></div>
    <div class="detail-story-copy"><h3 id="detail-story-name"></h3><p id="detail-story-sub"></p></div>
    <div class="detail-story-arrows"><button type="button" id="detail-prev" aria-label="上一组地图细节">←</button><button type="button" id="detail-next" aria-label="下一组地图细节">→</button></div>
   </div>
   <button class="detail-story-image" type="button" id="detail-open" aria-label="放大查看真实地图画面">
     <img id="detail-photo" src="assets/actual-map.webp" alt="地图视觉细节" draggable="false" decoding="async" />
     <span class="detail-zoom" aria-hidden="true">↗</span>
   </button>
   <div class="detail-legend" id="detail-legend" hidden aria-label="产品原版 POI 图标">
     <span>原版 POI</span><div class="detail-legend-items">
       <div><img src="assets/icons/21_mountain.svg" alt=""/><small>山景</small></div>
       <div><img src="assets/icons/26_lake.svg" alt=""/><small>湖泊</small></div>
       <div><img src="assets/icons/47_coffee.svg" alt=""/><small>咖啡</small></div>
       <div><img src="assets/icons/45_museum.svg" alt=""/><small>博物馆</small></div>
     </div>
   </div>
   <div class="detail-story-rail" id="detail-rail" role="group" aria-label="选择地图细节"></div>
   <p class="detail-provenance">所有地图局部均来自实际产品画面，未重新绘制底图与图标。</p>`;
  head.after(story);
  const photo=story.querySelector('#detail-photo');
  const label=story.querySelector('#detail-story-name');
  const text=story.querySelector('#detail-story-sub');
  const index=story.querySelector('#detail-story-index');
  const rail=story.querySelector('#detail-rail');
  const legend=story.querySelector('#detail-legend');
  let active=0;
  scenes.forEach((s,i)=>{
    const button=document.createElement('button');button.type='button';button.className='detail-option';
    button.innerHTML=`<span class="detail-option-thumb"><img src="${s.src}" alt="" loading="lazy" style="object-position:${s.pos}"></span><span class="detail-option-text"><small>0${i+1}</small><strong>${s.title}</strong></span>`;
    button.addEventListener('click',()=>show(i));rail.append(button);
  });
  function show(num){
    active=(num+scenes.length)%scenes.length;
    const s=scenes[active];
    photo.src=s.src;photo.alt=s.alt;photo.style.objectPosition=s.pos;
    label.textContent=s.title;text.textContent=s.subtitle;
    index.innerHTML=`0${active+1} <span>/ 05</span>`;
    legend.hidden=!s.icons;
    [...rail.children].forEach((b,i)=>{b.classList.toggle('current',i===active);b.setAttribute('aria-pressed',String(i===active))});
    if(window.matchMedia('(max-width:820px)').matches) rail.children[active].scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});
  }
  story.querySelector('#detail-prev').addEventListener('click',()=>show(active-1));
  story.querySelector('#detail-next').addEventListener('click',()=>show(active+1));
  story.querySelector('#detail-open').addEventListener('click',()=>{
    const s=scenes[active],d=document.querySelector('#lightbox');if(!d)return;
    d.querySelector('#lightbox-image').src=s.src;
    d.querySelector('#lightbox-image').alt=s.alt;
    d.querySelector('#lightbox-caption').textContent=s.title+' · 产品真实画面';
    if(!d.open)d.showModal();
  });
  let x0=0,y0=0;
  const viewport=story.querySelector('#detail-open');
  viewport.addEventListener('touchstart',e=>{if(e.touches.length===1){x0=e.touches[0].clientX;y0=e.touches[0].clientY}},{passive:true});
  viewport.addEventListener('touchend',e=>{
    if(e.changedTouches.length!==1)return;
    const dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;
    if(Math.abs(dx)>52&&Math.abs(dx)>1.4*Math.abs(dy)){e.preventDefault();e.stopPropagation();show(active+(dx<0?1:-1))}
  },{passive:false});
  story.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();show(active+(e.key==='ArrowRight'?1:-1));
    }
  },true);
  const layout=page.querySelector('.system-layout'),palette=page.querySelector('.palette');
  if(layout&&palette){
    const details=document.createElement('details');details.className='detail-specs-disclosure';
    const summary=document.createElement('summary');summary.innerHTML='<span>控件、色彩与尺寸</span><span class="detail-spec-chevron" aria-hidden="true">＋</span>';
    details.append(summary,layout,palette);story.after(details);
  }
  show(0);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();