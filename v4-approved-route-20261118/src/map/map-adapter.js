/* Isolated map adapter for the Card Restore candidate.
 * Owns only active basemap visibility, projection, camera observation and POI search.
 * Never creates a star, moves the camera on sheet open, or edits storage / cards. */
(function(g){
  'use strict';
  const d=g.document;
  const registry=g.TravelAtlasModules;
  if(!registry)throw new Error('Map adapter requires TravelAtlasModules');
  const valid=(v,min,max)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max;
  const byId=id=>d.getElementById(id);
  function getMode(){
    const c=d.body.classList;
    if(c.contains('legacy-recovery'))return 'figure';
    if(c.contains('amap-active'))return 'amap';
    if(c.contains('vector-active'))return 'vector';
    return c.contains('fg-active')?'figure':'unknown';
  }
  function activeRenderer(){
    const b=g.__atlasPOIBridge,mode=getMode();
    try{
      if(mode==='vector')return b?.vector?.()||null;
      if(mode==='amap')return b?.official?.()||null;
      return b?.raster?.()||null;
    }catch(_){return null}
  }
  function getViewport(){
    const el=getMode()==='vector'?byId('atlasVectorMap'):getMode()==='amap'?byId('amapSurface'):byId('map');
    if(!el)return null;
    const r=el.getBoundingClientRect?.();
    return r?{width:r.width,height:r.height}: {width:el.clientWidth,height:el.clientHeight};
  }
  function project(point){
    if(!valid(point?.lat,-90,90)||!valid(point?.lng,-180,180))return null;
    // The integration bridge already performs WGS84 -> GCJ02 conversion for AMap.
    // Never mix screen coordinates from an inactive legacy map.
    const pick=g.__atlasPickMapAPI;
    if(!pick?.project||!activeRenderer())return null;
    let p;try{p=pick.project(Number(point.lng),Number(point.lat))}catch(_){return null}
    if(!valid(p?.x,-1e7,1e7)||!valid(p?.y,-1e7,1e7))return null;
    const mode=getMode(),el=byId(mode==='vector'?'atlasVectorMap':mode==='amap'?'amapSurface':'map');
    const rect=el?.getBoundingClientRect?.()||{left:0,top:0};
    return {x:Number(p.x)+rect.left,y:Number(p.y)+rect.top};
  }
  function getCamera(){
    const q=g.__atlasCameraQA?.();
    if(!q||!valid(q.lat,-90,90)||!valid(q.lng,-180,180))return null;
    return {lat:Number(q.lat),lng:Number(q.lng),zoom:Number(q.zoom),provider:q.provider||getMode()};
  }
  function onCameraChange(fn){
    if(typeof fn!=='function')throw new TypeError('Camera callback required');
    let map=null,closed=false;
    const events=['moveend','zoomend'];
    const emit=()=>{if(!closed)fn(getCamera())};
    const bind=()=>{
      if(closed)return;
      const next=activeRenderer();
      if(next===map)return;
      if(map?.off)for(const name of events)map.off(name,emit);
      map=next;
      if(map?.on)for(const name of events)map.on(name,emit);
      emit();
    };
    const observer=typeof g.MutationObserver==='function'?new g.MutationObserver(bind):null;
    if(observer&&d.body)observer.observe(d.body,{attributes:true,attributeFilter:['class']});
    d.addEventListener('atlas:map-bridge',bind);
    bind();
    return ()=>{
      if(closed)return;closed=true;observer?.disconnect();
      d.removeEventListener('atlas:map-bridge',bind);
      if(map?.off)for(const name of events)map.off(name,emit);
    };
  }
  let searchId=0,searchController=null;
  function abortError(){
    if(typeof g.DOMException==='function')return new g.DOMException('Map search superseded','AbortError');
    const e=new Error('Map search superseded');e.name='AbortError';return e;
  }
  async function searchPlaces(query,{signal,center,submitted=false}={}){
    const q=String(query??'').trim().slice(0,120);
    const id=++searchId;
    searchController?.abort();
    searchController=null;
    if(signal?.aborted)throw abortError();
    if(q.length<2)return [];
    if(typeof g.AtlasServices?.search!=='function')throw new Error('Place search service unavailable');
    const controller=new AbortController();searchController=controller;
    const abort=()=>controller.abort();
    signal?.addEventListener('abort',abort,{once:true});
    try{
      const rows=await g.AtlasServices.search(q,{signal:controller.signal,center,allowFallback:submitted});
      if(id!==searchId||controller.signal.aborted)throw abortError();
      const unique=new Set(),clean=[];
      for(const item of Array.isArray(rows)?rows:[]){
        const lat=item?.lat,lng=item?.lon??item?.lng;
        if(!valid(lat,-90,90)||!valid(lng,-180,180))continue;
        const name=String(item?.name||item?.display_name||'').split(',')[0].trim();
        if(!name)continue;
        const key=String(item?.id||name.toLowerCase()+':'+Number(lat).toFixed(5)+':'+Number(lng).toFixed(5));
        if(unique.has(key))continue;unique.add(key);
        clean.push({id:key,name,lat:Number(lat),lng:Number(lng),lon:Number(lng),
          display_name:String(item?.display_name||name),type:String(item?.type||item?.class||'地点')});
        if(clean.length>=12)break;
      }
      return clean;
    }finally{
      signal?.removeEventListener('abort',abort);
      if(searchController===controller)searchController=null;
    }
  }
  function cancelSearch(){searchId++;searchController?.abort();searchController=null}
  // Only one basemap can paint or receive touches. This fixes transient double
  // layers without changing the legacy provider selection or the V4 palette.
  if(d.head&&!byId('atlas-map-layer-isolation')){
    const style=d.createElement('style');style.id='atlas-map-layer-isolation';
    style.textContent=[
      'body.amap-active #map,body.amap-active #atlasVectorMap,',
      'body.vector-active:not(.amap-active):not(.legacy-recovery) #map,',
      'body.vector-active:not(.amap-active):not(.legacy-recovery) #amapSurface,',
      'body.legacy-recovery #atlasVectorMap,body.legacy-recovery #amapSurface',
      '{visibility:hidden!important;pointer-events:none!important}'
    ].join('');
    d.head.appendChild(style);
  }
  registry.register('map',{
    getMode,activeRenderer,getViewport,project,getCamera,onCameraChange,
    searchPlaces,cancelSearch,
    visibleStarCount(){return d.querySelectorAll('.star-pin, .atlas-bookmark-hit, .atlas-official-star').length},
    diagnostics(){return {provider:getMode(),camera:getCamera(),viewport:getViewport(),
      hasActiveRenderer:!!activeRenderer(),visibleStarNodes:this.visibleStarCount()}}
  });
})(window);
