/* Footprint Map Stage1.24: interaction finishing, no separate user database. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const dock=$('appDock'),drawer=$('drawer'),sheet=$('memorySheet'),editor=$('editor');
if(dock){dock.setAttribute('aria-label','地图、收藏与路线');}
if(drawer){drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-label','我的收藏与路线');}
if($('dockRoute'))$('dockRoute').setAttribute('aria-haspopup','true');
if($('dockRoutePop'))$('dockRoutePop').setAttribute('role','group');
if($('toast'))$('toast').setAttribute('aria-live','polite');
// Keep map chrome distraction-free; version status remains available in the archive drawer.
if(drawer&&$('atlasVersionBadge'))drawer.append($('atlasVersionBadge'));
// Tapping outside search dismisses suggestions, without swallowing taps on map or results.
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#searchDock'))$('searchResults')?.classList.remove('visible')},{passive:true});
$('searchInput')?.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.stopPropagation();e.preventDefault();$('searchResults')?.classList.remove('visible');$('searchInput').blur()}
});
const closeIfOpen=()=>{
 if($('atlasUnstarDialog')?.open){$('atlasUnstarDialog').close();return true}
 if($('fpMediaViewer')){$('fpMediaViewer').querySelector('.fp-viewer-close')?.click();return true}
 if($('viewer')?.classList.contains('visible')){$('closeViewer')?.click();return true}
 if($('dockRoutePop')&&!$('dockRoutePop').hidden){window.__atlasDock?.closePop?.();return true}
 if(drawer?.classList.contains('visible')){$('closeDrawer')?.click();return true}
 if(sheet?.classList.contains('visible')){$('closeMemory')?.click();return true}
 if($('searchSheet')&&!$('searchSheet').hidden){window.__fpCloseSearch?.();return true}
 return false;
};
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented||editor?.open||$('atlasDiscardDialog')?.open||$('atlasDeleteDialog')?.open||$('amapSetup')?.open)return;if(closeIfOpen())e.preventDefault()});
/* Let iOS scroll form controls into view after the software keyboard changes viewport height. */
let raf=0;const viewport=window.visualViewport;
viewport?.addEventListener('resize',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(editor?.open&&document.activeElement?.matches('#editor input,#editor textarea'))document.activeElement.scrollIntoView({block:'nearest',behavior:'auto'})})},{passive:true});
})();
