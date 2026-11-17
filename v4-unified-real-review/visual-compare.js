/* Real V4 UI acceptance-only before/after switch.
   Does not patch existing event handlers, controllers, IndexedDB or route state. */
(()=>{'use strict';
const root=document.documentElement;
const before=new URL(location.href).searchParams.get('compare')==='before';
let after=!before;
const mount=()=>{
 if(document.getElementById('fpVisualReviewToggle'))return;
 const box=document.createElement('div');
 box.id='fpVisualReviewToggle';
 box.className='fp-review-toggle';
 box.setAttribute('aria-label','视觉统一验收对照');
 box.innerHTML='<button type="button" data-compare="before" aria-pressed="false">现款</button><button type="button" data-compare="after" aria-pressed="true">统一后</button><button type="button" class="fp-review-hide" aria-label="收起对照工具">×</button><button type="button" class="fp-review-show" aria-label="展开对照工具">对照</button>';
 const original=box.querySelector('[data-compare="before"]'),updated=box.querySelector('[data-compare="after"]');
 function render(){
  root.classList.toggle('fp-review-updated',after);
  original.setAttribute('aria-pressed',String(!after));
  updated.setAttribute('aria-pressed',String(after));
  box.setAttribute('data-current',after?'after':'before');
 }
 original.addEventListener('click',()=>{after=false;render()});
 updated.addEventListener('click',()=>{after=true;render()});
 box.querySelector('.fp-review-hide').addEventListener('click',()=>{box.dataset.collapsed='true'});
 box.querySelector('.fp-review-show').addEventListener('click',()=>{box.dataset.collapsed='false'});
 box.addEventListener('pointerdown',e=>e.stopPropagation());
 box.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
 document.body.appendChild(box);
 render();
};
root.classList.toggle('fp-review-updated',after);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
})();