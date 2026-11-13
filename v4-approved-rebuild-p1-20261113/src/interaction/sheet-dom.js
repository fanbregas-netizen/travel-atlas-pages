/* Opt-in bridge. The integration owner must remove legacy sheet listeners before mounting. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TravelAtlasSheetDOM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const INTERACTIVE = 'button:not([data-atlas-grip]),a,input,textarea,select,video,[contenteditable],.atlas-photo,.memory-strip,.memory-quickbar';
  const STAR = '[data-place-id],.atlas-bookmark-hit,.star-pin,.atlas-star-cluster';
  const closest = (target, selector) => target && typeof target.closest === 'function' ? target.closest(selector) : null;
  function connectExistingStarClicks(root, controller, selector) {
    if (!root || !controller) throw new TypeError('star container and controller required');
    const match = selector || '.atlas-bookmark-hit[data-place-id]';
    function onClick(event) {
      const star = closest(event.target, match);
      if (!star || !root.contains(star) || !star.dataset.placeId) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      controller.toggle(star.dataset.placeId);
    }
    root.addEventListener('click', onClick, true);
    return () => root.removeEventListener('click', onClick, true);
  }
  function connectSheetDOM(config) {
    const { controller, sheet, grip, scroll, closeButton, outside } = config || {};
    const header = config?.header || (typeof grip.closest==='function' ? grip.closest('.fp-card-header,.sheet-head,.sheet-header,.drawer-head') : null) || grip;
    if (!controller || !sheet || !grip) throw new TypeError('controller, sheet and grip required');
    const cleanups = [];
    const listen = (element, type, fn, options) => {
      if (!element) return;
      element.addEventListener(type, fn, options);
      cleanups.push(() => element.removeEventListener(type, fn, options));
    };
    let hideTimer=null;
    function render(state) {
      sheet.dataset.atlasSnap = state.sheet;
      if (state.selectedPlaceId) sheet.dataset.placeId = state.selectedPlaceId;
      else delete sheet.dataset.placeId;
      if (config.physicalMotion) {
        // V3 movement engine owns element visibility, dimensions and dismissal timing.
        // Keep its geometry intact while the shared controller updates state/ARIA.
        if (state.sheet!=='closed') sheet.hidden=false;
      } else if (state.sheet==='closed') {
        if (!sheet.hidden && sheet.classList && typeof setTimeout==='function') {
          sheet.classList.add('atlas-sheet-closing');
          if(hideTimer!==null)clearTimeout(hideTimer);
          hideTimer=setTimeout(()=>{
            if(controller.getState().sheet==='closed'){
              sheet.hidden=true;
              sheet.classList.remove('atlas-sheet-closing');
              sheet.style.removeProperty('height');
            }
            hideTimer=null;
          },380);
        } else sheet.hidden=true;
      } else {
        if(hideTimer!==null){clearTimeout(hideTimer);hideTimer=null;}
        sheet.classList?.remove('atlas-sheet-closing');
        const entering=sheet.hidden;
        sheet.hidden=false;
        if(entering && sheet.classList && typeof requestAnimationFrame==='function'){
          sheet.classList.add('atlas-sheet-entering');
          void sheet.offsetHeight;
          requestAnimationFrame(()=>sheet.classList.remove('atlas-sheet-entering'));
        }
      }
      sheet.setAttribute('aria-hidden', String(state.sheet==='closed'));
      const level = ['peek', 'half', 'full'].indexOf(state.sheet);
      grip.setAttribute('aria-valuenow', String(Math.max(1, level + 1)));
      grip.setAttribute('aria-valuetext', ({ peek:'预览', half:'半屏', full:'全屏' })[state.sheet] || '关闭');
      if (typeof config.onRender === 'function') config.onRender(state);
    }
    cleanups.push(controller.subscribe(render));
    sheet.setAttribute('data-atlas-sheet-controller','');
    grip.setAttribute('data-atlas-grip','');
    grip.setAttribute('role','slider');
    grip.setAttribute('aria-label','地点卡片展开程度');
    grip.setAttribute('aria-valuemin','1');
    grip.setAttribute('aria-valuemax','3');
    if (!grip.hasAttribute('tabindex')) grip.tabIndex = 0;
    let pointer=null,dragFrame=0,nextHeight=0;
    const viewportHeight=()=>(typeof window !== 'undefined'?
      window.visualViewport?.height || window.innerHeight : 844) || 844;
    function queueHeight(height) {
      nextHeight=height;
      if(typeof requestAnimationFrame!=='function'){
        sheet.style.setProperty('height',height+'px');return;
      }
      if(dragFrame)return;
      dragFrame=requestAnimationFrame(()=>{
        dragFrame=0;sheet.style.setProperty('height',nextHeight+'px');
      });
    }
    function resetDrag() {
      if(dragFrame && typeof cancelAnimationFrame==='function') cancelAnimationFrame(dragFrame);
      if(dragFrame)sheet.style.setProperty('height',nextHeight+'px');
      dragFrame=0;pointer=null;delete sheet.dataset.atlasDragging;
      header.classList?.remove('atlas-drag-header-active');
      void sheet.offsetHeight;
      if(typeof requestAnimationFrame==='function')
        requestAnimationFrame(()=>sheet.style.removeProperty('height'));
      else sheet.style.removeProperty('height');
    }
    if(!config.physicalMotion){
    listen(header,'pointerdown',e=>{
      if(controller.getState().sheet==='closed' ||
         (e.button!==undefined && e.button!==0) ||
         closest(e.target,INTERACTIVE) || pointer)return;
      const measured=typeof sheet.getBoundingClientRect==='function'?
        sheet.getBoundingClientRect().height : 248;
      const visible=viewportHeight();
      pointer={id:e.pointerId,x:e.clientX,y:e.clientY,time:e.timeStamp,
        height:measured,moved:false,
        lower:Math.max(155,Math.min(230,visible*.25)),
        upper:Math.max(310,visible-122)};
      if(typeof header.setPointerCapture==='function'){
        try{header.setPointerCapture(e.pointerId)}catch(_){}
      }
    });
    listen(header,'pointermove',e=>{
      if(!pointer||e.pointerId!==pointer.id)return;
      const dy=e.clientY-pointer.y,dx=e.clientX-pointer.x;
      if(!pointer.moved){
        if(Math.abs(dy)<5||Math.abs(dx)>Math.abs(dy)*1.2)return;
        pointer.moved=true;sheet.dataset.atlasDragging='true';
        header.classList?.add('atlas-drag-header-active');
      }
      const height=pointer.height-dy;
      const elastic=height<pointer.lower?
        pointer.lower-(pointer.lower-height)*.2 :
        height>pointer.upper?pointer.upper+(height-pointer.upper)*.16:height;
      queueHeight(Math.round(elastic));
    });
    listen(header,'pointerup',e=>{
      if(!pointer||pointer.id!==e.pointerId)return;
      const g={deltaX:e.clientX-pointer.x,deltaY:e.clientY-pointer.y,
        durationMs:Math.max(1,e.timeStamp-pointer.time)};
      const moved=pointer.moved;
      if(moved)controller.swipe(g);
      resetDrag();
    });
    listen(header,'pointercancel',()=>{if(pointer)resetDrag()});
    listen(header,'lostpointercapture',()=>{if(pointer)resetDrag()});
    listen(grip,'keydown',e => {
      if (e.key === 'Escape') { e.preventDefault(); controller.close(); return; }
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      controller.swipe({ deltaX:0, deltaY:e.key === 'ArrowUp'?-60:60, durationMs:220 });
    });
    let touch=null;
    if (scroll) {
      listen(scroll,'touchstart', e => {
        if (!e.touches || e.touches.length !== 1 || closest(e.target,INTERACTIVE+', [data-atlas-grip]')) {
          touch=null; return;
        }
        touch={ x:e.touches[0].clientX, y:e.touches[0].clientY,
          time:e.timeStamp, top:scroll.scrollTop };
      },{passive:true});
      listen(scroll,'touchend',e => {
        if (!touch || !e.changedTouches || e.changedTouches.length !== 1) { touch=null;return; }
        const t=e.changedTouches[0];
        controller.swipe({ deltaX:t.clientX-touch.x, deltaY:t.clientY-touch.y,
          durationMs:Math.max(1,e.timeStamp-touch.time),fromContent:true,
          scrollTop:Math.max(touch.top,scroll.scrollTop) });
        touch=null;
      },{passive:true});
      listen(scroll,'touchcancel',()=>{touch=null},{passive:true});
    }
    }
    listen(closeButton,'click',()=>controller.close());
    // Tap to dismiss, but do not dismiss on map drag, zoom or actual star.
    let outsideStart=null;
    listen(outside,'pointerdown',e => {
      if (closest(e.target,STAR+',button,a,input,textarea,select,[contenteditable]')) {
        outsideStart=null;return;
      }
      outsideStart={x:e.clientX,y:e.clientY,id:e.pointerId};
    });
    listen(outside,'pointerup',e => {
      if (!outsideStart || outsideStart.id !== e.pointerId) return;
      const distance=Math.hypot(e.clientX-outsideStart.x,e.clientY-outsideStart.y);
      outsideStart=null;
      if (distance <= 9 && !closest(e.target,STAR)) controller.close();
    });
    listen(outside,'pointercancel',()=>{outsideStart=null});
    render(controller.getState());
    return Object.freeze({destroy() {if(hideTimer!==null)clearTimeout(hideTimer);resetDrag();cleanups.splice(0).forEach(fn=>fn());}});
  }
  return Object.freeze({connectExistingStarClicks,connectSheetDOM});
});
