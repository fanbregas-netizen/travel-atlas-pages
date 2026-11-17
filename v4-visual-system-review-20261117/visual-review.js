/* V4 independent true-product visual comparison. No product DOM duplication. */
(()=>{
'use strict';
if(document.getElementById('visualReviewControl'))return;
const path='/travel-atlas-pages/v4-visual-system-review-20261117/';
const key='__fp_v4_visual_20261117_mode';
const params=new URLSearchParams(location.search);
let mode=(params.get('visual')==='before'||params.get('visual')==='after')?params.get('visual'):(()=>{try{return sessionStorage.getItem(key)==='before'?'before':'after'}catch(_){return 'after'}})();
function apply(value){
 mode=value==='before'?'before':'after';
 document.documentElement.classList.toggle('visual-after',mode==='after');
 try{sessionStorage.setItem(key,mode)}catch(_){}
 document.querySelectorAll('#visualReviewControl [data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 const status=document.getElementById('visualReviewStatus');
 if(status)status.textContent=mode==='before'?'当前：现款原始样式':'当前：收藏卡片统一规范';
}
const root=document.createElement('aside');
root.id='visualReviewControl';
root.setAttribute('aria-label','真实产品改前改后视觉验收');
root.dataset.open='false';
root.innerHTML='<div class="vr-toggle" role="group" aria-label="切换同一真实产品的两套样式">'+
 '<button type="button" data-mode="before" aria-pressed="false">改前</button>'+
 '<button type="button" data-mode="after" aria-pressed="false">改后</button>'+
 '<button type="button" class="vr-open" aria-expanded="false" aria-controls="visualReviewMenu">视觉对照 ▾</button></div>'+
 '<div class="vr-menu" id="visualReviewMenu"><p id="visualReviewStatus"></p>'+
 '<p>直接操作原版产品；切换样式不重置当前卡片、拖动位置与内容。进入其他页面仍可继续切换。</p>'+
 '<div class="vr-links"><a data-nav="index.html" href="'+path+'index.html">地图首页</a><button type="button" data-act="fav">我的收藏</button><button type="button" data-act="search">搜索</button><a data-nav="journey.html" href="'+path+'journey.html">C V5 路线</a></div>'+
 '</div>';
function navigate(file){location.assign(path+file+'?visual='+encodeURIComponent(mode));}
root.addEventListener('click',ev=>{
 const btn=ev.target.closest('button,a');if(!btn)return;
 if(btn.dataset.mode){apply(btn.dataset.mode);return}
 if(btn.classList.contains('vr-open')){const open=root.dataset.open!=='true';root.dataset.open=String(open);btn.setAttribute('aria-expanded',String(open));return}
 if(btn.dataset.nav){ev.preventDefault();navigate(btn.dataset.nav);return}
 if(btn.dataset.act==='fav'){if(!document.getElementById('dockStars'))return;document.getElementById('dockStars').click();root.dataset.open='false';root.querySelector('.vr-open')?.setAttribute('aria-expanded','false');return}
 if(btn.dataset.act==='search'){const anchor=document.getElementById('fpTopSearch')||document.getElementById('searchInput');anchor?.click();anchor?.focus?.();root.dataset.open='false';root.querySelector('.vr-open')?.setAttribute('aria-expanded','false')}
});
document.body.appendChild(root);
apply(mode);
})();
