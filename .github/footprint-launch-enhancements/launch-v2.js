(()=>{'use strict';
const boot=()=>{
 const $=s=>document.querySelector(s),section=$('#page-map'),old=section?.querySelector('.map-layout');
 if(!old)return;
 const scenes=[
 ['真实地图','完整底图与黄星收藏','assets/actual-map.webp'],
 ['地点详情','地图选中黄星后展开卡片','assets/phone_02.webp'],
 ['路线连线','收藏地点组成完整行程','assets/phone_09.webp']
 ];
 section.querySelector('.chapter-head h2').textContent='先看地图。';
 section.querySelector('.chapter-head p').textContent='底图、黄星、地点卡片与路线。';
 const board=document.createElement('div');board.className='release-map-board';
 board.innerHTML='<div class="release-map-title"><div><small>真实产品界面</small><h3 id="release-map-name">真实地图</h3><p id="release-map-desc">完整底图与黄星收藏</p></div><span id="release-map-count">01 / 03</span></div><button type="button" id="release-map-image" aria-label="放大地图实拍画面"><img id="release-map-img" alt="Footprint Map 实际地图画面" src="assets/actual-map.webp"><span aria-hidden="true">↗</span></button><div class="release-map-actions"><div id="release-map-tabs" role="group" aria-label="地图画面切换"></div><div class="release-map-arrows"><button id="release-map-prev" type="button" aria-label="上一张地图">←</button><button id="release-map-next" type="button" aria-label="下一张地图">→</button></div></div>';
 old.replaceChildren(board);old.classList.add('release-map-layout');
 let i=0;const tabs=$('#release-map-tabs');
 scenes.forEach((s,k)=>{const b=document.createElement('button');b.type='button';b.textContent=s[0];b.addEventListener('click',()=>show(k));tabs.append(b)});
 function show(n){i=(n+scenes.length)%scenes.length;let s=scenes[i];$('#release-map-name').textContent=s[0];$('#release-map-desc').textContent=s[1];$('#release-map-img').src=s[2];$('#release-map-img').alt=s[0]+'：Footprint Map 真实界面';$('#release-map-count').textContent='0'+(i+1)+' / 03';tabs.querySelectorAll('button').forEach((b,k)=>{b.classList.toggle('selected',k===i);b.setAttribute('aria-pressed',String(k===i))})}
 $('#release-map-prev').addEventListener('click',()=>show(i-1));$('#release-map-next').addEventListener('click',()=>show(i+1));
 $('#release-map-image').addEventListener('click',()=>{const dialog=$('#lightbox');$('#lightbox-image').src=scenes[i][2];$('#lightbox-caption').textContent=scenes[i][1];if(dialog&&!dialog.open)dialog.showModal()});
 let x=0,y=0;const frame=$('#release-map-image');
 frame.addEventListener('touchstart',e=>{if(e.touches.length===1){x=e.touches[0].clientX;y=e.touches[0].clientY}},{passive:true});
 frame.addEventListener('touchend',e=>{if(e.changedTouches.length!==1)return;let dx=e.changedTouches[0].clientX-x,dy=e.changedTouches[0].clientY-y;if(Math.abs(dx)>70&&Math.abs(dx)>1.7*Math.abs(dy)){e.preventDefault();e.stopPropagation();show(i+(dx<0?1:-1))}},{passive:false});
 show(0);
 const h=section.querySelector('.library-head h3');if(h)h.innerHTML='原版图标 <small>60</small>';
 const note=section.querySelector('.source-note');if(note)note.textContent='图标均采用产品原版 SVG，没有重新设计。';
 const content=$('#page-content'),oldStrip=content?.querySelector('.platforms');if(!content||!oldStrip)return;
 oldStrip.remove();
 const platforms=[
 ['小红书','旅行笔记','已在原始录屏中展示笔记跳转。',true],
 ['哔哩哔哩','旅行视频','已在原始录屏中展示视频跳转。',true],
 ['微信公众号','图文攻略','可收藏文章网址；实际打开方式由平台决定。',false],
 ['抖音','短视频攻略','可关联公开分享链接；跳转以平台支持为准。',false],
 ['携程旅行','目的地攻略','可关联旅行攻略网址；未虚构跳转操作。',false]
 ];
 const panel=document.createElement('section');panel.className='release-links';panel.innerHTML='<div class="release-links-title"><small>站外攻略</small><h3>攻略，和地点放在一起。</h3><p>保存链接，点击查看原文。</p></div><div class="release-platform-tabs" role="group" aria-label="攻略来源"></div><div class="release-platform-info" aria-live="polite"><div><strong id="release-link-name">小红书</strong><span id="release-link-type">旅行笔记</span></div><p id="release-link-desc"></p><small id="release-link-status"></small></div><p class="release-disclaimer">支持关联站外网址，不代表与上述平台建立官方 API 合作。</p>';
 content.append(panel);
 const pTabs=panel.querySelector('.release-platform-tabs');
 platforms.forEach((p,k)=>{let b=document.createElement('button');b.type='button';b.textContent=p[0];b.addEventListener('click',()=>choose(k));pTabs.append(b)});
 function choose(k){let p=platforms[k];$('#release-link-name').textContent=p[0];$('#release-link-type').textContent=p[1];$('#release-link-desc').textContent=p[2];$('#release-link-status').textContent=p[3]?'录屏已演示':'通用网址关联';pTabs.querySelectorAll('button').forEach((b,n)=>{b.classList.toggle('selected',n===k);b.setAttribute('aria-pressed',String(n===k))})}
 choose(0);content.querySelector('.chapter-head h2').textContent='地点，承载旅行内容。';
 const cta=$('[data-go="origin"].simple-link');if(cta){cta.dataset.go='map';cta.innerHTML='探索地图 <span aria-hidden="true">↗</span>'}
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();