/* Footprint Map V5 · local-only search inside the approved collection card.
 * This never invokes geocoding or touches private storage. Collection rows stay
 * mounted, so Safari does not decode/reflow hundreds of thumbnails each keypress.
 */
(()=>{'use strict';
 function init(){
  const drawer=document.getElementById('drawer');
  const list=document.getElementById('spotList');
  const box=document.getElementById('fpSavedSearch');
  const input=document.getElementById('fpSavedSearchInput');
  const clear=document.getElementById('fpSavedSearchClear');
  const meta=document.getElementById('fpSavedSearchMeta');
  const empty=document.getElementById('fpSavedSearchEmpty');
  if(!drawer||!list||!box||!input||!clear||!meta||!empty||box.dataset.bound)return;
  box.dataset.bound='yes';
  const normalize=s=>String(s??'').normalize('NFKC').toLocaleLowerCase().trim();
  const rows=()=>[...list.querySelectorAll(':scope > .spotrow')];
  const available=()=>drawer.classList.contains('fp30-detail')&&!drawer.classList.contains('fp30-routes')&&!list.hidden;
  let lastMode='',lastVisible=false;
  function apply(){
   const items=rows();
   const query=normalize(input.value);
   const terms=query.split(/\s+/).filter(Boolean);
   let matched=0;
   for(const row of items){
    const haystack=row.__fpSavedSearchText||normalize(row.textContent);
    const visible=!terms.length||terms.every(term=>haystack.includes(term));
    row.classList.toggle('fp-saved-search-miss',!visible);
    if(visible)matched++;
   }
   clear.hidden=!query;
   meta.hidden=!query;
   meta.textContent=query?'找到 '+matched+' 处收藏':'';
   empty.hidden=!query||matched>0||items.length===0;
   return {total:items.length,matched};
  }
  function reset(){
   if(input.value)input.value='';
   input.blur();
   apply();
  }
  function sync(){
   const mode=drawer.classList.contains('fp30-route-pick')?'pick':drawer.classList.contains('fp30-routes')?'routes':drawer.classList.contains('fp30-detail')?'places':'hub';
   const opened=drawer.classList.contains('visible');
   if((lastVisible&&!opened)||(lastMode==='places'&&mode!=='places'))reset();
   lastMode=mode;lastVisible=opened;
   box.hidden=!available()||rows().length===0;
   if(box.hidden){empty.hidden=true;return}
   apply();
  }
  input.addEventListener('input',()=>{
   apply();
   // Always show the start of matches, not the scrolled position of a past
   // item; do not retrigger the physical sheet's B05 spring.
   const viewport=list.getBoundingClientRect();
   if(viewport.top<box.getBoundingClientRect().bottom-2)drawer.scrollTop=Math.max(0,drawer.scrollTop-(box.getBoundingClientRect().bottom-viewport.top));
  });
  input.addEventListener('search',apply);
  input.addEventListener('keydown',e=>{
   if(e.key==='Escape'){
    e.preventDefault();e.stopPropagation();
    if(input.value){reset();input.focus({preventScroll:true})}
    else input.blur();
   }
   if(e.key==='Enter'){e.preventDefault();input.blur()}
  });
  clear.addEventListener('click',()=>{reset();input.focus({preventScroll:true})});
  // Observe only list child additions/removals and drawer mode/visibility;
  // row class toggles must not recursively trigger another full search.
  new MutationObserver(sync).observe(list,{childList:true});
  new MutationObserver(sync).observe(drawer,{attributes:true,attributeFilter:['class']});
  new MutationObserver(sync).observe(list,{attributes:true,attributeFilter:['hidden']});
  sync();
  window.__fpSavedSearchQA={
   getState:()=>({query:input.value,total:rows().length,shown:rows().filter(x=>!x.classList.contains('fp-saved-search-miss')).length,open:!box.hidden})
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
