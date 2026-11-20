/* Footprint Map Stage1.25: state and accessibility polish only.
   Keeps the approved Stage1.24 navigation, gestures, databases and map layers. */
(()=>{'use strict';
const byId=id=>document.getElementById(id);
const body=document.body,drawer=byId('drawer'),routePop=byId('dockRoutePop');
const tabs=[byId('dockMap'),byId('dockStars'),byId('dockRoute')];
const syncDock=()=>{
  if(tabs.some(el=>!el))return;
  const route=!!(body.classList.contains('route-pick-active')||(routePop&&!routePop.hidden));
  const saved=!route&&!!(drawer?.classList.contains('visible'));
  const index=route?2:saved?1:0;
  tabs.forEach((el,i)=>{
    const current=i===index;
    el.classList.toggle('fp25-current',current);
    el.setAttribute('aria-pressed',String(current));
    el.setAttribute('aria-label',["地图总览","我的收藏","规划路线"][i]);
  });
};
const observer=new MutationObserver(syncDock);
if(drawer)observer.observe(drawer,{attributes:true,attributeFilter:['class']});
if(routePop)observer.observe(routePop,{attributes:true,attributeFilter:['hidden','class']});
observer.observe(body,{attributes:true,attributeFilter:['class']});
syncDock();
/* Clear focus on drawer dismissal so keyboard focus is not lost behind the map. */
if(drawer){
  drawer.addEventListener('transitionend',event=>{
    if(event.target!==drawer||drawer.classList.contains('visible'))return;
    if(drawer.contains(document.activeElement))byId('dockStars')?.focus({preventScroll:true});
  });
}
/* Keyboard shortcut applies only to the visible search field, never a photo/video editor. */
const input=byId('searchInput');
input?.setAttribute('enterkeyhint','search');
/* Create navigation semantics without changing the user's hand-drawn icon files. */
byId('appDock')?.setAttribute('aria-label','主导航：地图、收藏、路线');
/* Stage1.26: focus follows the editor's own scroller, never the map page.
   Avoid scrollIntoView() on the whole document (Safari sometimes jumps the
   background fixed map when a keyboard appears). Scroll only if obscured. */
const editor=byId('editor');
const editorScroller=editor?.querySelector('.editor-scroll');
function settleEditorFocus(){
  if(!editor?.open||!editorScroller)return;
  const target=editor.querySelector('input:focus,textarea:focus,select:focus');
  if(!target)return;
  const field=target.getBoundingClientRect();
  const pane=editorScroller.getBoundingClientRect();
  const viewport=window.visualViewport;
  const visibleTop=Math.max(pane.top+12,(viewport?.offsetTop||0)+12);
  const visibleBottom=Math.min(pane.bottom-72,(viewport?.offsetTop||0)+(viewport?.height||window.innerHeight)-16);
  if(visibleBottom<=visibleTop+40)return;
  if(field.top<visibleTop)editorScroller.scrollTop-=visibleTop-field.top;
  else if(field.bottom>visibleBottom)editorScroller.scrollTop+=field.bottom-visibleBottom;
}
editor?.addEventListener('focusin',event=>{
  if(!event.target?.matches?.('input,textarea,select'))return;
  requestAnimationFrame(settleEditorFocus);
});
window.visualViewport?.addEventListener('resize',()=>{
  if(editor?.open)requestAnimationFrame(settleEditorFocus);
},{passive:true});
})();
