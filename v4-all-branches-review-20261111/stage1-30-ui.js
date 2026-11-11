/* Stage1.30 – one map-first navigation, no duplicate saved-place stores.
   Search uses the existing geocoder; overviews use the existing fit-all map API;
   saved routes reuse travel-atlas-journeys-v1-v4-real-e2e-review via the existing route reader. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 let drawerWasOpen=false, viewToken=0;
 const savedPlaces=()=>{try{return (window.__atlasDemo?.getSaved?.()||[]).filter(x=>x.starred!==false)}catch{return []}};
 const closeRoute=()=>{window.__atlasDock?.closePop?.();const sheet=$('atlasRoutesSheet');if(sheet?.classList.contains('open'))sheet.querySelector('.rs-close')?.click()};
 function syncNav(){
   const search=document.body.classList.contains('fp-search-open');
   const drawer=$('drawer')?.classList.contains('visible');
   $('dockSearch')?.setAttribute('aria-expanded',String(search));
   for(const [id,active] of [['dockSearch',search],['dockStars',!!drawer],['dockRoute',!$('dockRoutePop')?.hidden]]){
    const button=$(id);button?.classList.toggle('active',active);if(button){if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')}
   }
 }
 async function updateCards(){
   const token=++viewToken;
   const places=savedPlaces();
   const first=$('fp30PlaceCount');if(first)first.textContent=places.length?`${places.length} 个收藏地点`:'想去和已到访的地方';
   try{const routes=await window.__atlasRoutesEntry?.list?.()||[];if(token===viewToken&&$('fp30RouteCount'))$('fp30RouteCount').textContent=routes.length?`${routes.length} 条已保存路线`:'查看规划好的行程'}catch{}
 }
 function showHub(){
   if(document.body.classList.contains('route-pick-active'))return;
   const d=$('drawer');if(!d)return;
   d.classList.remove('fp30-detail','fp30-routes','fp30-route-pick');d.classList.add('fp30-hub');
   $('fp30DetailHead').hidden=true;
   $('spotList').hidden=true;$('drawerRouteList').hidden=true;
   d.querySelector('.backuprow').hidden=true;d.querySelector('.footnote').hidden=true;
   updateCards();d.scrollTo?.({top:0,behavior:'instant'});
 }
 function showRoutePick(){
   const d=$('drawer');if(!d)return;
   d.classList.remove('fp30-hub','fp30-detail','fp30-routes');d.classList.add('fp30-route-pick');
   $('fp30DetailHead').hidden=true;$('spotList').hidden=false;$('drawerRouteList').hidden=true;
 }
 function showSection(section){
   const d=$('drawer');if(!d)return;
   d.classList.remove('fp30-hub','fp30-route-pick');d.classList.add('fp30-detail');d.classList.toggle('fp30-routes',section==='routes');
   $('fp30DetailHead').hidden=false;$('fp30DetailTitle').textContent=section==='routes'?'已保存路线':'收藏地点';
   $('fp30NewRoute').hidden=section!=='routes';
   d.querySelector('.backuprow').hidden=section==='routes';d.querySelector('.footnote').hidden=section==='routes';
   const old=$('saveBoxMenu')?.querySelector(`button[data-view="${section}"]`);
   // Reuse the existing list and IndexedDB loader rather than creating another one.
   if(old)old.click();else {$('spotList').hidden=section!=='places';$('drawerRouteList').hidden=section!=='routes';}
   if(section==='routes')$('spotList').hidden=true;else $('drawerRouteList').hidden=true;
   d.scrollTo?.({top:0,behavior:'smooth'});
 }
 function init(){
   const dock=$('appDock');if(!dock||!$('dockSearch'))return;
   // A full-width nav transforms into the existing search input in exactly the same place.
   const sheet=$('fpSearchSheet'),bar=sheet?.querySelector('.fp-search-bar'),cancel=sheet?.querySelector('.fp-search-close');
   if(bar&&cancel){cancel.textContent='取消';cancel.classList.add('fp30-search-cancel');cancel.setAttribute('aria-label','关闭搜索');bar.append(cancel);}
   $('dockSearch').addEventListener('click',e=>{
     e.preventDefault();closeRoute();$('closeDrawer')?.click();
     window.__footprintHome?.openSearch?.();syncNav();
   });
   $('dockMap').addEventListener('click',()=>{
     $('closeDrawer')?.click();window.__fpCloseSearch?.();closeRoute();
     // The original total-overview handler calls __atlasFitAll on this same click.
     if(!savedPlaces().length){const t=$('toast');if(t){t.textContent='还没有收藏地点，先搜索一个想去的地方';t.classList.add('visible');setTimeout(()=>t.classList.remove('visible'),2400)}}
     syncNav();
   });
   $('dockStars').addEventListener('click',()=>{window.__fpCloseSearch?.();closeRoute();if(!document.body.classList.contains('route-pick-active'))showHub();syncNav()});
   $('dockRoute').addEventListener('click',()=>{$('closeDrawer')?.click();window.__fpCloseSearch?.();syncNav()});
   $('fp30Places').addEventListener('click',()=>showSection('places'));
   $('fp30Routes').addEventListener('click',()=>showSection('routes'));
   $('fp30Back').addEventListener('click',showHub);
   const drawer=$('drawer');
   if(drawer){
     const observer=new MutationObserver(()=>{
       const visible=drawer.classList.contains('visible');
       if(visible&&!drawerWasOpen){if(document.body.classList.contains('route-pick-active'))showRoutePick();else showHub();}
       drawerWasOpen=visible;syncNav();
     });observer.observe(drawer,{attributes:true,attributeFilter:['class']});
     document.addEventListener('atlas:memory-open',syncNav);
   }
   // Explicit route selection is a specialized task; its rows remain directly accessible.
   const bodyWatch=new MutationObserver(()=>{
     if(document.body.classList.contains('route-pick-active')&&drawer?.classList.contains('visible'))showRoutePick();
     syncNav();
   });bodyWatch.observe(document.body,{attributes:true,attributeFilter:['class']});
   const searchWatch=new MutationObserver(syncNav);if(sheet)searchWatch.observe(sheet,{attributes:true,attributeFilter:['hidden']});
   document.addEventListener('keydown',e=>{
     if(e.key==='Escape'&&drawer?.classList.contains('visible'))$('closeDrawer')?.click();
   });
   showHub();syncNav();
   window.__fp30UI={showHub,showSection,updateCards,syncNav,version:'V4.Stage1.20261109.30'};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
