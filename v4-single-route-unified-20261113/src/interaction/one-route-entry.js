/* Footprint Map V4 | 唯一路线入口。
 * 旧路线操作不再暴露或持有点击事件；只保留原 C V5。
 * 收藏库专注收藏，已存路线从 C V5 内部查看。
 */
(()=>{'use strict';
 if(window.__fpSingleRouteNavigation)return;
 const id='dockRoute',entry='./journey.html';
 const oldControls=[
  '#dockRoutePop','#atlasRoutesSheet','#atlasRoutesVeil',
  '#fp30Routes','#fpvRoutesTab','#fp30NewRoute',
  '#routeMapAction','#routeSearchAction','#routeSavedAction','#savedTripEntry',
  '#routeMapStrip','#tpBar','#drawerRouteList','#routePickConfirm',
  '#atlasJourneyEntry'
 ].join(',');
 const openRoute=()=>{location.assign(entry)};
 document.addEventListener('click',e=>{
  const button=e.target?.closest?.('#'+id);
  if(button){
   e.preventDefault();e.stopImmediatePropagation();
   openRoute();return;
  }
  // Deep legacy routes remain physically present for rollback, but no
  // old planner may be entered by an anchor, menu item, or delayed event.
  const legacy=e.target?.closest?.(oldControls);
  if(!legacy)return;
  const link=legacy.matches('a[href*="journey"],a[href*="route-view"]')?legacy:legacy.closest('a');
  if(link||legacy.id==='atlasJourneyEntry'){
   e.preventDefault();e.stopImmediatePropagation();openRoute();
  }else{
   e.preventDefault();e.stopImmediatePropagation();
  }
 },true);
 const hideOld=()=>{
  const node=document.getElementById(id);
  if(node){
   node.removeAttribute('aria-controls');
   node.removeAttribute('aria-expanded');
   node.setAttribute('aria-label','路线规划');
   node.setAttribute('title','路线规划');
  }
  document.body.classList.add('fp-single-route-owner');
  document.body.classList.remove('route-pick-active');
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hideOld,{once:true});else hideOld();
 window.__fpSingleRouteNavigation=Object.freeze({version:'唯一 C V5',open:openRoute});
})();
