/* Stage1.29: no duplicate top dock; bottom Map entry opens the existing search sheet. */
(()=>{'use strict';
 const init=()=>{
  const dock=document.getElementById('dockMap'),search=document.getElementById('searchDock');
  const input=document.getElementById('searchInput');
  if(!dock||!search||dock.dataset.fp29Wired)return;
  dock.dataset.fp29Wired='yes';
  dock.title='地图 · 搜索目的地';dock.setAttribute('aria-label','打开地图搜索');
  dock.setAttribute('aria-haspopup','dialog');dock.setAttribute('aria-controls','fpSearchSheet');
  dock.addEventListener('click',event=>{
   if(window.__footprintHome?.openSearch){
    event.preventDefault();event.stopImmediatePropagation();
    window.__atlasDock?.closePop?.();window.__atlasTripPicker?.cancel?.();
    const routes=document.getElementById('atlasRoutesSheet');
    if(routes?.classList.contains('open'))routes.querySelector('.rs-close')?.click();
    window.__footprintHome.openSearch();
   }
  },true);
  document.addEventListener('keydown',event=>{
   if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();window.__footprintHome?.openSearch?.();
   }
  });
  // Make sure route and favourites return to the right highlighting.
  const route=document.getElementById('dockRoute'),stars=document.getElementById('dockStars');
  for(const button of [route,stars])button?.addEventListener('click',()=>dock.removeAttribute('aria-current'));
  document.addEventListener('atlas:memory-open',()=>dock.removeAttribute('aria-current'));
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
