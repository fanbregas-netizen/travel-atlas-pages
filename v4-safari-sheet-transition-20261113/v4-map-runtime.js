
(()=>{
  'use strict';
  const maplibregl=window.atlasLegacyMaplibre;
  // iPhone stability: one lightweight map, zero extra map engines and no main-thread PBF decoding.
  const mobileStableMap=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Macintosh/.test(navigator.userAgent))||!!window.matchMedia?.('(max-width:700px) and (pointer:coarse)').matches;
  document.documentElement.classList.toggle('atlas-stable-map',mobileStableMap);
  window.__atlasStableMapEnabled=mobileStableMap;
  // V3 手绘图标系统（Footprint_Map_Icon_System_V3 素材包，viewBox 64，墨 #161616）
  const atlasIcon=(paths,vb)=>'<svg viewBox="'+(vb||'0 0 24 24')+'" aria-hidden="true">'+paths+'</svg>';
  const VB64='0 0 64 64';
  const atlasIcons={
    btnStars:['<g fill="none" stroke="#161616" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M32 8 L39.2 23.2 L56 25.4 L43.2 37.2 L46.1 54.4 L31.7 45.8 L16.8 54.4 L20 37.4 L8.1 25.3 L24.8 23Z"/><path d="M24 25 L30 13" stroke-width="1.3"/></g>',VB64],
    btnLocate:['<g fill="none" stroke="#161616" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="15"/><circle cx="32" cy="32" r="4" fill="#161616"/><path d="M32 8 L32 16 M32 48 L32 56 M8 32 L16 32 M48 32 L56 32"/></g>',VB64],
    btnZoomIn:['<path d="M12 5v14M5 12h14"/>'],btnZoomOut:['<path d="M5 12h14"/>']
  };
  for(const [id,cfg] of Object.entries(atlasIcons)){
    const el=document.getElementById(id);if(!el)continue;
    el.innerHTML=atlasIcon(cfg[0],cfg[1]);el.setAttribute('aria-label',({btnStars:'我的旅行星标',btnLocate:'定位当前位置',btnZoomIn:'放大地图',btnZoomOut:'缩小地图'})[id]);
  }
  const searchBtn=document.querySelector('#searchForm .dock-go');
  if(searchBtn)searchBtn.innerHTML=atlasIcon('<g fill="none" stroke="#161616" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M27 10 C36 10 43 16 45 25 C48 34 42 43 32 46 C22 49 13 44 11 34 C8 24 16 13 24 11"/><path d="M42 43 Q50 50 56 57" stroke-width="4.3"/><path d="M18 20 Q22 16 27 16" stroke-width="1.6"/></g>',VB64);

  const $=id=>document.getElementById(id);
  // Figure-ground: actual OpenStreetMap building polygons, rendered as black solids.
  // OpenFreeMap distributes OSM data with no API key. If it cannot load, the pale
  // street map stays operable; no simulated building geometries are invented.
  const FIG_TILE='https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf';
  const figCache=new Map(), figPending=new Set();
  let figRequestTimer=null;
  function readProto(bytes){let i=0;return {
    get pos(){return i},get size(){return bytes.length},
    varint(){let n=0,s=0,v;do{if(i>=bytes.length)throw Error('PBF 截断');v=bytes[i++];n+=(v&127)*Math.pow(2,s);s+=7;if(s>63)throw Error('PBF 格式不支持')}while(v&128);return n},
    bytes(){const len=this.varint();if(len<0||i+len>bytes.length)throw Error('PBF 大小错误');const b=bytes.subarray(i,i+len);i+=len;return b},
    skip(w){if(w===0)this.varint();else if(w===2)this.bytes();else if(w===5)i+=4;else if(w===1)i+=8;else throw Error('PBF 字段错误')}
  }}
  function decodeShape(buf){const p=readProto(buf);let x=0,y=0,contours=[],line=null;while(p.pos<p.size){const c=p.varint(),cmd=c&7,num=c>>3;if(!num||num>500000)break;
    if(cmd===1||cmd===2){for(let j=0;j<num;j++){const xx=p.varint(),yy=p.varint();x+=(xx>>>1)^-(xx&1);y+=(yy>>>1)^-(yy&1);if(cmd===1){line=[];contours.push(line)}if(line)line.push([x,y])}}
    else if(cmd===7){for(let j=0;j<num;j++){/* closing the ring happens in canvas */}}
    else break;
  }return contours.filter(r=>r.length>=3)}
  function decodeBuildings(buffer){
    const p=readProto(new Uint8Array(buffer));let result=[],poi=[];
    const dec=new TextDecoder();
    while(p.pos<p.size){const tag=p.varint(),field=tag>>3,wire=tag&7;if(field!==3||wire!==2){p.skip(wire);continue}
      const l=readProto(p.bytes());let name='',features=[],extent=4096,keys=[],values=[];
      while(l.pos<l.size){const t=l.varint(),f=t>>3,w=t&7;
        if(f===1&&w===2)name=dec.decode(l.bytes());
        else if(f===2&&w===2)features.push(l.bytes());
        else if(f===3&&w===2)keys.push(dec.decode(l.bytes()));
        else if(f===4&&w===2){const val=readProto(l.bytes());let str='';while(val.pos<val.size){const t2=val.varint(),f2=t2>>3,w2=t2&7;if(f2===1&&w2===2)str=dec.decode(val.bytes());else val.skip(w2)}values.push(str)}
        else if(f===5&&w===0)extent=l.varint();else l.skip(w)
      }
      if(!['building','poi','place'].includes(name))continue;
      for(const bytes of features){const r=readProto(bytes);let kind=0,geom=null,tags=null;
        while(r.pos<r.size){const t=r.varint(),f=t>>3,w=t&7;
          if(f===3&&w===0)kind=r.varint();else if(f===4&&w===2)geom=r.bytes();else if(f===2&&w===2)tags=r.bytes();else r.skip(w)}
        if(!geom)continue;
        if(name==='building'&&kind===3){const contours=decodeShape(geom);if(contours.length)result.push(contours);continue}
        if(name==='building'||!tags||!kind)continue;
        const props={},tp=readProto(tags);
        while(tp.pos<tp.size){const ki=tp.varint(),vi=tp.varint();if(keys[ki]&&values[vi])props[keys[ki]]=values[vi]}
        const title=String(props['name:zh']||props.name||props['name:en']||'').trim();
        if(!title||title.length>44)continue;
        const gp=readProto(geom);let pt=null,x=0,y=0;
        while(gp.pos<gp.size){const cmd=gp.varint(),id=cmd&7,n=cmd>>3;if(!n||n>8000)break;
          if(id===1||id===2){for(let j=0;j<n;j++){const a=gp.varint(),b=gp.varint();x+=(a>>>1)^-(a&1);y+=(b>>>1)^-(b&1);if(!pt)pt={x,y}}}
          else if(id===7)continue;else break;
        }
        if(pt)poi.push({name:title,x:pt.x,y:pt.y,category:String(props.class||props.subclass||props.type||name),extent});
      }
    }
    return {buildings:result,poi,extent:4096};
  }
  const fgClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function figPixel(lng,lat,z){const full=256*Math.pow(2,z),r=fgClamp(lat,-85.05112878,85.05112878)*Math.PI/180;return {x:(lng+180)/360*full,y:(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*full}}
  function figureVisibleTiles(){if(!map)return [];const z=Math.min(14,Math.floor(map.getZoom()));if(z<12)return [];const scale=Math.pow(2,map.getZoom()-z),a=figPixel(map.getCenter().lng,map.getCenter().lat,z);const w=map.getContainer().clientWidth,h=map.getContainer().clientHeight,N=Math.pow(2,z);const x0=Math.floor((a.x-w/(2*scale))/256),x1=Math.ceil((a.x+w/(2*scale))/256),y0=fgClamp(Math.floor((a.y-h/(2*scale))/256),0,N-1),y1=fgClamp(Math.ceil((a.y+h/(2*scale))/256),0,N-1);const out=[];for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){out.push({z,x:((x%N)+N)%N,worldX:x,y,key:`${z}/${((x%N)+N)%N}/${y}`})}return out.slice(0,28)}
  function paintBuildings(){if(mobileStableMap||!map?.figureCanvas)return;const canvas=map.figureCanvas,w=map.getContainer().clientWidth,h=map.getContainer().clientHeight;if(!w||!h)return;
    const dpr=Math.min(devicePixelRatio||1,2),cw=Math.ceil(w*dpr),ch=Math.ceil(h*dpr);if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;canvas.style.width=w+'px';canvas.style.height=h+'px'}
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,cw,ch);if(satelliteOn||!document.body.classList.contains('fg-active'))return;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#121212';const tiles=figureVisibleTiles();if(!tiles.length)return;const z=tiles[0].z,scale=Math.pow(2,map.getZoom()-z),center=figPixel(map.getCenter().lng,map.getCenter().lat,z);
    for(const t of tiles){const data=figCache.get(t.key);if(!data?.buildings?.length)continue;const left=(t.worldX*256-center.x)*scale+w/2,top=(t.y*256-center.y)*scale+h/2,tileSize=256*scale;
      ctx.save();ctx.beginPath();ctx.rect(left,top,tileSize,tileSize);ctx.clip();ctx.translate(left,top);ctx.scale(tileSize/data.extent,tileSize/data.extent);
      for(const rings of data.buildings){ctx.beginPath();for(const ring of rings){for(let j=0;j<ring.length;j++){const v=ring[j];if(j===0)ctx.moveTo(v[0],v[1]);else ctx.lineTo(v[0],v[1])}ctx.closePath()}ctx.fill('evenodd')}
      ctx.restore();
    }
  }
  function requestFigure(){if(mobileStableMap||!map||satelliteOn)return;const tiles=figureVisibleTiles();for(const t of tiles){if(figCache.has(t.key)||figPending.has(t.key))continue;if(figPending.size>=8)break;figPending.add(t.key);
      const url=FIG_TILE.replace('{z}',t.z).replace('{x}',t.x).replace('{y}',t.y);
      fetch(url).then(r=>{if(!r.ok)throw Error('建筑数据 '+r.status);return r.arrayBuffer()}).then(b=>{figCache.set(t.key,decodeBuildings(b));if(figCache.size>75)figCache.delete(figCache.keys().next().value);paintBuildings();renderDestinations()}).catch(()=>{figCache.set(t.key,{buildings:[],poi:[],extent:4096})}).finally(()=>{figPending.delete(t.key);if(!satelliteOn&&figPending.size<4)setTimeout(requestFigure,110);});
    }}
  function scheduleFigure(){if(mobileStableMap)return;paintBuildings();renderDestinations();clearTimeout(figRequestTimer);figRequestTimer=setTimeout(requestFigure,260)}

  // Real, clickable map destinations come from OpenFreeMap OSM vector tiles.
  // Discovery fetch is explicit to the user's action; never invent map POIs.
  let stableSelectionMarker=null;
  let discoveredPlaces=[],selectedDestination=null,lastPoiRender=0,poiRenderTimer=null,poiCategoryFilter='all',poiLastQuery=null,poiLastAt=0;
  const poiGroup=cat=>/museum|historic|attraction|viewpoint|park|garden|zoo|theme_park|artwork|gallery|beach|peak|monument|castle|tourism|nature_reserve|temple/.test(cat)?'attraction':/restaurant|cafe|food|bar|pub|fast_food/.test(cat)?'food':/hotel|lodging|guest_house|hostel|motel/.test(cat)?'stay':'other';
  function setPoiFilter(cat){poiCategoryFilter=cat;document.querySelectorAll('[data-poi-category]').forEach(el=>el.classList.toggle('active',el.dataset.poiCategory===cat));renderDestinations()}

  const poiCategory=c=>({attraction:'景点',museum:'博物馆',park:'公园',garden:'花园',restaurant:'餐厅',cafe:'咖啡馆',hotel:'酒店',lodging:'住宿',historic:'历史古迹',viewpoint:'观景点',place:'地方',peak:'山峰',tourism:'旅行目的地',poi:'兴趣点'}[c]||'目的地');
  const poiEmoji=c=>(/museum|historic/.test(c)?'🏛':/restaurant|food|cafe/.test(c)?'☕':/park|garden|forest/.test(c)?'🌳':/hotel|lodging/.test(c)?'🏨':/peak|viewpoint|nature/.test(c)?'⛰':'📍');
  let mapTapSuppressionUntil=0;
  function selectPlaceAtTap(point){
    if(!map||(!mobileStableMap&&mapMode!=='standard')||picking||selectedDestination||selectedId||Date.now()<mapTapSuppressionUntil)return;
    const lat=Number(point?.lat),lng=Number(point?.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    const name='地图选点';
    const cache=discoveredPlaces.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng)).map(x=>({place:x,d:Math.hypot(map._pixel(x.lng,x.lat).x-map._pixel(lng,lat).x,map._pixel(x.lng,x.lat).y-map._pixel(lng,lat).y)})).sort((a,b)=>a.d-b.d);
    const nearest=cache[0]?.d<24?cache[0].place:null;
    if(nearest)showDestination(nearest); // no extra panel on empty map space
  }
  function renderDestinations(){
    if(mobileStableMap||!map?.destinationPane)return;
    clearTimeout(poiRenderTimer);poiRenderTimer=setTimeout(()=>{
      if(!map?.destinationPane)return;
      const pane=map.destinationPane;pane.innerHTML='';if(map.getZoom()<12.9)return;
      const vw=map.getContainer().clientWidth,vh=map.getContainer().clientHeight,z=Math.min(14,Math.floor(map.getZoom()));
      document.body.classList.toggle('poi-detail',map.getZoom()>=14);
      const tlist=figureVisibleTiles(),center=figPixel(map.getCenter().lng,map.getCenter().lat,z),scale=Math.pow(2,map.getZoom()-z),seen=new Set(),occupied=new Set();
      const collected=[];
      for(const t of tlist){const pack=figCache.get(t.key);for(const item of pack?.poi||[]){
        const x=(t.worldX*256-center.x)*scale+vw/2+item.x/(item.extent||4096)*256*scale;
        const y=(t.y*256-center.y)*scale+vh/2+item.y/(item.extent||4096)*256*scale;
        if(x<20||y<154||x>vw-20||y>vh-155)continue;
        const lat=Math.atan(Math.sinh(Math.PI*(1-2*(t.y+item.y/(item.extent||4096))/2**z)))*180/Math.PI;
        const lng=(t.worldX+item.x/(item.extent||4096))/2**z*360-180;
        collected.push({name:item.name,category:item.category,lat,lng,x,y});
      }}
      for(const p of discoveredPlaces){const xy=map._pixel(p.lng,p.lat);collected.unshift({...p,x:xy.x,y:xy.y});}
      collected.sort((a,b)=>a.category==='place'?1:b.category==='place'?-1:0);
      for(const p of collected){if(poiCategoryFilter!=='all'&&poiGroup(p.category)!==poiCategoryFilter)continue;const key=p.name.trim().toLowerCase();const cell=Math.floor(p.x/112)+':'+Math.floor(p.y/50);
        if(seen.has(key)||occupied.has(cell))continue;
        if(p.x<20||p.x>vw-20||p.y<154||p.y>vh-156)continue;
        seen.add(key);occupied.add(cell);
        const b=document.createElement('button');b.type='button';b.className='poi-marker';b.title='查看 '+p.name;b.style.left=p.x+'px';b.style.top=p.y+'px';
        b.innerHTML='<span class="poi-icon"><img src="'+(window.AtlasPOIIcons?.fileFor(p.category,p.name)||'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0IiBhcmlhLWxhYmVsPSJOZWFyYnkiPgogPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMTYxNjE2IiBzdHJva2Utd2lkdGg9IjMuNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KICA8cGF0aCBkPSJNMzEgMTAgQzQxIDkgNDggMTcgNDcgMjcgQzQ2IDM2IDM5IDQxIDMxIDUxIEMyNCA0MiAxNiAzNCAxNiAyNiBDMTYgMTYgMjMgMTAgMzEgMTBaIi8+CiAgPGNpcmNsZSBjeD0iMzEiIGN5PSIyNiIgcj0iNi4xIi8+CiAgPHBhdGggZD0iTTE1IDQ3IEM5IDQ5IDggNTMgMTQgNTUgQzIyIDU5IDQxIDU5IDUwIDU1IEM1NSA1MyA1NCA0OSA0NyA0NyIgc3Ryb2tlLXdpZHRoPSIyLjQiLz4KIDwvZz4KPC9zdmc+')+'" alt="" aria-hidden="true"></span><span class="poi-label">'+escape(p.name)+'</span>';
        b.onclick=e=>{e.stopPropagation();showDestination(p)};
        pane.append(b);if(pane.children.length>=(map.getZoom()<14.5?9:map.getZoom()<15?16:28))break;
      }
    },95)
  }
  function hideDestination(){if(!selectedDestination&&!$('destinationCard').classList.contains('visible')&&$('selectionFeedback').hidden)return;stableSelectionMarker?.remove();stableSelectionMarker=null;selectedDestination=null;if(isOfficial())updateOfficialSelectionPin(null);if(vectorSelectionMarker){vectorSelectionMarker.remove();vectorSelectionMarker=null;}$('destinationCard').classList.remove('visible');$('selectionFeedback').hidden=true;document.body.classList.remove('destination-selected')}

  function cancelBookmark(id){
    const p=places.find(item=>item.id===id);
    const dialog=$('atlasUnstarDialog');
    if(!p||!dialog||dialog.open)return Promise.resolve(false);
    return new Promise(resolve=>{
      const accept=$('atlasConfirmUnstar');
      dialog.returnValue='cancelled';accept.disabled=false;
      dialog.addEventListener('close',()=>resolve(dialog.returnValue==='unstarred'),{once:true});
      accept.onclick=async()=>{
        if(accept.disabled)return;
        accept.disabled=true;
        try{
          await upsert({...p,starred:false});dialog.close('unstarred');
          closeMemory();hideDestination();await refresh();toast('☆ 已取消星标，原有文字与影像仍保留');
        }catch(err){console.error(err);toast('取消星标失败，收藏未改动')}
        finally{accept.disabled=false}
      };
      dialog.showModal();
    });
  }
  function showDestination(d){
    if(window.__atlasTripPicking)return;
    focusMapPlaceIfNeeded(d);
    closeMemory();closeSearchResults();setPicking(false);window.__fpCloseSearch?.();
    selectedDestination={name:String(d.name||'地图选点'),lat:+d.lat,lng:+d.lng,category:d.category||'地点',address:d.address||'',id:d.id||''};
    const existing=places.find(p=>!p.demo&&(
       (d.id && p.poiId && p.poiId===d.id)||
       (Math.abs(p.lat-d.lat)<.00016&&Math.abs(p.lng-d.lng)<.00016)
    ));
    $('destinationClose').onclick=hideDestination; /* build .21 · 用户批注：卡片必须有显式关闭钮，不能靠运气点空白 */
    $('destinationTitle').textContent=selectedDestination.name;
    $('destinationCategory').textContent=(d.address?String(d.address).slice(0,76)+' · ':'')+poiCategory(d.category);
    $('destinationStar').textContent=existing?.starred!==false&&existing?'查看这段回忆':existing?'恢复收藏':'收藏并写下原因 ☆';
    $('destinationUnstar').hidden=!(existing&&existing.starred!==false);
    $('destinationCard').classList.add('visible');
    document.body.classList.add('destination-selected');
    $('selectionFeedback').hidden=true;
    $('selectionCaption').textContent=selectedDestination.name;
    if(isVector())showVectorSelection(selectedDestination);
    if(!isVector()&&!isOfficial()&&map){
      stableSelectionMarker?.remove();const el=document.createElement('div');el.className='atlas-light-selection-pin';el.setAttribute('aria-hidden','true');el.innerHTML='<span class="atlas-light-selection-hole"></span>';
      stableSelectionMarker=new maplibregl.Marker({element:el}).setLngLat([+d.lng,+d.lat]).addTo(map);
    }

    if(existing&&existing.starred!==false){
      $('destinationStar').onclick=()=>{hideDestination();showPlace(existing.id,true)};
      $('destinationUnstar').onclick=()=>cancelBookmark(existing.id);
    }else if(existing){
      $('destinationStar').onclick=async()=>{try{await upsert({...existing,starred:true});await refresh();hideDestination();pulseSavedStar(existing.id);toast('收藏已恢复。点击地图上的星标可查看内容。')}catch(e){toast('恢复星标失败')}};
      $('destinationUnstar').onclick=null;
    }else{
      $('destinationStar').onclick=()=>{
        const item=selectedDestination;
        if(!item||!Number.isFinite(item.lat)||!Number.isFinite(item.lng))return;
        // No empty auto-saved star. The user confirms title, intent and Brief in one editor.
        hideDestination();
        beginEdit({id:uid(),title:item.name||'目的地',lat:item.lat,lng:item.lng,
          poiId:item.id||'',note:'',photos:[],videos:[],rank:2,date:'',
          demo:false,starred:true,stage:'plan'});
      };
      $('destinationUnstar').onclick=null;
    }
    if(isOfficial())updateOfficialSelectionPin(selectedDestination);
    window.__atlasPoiFeedback?.(selectedDestination.lat,selectedDestination.lng);
    $('destinationNav').onclick=()=>openNavigation(selectedDestination);
  }
  function navigateTo(place){return; if(!place)return;const lat=Number(place.lat),lng=Number(place.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent);const name=encodeURIComponent(place.title||place.name||'目的地');
    let url;
    if(isOfficial()&&insideCN(lng,lat)){
      const gcj=wgsToGcj(lng,lat);
      const params=new URLSearchParams({from:'',to:gcj[0].toFixed(6)+','+gcj[1].toFixed(6)+','+(place.title||place.name||'目的地'),mode:'car',src:'TravelAtlas',callnative:'1'});
      url='https://uri.amap.com/navigation?'+params.toString();
    }else url=isiOS?'https://maps.apple.com/?daddr='+lat+','+lng+'&q='+name:'https://www.google.com/maps/dir/?api=1&destination='+lat+','+lng;
    window.open(url,'_blank','noopener,noreferrer');
  }
  async function discoverNear(){
    if(isOfficial()){hideDestination();return showOfficialNearby()}
    if(isVector()){scheduleVectorPOIs();return}if(!map)return;hideDestination();
    if(map.getZoom()<12){map.zoomTo(13);toast('已放大地图，正在查找周边地点…')}
    const z=map.getZoom(),c=map.getCenter(),radius=Math.min(.030,Math.max(.0035,.013*2**(13-z))); 
    const south=Math.max(-85,c.lat-radius),north=Math.min(85,c.lat+radius),west=Math.max(-180,c.lng-radius),east=Math.min(180,c.lng+radius);
    const box=[south.toFixed(5),west.toFixed(5),north.toFixed(5),east.toFixed(5)].join(',');
    if(poiLastQuery===box&&Date.now()-poiLastAt<60000&&discoveredPlaces.length){$('poiFilters').hidden=false;renderDestinations();toast('已显示当前区域的可点击目的地');return}
    const q='[out:json][timeout:20];(nwr["tourism"]["name"]('+box+');nwr["historic"]["name"]('+box+');nwr["leisure"~"park|garden|nature_reserve"]["name"]('+box+');nwr["amenity"~"museum|restaurant|cafe|place_of_worship|arts_centre|theatre"]["name"]('+box+');nwr["shop"~"mall|department_store"]["name"]('+box+'););out center 180;';
    $('chipDiscover').disabled=true;$('chipDiscover').textContent='⌛ 查找中…';
    let lastErr;
    try{
      for(const endpoint of ['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter']){
        try{const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),9500);
          const resp=await fetch(endpoint+'?data='+encodeURIComponent(q),{signal:ctrl.signal});clearTimeout(t);
          if(!resp.ok)throw Error('地图查询 '+resp.status);
          const json=await resp.json(),a=[],seen=new Set();
          for(const e of json.elements||[]){const lat=e.lat??e.center?.lat,lng=e.lon??e.center?.lon,name=e.tags?.['name:zh']||e.tags?.name;
            if(!name||!Number.isFinite(lat)||!Number.isFinite(lng))continue;
            const id=e.type+':'+e.id;if(seen.has(id))continue;seen.add(id);
            a.push({name,lat,lng,category:e.tags.tourism||e.tags.historic||e.tags.leisure||e.tags.amenity||e.tags.shop||'景点'});
          }
          discoveredPlaces=a.slice(0,180);poiLastQuery=box;poiLastAt=Date.now();$('poiFilters').hidden=false;
          poiCategoryFilter='all';document.querySelectorAll('[data-poi-category]').forEach(x=>x.classList.toggle('active',x.dataset.poiCategory==='all'));
          renderDestinations();toast(a.length?'找到 '+a.length+' 处真实目的地，点名称即可收藏':'此区域暂无足够地点，可搜索目的地名称');return;
        }catch(err){lastErr=err;console.warn('周边地图服务暂不可用',err)}
      }
      renderDestinations();toast('周边地点服务暂时不可用，可使用顶部搜索定位目的地');
    }finally{$('chipDiscover').disabled=false;$('chipDiscover').textContent='⌖ 探索附近'}
  }
  const SAMPLE_PHOTOS=["data:image/webp;base64,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", "data:image/webp;base64,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", "data:image/webp;base64,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"];
  const DEMO={id:'demo-xiangshan',title:'松兰山滨海栈道 · 演示',note:'海风轻轻吹过，沿着海岸慢慢走。\n这里展示的是功能示例：收藏时写下你的文字，选几张最喜欢的照片。',date:'2026-10-20',lat:29.492,lng:121.905,photos:SAMPLE_PHOTOS.map((src,i)=>({src,name:'演示照片 '+(i+1),demo:true})),demo:true};
  // Original IndexedDB schema & WGS84 bookmark coordinates remain unchanged.
  let map,markers=new Map(),places=[],selectedId=null,picking=false,editing=null,photoIndex=0,viewingPlace=null,searchPin=null,locationPin=null,db=null,fallback=false,timer=null,editorPhotos=[],editorVideos=[],directUploadId=null,activeVideoUrl=null;
  let satelliteOn=false,mapMode="figure",searchRequest=0,streetSource=0,styleEpoch=0,styleTimeout=null,loadErrors=0;
  // If this in-app browser blocks IndexedDB AND localStorage, keep the app usable for the session.
  let volatilePlaces=[],volatileMeta={},storageIsTransient=false;
  // V14 AMap JS API: visual overlay, keeping all saved places as original WGS84 coordinates.
  let officialMap=null,officialSDK=null,officialLoaded=false,officialLoading=false;
  let officialKey='', officialMarkers=[],officialPoiMarkers=[],officialSearch=null,officialPoiSearch=null,officialPoiBackendAvailable=false;
  let officialView='white',officialSatellite=null,officialRoadNet=null,officialBaseLayer=null,officialBuildings=null,officialSelectionMarker=null,officialYouMarker=null;
  let pendingPick=0,lastHotspot=0,lastPoiTap=0,officialFeatureSignature='';
  let poiOverlayPlaces=[],poiOverlayRaf=0,poiOverlayRequest=0;
  const isOfficial=()=>mapMode==='amap'&&!!officialMap;
  const AUTO_MODEL_ZOOM=15.10,AUTO_FIGURE_ZOOM=14.35;
  let automaticScaleMode=false,autoModelStarting=false,autoMapSwitching=false,nonChinaNoticeShown=false;
  let currentUserCoords=null,geoRequested=false;
  const lastLocationStorage='travel-atlas-last-location-v19';
  const loadLastCoords=()=>{try{const v=JSON.parse(localStorage.getItem(lastLocationStorage)||'null');if(v&&Number.isFinite(v.lat)&&Number.isFinite(v.lng)&&Math.abs(v.lat)<=90&&Math.abs(v.lng)<=180)return v;}catch(e){}return null;};
  function saveLastCoords(lat,lng){try{localStorage.setItem(lastLocationStorage,JSON.stringify({lat,lng,t:Date.now()}))}catch(e){}}
  function onUserLocated(pos){
    const lat=Number(pos?.coords?.latitude),lng=Number(pos?.coords?.longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    currentUserCoords={lat,lng};saveLastCoords(lat,lng);addLocationMarker(lat,lng);
    if(isVector())updateVectorUserLocation();
    if(officialMap){const A=officialSDK;if(officialYouMarker)officialYouMarker.setMap(null);officialYouMarker=new A.Marker({map:officialMap,position:wgsToGcj(lng,lat),content:'<div class="amap-you-dot" title="当前位置"></div>',offset:new A.Pixel(-8,-8),zIndex:150});}
    // Do not change the user's manually chosen location if a delayed GPS fix arrives.
    if(!selectedId&&!selectedDestination&&!userHasMovedMap
       && !window.__atlasTripPicking && !document.body.classList.contains('route-pick-active')
       && !document.body.classList.contains('fp-search-open')
       && !$('drawer')?.classList.contains('visible') && !$('editor')?.open
       && !$('atlasRoutesSheet')?.classList.contains('open')){
      setMapView(lat,lng,13.8,true);
    }
  }
  let userHasMovedMap=false;
  function requestCurrentLocation(force=false){
    if(!navigator.geolocation){toast('当前浏览器不支持定位，已显示上次位置');return;}
    if(geoRequested&&!force)return;
    geoRequested=true;
    navigator.geolocation.getCurrentPosition(onUserLocated,err=>{
      if(force)toast('定位不可用，请在浏览器设置中授权位置权限');
      else if(!loadLastCoords()){ /* A permission dialog should be user-initiated, never interrupt the map preview. */ }
    },{enableHighAccuracy:false,timeout:12500,maximumAge:60000});
  }
  // 用户确认的启动行为：打开地图首先显示当下实时定位。
  // 已授权则静默定位；未询问过则启动时询问一次；已拒绝则保持上次视图，不打扰。
  function bootCurrentLocation(){
    if(!navigator.geolocation)return;
    const ask=()=>{try{requestCurrentLocation(false)}catch(e){console.warn('启动定位暂不可用',e)}};
    try{
      if(navigator.permissions?.query)navigator.permissions.query({name:'geolocation'}).then(st=>{if(st.state!=='denied')ask()}).catch(()=>ask());
      else ask();
    }catch(e){ask()}
  }
  async function automaticCloseToModel(){
    if(!automaticScaleMode||autoModelStarting||!map||mapMode!=='figure'||map.getZoom()<AUTO_MODEL_ZOOM)return;
    const c=map.getCenter();
    if(!insideCN(c.lng,c.lat))return; // The official model has reliable coverage in China only.
    autoModelStarting=true;
    try{
      if(officialMap){setOfficialView('white')}else await activateOfficial();
    }catch(error){console.warn('暂时保留二维城市地图',error)}
    finally{autoModelStarting=false;}
  }
  function automaticCloseToFigure(){
    if(!automaticScaleMode||!isOfficial()||officialMap.getZoom()>AUTO_FIGURE_ZOOM||autoMapSwitching)return;
    autoMapSwitching=true;try{hideOfficial()}finally{autoMapSwitching=false}
  }
  function updateAutomaticMode(){
    if(!automaticScaleMode||!map)return;
    if(isOfficial())automaticCloseToFigure();
    else if(mapMode==='figure')automaticCloseToModel();
  }

  const insideCN=(x,y)=>x>=72.004&&x<=137.8347&&y>=0.8293&&y<=55.8271;
  const gPi=Math.PI;
  function deltaLat(x,y){let r=-100+2*x+3*y+.2*y*y+.1*x*y+.2*Math.sqrt(Math.abs(x));r+=(20*Math.sin(6*x*gPi)+20*Math.sin(2*x*gPi))*2/3;r+=(20*Math.sin(y*gPi)+40*Math.sin(y/3*gPi))*2/3;r+=(160*Math.sin(y/12*gPi)+320*Math.sin(y*gPi/30))*2/3;return r}
  function deltaLng(x,y){let r=300+x+2*y+.1*x*x+.1*x*y+.1*Math.sqrt(Math.abs(x));r+=(20*Math.sin(6*x*gPi)+20*Math.sin(2*x*gPi))*2/3;r+=(20*Math.sin(x*gPi)+40*Math.sin(x/3*gPi))*2/3;r+=(150*Math.sin(x/12*gPi)+300*Math.sin(x/30*gPi))*2/3;return r}
  function wgsToGcj(lng,lat){if(!insideCN(lng,lat))return [lng,lat];const dLat=deltaLat(lng-105,lat-35),dLng=deltaLng(lng-105,lat-35),rad=lat/180*gPi,magic=1-0.006693421622965943*Math.sin(rad)**2,sqrt=Math.sqrt(magic);return [lng+dLng*180/(6378245/sqrt*Math.cos(rad)*gPi),lat+dLat*180/(6378245*(1-0.006693421622965943)/(magic*sqrt)*gPi)]}
  function gcjToWgs(lng,lat){if(!insideCN(lng,lat))return [lng,lat];let x=lng,y=lat;for(let i=0;i<4;i++){const [gx,gy]=wgsToGcj(x,y);x+=lng-gx;y+=lat-gy}return [x,y]}
  function officialCenter(){const pos=officialMap.getCenter();const p=gcjToWgs(pos.getLng(),pos.getLat());return {lng:p[0],lat:p[1]}}
  function desiredModelPitch(z){return 0}
  function lockOfficialNorthUp(){if(!officialMap)return;try{officialMap.setRotation?.(0);const target=desiredModelPitch(officialMap.getZoom());if(Math.abs((officialMap.getPitch?.()||0)-target)>3)officialMap.setPitch?.(target)}catch(e){}}
  function applyOfficialStatus(){if(!officialMap)return;try{officialMap.setStatus({dragEnable:true,zoomEnable:true,doubleClickZoom:true,keyboardEnable:false,jogEnable:false,rotateEnable:false,pitchEnable:false})}catch(e){}lockOfficialNorthUp()}
  function officialSelectionHTML(){return '<div class="amap-select-pin" aria-hidden="true"><span class="pin-shadow"></span><span class="pin-head"></span><span class="pin-hole"></span></div>'}
  function updateOfficialSelectionPin(place){
    if(!officialMap||!officialSDK)return;
    if(!place||!Number.isFinite(+place.lat)||!Number.isFinite(+place.lng)){if(officialSelectionMarker){officialSelectionMarker.setMap(null);officialSelectionMarker=null}return;}
    const pos=wgsToGcj(+place.lng,+place.lat);
    if(!officialSelectionMarker){officialSelectionMarker=new officialSDK.Marker({map:officialMap,position:pos,content:officialSelectionHTML(),offset:new officialSDK.Pixel(-27,-58),anchor:'bottom-center'})}
    else{officialSelectionMarker.setPosition(pos);officialSelectionMarker.setContent(officialSelectionHTML());officialSelectionMarker.setMap(officialMap)}
    lockOfficialNorthUp();
  }
  function hideOfficial(){
    if(!officialMap)return;
    const c=officialCenter(),z=officialMap.getZoom();
    document.body.classList.remove('amap-active','vector-active');$('amapSurface').hidden=true;officialMap.setStatus({dragEnable:false,zoomEnable:false});
    updateOfficialSelectionPin(null);
    if(officialYouMarker){officialYouMarker.setMap(null);officialYouMarker=null;}
    map.jumpTo({center:[c.lng,c.lat],zoom:z});clearPoiOverlay();$('atlasBookmarkOverlay')?.replaceChildren();officialPoiMarkers.forEach(m=>m.hide());
    mapMode='figure';updateLayerLabel();scheduleFigure();
  }
  function officialMarker(lat,lng,content,click){
    const pin=document.createElement('div');pin.innerHTML=content;pin.style.cursor='pointer';
    const select=e=>{e?.stopPropagation?.();e?.originalEvent?.stopPropagation?.();if(Date.now()-lastPoiTap<320)return;lastPoiTap=Date.now();lastHotspot=lastPoiTap;click()};
    pin.addEventListener('click',select);
    pin.addEventListener('touchend',e=>{if(e.cancelable)e.preventDefault();select(e)},{passive:false});
    const marker=new officialSDK.Marker({map:officialMap,position:wgsToGcj(lng,lat),content:pin,offset:new officialSDK.Pixel(-19,-19),bubble:false,zIndex:220});
    marker.on('click',select);
    return marker;
  }
  function paintOfficialBookmarks(){
    // Use a separate HTML hit layer. The older AMap Marker event routing was unreliable on iOS.
    officialMarkers.forEach(m=>m.setMap(null));officialMarkers=[];
    renderBookmarkOverlay();
  }
  function decoratePhotoPin(button,p){
    // Stage1.34: A saved place ALWAYS looks like the same star, with or without media.
    // Photos belong in the media bubble; never turn a starred location into a photo pin.
    button.classList.remove('atlas-photo-location-pin','atlas-photo-unavailable');
    return false;
  }
  const SAVED_STAR_SVG='<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3.7 25.2 13.5 36.1 15.2 28.3 23 30.1 34 20 28.7 9.9 34 11.7 23 3.9 15.2 14.8 13.5Z" fill="#C9AD79" stroke="#314346" stroke-width="2.25" stroke-linejoin="round"/></svg>';

  /* build .21 · 与矢量模式同一原则：星 pin DOM 复用，mapmove 只更新坐标——高德模式下照片 pin 也不再闪白框 */
  const amapStarCache=new Map();
  function renderBookmarkOverlay(){
    const pane=$('atlasBookmarkOverlay');if(!pane)return;
    if(!isOfficial()||!officialSDK||!officialMap)return;
    const zoom=officialMap.getZoom();
    if(zoom<11.5&&!window.__atlasTripPicking)return;
    const seen=new Set();
    for(const p of places.filter(x=>x.starred!==false)){
      const xy=wgsToGcj(+p.lng,+p.lat);
      let point;try{point=officialMap.lngLatToContainer(new officialSDK.LngLat(xy[0],xy[1]))}catch(e){continue}
      const x=Number(point?.getX?.()??point?.x),y=Number(point?.getY?.()??point?.y);
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>window.innerWidth||y<0||y>window.innerHeight)continue;
      const key=String(p.id);seen.add(key);
      let button=amapStarCache.get(key);
      if(!button){
        button=document.createElement('button');button.type='button';button.className='atlas-bookmark-hit';button.dataset.placeId=key;
        decoratePhotoPin(button,p);button.setAttribute('aria-label','查看星标 '+String(p.title||''));
        button.innerHTML=SAVED_STAR_SVG;button.dataset.rank='2';
        button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();lastPoiTap=Date.now();if(selectedId===p.id&&$('memorySheet').classList.contains('visible'))closeMemory();else showPlace(p.id)});button.addEventListener('pointerup',event=>event.stopPropagation());
        amapStarCache.set(key,button);
      }
      // Identical star at ALL zoom levels; never a yellow dot or a photo card.
      button.style.left=x+'px';button.style.top=y+'px';
      button.classList.toggle('selected',selectedId===p.id);
      if(button.parentNode!==pane)pane.append(button);
    }
    for(const [k,el] of amapStarCache){if(!seen.has(k)){el.remove();amapStarCache.delete(k)}}
  }
  // Independent, real DOM hit targets: avoid AMap Marker/map click competition on iOS.
  // Visual hierarchy: no POIs on city view; tiny points at neighborhood scale,
  // progressive names only as the user reaches an actual street.
  function clearPoiOverlay(){
    const pane=$('atlasPoiOverlay');if(pane)pane.replaceChildren();poiOverlayPlaces=[];
    if(poiOverlayRaf){cancelAnimationFrame(poiOverlayRaf);poiOverlayRaf=0;}
  }
  function requestPoiOverlayRender(){
    if(poiOverlayRaf)return;
    poiOverlayRaf=requestAnimationFrame(()=>{poiOverlayRaf=0;renderPoiOverlay()});
  }
  // Real API-backed POIs, with DOM hit-targets on top of the basemap (iOS friendly).
  // Map annotations are light at distant zooms, names appear at street scale.
  let officialNearbyPlaces=[],officialNearbyCache='',officialNearbyFetchTime=0,officialNearbyTimer=null;
  function showOfficialPoi(items){officialNearbyPlaces=Array.isArray(items)?items:[];requestPoiOverlayRender()}
  function renderPoiOverlay(){
    /* build .17 · 停用 DOM 文字 pin:高德/矢量底图已烘焙 POI 标签,DOM 再画一遍就是用户看到的重复文字 pin。
       点击能力不受影响——高德用原生 hotspotclick,矢量用 queryRenderedFeatures(selectVectorTap)。 */
    const pane=$('atlasPoiOverlay');if(!pane)return;pane.replaceChildren();
  }
  async function officialSearchPlaces(query,nearby=false,category='scenic'){
    if(!officialMap||!officialSDK)return [];
    if(officialPoiBackendAvailable){
      const c=officialMap.getCenter();
      const zoom=officialMap.getZoom();
      const radius=zoom>=15?2500:zoom>=13?6000:zoom>=11?12000:25000;
      const args=new URLSearchParams(nearby?{mode:'nearby',lng:String(c.getLng()),lat:String(c.getLat()),radius:String(radius),category}:{mode:'text',q:String(query).slice(0,72)});
      try{
        const response={ok:false,status:404,json:async()=>({code:'STATIC_HOSTING'})};
        const data=await response.json();
        if(response.ok&&Array.isArray(data.places))return data.places.map(p=>{const [lng,lat]=gcjToWgs(Number(p.lng),Number(p.lat));return {...p,lng,lat}});
        if(data.code==='KEY_REQUIRED'||data.code==='STATIC_HOSTING')officialPoiBackendAvailable=false;
        else console.warn('地点搜索响应异常',data.code||response.status);
      }catch(e){console.warn('地点搜索网络不可用',e.message)}
    }
    // Fall back to the official JS SDK plugin. Its Web-end Key is not the same as
    // a Web Service Key: do not use the former to call the REST API directly.
    const placeSearch=await new Promise((resolve,reject)=>{
      let timer=setTimeout(()=>reject(Error('高德地点插件加载超时')),11000);
      officialSDK.plugin('AMap.PlaceSearch',()=>{
        clearTimeout(timer);
        try{resolve(new officialSDK.PlaceSearch({city:'全国',citylimit:false,pageSize:20,pageIndex:1,extensions:'base'}))}catch(err){reject(err)}
      });
    });
    return await new Promise((resolve,reject)=>{
      const t=setTimeout(()=>reject(Error('高德搜索请求超时')),13000);
      const cb=(status,data)=>{
        clearTimeout(t);
        if(status==='error'){reject(Error('高德 POI 插件搜索失败'));return}
        if(status==='no_data'){resolve([]);return}
        const pois=data?.poiList?.pois||[];
        resolve(pois.filter(p=>p.location).map(p=>{
          const loc=p.location;
          const gx=typeof loc.getLng==='function'?loc.getLng():Array.isArray(loc)?Number(loc[0]):Number(String(loc).split(',')[0]);
          const gy=typeof loc.getLat==='function'?loc.getLat():Array.isArray(loc)?Number(loc[1]):Number(String(loc).split(',')[1]);
          if(!Number.isFinite(gx)||!Number.isFinite(gy))return null;
          const [lng,lat]=gcjToWgs(gx,gy);
          return {name:p.name,lat,lng,category:p.type||p.typecode||'目的地',address:p.address||'',city:p.cityname||''};
        }).filter(Boolean));
      };
      if(nearby){const c=officialMap.getCenter(),z=officialMap.getZoom();
        const radius=z>=15?2500:z>=13?6000:z>=11?12000:25000;
        placeSearch.searchNearBy(({food:'餐厅',hotel:'酒店',transit:'地铁站',culture:'博物馆',park:'公园',shopping:'商场',arts:'艺术中心'})[category]||'景点',[c.getLng(),c.getLat()],radius,cb);
      }else placeSearch.search(query,cb);
    });
  }
  let nearbyRequestId=0, nearbyTimer=null;
  async function showOfficialNearby(){
    if(!isOfficial()||!officialMap)return;
    const z=officialMap.getZoom();if(z<13){showOfficialPoi([]);return}
    const c=officialCenter(),cell=(z>=15?.008:.025),cacheKey=[Math.round(c.lng/cell),Math.round(c.lat/cell),Math.floor(z/2)].join(':');
    if(cacheKey===officialNearbyCache&&Date.now()-officialNearbyFetchTime<60000){requestPoiOverlayRender();return}
    const req=++nearbyRequestId;
    const categories=[['scenic','景点'],['food','餐饮'],['hotel','酒店'],['transit','地铁站'],['culture','博物馆'],['park','公园'],['shopping','购物'],['arts','艺术中心']];
    const results=await Promise.allSettled(categories.map(([cat,q])=>officialSearchPlaces(q,true,cat)));
    if(req!==nearbyRequestId)return;
    const merged=[];
    results.forEach((result,i)=>{
      if(result.status==='fulfilled'&&Array.isArray(result.value))merged.push(...result.value.slice(0,30));
      else if(result.status==='rejected')console.warn('周边地点部分获取失败',categories[i][0],result.reason);
    });
    officialNearbyCache=cacheKey;officialNearbyFetchTime=Date.now();
    const uniq=new Map();for(const p of merged){const id=p.id||String(p.name)+':'+Math.round(p.lat*10000)+':'+Math.round(p.lng*10000);if(!uniq.has(id))uniq.set(id,p)}
    showOfficialPoi([...uniq.values()]);
  }
  function queueOfficialNearby(){clearTimeout(officialNearbyTimer);officialNearbyTimer=setTimeout(showOfficialNearby,480)}
  function syncNativeFeatures(){
    if(!officialMap)return;
    const z=officialMap.getZoom();
    const mode=z<8?['bg','road','point']:['bg','road','point','building'];
    const signature=mode.join(',');
    if(officialFeatureSignature===signature)return;
    officialFeatureSignature=signature;
    officialMap.setFeatures(mode);
  }
  // Single map mode: high fidelity AMap architectural white massing, always plan view.
  // Zooming alters level of detail only; it must never switch providers, layers or camera pitch.
  function setOfficialView(view){
    officialView='white';
    if(!officialMap){openOfficial('white');return;}
    const A=officialSDK,surface=$('amapSurface');
    try{
      surface.classList.remove('amap-style-street','amap-style-satellite','amap-style-white');
      surface.classList.add('amap-style-white');
      if(!officialBaseLayer)officialBaseLayer=new A.TileLayer();
      officialMap.setLayers([officialBaseLayer]);
      officialMap.setMapStyle('amap://styles/whitesmoke');
      syncNativeFeatures();
      if(!officialBuildings&&A.Buildings){
        officialBuildings=new A.Buildings({zIndex:130,zooms:[15,20],wallColor:'#e4e4e4',roofColor:'#ffffff',heightFactor:1});
      }
      if(officialBuildings){officialMap.remove(officialBuildings);officialBuildings=null;} // No extruded buildings in orthographic plan view.
      officialMap.setPitch?.(desiredModelPitch(officialMap.getZoom()));
      officialMap.setRotation?.(0);
      applyOfficialStatus();
      useOfficialMap();updateLayerLabel();
    }catch(e){console.error('白模地图加载失败',e);toast('地图加载中，请稍后重试');}
  }
  async function pickNearestOfficialPlace(e){
    if(!officialPoiBackendAvailable||!e?.lnglat)return;
    const request=++pendingPick, clickGcj={lng:e.lnglat.getLng(),lat:e.lnglat.getLat()};
    try{
      const query=new URLSearchParams({mode:'pick',lng:String(clickGcj.lng),lat:String(clickGcj.lat),radius:'350'});
      const response=await fetch('./api/pois?'+query.toString(),{cache:'no-store'});
      if(!response.ok)return;
      const result=await response.json();
      if(request!==pendingPick||!isOfficial()||!selectedDestination||!result.places?.length)return;
      const p=result.places[0],wgs=gcjToWgs(Number(p.lng),Number(p.lat));
      // Do not replace a legitimate hotspot with a distant, unrelated POI.
      if(!Number.isFinite(Number(p.distance))||Number(p.distance)>45)return;
      showDestination({...p,lng:wgs[0],lat:wgs[1]});
    }catch(err){console.warn('附近地点查询失败',err)}
  }
  function useOfficialMap(){
    if(!officialMap)return;
    if(mapMode!=='amap'){
      const c=map.getCenter(),z=map.getZoom();
      const closest=places.slice().sort((a,b)=>Math.hypot(a.lng-c.lng,a.lat-c.lat)-Math.hypot(b.lng-c.lng,b.lat-c.lat))[0];
      // A country-scale map only shows city labels. Bring the user to street level,
      // where individual POIs are visible and tappable.
      const shouldFocus=false;
      officialMap.setZoomAndCenter(shouldFocus?13:z,
        wgsToGcj(shouldFocus?Number(closest.lng):c.lng,shouldFocus?Number(closest.lat):c.lat));
    }
    $('amapSurface').hidden=false;document.body.classList.remove('legacy-recovery','vector-active');document.body.classList.add('amap-active');
    mapMode='amap';applyOfficialStatus();officialMap.resize?.();renderPoiOverlay();if(currentUserCoords&&officialSDK){if(officialYouMarker)officialYouMarker.setMap(null);const loc=currentUserCoords;officialYouMarker=new officialSDK.Marker({map:officialMap,position:wgsToGcj(loc.lng,loc.lat),content:'<div class="amap-you-dot" title="当前位置"></div>',offset:new officialSDK.Pixel(-8,-8),zIndex:150});}
    updateLayerLabel();paintOfficialBookmarks();if(selectedDestination)updateOfficialSelectionPin(selectedDestination);showOfficialNearby();hideMapWarning();mapConnection('',false);toggleLayerMenu(false);
  }
  function officialSdkScript(){
    if(window.AMap)return Promise.resolve(window.AMap);
    if(officialLoading)return Promise.reject(Error('地图仍在加载，请稍候'));
    officialLoading=true;
    window._AMapSecurityConfig={serviceHost:location.origin+'/_AMapService'};
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src='https://webapi.amap.com/maps?v=2.0&key='+encodeURIComponent(officialKey)+'&plugin=AMap.PlaceSearch';s.async=true;s.crossOrigin='anonymous';
      const timer=setTimeout(()=>{officialLoading=false;reject(Error('高德地图连接超时'))},14000);
      s.onload=()=>{clearTimeout(timer);officialLoading=false;if(window.AMap)resolve(window.AMap);else reject(Error('高德 JS API 未能初始化'))};
      s.onerror=()=>{clearTimeout(timer);officialLoading=false;reject(Error('无法读取高德 JS API'))};
      document.head.appendChild(s);
    });
  }
  async function checkOfficialConfiguration(){
    if(window.AtlasServices?.staticHost)throw Error('GitHub Pages 不提供高德地图服务端配置；请使用默认地图模式');
    let response;
    try{response=await fetch('./api/amap-config',{cache:'no-store',credentials:'same-origin'})}
    catch(_){throw Error('暂时无法联系地图配置服务')}
    if(!response.ok)throw Error('地图配置服务暂时不可用');
    const cfg=await response.json();
    if(!cfg.ready||!cfg.key)throw Error('高德 Web Key 或安全密钥尚未配置到网站服务器');
    officialPoiBackendAvailable=!!cfg.poiReady;
    return cfg;
  }
  async function activateOfficial(){
    $('amapForm').querySelector('[type="submit"]').disabled=true;
    try{
      const config=await checkOfficialConfiguration();
      officialKey=config.key;
      $('amapSetupStatus').textContent='已找到高德配置，正在连接官方地图…';
      officialSDK=await officialSdkScript();
      if(!officialMap){
        $('amapSurface').hidden=false;
        const c=currentCenter();
        officialMap=new officialSDK.Map('amapSurface',{zoom:currentZoom(),center:wgsToGcj(c.lng,c.lat),viewMode:'2D',pitch:0,rotation:0,isHotspot:true,mapStyle:'amap://styles/whitesmoke',resizeEnable:true,rotateEnable:false,pitchEnable:false,dragEnable:true,zoomEnable:true,keyboardEnable:false,jogEnable:false});
        officialMap.on('complete',()=>{if(isOfficial()){document.body.classList.add('atlas-remote-ready');document.body.classList.remove('map-booting');mapConnection('',false);queueOfficialNearby();}});
        officialMap.on('hotspotclick',e=>{
          if(!isOfficial()||picking||Date.now()-lastPoiTap<700)return;
          lastHotspot=Date.now();++pendingPick;
          const loc=e.lnglat||e.lngLat;
          if(!loc)return;
          const [lng,lat]=gcjToWgs(loc.getLng(),loc.getLat());
          showDestination({id:String(e.id||''),name:String(e.name||'目的地'),lng,lat,category:'高德地点'});
        });
        officialMap.on('click',e=>{
          if(!isOfficial()||picking||Date.now()-lastHotspot<800||Date.now()-lastPoiTap<800)return;
          const [lng,lat]=gcjToWgs(e.lnglat.getLng(),e.lnglat.getLat());
          if(selectedId){closeMemory();return;}
          if(selectedDestination)hideDestination();
          // Blank map space only dismisses details. Named AMap hotspots remain tappable.
          // Do not invent a coordinate card on every incidental pan or tap.
        });
        officialMap.on('mapmove',()=>{if(isOfficial()){renderBookmarkOverlay();requestPoiOverlayRender()}});
        officialMap.on('moveend',()=>{if(!isOfficial())return;lockOfficialNorthUp();renderBookmarkOverlay();/* Inactive raster camera syncs once in hideOfficial(), never during AMap movement. */if(selectedId)relayoutMemoryOpen();queueOfficialNearby();requestPoiOverlayRender();});
        officialMap.on('zoomend',()=>{if(!isOfficial())return;lockOfficialNorthUp();syncNativeFeatures();renderBookmarkOverlay();queueOfficialNearby();requestPoiOverlayRender();});
        officialMap.on('touchend',()=>{if(!isOfficial())return;lockOfficialNorthUp();});
      }
      applyOfficialStatus();
      if($('amapSetup').open)$('amapSetup').close();setOfficialView(officialView);if(officialMap.getStatus?.()?.loaded){document.body.classList.add('atlas-remote-ready');document.body.classList.remove('map-booting')}else{setTimeout(()=>{if(isOfficial()&&$('amapSurface').querySelector('canvas')&&officialMap.getZoom()>0){document.body.classList.add('atlas-remote-ready');document.body.classList.remove('map-booting')}},2600)};
    }catch(err){console.warn('高德地图不可用，改用真实矢量底图:',err);const msg=err?.message||'高德服务连接失败';$('amapSetupStatus').textContent=msg+'。正在连接备用真实地图。';/* build .18 · 静默回落矢量图,启动期不再叠 toast */$('amapSurface').hidden=true;document.body.classList.remove('amap-active');activateVectorMap();}

    finally{$('amapForm').querySelector('[type="submit"]').disabled=false;}
  }
  async function openOfficial(view){
    if(typeof view==='string'&&['street','satellite','white'].includes(view))officialView=view;
    toggleLayerMenu(false);
    if(officialMap){setOfficialView(officialView);return}
    if(!$('amapSetup').open)$('amapSetup').showModal();
    $('amapSetupStatus').textContent='正在检查高德连接状态…';
    try{await checkOfficialConfiguration();$('amapSetupStatus').textContent='已配置高德地图，可点击「检查并连接高德」。'}
    catch(e){$('amapSetupStatus').textContent=e.message+'。需在网站部署后台配置 AMAP_WEB_KEY 和 AMAP_SECURITY_CODE。';}
  }
  // Stage 1.34.4: one common geometry contract for the geographic camera
  // and the independent four-bubble display. The previous broad 64px star
  // safety zone left stars near the edge, so the orbit silently collapsed to
  // two tiny panels even when the screen was large enough for all four.
  let placeFocusTimer=null,placeFocusCleanup=null,placeFocusSequence=0;
   function getFourBubbleFocusCorridor(W,H){
     const g=window.__atlasOrbitGeometry?.(W,H);
     if(g)return g; // identical geometry to the actual four SVG silhouettes
     const dockTop=document.getElementById('appDock')?.getBoundingClientRect().top||H-88;
     const top=Math.max(76,(window.visualViewport?.offsetTop||0)+18),bottom=Math.min(H-16,dockTop-16);
     const scale=Math.max(.67,Math.min(.96,(W-28)/400,(Math.max(170,bottom-top)-22)/302));
     const left=14+187*scale,right=W-14-213*scale,upper=top+147*scale,lower=bottom-129*scale;
     return{fullFourPossible:scale>=.78&&left<=right+.5&&upper<=lower+.5,scale,left,right,top:upper,bottom:lower};
   }
  // Exported read-only geometry probe for headless layout acceptance tests.
  window.__atlasOrbitFocusCorridor=()=>getFourBubbleFocusCorridor(innerWidth,innerHeight);
  window.__atlasOrbitRequestFocus=p=>focusMapPlaceIfNeeded(p);
   function focusMapPlaceIfNeeded(p){
     if(window.__atlasInteractionMode==='swipe-card')return false;
     // A second tap cancels the previous camera transaction immediately.
     ++placeFocusSequence;
     placeFocusCleanup?.();placeFocusCleanup=null;
     if(placeFocusTimer){clearTimeout(placeFocusTimer);placeFocusTimer=null}
     document.body.classList.remove('atlas-map-reframing');
     const lat=Number(p?.lat),lng=Number(p?.lng);
    if(p?.lat==null||p?.lng==null||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85.05||Math.abs(lng)>180)return false;
    const active=isVector()?vectorMap:(!isOfficial()?map:null);
    if(!active){
      if(!isOfficial()||!officialMap)return false;
      const corridor=getFourBubbleFocusCorridor(innerWidth,innerHeight);
      if(!corridor.fullFourPossible)return false;
      let point;
      try{
       const xy=wgsToGcj(lng,lat),q=officialMap.lngLatToContainer(new officialSDK.LngLat(xy[0],xy[1]));
       const rect=officialMap.getContainer().getBoundingClientRect();
       point={x:Number(q.getX?.()??q.x)+rect.left,y:Number(q.getY?.()??q.y)+rect.top};
      }catch(_){return false}
      if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;
      const dx=Math.max(corridor.left,Math.min(corridor.right,point.x))-point.x;
      const dy=Math.max(corridor.top,Math.min(corridor.bottom,point.y))-point.y;
      if(Math.hypot(dx,dy)<5)return false;
      const seq=++placeFocusSequence;document.body.classList.add('atlas-map-reframing');userHasMovedMap=true;
      let done=false;
      const finish=()=>{
       if(done||seq!==placeFocusSequence)return;done=true;
       if(placeFocusTimer)clearTimeout(placeFocusTimer);placeFocusTimer=null;
       placeFocusCleanup?.();placeFocusCleanup=null;
       document.body.classList.remove('atlas-map-reframing');
       document.dispatchEvent(new Event('atlas:focus-settled'));
      };
      officialMap.on?.('moveend',finish);
      placeFocusCleanup=()=>officialMap.off?.('moveend',finish);
      placeFocusTimer=setTimeout(finish,860);
      try{if(typeof officialMap.panBy==='function')officialMap.panBy(dx,dy,480);
        else setMapView(lat,lng,currentZoom(),true);
      }catch(_){finish();return false}
      return true;
    }
    const rasterFallback=typeof active.project!=='function'&&typeof active._pixel==='function'&&typeof active._moveCenter==='function';
    if(!rasterFallback&&(typeof active.project!=='function'||typeof active.panBy!=='function'))return false;
    let projected;
    try{
      if(rasterFallback){
        const q=active._pixel(lng,lat),rect=active.getContainer().getBoundingClientRect();
        projected={x:q.x+rect.left,y:q.y+rect.top};
       }else{const q=active.project([lng,lat]),r=active.getContainer?.()?.getBoundingClientRect();projected={x:q.x+(r?.left||0),y:q.y+(r?.top||0)}}
    }catch(_){return false}
    if(!projected||!Number.isFinite(projected.x)||!Number.isFinite(projected.y))return false;
    const W=innerWidth,H=innerHeight;
    const fit=getFourBubbleFocusCorridor(W,H);
    const dockTop=document.getElementById('appDock')?.getBoundingClientRect().top||H-88;
    const top=Math.max(88,(window.visualViewport?.offsetTop||0)+95),bottom=Math.min(H-110,dockTop-110);
    const fallback={left:64,right:W-64,top,bottom:Math.max(top+70,bottom)};
    const region=fit.fullFourPossible?fit:fallback;
    const targetX=Math.max(region.left,Math.min(region.right,projected.x));
    const targetY=Math.max(region.top,Math.min(region.bottom,projected.y));
    const dx=targetX-projected.x,dy=targetY-projected.y;
    if(Math.hypot(dx,dy)<6)return false;
    // Finish any previous camera movement before starting a new tap; a later
    // 'moveend' or timeout may never reveal a different place's bubbles.
    placeFocusCleanup?.();placeFocusCleanup=null;
    if(placeFocusTimer){clearTimeout(placeFocusTimer);placeFocusTimer=null}
    const seq=++placeFocusSequence;
    document.body.classList.add('atlas-map-reframing');
    userHasMovedMap=true;
    let done=false;
    const finish=()=>{
      if(done||seq!==placeFocusSequence)return;
      done=true;
      if(placeFocusTimer){clearTimeout(placeFocusTimer);placeFocusTimer=null}
      placeFocusCleanup?.();placeFocusCleanup=null;
      document.body.classList.remove('atlas-map-reframing');
      document.dispatchEvent(new Event('atlas:focus-settled'));
    };
    if(typeof active.on==='function'&&typeof active.off==='function'){
      active.on('moveend',finish);
      placeFocusCleanup=()=>active.off('moveend',finish);
    }
    placeFocusTimer=setTimeout(finish,850);
    try{
      const duration=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:490;
      if(!rasterFallback)active.panBy([dx,dy],{duration,essential:true});
      else{
        // The lightweight fallback map exposes _moveCenter instead of panBy.
        // Use the same geographic focus movement rather than dropping to two cards.
        const begin=performance.now();let last=0;
        const step=t=>{
          if(seq!==placeFocusSequence)return;
          const fraction=duration?Math.min(1,(t-begin)/duration):1;
          const eased=1-Math.pow(1-fraction,3),change=eased-last;last=eased;
          active._moveCenter(dx*change,dy*change);
          renderBookmarkOverlay();
          if(fraction<1)requestAnimationFrame(step);else{active._fire?.('moveend');finish()}
        };
        requestAnimationFrame(step);
      }
    }catch(_){finish();return false}
    return true;
  }
  let pendingCamera=loadMapView()||loadLastCoords()||{lat:29.492,lng:121.905,zoom:13.35};
  const currentCenter=()=>isOfficial()?officialCenter():isVector()?(()=>{const c=vectorMap.getCenter();return {lat:c.lat,lng:c.lng}})():{lat:map?.getCenter?.().lat??pendingCamera.lat,lng:map?.getCenter?.().lng??pendingCamera.lng};
  const currentZoom=()=>isOfficial()?officialMap.getZoom():isVector()?vectorMap.getZoom():(map?.getZoom()??pendingCamera.zoom??13.35);
  function setMapView(lat,lng,zoom,animated=true){
    if(!Number.isFinite(+lat)||!Number.isFinite(+lng)||Math.abs(+lat)>85.05||Math.abs(+lng)>180)return;
    // A deliberate camera change takes priority over delayed automatic GPS callbacks.
    userHasMovedMap=true;
    if(isVector()){vectorMap[animated?'flyTo':'jumpTo']({center:[lng,lat],zoom:zoom??vectorMap.getZoom(),essential:true,duration:animated?620:0});return;}
    if(isOfficial()){officialMap.setZoomAndCenter(zoom??officialMap.getZoom(),wgsToGcj(lng,lat),!animated,animated?420:0);return}
    if(!map){pendingCamera={lat:+lat,lng:+lng,zoom:zoom??currentZoom()};return}
    if(animated)map.flyTo({center:[lng,lat],zoom:zoom??map.getZoom(),speed:1.45,curve:1.2,essential:true});
    else map.jumpTo({center:[lng,lat],zoom:zoom??map.getZoom()});
  }
  function removeMapItem(item){if(item)item.remove()}
  function closeMapPopup(){} // Memory is composed over the map; it is not a bottom sheet.
  function zoomMap(delta){userHasMovedMap=true;if(isVector()){vectorMap.easeTo({zoom:Math.max(2,Math.min(19,vectorMap.getZoom()+delta)),duration:380,essential:true});return}if(isOfficial()){officialMap.setZoom(Math.max(2,Math.min(19,officialMap.getZoom()+delta)));return}map.zoomTo(Math.max(2,Math.min(19,map.getZoom()+delta)),{duration:260})}
  function fitMapPlaces(list,maximum=12){
    userHasMovedMap=true; // Explicit overview, never overwritten by a pending GPS response.
    const points=list.filter(p=>Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)&&Math.abs(+p.lat)<=85.05&&Math.abs(+p.lng)<=180);if(!points.length)return;
    if(points.length===1){setMapView(+points[0].lat,+points[0].lng,Math.min(maximum,15.2));return}
    if(isVector()){const b=new window.maplibregl.LngLatBounds();points.forEach(p=>b.extend([+p.lng,+p.lat]));vectorMap.fitBounds(b,{maxZoom:maximum,padding:{top:140,bottom:235,left:30,right:60},duration:720});return;}
    const bounds=new maplibregl.LngLatBounds();points.forEach(p=>bounds.extend([+p.lng,+p.lat]));
    map.fitBounds(bounds,{maxZoom:maximum,padding:{top:150,bottom:230,left:38,right:65},duration:750});
    if(isOfficial()){const c=map.getCenter();officialMap.setZoomAndCenter(map.getZoom(),wgsToGcj(c.lng,c.lat));}
  }
  /* dock「总览」：收起面板后缩放到全部足迹 */
  window.__atlasFitAll=()=>{const pts=places.filter(p=>p.starred!==false&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)&&Math.abs(+p.lat)<=85.05&&Math.abs(+p.lng)<=180);if(pts.length)fitMapPlaces(pts,12)};
  /* build .20 · 供选点规划读取：当前位置（顺路排序锚点/我的城市反查）与取消收藏 */
  window.__atlasUserCoords=()=>currentUserCoords;
  window.__atlasCancelBookmark=id=>cancelBookmark(id);
  function markerHTML(active=false){return `<div class="star-pin ${active?'selected':''}" role="button" tabindex="0" aria-label="打开收藏"><svg width="44" height="44" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M20 3.7 25.2 13.5 36.1 15.2 28.3 23 30.1 34 20 28.7 9.9 34 11.7 23 3.9 15.2 14.8 13.5Z" fill="#D7B36E" stroke="#344149" stroke-width="2.2" stroke-linejoin="round"/><path d="M20 3.7 25.2 13.5 36.1 15.2 28.3 23 30.1 34 20 28.7 9.9 34 11.7 23 3.9 15.2 14.8 13.5Z" fill="none" stroke="#8c5b05" stroke-width=".5"/></svg></div>`}
  function renderMapPin(lat,lng,id,title,active){
    const el=document.createElement('div');el.innerHTML=markerHTML(active);const pin=el.firstElementChild;
    pin.dataset.placeId=String(id);pin.setAttribute('aria-label','查看 '+title);pin.title=title;pin.dataset.rank='2';
    pin.addEventListener('click',e=>{e.stopPropagation();if(selectedId===id&&$('memorySheet').classList.contains('visible')){closeMemory();return}showPlace(id)});
    pin.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(selectedId===id&&$('memorySheet').classList.contains('visible'))closeMemory();else showPlace(id)}});
    return new maplibregl.Marker({element:pin,anchor:'center'}).setLngLat([lng,lat]).addTo(map);
  }
  function pulseStar(id){
    const key=String(id);
    for(const el of document.querySelectorAll('.star-pin,.atlas-bookmark-hit')){
      if(el.dataset?.placeId!==key)continue;
      el.classList.remove('atlas-star-pop');void el.offsetWidth;el.classList.add('atlas-star-pop');
      el.addEventListener('animationend',()=>el.classList.remove('atlas-star-pop'),{once:true});
    }
  }
  function updateMarkerIcon(m,active){if(m)m.getElement()?.classList.toggle('selected',active)}
  function addSearchMarker(lat,lng,name){if(!map)return;removeMapItem(searchPin);const el=document.createElement('div');el.className='search-dot';el.title=name;searchPin=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([lng,lat]).addTo(map)}
  function addLocationMarker(lat,lng){if(!map)return;removeMapItem(locationPin);const el=document.createElement('div');el.className='loc-dot';el.title='当前位置';locationPin=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([lng,lat]).addTo(map)}
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const photoSrc=src=>typeof src==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(src)?src:'';
  const videoType=t=>typeof t==='string' && /^video\//.test(t);
  const makeVideoURL=video=>video?.blob instanceof Blob?URL.createObjectURL(video.blob):null;
  async function storeVideo(f){
    if(fallback){toast('此浏览器不支持永久保存视频，请用 Safari 打开');return null}
    if(f.size>80*1024*1024){toast('单条视频超过 80MB，请先在相册压缩后再上传');return null}
    if(!videoType(f.type)&&!/(?:(?:mp4)|(?:mov)|(?:webm))$/i.test(f.name))return null;
    return {id:uid(),name:f.name,type:f.type||'video/mp4',size:f.size,blob:new Blob([await f.arrayBuffer()],{type:f.type||'video/mp4'})};
  }
  const uid=()=>('p'+Date.now().toString(36)+Math.random().toString(36).slice(2,9));
  const today=()=>new Date().toLocaleDateString('en-CA');
  function toast(t){$('toast').textContent=t;$('toast').classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>$('toast').classList.remove('visible'),3000)}
  function pulseSavedStar(id){requestAnimationFrame(()=>{const el=document.querySelector('.atlas-bookmark-hit[data-place-id="'+id+'"],.star-pin[data-place-id="'+id+'"]');if(el){el.classList.add('atlas-star-pop');setTimeout(()=>el.classList.remove('atlas-star-pop'),700)}});try{navigator.vibrate?.(12)}catch(e){}}
  async function database(){if(!('indexedDB' in window)){fallback=true;return}try{db=await new Promise((resolve,reject)=>{const r=indexedDB.open('private-travel-footprints-v1',1);const timeout=setTimeout(()=>reject(new Error('储存启动超时')),4000);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('places'))d.createObjectStore('places',{keyPath:'id'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'})};r.onsuccess=()=>{clearTimeout(timeout);resolve(r.result)};r.onerror=()=>{clearTimeout(timeout);reject(r.error)}});}catch(e){fallback=true;try{const k='travel-storage-test';localStorage.setItem(k,'ok');localStorage.removeItem(k)}catch(err){storageIsTransient=true}toast(storageIsTransient?'当前浏览器无法长期保存，收藏后请导出备份':'本机备用储存已启用，建议定期备份')}}
  // IndexedDB request success is NOT a committed write. Confirm only when
  // the full transaction completes, so a quota/abort cannot look like a save.
  function txn(store,mode,fn){
    return new Promise((resolve,reject)=>{
      let tx,result;
      try{
        tx=db.transaction(store,mode);
        tx.oncomplete=()=>resolve(result);
        tx.onerror=()=>reject(tx.error||new Error('STORAGE_TRANSACTION_FAILED'));
        tx.onabort=()=>reject(tx.error||new Error('STORAGE_TRANSACTION_ABORTED'));
        const req=fn(tx.objectStore(store));
        req.onsuccess=()=>{result=req.result};
      }catch(e){if(tx){try{tx.abort()}catch(_){}}reject(e)}
    });
  }
  function hydratePlace(p){return {...p,videos:(p.videos||[]).map(v=>{if(v?.blob instanceof Blob)return v;if(!v?.bytes)return v;const b=v.bytes;const data=b instanceof ArrayBuffer?b:ArrayBuffer.isView(b)?b:Array.isArray(b)?new Uint8Array(b):null;return data?{...v,blob:new Blob([data],{type:v.type||'video/mp4'})}:v})}}
  async function preparePlace(p){return {...p,videos:await Promise.all((p.videos||[]).map(async v=>{if(!(v?.blob instanceof Blob))return v;const bytes=await v.blob.arrayBuffer();const {blob,...rest}=v;return {...rest,bytes}}))}}
  async function allStored(){if(fallback){try{const value=JSON.parse(localStorage.getItem('travel-places')||'null');return (Array.isArray(value)?value:volatilePlaces).map(hydratePlace)}catch(e){return volatilePlaces.map(hydratePlace)}}return (await txn('places','readonly',s=>s.getAll())).map(hydratePlace)}
  async function getMeta(key){if(fallback){try{return JSON.parse(localStorage.getItem('travel-meta-'+key)||'null')||volatileMeta[key]||null}catch(e){return volatileMeta[key]||null}}return await txn('meta','readonly',s=>s.get(key))}
  async function setMeta(key,value){if(fallback){volatileMeta[key]={key,value};try{localStorage.setItem('travel-meta-'+key,JSON.stringify({key,value}))}catch(e){}return}return await txn('meta','readwrite',s=>s.put({key,value}))}
  async function upsert(place){const stored=await preparePlace(place);if(fallback){const a=[...(await allStored())],i=a.findIndex(p=>p.id===place.id);if(i<0)a.push(stored);else a[i]=stored;volatilePlaces=a;try{localStorage.setItem('travel-places',JSON.stringify(a))}catch(e){storageIsTransient=true;throw Error('本机存储失败，请导出备份')}return}await txn('places','readwrite',s=>s.put(stored))}
  window.__atlasPlaceStore={readAll:()=>allStored(),save:p=>upsert(p)};
  async function remove(id){if(fallback){const a=(await allStored()).filter(p=>p.id!==id);volatilePlaces=a;try{localStorage.setItem('travel-places',JSON.stringify(a))}catch(e){}return}return await txn('places','readwrite',s=>s.delete(id))}
  // Restore every place in one transaction; an import must never partially
  // overwrite the user's map if a video or photo hits the browser storage quota.
  async function upsertMany(records){
    if(!records.length)return;
    records=await Promise.all(records.map(preparePlace));
    if(fallback){
      const merged=new Map((await allStored()).map(item=>[item.id,item]));
      for(const item of records)merged.set(item.id,item);
      const next=[...merged.values()];
      volatilePlaces=next;
      try{localStorage.setItem('travel-places',JSON.stringify(next))}
      catch(e){storageIsTransient=true;console.warn('本机空间不足，请立即导出备份',e);throw Error('导入未持久保存：本机空间不足，请释放空间后重试')}
      return;
    }
    return new Promise((resolve,reject)=>{
      let tx;
      try{
        tx=db.transaction('places','readwrite');
        tx.oncomplete=()=>resolve();
        tx.onabort=()=>reject(tx.error||Error('RESTORE_ABORTED'));
        tx.onerror=()=>reject(tx.error||Error('RESTORE_FAILED'));
        const store=tx.objectStore('places');
        for(const item of records)store.put(item);
      }catch(e){if(tx){try{tx.abort()}catch(_){}}reject(e)}
    });
  }
  async function refresh(){places=(await allStored()).sort((a,b)=>(b.date||'').localeCompare(a.date||''));bmStarCache.forEach(el=>el.remove());bmStarCache.clear();amapStarCache.forEach(el=>el.remove());amapStarCache.clear();renderMarkers();renderList();if(isVector())renderVectorBookmarks();$('pinCount').textContent=places.filter(p=>p.starred!==false).length;$('sheetCount').textContent=places.filter(p=>p.starred!==false).length+' 处收藏';window.__atlasFirstStarGuide?.evaluate?.();}
  // Raster layers are intentionally simple and keyless. The user's photos/notes never leave IndexedDB.
  // CARTO changed its service policy in September 2026 and now requires an API key.
  // Use the official, keyless OpenStreetMap standard tiles for this low-traffic personal map.
  const STREET_OSM='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const STREET_ESRI='https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
  const STREET_OSM_HOT='https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
  const ESRI_IMAGERY='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const SATELLITE_LABELS='https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
  function raster(id,tiles,attribution,maxzoom=19){return {type:'raster',tiles:[tiles],tileSize:256,attribution,maxzoom}}
  function styleFor(type){
    const imagery=type==='satellite';const base=imagery?ESRI_IMAGERY:(streetSource===0?STREET_OSM:streetSource===1?STREET_ESRI:STREET_OSM_HOT);
    const credit=imagery?'Imagery © Esri, Maxar, Earthstar Geographics':streetSource===0?'© OpenStreetMap contributors':streetSource===1?'© Esri / OpenStreetMap contributors':'© OpenStreetMap contributors · HOT / OSM France';
    const sources={base:raster('base',base,credit)};
    const layers=[{id:'base-raster',type:'raster',source:'base',paint:{'raster-opacity':1}}];
    if(imagery){sources.labels=raster('labels',SATELLITE_LABELS,'Reference labels © Esri');layers.push({id:'satellite-labels',type:'raster',source:'labels',paint:{'raster-opacity':0.96}})}
    return {version:8,name:imagery?'卫星与地名':'开放街道图',sources,layers};
  }
  function updateLayerLabel(){
    $('chipSatellite').textContent='◩ 卫星影像';
    $('chipStreet').classList.toggle('layer-on',mapMode==='standard');
    $('chipFigure').classList.toggle('layer-on',mapMode==='figure');
    $('chipSatellite').classList.toggle('layer-on',mapMode==='satellite');
    $('chipAmap').classList.toggle('layer-on',mapMode==='amap');
    $('amapStreet').classList.toggle('layer-on',mapMode==='amap'&&officialView==='street');
    $('amapSatellite').classList.toggle('layer-on',mapMode==='amap'&&officialView==='satellite');
    $('amapModel').classList.toggle('layer-on',mapMode==='amap'&&officialView==='white');
    $('btnLayers').title='固定白模地图';
    $('btnLayers').querySelector('.layer-label').textContent='图层';
    $('mapStatus').textContent=mapMode==='amap'?'白色建筑肌理 · 高德地图':'建筑底图载入中';
    document.body.classList.toggle('fg-active',mapMode==='figure');
    document.body.classList.toggle('standard-active',mapMode==='standard');
    if(map)document.body.classList.toggle('poi-detail',map.getZoom()>=14);
    if(!selectedId && $('helptext'))$('helptext').textContent='俯视白模 · 点击地点查看详情，★ 收藏旅途';
  }
  /* Stage 16: terminal map failures exit the loading state and reuse one accessible retry banner. */
  function showMapWarning(message){const el=$('mapError');el.querySelector('span').textContent=message;el.classList.add('visible');el.setAttribute('role','alert');document.body.classList.add('atlas-map-unavailable');document.body.classList.remove('map-booting');mapConnection('',false)}
  function hideMapWarning(){$('mapError').classList.remove('visible');document.body.classList.remove('atlas-map-unavailable')}
  function handleMapError(e){
    if(isVector()||isOfficial())return;
    if(!e?.sourceId&&!e?.error)return;
    const source=e.sourceId||e?.error?.sourceId||'';
    // Ignore harmless style errors and stale tiles from a previous style.
    if(source && source!=='base' && source!=='labels')return;
    if(map?.baseLoaded)return; // don't abandon a healthy map because one peripheral tile fails
    loadErrors++;
    if(loadErrors<2)return;
    if(satelliteOn){toast('卫星影像暂不可用，已返回黑白地图');installTileLayer('figure')}
    else if(streetSource<2){streetSource++;toast('地图源连接失败，正在自动切换');installTileLayer('street')}
    else showMapWarning('目前网络无法读取地图图片。仍可使用足迹、查看照片和导出备份；建议在 Safari 打开或稍后重试。');
  }
  function installTileLayer(mode='street',announce=false){
    if(!map)return;
    if(isOfficial())hideOfficial();
    const epoch=++styleEpoch;
    clearTimeout(styleTimeout);loadErrors=0;hideMapWarning();mapMode=mode==='satellite'?'satellite':mode==='standard'?'standard':'figure';satelliteOn=mapMode==='satellite';
    updateLayerLabel();paintBuildings();if(!satelliteOn)scheduleFigure();
    map.setStyle(styleFor(mode),{diff:false});
    // Wait for a fully loaded style, not just the first tile. No blank squares should persist indefinitely.
    const check=()=>{if(epoch!==styleEpoch)return;if(map.loaded()){hideMapWarning();clearTimeout(styleTimeout)}};
    map.once('idle',check);
    styleTimeout=setTimeout(()=>{
      if(epoch!==styleEpoch)return;
      if(!map.isSourceLoaded('base')){
        if(satelliteOn){toast('卫星影像暂不可用，已返回黑白地图');installTileLayer('figure')}
        else if(streetSource<2){streetSource++;installTileLayer('street')}
        else showMapWarning('地图图片加载超时。收藏和照片仍可在「足迹」中查看；请尝试 Safari 或点击重试。');
      }
    },5200);
    if(announce)toast(mapMode==='satellite'?'正在加载卫星影像':mapMode==='standard'?'正在加载可读地名地图':'已切回黑白建筑地图');
    renderDestinations();
  }
  function toggleLayerMenu(force){const el=$('layerMenu');const show=typeof force==='boolean'?force:el.hidden;el.hidden=!show;$('btnLayers').setAttribute('aria-expanded',String(show));}
  function changeLayer(){if(!map)return;installTileLayer(mapMode==='figure'?'standard':mapMode==='standard'?'satellite':'figure',true)}

  // Muted inline autoplay is permitted on modern iOS Safari with playsinline. Playback
  // stops when hidden/closed; object URLs are revoked to avoid retaining 80MB blobs.
  const inlineVideoUrls=new Map();let inlineObserver=null;
  function pauseInlineVideo(button,release=false){
    const v=button.querySelector('video');if(!v)return;
    try{v.pause()}catch(e){};if(release){v.removeAttribute('src');v.load();const url=inlineVideoUrls.get(button);if(url)URL.revokeObjectURL(url);inlineVideoUrls.delete(button);button.classList.remove('has-video')}
  }
  function stopInlineVideos(release=true){if(inlineObserver){inlineObserver.disconnect();inlineObserver=null}document.querySelectorAll('.atlas-video').forEach(b=>pauseInlineVideo(b,release))}
  function startInlineVideos(place){
    if(window.__atlasOrbitEnabled)return;
    stopInlineVideos();const videos=mediaItems(place);
    if(!('IntersectionObserver' in window))return;
    inlineObserver=new IntersectionObserver(entries=>{
      for(const ent of entries){const b=ent.target;const v=b.querySelector('video');if(!v)continue;
        const visible=ent.isIntersecting&&ent.intersectionRatio>.35&&document.visibilityState==='visible'&&document.body.classList.contains('memory-open')&&!$('viewer').classList.contains('visible');
        if(!visible){pauseInlineVideo(b,false);continue}
        if(!inlineVideoUrls.has(b)){
          const item=videos[Number(b.dataset.idx)];if(!item||item.kind!=='video')continue;
          const url=makeVideoURL(item);if(!url)continue;inlineVideoUrls.set(b,url);v.src=url;
        }
        v.muted=true;v.defaultMuted=true;v.playsInline=true;v.loop=true;
        v.play().then(()=>b.classList.add('has-video')).catch(()=>b.classList.remove('has-video'));
      }
    },{threshold:[0,.35,.7]});
    document.querySelectorAll('.atlas-video').forEach(b=>inlineObserver.observe(b));
  }
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')stopInlineVideos(true);else if(selectedId){const p=places.find(x=>x.id===selectedId);if(p)startInlineVideos(p)}});
  const encodeShare=p=>{
    const item={v:1,title:p.title||p.name||'旅行地点',date:p.date||'',note:String(p.note||'').slice(0,800),lat:Number(p.lat),lng:Number(p.lng),rank:p.rank||2};
    const u=new TextEncoder().encode(JSON.stringify(item));let raw='';for(const byte of u)raw+=String.fromCharCode(byte);
    return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  };
  function decodeShare(q){try{const raw=atob(q.replace(/-/g,'+').replace(/_/g,'/'));const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const obj=JSON.parse(new TextDecoder().decode(bytes));return obj?.v===1&&Number.isFinite(obj.lat)&&Number.isFinite(obj.lng)?obj:null}catch(e){return null}}
  // Public media sharing is explicit opt-in; all other journal data remains local.
  // The memory always remains local until the person explicitly chooses to share it.
  async function shareMemory(p){
    if(!p)return;
    if(location.protocol==='file:'){toast('请在部署后的网页打开，再分享可访问的链接');return}
    const title='来和我一起 HI / Explore · '+p.title;
    const fallback=new URL('./',location.href);fallback.searchParams.set('atlas',encodeShare(p));
    async function sendLink(url,mediaCount){
      if(navigator.share){try{await navigator.share({title,text:title,url});return}catch(e){if(e?.name==='AbortError')return}}
      try{await navigator.clipboard.writeText(url);toast(mediaCount?'照片、视频分享链接已复制':'分享链接已复制，可以发送到微信或小红书')}
      catch(_){window.prompt('复制分享链接',url)}
    }
    if(window.AtlasServices?.staticHost){
      if(!confirm('分享这个地点和想去原因？获得链接的人可查看这些文字和位置。照片与视频只保存在本机，不会包含在链接中。'))return;
      await sendLink(fallback.toString(),0);return;
    }
    // Be explicit: remote sharing publishes this selected memory, not the user's entire atlas.
    const photos=(p.photos||[]).filter(x=>photoSrc(x.src)).slice(0,9);
    const videos=(p.videos||[]).filter(x=>x.blob instanceof Blob).slice(0,6);
    if(!confirm('生成公开分享链接？\n仅这一个地点的名称、文字及选中的照片/视频会上传；获得链接的人可查看。其他星标不会分享。'))return;
    let canFallback=true;
    try{
      toast('正在准备独立分享链接…');
      const r=await fetch('./api/atlas-share-intent',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      if(!r.ok)throw Error('分享服务当前不可用：'+r.status);
      const claim=await r.json();if(!claim.id||!claim.exp||!claim.permit)throw Error('分享许可无效');
      const wantsMedia=photos.length+videos.length>0;
      const uploads=[];
      if(wantsMedia){
        const mod=await import('https://esm.sh/@vercel/blob@2/client');
        if(typeof mod.upload!=='function')throw Error('媒体组件加载失败');
        let idx=0;
        const media=[...photos.map(x=>({name:x.name||'photo.jpg',mime:'',src:x.src})),...videos.map(x=>({name:x.name||'video.mp4',blob:x.blob,mime:x.type||'video/mp4'}))];
        for(const m of media.slice(0,16)){
          let blob=m.blob;
          if(!blob){blob=await (await fetch(m.src)).blob()}
          if(!blob||blob.size>80*1024*1024)throw Error('单个媒体超过分享容量限制');
          const name=String(m.name||'memory').replace(/[^a-zA-Z0-9_.-]/g,'_').slice(-55)||'memory';
          const path='shares/'+claim.id+'/travel-atlas-pages/media/'+(idx++)+'-'+name;
          toast('正在上传旅行影像 '+idx+'/'+media.length);
          const uploaded=await mod.upload(path,blob,{access:'public',handleUploadUrl:'./api/atlas-share-upload',clientPayload:JSON.stringify(claim),contentType:blob.type||m.mime||'application/octet-stream'});
          if(!uploaded?.url)throw Error('上传没有返回媒体地址');
          uploads.push({url:uploaded.url,type:blob.type||m.mime||'image/jpeg',name:m.name});
        }
      }
      const data={...claim,name:String(p.title||'旅行记忆'),note:String(p.note||''),lng:Number(p.lng),lat:Number(p.lat),address:'',visitCount:p.stage==='visited'?1:0,media:uploads};
      const finish=await fetch('./api/atlas-share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      if(!finish.ok)throw Error('公开页面创建失败：'+finish.status);
      const url=location.origin+'/m/'+encodeURIComponent(claim.id);
      toast('独立分享页面已创建');await sendLink(url,uploads.length);return;
    }catch(err){
      console.warn('远程分享未成功，尚未生成公开链接',err);
      const hasMedia=photos.length+videos.length>0;
      if(!hasMedia||confirm('云端分享尚未成功。是否改为只分享地点和文字？照片与视频不会包含在备用链接中。')){
        await sendLink(fallback.toString(),0);
      }else toast('未生成分享链接，照片和视频仍安全保存在本机');
    }
  }
  function showIncomingShare(){const q=new URLSearchParams(location.search).get('atlas');if(!q)return;const place=decodeShare(q);if(!place)return;
    $('sharedTitle').textContent=place.title;$('sharedDate').textContent=place.date||'TRAVEL ATLAS';$('sharedNote').textContent=place.note||'一起探索这个地方。';
    $('shareNotice').classList.add('visible');$('sharedNavigation').onclick=()=>openNavigation(place);
    setMapView(place.lat,place.lng,15.3);
  }
  function openNavigation(place){if(!place||!Number.isFinite(+place.lat)||!Number.isFinite(+place.lng))return;
    const lng=Number(place.lng),lat=Number(place.lat),title=encodeURIComponent(place.title||place.name||'目的地'),gc=wgsToGcj(lng,lat);
    const links=[
      ['高德地图','https://uri.amap.com/navigation?to='+encodeURIComponent(gc[0]+','+gc[1]+','+(place.title||place.name||'目的地'))+'&mode=car&src=TravelAtlas&coordinate=gaode&callnative=1'],
      ['百度地图','https://api.map.baidu.com/direction?destination='+encodeURIComponent(lat+','+lng)+'&coord_type=wgs84&mode=driving&output=html&src=webapp.travelatlas.map'],
      ['Apple 地图','https://maps.apple.com/?daddr='+encodeURIComponent(lat+','+lng)+'&dirflg=d&q='+title]
    ];
    $('navLinks').replaceChildren();for(const [name,url] of links){const a=document.createElement('a');a.textContent='↗ '+name;a.href=url;a.target='_blank';a.rel='noopener noreferrer';$('navLinks').append(a)}
    $('navigationChooser').classList.add('visible');
  }
  function layoutMemoryAtlas(place){
    if(!place||!map)return;
    const note=$('memoryNote'), col=$('memoryColumn'), strip=$('memoryStrip'), closeBtn=$('closeMemory');
    const vw=window.innerWidth||document.documentElement.clientWidth;
    const vh=window.innerHeight||document.documentElement.clientHeight;
    const p=isVector()?vectorMap.project([place.lng,place.lat]):map._pixel(place.lng,place.lat);
    const mobile=vw<=700;
    const topSafe=mobile?118:128;
    const bottomSafe=(mobile?112:126);
    const colW=mobile?Math.min(vw*0.30,146):Math.min(vw*0.21,184);
    const noteW=mobile?Math.max(172, vw-colW-34):Math.min(vw*0.34,350);
    note.style.width=Math.round(noteW)+'px';
    const noteH=note.offsetHeight||180;
    const colH=mobile?Math.min(vh*0.34,260):Math.min(vh*0.40,430);
    const stripH=mobile?Math.min(vh*0.18,136):Math.min(vh*0.21,175);
    const colRight=mobile?11:18;
    const colLeft=vw-colW-colRight;
    const starGap=mobile?18:24;
    const noteLeft=12;
    let noteTop=p.y - noteH*0.52;
    let colTop=p.y - colH*0.40;
    noteTop=Math.max(topSafe, Math.min(noteTop, vh-bottomSafe-stripH-noteH-18));
    colTop=Math.max(topSafe-4, Math.min(colTop, vh-bottomSafe-stripH-colH-10));
    let stripLeft=mobile?11:Math.max(18, Math.min(p.x-140, vw*0.18));
    let stripRight=mobile?11:Math.max(18, vw-colLeft+8);
    const maxStripRight=vw-18;
    if(stripLeft>vw-220) stripLeft=18;
    const stripWidth=Math.max(220, maxStripRight-stripLeft-stripRight);
    note.style.left=noteLeft+'px';
    note.style.top=Math.round(noteTop)+'px';
    col.style.width=Math.round(colW)+'px';
    col.style.height=Math.round(colH)+'px';
    col.style.left=Math.round(colLeft)+'px';
    col.style.right='auto';
    col.style.top=Math.round(colTop)+'px';
    strip.style.left=Math.round(stripLeft)+'px';
    strip.style.right=Math.round(stripRight)+'px';
    strip.style.bottom=(mobile? (104) : 118)+'px';
    strip.style.height=Math.round(stripH)+'px';
    closeBtn.style.top=Math.max(topSafe-8, colTop-42)+'px';
    closeBtn.style.right=(mobile?11:18)+'px';
  }
  function relayoutMemoryOpen(){ if(window.__atlasInteractionMode==='swipe-card')return; if(selectedId && $('memorySheet').classList.contains('visible')){ const p=places.find(x=>x.id===selectedId); if(p) layoutMemoryAtlas(p); } }
  function closeMemory(){
    // Most map taps happen without an open journal. Avoid class mutations and
    // media cleanup in that case; it also prevents unnecessary observer work.
    const sheet=$('memorySheet');
    if(!selectedId&&!sheet.classList.contains('visible')&&!sheet.classList.contains('journal-open')&&!document.body.classList.contains('memory-open'))return;
    stopInlineVideos(true);sheet.classList.remove('visible');
    document.body.classList.remove('memory-open');
    selectedId=null;
    markers.forEach((m)=>updateMarkerIcon(m,false));if(isOfficial())paintOfficialBookmarks();
  }

  function renderMarkers(){if(map){for(let m of markers.values())removeMapItem(m);markers.clear();places.filter(p=>p.starred!==false).forEach(p=>{const m=renderMapPin(p.lat,p.lng,p.id,p.title,p.id===selectedId);markers.set(p.id,m)});}if(officialMap)paintOfficialBookmarks();}
  const MEMORY_LABEL='<svg viewBox="2.09 -89.70 471.21 102.11" width="78" height="20" class="memo-letter-svg" aria-label="Memories" xmlns="http://www.w3.org/2000/svg"><g transform="scale(1,-1)"><path d="M 11.20 -7.09 C 14.91 -7.09 15.70 -1.80 15.80 23.59 L 15.80 49.41 L 20.91 40.70 C 23.70 35.80 26.91 32.00 28.00 32.00 C 32.30 32.00 39.00 36.59 41.80 41.59 C 47.20 51.00 47.80 52.20 51.09 59.70 C 52.80 63.50 54.41 66.41 55.00 66.41 C 56.59 66.41 57.20 6.30 58.70 2.41 C 59.50 0.20 61.91 -1.20 63.91 -1.20 C 65.30 -1.20 66.70 -0.59 66.70 1.91 C 66.70 7.09 64.09 1.70 63.70 41.30 C 63.41 71.20 62.80 76.80 59.91 79.50 C 59.30 80.09 58.50 80.30 57.70 80.30 C 55.09 80.30 52.00 77.91 50.20 74.09 C 40.70 53.91 32.70 40.30 30.41 40.30 C 28.09 40.30 21.91 54.00 17.80 68.70 C 15.09 77.91 13.70 80.80 12.00 80.80 C 10.70 80.80 9.09 80.00 8.30 78.91 C 7.41 77.80 7.09 68.00 7.09 46.70 C 7.09 0.41 7.91 -7.09 11.20 -7.09 Z M 129.50 21.50 C 125.79 21.50 113.90 4.50 101.40 4.50 C 97.50 4.50 94.00 6.20 90.61 9.50 C 85.61 14.30 83.70 18.20 83.70 23.50 L 83.70 27.50 L 93.00 28.00 C 98.00 28.30 106.40 29.50 111.40 30.59 C 121.00 32.70 123.61 34.50 123.61 38.70 C 123.61 42.09 119.90 47.91 115.70 51.09 C 112.29 53.70 110.79 54.09 104.50 54.59 C 102.40 54.80 100.90 54.91 99.70 54.91 C 91.40 54.91 81.11 42.30 78.79 35.20 C 78.11 33.09 77.79 30.59 77.79 27.91 C 77.79 8.41 90.50 -1.00 100.70 -1.00 C 107.40 -1.00 114.90 2.30 121.70 8.30 C 125.79 11.80 130.00 18.41 130.00 20.70 C 130.00 21.41 129.70 21.50 129.50 21.50 Z M 113.40 45.91 C 116.70 43.00 117.90 41.70 117.90 40.50 C 117.90 39.59 117.40 37.41 112.90 36.30 C 101.50 33.70 92.29 32.50 87.11 32.50 C 85.11 32.50 84.70 32.91 84.70 33.80 C 84.70 36.00 86.61 38.91 92.29 45.41 C 95.70 49.30 98.11 50.20 104.70 50.20 C 108.11 50.20 109.29 49.59 113.40 45.91 Z M 148.81 50.30 C 148.81 41.91 150.31 36.80 150.31 16.59 C 150.31 -2.41 150.81 -7.41 152.99 -7.41 C 155.40 -7.41 155.20 -4.00 155.40 5.30 C 155.99 24.09 157.40 16.91 157.40 23.91 C 157.40 26.09 158.20 29.91 159.20 32.50 C 163.99 44.59 165.99 49.09 167.90 49.09 C 168.99 49.09 170.10 47.70 171.70 45.41 C 176.40 38.41 177.60 32.41 178.49 10.80 C 178.99 -1.00 179.20 -2.09 180.81 -2.09 C 182.10 -2.09 182.60 -1.09 182.81 2.20 C 183.49 16.09 186.90 30.59 191.60 40.09 C 194.40 45.80 196.70 48.70 198.40 48.70 C 201.70 48.70 203.20 38.41 203.20 17.20 C 203.31 0.80 203.31 -1.30 204.60 -1.30 C 204.81 -1.30 204.99 -1.30 205.31 -1.20 C 206.99 -0.91 207.60 -1.41 207.60 26.80 C 207.60 35.80 207.31 42.20 206.70 44.91 C 205.49 50.80 202.40 55.00 199.10 55.00 C 193.81 55.00 186.49 45.30 183.20 33.70 L 181.49 27.70 L 179.90 37.09 C 178.60 45.30 177.90 47.00 174.81 50.70 C 172.10 53.80 170.31 55.00 167.99 55.00 C 164.20 55.00 163.70 54.50 160.90 48.80 C 159.81 46.50 158.49 44.30 158.20 43.91 C 157.20 42.91 155.99 37.91 155.40 37.91 C 153.99 37.91 152.81 56.09 150.40 56.09 C 149.40 56.09 148.81 53.50 148.81 50.30 Z M 234.10 44.91 C 227.39 38.50 224.39 32.00 224.39 23.50 C 224.39 15.00 225.60 11.91 231.30 5.20 C 235.30 0.59 241.39 -1.91 247.80 -1.91 C 252.60 -1.91 257.50 -0.50 261.89 2.20 C 271.30 7.91 278.21 25.00 278.21 38.70 C 278.21 42.70 277.60 46.50 276.30 49.50 C 274.21 54.50 269.10 56.91 260.80 56.91 C 250.10 56.91 244.71 54.91 234.10 44.91 Z M 250.21 3.80 C 239.30 3.91 231.71 11.70 231.71 22.80 C 231.71 30.20 234.71 36.00 242.60 43.50 C 246.71 47.41 248.71 48.41 253.30 49.00 C 259.50 49.59 260.39 50.09 262.10 50.09 C 264.71 50.09 267.60 49.00 270.00 47.00 C 271.71 45.59 272.30 44.59 272.30 41.50 C 272.30 22.00 261.39 3.80 250.21 3.80 Z M 325.31 48.59 C 319.81 48.59 310.60 41.20 305.90 32.41 C 304.40 29.41 302.70 26.91 302.20 26.91 C 301.31 26.91 298.70 45.41 298.70 51.41 C 298.70 53.20 297.99 54.09 297.10 54.09 C 296.20 54.09 294.99 53.00 294.31 50.91 C 293.99 50.00 293.90 47.80 293.90 44.50 C 293.90 36.30 294.70 21.50 296.31 4.70 C 296.90 -1.09 296.99 -3.80 300.10 -3.80 C 302.31 -3.80 303.20 -0.80 305.31 12.59 C 307.20 24.50 317.49 39.80 325.81 43.09 C 328.40 44.09 329.60 44.91 329.60 45.80 C 329.60 46.50 327.81 48.59 325.31 48.59 Z M 347.91 57.00 C 346.80 56.09 346.30 54.91 346.30 49.50 C 346.30 39.50 348.20 4.59 348.80 2.91 C 349.20 1.50 350.50 0.80 351.91 0.80 C 353.00 0.80 354.09 1.30 354.91 2.30 C 355.30 2.80 355.50 5.50 355.50 10.09 C 355.50 14.00 355.41 19.41 355.09 26.00 C 354.00 50.59 353.09 58.20 350.30 58.20 C 349.59 58.20 348.80 57.80 347.91 57.00 Z M 347.30 80.50 C 347.30 78.00 349.91 76.30 351.91 76.30 C 353.80 76.30 355.00 78.00 355.00 79.91 C 355.00 83.09 351.20 84.70 350.50 84.70 C 349.41 84.70 347.30 82.50 347.30 80.50 Z M 421.00 21.50 C 417.29 21.50 405.40 4.50 392.90 4.50 C 389.00 4.50 385.50 6.20 382.11 9.50 C 377.11 14.30 375.20 18.20 375.20 23.50 L 375.20 27.50 L 384.50 28.00 C 389.50 28.30 397.90 29.50 402.90 30.59 C 412.50 32.70 415.11 34.50 415.11 38.70 C 415.11 42.09 411.40 47.91 407.20 51.09 C 403.79 53.70 402.29 54.09 396.00 54.59 C 393.90 54.80 392.40 54.91 391.20 54.91 C 382.90 54.91 372.61 42.30 370.29 35.20 C 369.61 33.09 369.29 30.59 369.29 27.91 C 369.29 8.41 382.00 -1.00 392.20 -1.00 C 398.90 -1.00 406.40 2.30 413.20 8.30 C 417.29 11.80 421.50 18.41 421.50 20.70 C 421.50 21.41 421.20 21.50 421.00 21.50 Z M 404.90 45.91 C 408.20 43.00 409.40 41.70 409.40 40.50 C 409.40 39.59 408.90 37.41 404.40 36.30 C 393.00 33.70 383.79 32.50 378.61 32.50 C 376.61 32.50 376.20 32.91 376.20 33.80 C 376.20 36.00 378.11 38.91 383.79 45.41 C 387.20 49.30 389.61 50.20 396.20 50.20 C 399.61 50.20 400.79 49.59 404.90 45.91 Z M 443.99 23.50 C 445.20 23.50 450.90 20.50 455.90 18.80 C 460.70 17.09 461.60 13.09 461.60 12.20 C 461.60 9.50 457.20 -1.00 450.70 -1.00 C 446.49 -1.00 440.60 2.20 438.99 5.50 C 438.10 7.41 437.10 8.30 436.20 8.30 C 434.99 8.30 434.31 6.80 434.31 5.50 C 434.31 2.70 436.70 -1.59 439.10 -2.80 C 442.10 -4.30 449.10 -5.59 452.60 -5.59 C 457.81 -5.59 463.31 1.59 464.40 4.50 C 465.70 7.59 465.99 12.09 465.99 12.91 C 465.99 19.50 462.40 22.50 449.60 26.91 C 440.49 30.09 438.31 33.70 438.31 35.41 C 438.31 36.91 439.60 38.50 442.70 41.80 C 446.99 46.41 452.81 49.00 457.31 49.00 C 463.70 49.00 463.10 44.30 466.99 44.30 C 467.81 44.30 468.31 44.70 468.31 45.50 C 468.31 46.20 466.90 48.41 465.20 50.30 C 462.70 53.09 461.90 53.59 458.81 53.59 C 457.90 53.59 453.40 53.59 450.10 52.70 C 439.20 50.00 432.70 38.09 432.70 34.59 C 432.70 28.70 443.10 23.50 443.99 23.50 Z" fill="#383630"/></g></svg>'+"<span class=\"memo-label-cn\"> · 旅行记忆</span>";
  const PLAN_LABEL='<svg viewBox="2.09 -104.91 860.00 134.50" width="110" height="20" class="memo-letter-svg" aria-label="Before the trip" xmlns="http://www.w3.org/2000/svg"><g transform="scale(1,-1)"><path d="M 32.80 2.41 C 35.20 2.41 36.09 1.20 38.20 1.20 C 44.80 1.20 57.41 12.09 57.41 29.50 C 57.41 34.09 56.59 38.41 55.00 41.00 C 53.41 43.59 46.41 47.91 43.70 47.91 C 42.80 47.91 42.30 48.00 42.30 48.50 C 42.30 50.70 52.50 60.91 52.50 71.41 C 52.50 72.41 51.30 74.59 50.00 76.09 C 47.91 78.30 46.91 78.70 40.70 78.70 C 33.41 78.70 26.00 78.00 22.50 77.09 C 17.09 75.70 7.09 72.80 7.09 69.91 C 7.09 68.59 9.00 67.70 12.09 67.70 L 16.00 67.70 L 16.70 58.70 C 17.09 53.70 17.91 45.80 18.41 41.30 C 21.59 17.00 19.50 0.70 25.59 0.70 C 27.80 0.70 30.30 2.41 32.80 2.41 Z M 45.70 71.50 C 46.59 70.50 47.09 70.00 47.09 69.20 C 47.09 68.20 46.30 66.59 44.59 62.80 C 41.30 55.59 29.91 42.41 27.00 42.41 C 25.20 42.41 24.70 43.59 23.70 50.91 C 23.00 55.70 22.50 62.00 22.50 65.20 L 22.50 67.20 C 22.50 71.41 23.00 71.09 31.80 72.59 C 34.20 73.00 36.41 73.09 38.41 73.09 C 41.91 73.09 44.70 72.59 45.70 71.50 Z M 52.09 28.09 C 52.09 19.41 50.20 16.80 46.20 12.30 C 42.09 7.50 41.41 6.70 37.91 6.70 C 37.20 6.70 36.41 6.80 35.50 6.80 C 27.20 7.09 26.70 8.00 25.91 23.00 C 25.70 27.00 25.59 29.70 25.59 31.70 C 25.59 35.41 26.00 35.91 27.30 36.41 C 31.80 38.00 36.80 41.20 42.41 41.20 C 50.20 41.20 52.09 34.70 52.09 28.09 Z M 122.30 21.50 C 118.59 21.50 106.70 4.50 94.20 4.50 C 90.30 4.50 86.80 6.20 83.41 9.50 C 78.41 14.30 76.50 18.20 76.50 23.50 L 76.50 27.50 L 85.80 28.00 C 90.80 28.30 99.20 29.50 104.20 30.59 C 113.80 32.70 116.41 34.50 116.41 38.70 C 116.41 42.09 112.70 47.91 108.50 51.09 C 105.09 53.70 103.59 54.09 97.30 54.59 C 95.20 54.80 93.70 54.91 92.50 54.91 C 84.20 54.91 73.91 42.30 71.59 35.20 C 70.91 33.09 70.59 30.59 70.59 27.91 C 70.59 8.41 83.30 -1.00 93.50 -1.00 C 100.20 -1.00 107.70 2.30 114.50 8.30 C 118.59 11.80 122.80 18.41 122.80 20.70 C 122.80 21.41 122.50 21.50 122.30 21.50 Z M 106.20 45.91 C 109.50 43.00 110.70 41.70 110.70 40.50 C 110.70 39.59 110.20 37.41 105.70 36.30 C 94.30 33.70 85.09 32.50 79.91 32.50 C 77.91 32.50 77.50 32.91 77.50 33.80 C 77.50 36.00 79.41 38.91 85.09 45.41 C 88.50 49.30 90.91 50.20 97.50 50.20 C 100.91 50.20 102.09 49.59 106.20 45.91 Z M 149.50 45.00 C 149.79 45.00 149.90 45.00 150.00 44.91 C 150.29 44.59 150.61 36.80 150.61 27.59 C 150.61 8.80 152.29 -0.30 155.90 -0.30 C 157.20 -0.30 158.70 0.30 158.70 2.70 C 158.70 8.41 155.90 6.80 155.90 24.09 C 155.90 25.91 156.00 27.91 156.00 30.20 L 156.29 46.09 L 164.90 48.59 C 170.61 50.30 173.50 51.70 173.50 52.91 C 173.50 53.59 172.29 54.41 170.29 54.41 C 165.79 54.41 161.79 53.00 159.00 53.00 C 156.20 53.00 156.11 54.30 156.11 61.59 C 156.11 71.41 157.20 87.59 158.50 90.41 C 160.11 93.80 162.11 95.41 165.20 95.41 C 166.61 95.41 168.29 95.00 170.29 94.41 C 177.00 92.20 178.79 90.41 178.79 86.09 C 178.79 83.91 179.20 82.70 180.00 82.70 C 180.90 82.70 183.90 86.00 183.90 89.00 C 183.90 91.00 182.79 92.91 180.50 95.20 C 177.40 98.20 176.00 98.80 170.40 99.41 C 167.11 99.70 164.90 99.91 163.20 99.91 C 159.90 99.91 158.90 99.09 156.40 96.70 C 153.20 93.50 152.90 92.70 151.70 81.59 C 151.00 75.09 150.40 65.80 150.29 61.09 L 150.11 52.41 L 142.00 50.00 C 135.50 48.09 133.90 47.20 133.90 45.70 C 133.90 43.91 135.50 42.91 138.29 42.91 C 142.61 42.91 146.70 45.00 149.50 45.00 Z M 204.90 44.91 C 198.19 38.50 195.19 32.00 195.19 23.50 C 195.19 15.00 196.40 11.91 202.10 5.20 C 206.10 0.59 212.19 -1.91 218.60 -1.91 C 223.40 -1.91 228.30 -0.50 232.69 2.20 C 242.10 7.91 249.01 25.00 249.01 38.70 C 249.01 42.70 248.40 46.50 247.10 49.50 C 245.01 54.50 239.90 56.91 231.60 56.91 C 220.90 56.91 215.51 54.91 204.90 44.91 Z M 221.01 3.80 C 210.10 3.91 202.51 11.70 202.51 22.80 C 202.51 30.20 205.51 36.00 213.40 43.50 C 217.51 47.41 219.51 48.41 224.10 49.00 C 230.30 49.59 231.19 50.09 232.90 50.09 C 235.51 50.09 238.40 49.00 240.80 47.00 C 242.51 45.59 243.10 44.59 243.10 41.50 C 243.10 22.00 232.19 3.80 221.01 3.80 Z M 296.11 48.59 C 290.61 48.59 281.40 41.20 276.70 32.41 C 275.20 29.41 273.50 26.91 273.00 26.91 C 272.11 26.91 269.50 45.41 269.50 51.41 C 269.50 53.20 268.79 54.09 267.90 54.09 C 267.00 54.09 265.79 53.00 265.11 50.91 C 264.79 50.00 264.70 47.80 264.70 44.50 C 264.70 36.30 265.50 21.50 267.11 4.70 C 267.70 -1.09 267.79 -3.80 270.90 -3.80 C 273.11 -3.80 274.00 -0.80 276.11 12.59 C 278.00 24.50 288.29 39.80 296.61 43.09 C 299.20 44.09 300.40 44.91 300.40 45.80 C 300.40 46.50 298.61 48.59 296.11 48.59 Z M 364.10 21.50 C 360.39 21.50 348.50 4.50 336.00 4.50 C 332.10 4.50 328.60 6.20 325.21 9.50 C 320.21 14.30 318.30 18.20 318.30 23.50 L 318.30 27.50 L 327.60 28.00 C 332.60 28.30 341.00 29.50 346.00 30.59 C 355.60 32.70 358.21 34.50 358.21 38.70 C 358.21 42.09 354.50 47.91 350.30 51.09 C 346.89 53.70 345.39 54.09 339.10 54.59 C 337.00 54.80 335.50 54.91 334.30 54.91 C 326.00 54.91 315.71 42.30 313.39 35.20 C 312.71 33.09 312.39 30.59 312.39 27.91 C 312.39 8.41 325.10 -1.00 335.30 -1.00 C 342.00 -1.00 349.50 2.30 356.30 8.30 C 360.39 11.80 364.60 18.41 364.60 20.70 C 364.60 21.41 364.30 21.50 364.10 21.50 Z M 348.00 45.91 C 351.30 43.00 352.50 41.70 352.50 40.50 C 352.50 39.59 352.00 37.41 347.50 36.30 C 336.10 33.70 326.89 32.50 321.71 32.50 C 319.71 32.50 319.30 32.91 319.30 33.80 C 319.30 36.00 321.21 38.91 326.89 45.41 C 330.30 49.30 332.71 50.20 339.30 50.20 C 342.71 50.20 343.89 49.59 348.00 45.91 Z M 457.11 69.50 C 457.11 66.50 456.70 64.70 456.00 64.20 C 453.00 62.20 438.40 61.41 438.40 57.50 C 438.40 55.91 439.00 55.09 441.29 55.09 C 444.29 55.09 453.50 57.30 456.61 57.30 C 457.20 57.30 457.40 56.91 458.11 44.80 C 459.79 22.59 460.90 16.91 460.90 8.50 C 460.90 1.59 462.61 -3.00 465.00 -3.00 C 467.29 -3.00 467.29 -1.00 467.29 0.09 C 467.29 6.41 464.79 17.00 464.00 42.59 L 463.40 59.50 L 468.40 60.70 C 476.50 62.70 479.40 64.00 479.40 65.59 C 479.40 67.41 476.40 67.80 474.40 67.80 C 470.00 67.80 465.61 66.09 463.40 66.09 C 463.20 66.09 463.11 66.20 463.11 66.20 C 462.70 66.59 461.20 91.59 460.40 93.30 C 460.00 94.09 459.40 94.41 458.70 94.41 C 457.50 94.41 456.20 93.09 455.79 90.91 C 455.70 90.30 455.70 89.41 455.70 88.41 C 455.70 80.80 457.11 77.00 457.11 69.50 Z M 495.10 8.59 C 495.10 2.20 495.60 -0.30 496.90 -1.41 C 497.51 -1.91 498.10 -2.20 498.60 -2.20 C 502.30 -2.20 501.69 15.09 504.01 23.30 C 505.80 29.00 511.51 37.30 517.69 43.20 L 523.51 48.59 L 525.10 43.59 C 526.19 40.30 527.10 31.59 527.51 18.91 C 528.10 0.30 528.30 -0.70 530.40 -0.70 C 532.60 -0.70 532.60 0.00 532.60 20.59 C 532.60 32.41 532.30 43.20 531.80 44.91 C 530.60 49.20 525.80 53.70 522.40 53.70 C 518.90 53.70 504.80 40.59 502.10 34.59 L 500.30 30.70 L 499.40 42.50 C 496.80 76.30 497.30 82.80 494.10 82.80 C 493.40 82.80 492.60 82.09 491.80 80.70 C 491.40 80.00 491.19 77.91 491.19 74.30 C 491.19 56.30 495.10 25.00 495.10 8.59 Z M 596.20 21.50 C 592.49 21.50 580.60 4.50 568.10 4.50 C 564.20 4.50 560.70 6.20 557.31 9.50 C 552.31 14.30 550.40 18.20 550.40 23.50 L 550.40 27.50 L 559.70 28.00 C 564.70 28.30 573.10 29.50 578.10 30.59 C 587.70 32.70 590.31 34.50 590.31 38.70 C 590.31 42.09 586.60 47.91 582.40 51.09 C 578.99 53.70 577.49 54.09 571.20 54.59 C 569.10 54.80 567.60 54.91 566.40 54.91 C 558.10 54.91 547.81 42.30 545.49 35.20 C 544.81 33.09 544.49 30.59 544.49 27.91 C 544.49 8.41 557.20 -1.00 567.40 -1.00 C 574.10 -1.00 581.60 2.30 588.40 8.30 C 592.49 11.80 596.70 18.41 596.70 20.70 C 596.70 21.41 596.40 21.50 596.20 21.50 Z M 580.10 45.91 C 583.40 43.00 584.60 41.70 584.60 40.50 C 584.60 39.59 584.10 37.41 579.60 36.30 C 568.20 33.70 558.99 32.50 553.81 32.50 C 551.81 32.50 551.40 32.91 551.40 33.80 C 551.40 36.00 553.31 38.91 558.99 45.41 C 562.40 49.30 564.81 50.20 571.40 50.20 C 574.81 50.20 575.99 49.59 580.10 45.91 Z M 689.21 69.50 C 689.21 66.50 688.80 64.70 688.10 64.20 C 685.10 62.20 670.50 61.41 670.50 57.50 C 670.50 55.91 671.10 55.09 673.39 55.09 C 676.39 55.09 685.60 57.30 688.71 57.30 C 689.30 57.30 689.50 56.91 690.21 44.80 C 691.89 22.59 693.00 16.91 693.00 8.50 C 693.00 1.59 694.71 -3.00 697.10 -3.00 C 699.39 -3.00 699.39 -1.00 699.39 0.09 C 699.39 6.41 696.89 17.00 696.10 42.59 L 695.50 59.50 L 700.50 60.70 C 708.60 62.70 711.50 64.00 711.50 65.59 C 711.50 67.41 708.50 67.80 706.50 67.80 C 702.10 67.80 697.71 66.09 695.50 66.09 C 695.30 66.09 695.21 66.20 695.21 66.20 C 694.80 66.59 693.30 91.59 692.50 93.30 C 692.10 94.09 691.50 94.41 690.80 94.41 C 689.60 94.41 688.30 93.09 687.89 90.91 C 687.80 90.30 687.80 89.41 687.80 88.41 C 687.80 80.80 689.21 77.00 689.21 69.50 Z M 759.11 48.59 C 753.61 48.59 744.40 41.20 739.70 32.41 C 738.20 29.41 736.50 26.91 736.00 26.91 C 735.11 26.91 732.50 45.41 732.50 51.41 C 732.50 53.20 731.79 54.09 730.90 54.09 C 730.00 54.09 728.79 53.00 728.11 50.91 C 727.79 50.00 727.70 47.80 727.70 44.50 C 727.70 36.30 728.50 21.50 730.11 4.70 C 730.70 -1.09 730.79 -3.80 733.90 -3.80 C 736.11 -3.80 737.00 -0.80 739.11 12.59 C 741.00 24.50 751.29 39.80 759.61 43.09 C 762.20 44.09 763.40 44.91 763.40 45.80 C 763.40 46.50 761.61 48.59 759.11 48.59 Z M 781.71 57.00 C 780.60 56.09 780.10 54.91 780.10 49.50 C 780.10 39.50 782.00 4.59 782.60 2.91 C 783.00 1.50 784.30 0.80 785.71 0.80 C 786.80 0.80 787.89 1.30 788.71 2.30 C 789.10 2.80 789.30 5.50 789.30 10.09 C 789.30 14.00 789.21 19.41 788.89 26.00 C 787.80 50.59 786.89 58.20 784.10 58.20 C 783.39 58.20 782.60 57.80 781.71 57.00 Z M 781.10 80.50 C 781.10 78.00 783.71 76.30 785.71 76.30 C 787.60 76.30 788.80 78.00 788.80 79.91 C 788.80 83.09 785.00 84.70 784.30 84.70 C 783.21 84.70 781.10 82.50 781.10 80.50 Z M 809.59 51.20 C 809.59 47.80 804.00 45.80 804.00 43.30 C 804.00 42.20 805.09 41.41 807.20 41.41 C 810.09 41.41 810.50 39.91 812.00 21.59 C 814.30 -4.70 817.00 -15.50 818.30 -20.20 C 819.30 -23.80 820.00 -24.59 822.41 -24.59 C 824.50 -24.59 825.50 -24.20 825.50 -21.30 C 825.50 -18.00 823.30 -6.59 821.91 0.00 L 820.80 5.41 L 825.41 4.70 C 826.41 4.50 827.41 4.50 828.30 4.50 C 837.20 4.50 845.41 11.00 850.91 22.80 C 855.00 31.59 857.09 38.59 857.09 44.09 C 857.09 51.09 853.59 55.41 846.70 57.00 C 843.50 57.70 840.59 58.09 837.59 58.09 C 829.09 58.09 822.00 55.00 818.80 55.00 C 816.30 55.00 816.80 58.09 814.09 58.09 C 810.70 58.09 809.59 52.50 809.59 51.20 Z M 821.70 13.70 C 820.09 13.80 819.50 15.80 818.80 23.70 C 818.30 29.09 817.80 36.50 817.70 40.00 L 817.50 46.41 L 824.20 48.59 C 828.59 50.00 835.50 50.91 840.70 50.91 C 843.30 50.91 845.41 50.70 846.59 50.20 C 847.70 49.91 850.30 46.41 850.30 41.80 C 850.30 30.00 836.91 11.20 828.59 11.20 C 825.80 11.20 824.70 13.70 821.70 13.70 Z" fill="#383630"/></g></svg>'+"<span class=\"memo-label-cn\"> · 旅行计划</span>";
  function showPlace(id,fly=false){
    if(window.__atlasTripPicking)return;
    const p=places.find(x=>x.id===id);if(!p)return;
    // Stage1.34.2 · all saved-star, list, deep-link and POI entries share one
    // conditional camera policy. A visible place is never force-centred/zoomed.
    // When panning is needed, atlas:focus-settled gates orbit expansion.
    // Saved stars do not chase the map camera when a bottom sheet opens.
    if(window.__atlasInteractionMode!=='swipe-card')focusMapPlaceIfNeeded(p);
    if(window.__atlasInteractionMode!=='swipe-card')window.__atlasPoiFeedback?.(p.lat,p.lng);stopInlineVideos(true);
    setPicking(false);hideDestination();closeSearchResults();closeMapPopup();selectedId=id;if(window.__atlasInteractionMode!=='swipe-card')pulseStar(id);
    for(const [key,m] of markers.entries())updateMarkerIcon(m,key===id);if(isOfficial()){paintOfficialBookmarks();if(window.__atlasInteractionMode==='swipe-card')updateOfficialSelectionPin(null);else updateOfficialSelectionPin({lat:+p.lat,lng:+p.lng,name:p.title||p.name||'已收藏地点'})}
    // Tapping a saved star must not suddenly pan or zoom the map. The card handles its own safe area.
    if(window.__atlasInteractionMode==='swipe-card'){
      $('memorySheet').classList.add('visible');
      document.body.classList.add('memory-open');
      document.dispatchEvent(new CustomEvent('atlas:memory-open',{detail:{id}}));
      return;
    }
    const items=mediaItems(p),rightCount=items.length>=5?3:Math.min(2,items.length),vertical=items.slice(0,rightCount),horizontal=items.slice(rightCount);
    const itemButton=(item,i,band)=>item.kind==='video'?`<button class="atlas-photo atlas-video ${band==='bottom'?'atlas-strip-photo':''}" type="button" data-action="photo" data-id="${escape(p.id)}" data-idx="${i}" aria-label="放大第 ${i+1} 项视频"><span class="video-face"><b class="video-play">▶</b><span>${escape(item.name||'旅行视频')}</span></span><video class="atlas-inline-video" muted playsinline autoplay loop preload="none" aria-label="旅行视频静音预览"></video><span class="photo-number">${String(i+1).padStart(2,'0')} · 视频 ↗</span></button>`:
    `<button class="atlas-photo ${band==='bottom'?'atlas-strip-photo':''}" type="button" data-action="photo" data-id="${escape(p.id)}" data-idx="${i}" aria-label="查看第 ${i+1} 张照片"><img src="${photoSrc(item.src)}" alt="${escape(p.title)} · 精选照片" loading="lazy"><span class="photo-number">${String(i+1).padStart(2,'0')}</span></button>`;
    const emptyPhoto=`<button type="button" class="atlas-photo atlas-strip-photo atlas-empty" data-action="upload" data-id="${escape(p.id)}"><b>＋</b><span>添加照片 / 视频</span></button>`;
    $('memoryNote').innerHTML=`<div class="memo-eyebrow"><span class="memo-pin">★</span><span class="hand-letter">${p.videos?.length||p.photos?.length?MEMORY_LABEL:PLAN_LABEL}</span></div><h2 class="memo-name">${escape(p.title)}</h2><div class="memo-date">${escape(p.date||'未标注日期')}${p.demo?' · 演示内容':''}</div><p class="memo-text">${escape(p.note||'在这里写下旅行计划。回来后再上传最喜欢的照片和视频。')}</p><div class="memo-foot"><small>${p.photos?.length||0} 张照片 · ${p.videos?.length||0} 条视频 · <span class=\"memo-rank\">${['','轻收藏','常去','珍藏'][Math.max(1,Math.min(3,Number(p.rank)||2))]}</span></small><button class="memo-edit" data-action="edit" data-id="${escape(p.id)}" type="button">编辑想去理由 ✎</button></div>`;
    $('memoryColumn').innerHTML=vertical.map((pic,i)=>itemButton(pic,i,'right')).join('')||`<button type="button" class="atlas-photo atlas-empty" data-action="upload" data-id="${escape(p.id)}"><b>＋</b><span>游玩后上传影像</span></button>`;
    $('memoryStrip').innerHTML=horizontal.map((pic,i)=>itemButton(pic,rightCount+i,'bottom')).join('')+(items.length<15?emptyPhoto:'');
    $('memoryUpload').onclick=()=>{$('directUpload').dataset.target=p.id;$('directUpload').click()};
    $('memoryRoute').onclick=()=>openNavigation(p);$('memoryShare').onclick=()=>shareMemory(p);$('memoryUnstar').onclick=()=>cancelBookmark(p.id);
    $('memorySheet').classList.add('visible');document.dispatchEvent(new CustomEvent('atlas:memory-open',{detail:{id:p.id}}));document.body.classList.add('memory-open');$('helptext').style.display='none';startInlineVideos(p);
    requestAnimationFrame(()=>layoutMemoryAtlas(p));
  }
  function closeDrawer(){ $('drawer').classList.remove('visible');$('cover').classList.remove('visible') }
  /* build .20 · 对标高德/苹果 sheet 手势：捏住眉头或列表拉到顶后继续下拉，整片随手势下滑，松手超过阈值即关闭 */
  function attachSheetSwipe(el,baseTransform,onClose){
    // Stage1.25: vertical-axis lock, scroll-first behavior, 32pt content dead zone.
    // Movement is composited (translate); a single easing curve settles or dismisses.
    let gesture=null;
    const interactive='button,a,input,textarea,select,label,[contenteditable="true"]';
    el.addEventListener('touchstart',e=>{
      if(e.touches.length!==1||e.target.closest(interactive)||el.scrollTop>0){gesture=null;return}
      const t=e.touches[0];
      gesture={x:t.clientX,y:t.clientY,lastY:t.clientY,lastT:performance.now(),dy:0,v:0,
        header:!!e.target.closest('.sheet-grab,.drawer-head,.sheet-head,.rb-pop-head'),
        engaged:false,axis:null};
    },{passive:true});
    el.addEventListener('touchmove',e=>{
      if(!gesture||e.touches.length!==1)return;
      const t=e.touches[0],g=gesture;
      const x=t.clientX-g.x,y=t.clientY-g.y;
      if(!g.axis&&Math.max(Math.abs(x),Math.abs(y))>9)g.axis=Math.abs(x)>Math.abs(y)*.85?'x':'y';
      if(g.axis==='x')return;
      if(el.scrollTop>0&&!g.engaged)return;
      if(!g.engaged){
        if(y<=(g.header?7:32))return;
        g.engaged=true;
        g.origin=g.y+(g.header?7:32);
        el.classList.add('fp25-dragging');
      }
      const now=performance.now(),deltaT=Math.max(1,now-g.lastT);
      g.v=Math.max(-3,Math.min(3,(t.clientY-g.lastY)/deltaT));
      g.lastY=t.clientY;g.lastT=now;
      g.dy=Math.max(0,t.clientY-g.origin);
      if(g.dy>0){
        e.preventDefault();
        const distance=g.dy>el.offsetHeight*.6?el.offsetHeight*.6+(g.dy-el.offsetHeight*.6)*.25:g.dy;
        el.style.transform=baseTransform.replace('$',Math.round(distance)+'px');
      }
    },{passive:false});
    const finish=cancel=>{
      if(!gesture)return;
      const g=gesture;gesture=null;
      const shouldClose=!cancel&&g.engaged&&(g.dy>Math.min(124,el.offsetHeight*.28)||(g.dy>65&&g.v>.85));
      // Remove drag styles and the open state in one frame: no snap-back flash.
      el.classList.remove('fp25-dragging');
      el.style.removeProperty('transform');
      if(shouldClose)onClose();
    };
    el.addEventListener('touchend',()=>finish(false),{passive:true});
    el.addEventListener('touchcancel',()=>finish(true),{passive:true});
  }
  attachSheetSwipe($('drawer'),'translate(-50%, $)',closeDrawer);
  function openDrawer(){if(document.body.classList.contains('fp-search-open')){window.__fpCloseSearch?.();window.__fpRealSearchMotion?.cancelForHandoff?.()}renderList();$('drawer').classList.add('visible');$('cover').classList.add('visible')}
  function renderList(){const list=$('spotList');list.innerHTML='';const favorites=places.filter(p=>p.starred!==false);if(!favorites.length){list.innerHTML='<div class="atlas-empty-places"><div class="empty-star" aria-hidden="true">★</div><strong>从第一颗星开始</strong><p>搜索一个想去的地点，或在地图上标记你喜欢的地方。</p><button type="button" id="atlasEmptySearch">搜索地点</button><button type="button" class="quiet" id="atlasEmptyMark">在地图上标记</button></div>';$('atlasEmptySearch').onclick=()=>{closeDrawer();window.__footprintHome?.openSearch?window.__footprintHome.openSearch():$('searchInput').focus()};$('atlasEmptyMark').onclick=()=>{closeDrawer();$('navAdd').click()};return}favorites.forEach(p=>{const b=document.createElement('button');b.type='button';b.className='spotrow';b.dataset.placeId=p.id;const thumb=p.photos?.length&&photoSrc(p.photos[0].src)?`<img src="${photoSrc(p.photos[0].src)}" alt="封面">`:(p.videos?.length?'<div class="spotempty spotempty-vid"></div>':'<div class="spotempty spotempty-ic"></div>');b.innerHTML=`${thumb}<span style="min-width:0;flex:1"><strong>${escape(p.title)}</strong><small>${p.stage==='visited'?'已到访':'想去'}${p.date?' · '+escape(p.date):''}${p.demo?' · 演示':''}</small><small style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escape(((p.note||'').replace(/^原高德地址[：:][^\n]*\n?/,'').trim().slice(0,32))||'还没有备注')}</small></span><span class="arrow" aria-hidden="true"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0IiBhcmlhLWxhYmVsPSJEaXJlY3Rpb25zIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiMxNjE2MTYiIHN0cm9rZS13aWR0aD0iMy40IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik04IDM0IEwzMSAxMCBMNTUgMzMgTDMxIDU1IFoiLz48cGF0aCBkPSJNMjEgMzQgSDM5IFYyNSBNMzIgMjUgTDM5IDI1Ii8+PC9nPjwvc3ZnPg==" alt=""></span>`;b.addEventListener('click',()=>{closeDrawer();showPlace(p.id,true)});list.append(b)})}
  function setPicking(on){
    if(on&&!map&&!isVector()&&!isOfficial()){toast('地图尚未加载。可先查看已有足迹。');return}
    picking=!!on;
    document.body.classList.toggle('picking',picking);
    $('maphint').classList.toggle('visible',picking);
    $('navAdd').innerHTML=picking?'<span class="symbol">✓</span>确认此处':'<span class="symbol">＋</span>标记地点';
    if(on){closeDrawer();closeMemory();closeSearchResults();toast('拖动地图调整位置，点「确认此处」保存');}
  }
  function confirmPicking(){
    if(!picking){setPicking(true);return;}
    const p=currentCenter();
    setPicking(false);
    beginEdit({id:uid(),lat:p.lat,lng:p.lng,title:'',note:'',date:'',stage:'plan',photos:[],demo:false});
  }

  let editorOriginSnapshot='';
  function syncEditorStage(){
    const visited=document.querySelector('input[name=placeStage]:checked')?.value==='visited';
    $('placeNoteLabel').textContent=visited?'旅行手记 · 那天的记忆':'为什么想去';
    $('placeNote').placeholder=visited?'记下旅途中的细节与感受……':'是什么吸引了你？记录一两个瞬间或想法……';
    $('placeDateLabel').textContent=visited?'到访日期（可选）':'计划日期（可选）';
  }
  function editorSnapshot(){
    const ids=list=>list.map(x=>[x.name||'',x.src?.length||0,x.src?.slice(0,45)||'',x.id||'',x.size||0,x.blob?.size||0]);
    return JSON.stringify({name:$('placeName').value.trim(),note:$('placeNote').value,date:$('placeDate').value,
      stage:document.querySelector('input[name=placeStage]:checked')?.value||'plan',rank:document.querySelector('input[name=starRank]:checked')?.value||'2',
      photos:ids(editorPhotos),videos:ids(editorVideos)});
  }
  function discardEditor(){if(savingEditor||ingestingMedia)return;const prompt=$('atlasDiscardDialog');if(prompt.open)prompt.close();editing=null;editorOriginSnapshot='';if($('editor').open)$('editor').close();}
  function requestEditorClose(){if(!editing||savingEditor||ingestingMedia)return;
    if(editorSnapshot()===editorOriginSnapshot){discardEditor();return}
    if(!$('atlasDiscardDialog').open)$('atlasDiscardDialog').showModal();
  }
  function beginEdit(p){stopInlineVideos(true);
    const isExisting=!!(p&&places.some(x=>x.id===p.id));
    editing=p?structuredClone(p):{id:uid(),lat:currentCenter().lat,lng:currentCenter().lng,title:'',note:'',date:'',stage:'plan',photos:[],videos:[],demo:false};
    editorPhotos=[...(editing.photos||[])];editorVideos=[...(editing.videos||[])];
    $('editorTitle').textContent=isExisting?'旅行手记 · 编辑内容':'★ 收藏这个目的地';
    $('coordText').textContent=`地图坐标：${Math.abs(editing.lat).toFixed(5)}° ${editing.lat>=0?'N':'S'}, ${Math.abs(editing.lng).toFixed(5)}° ${editing.lng>=0?'E':'W'}`;
    $('placeName').value=editing.title||'';$('placeDate').value=editing.date||'';$('placeNote').value=editing.note||'';document.querySelectorAll('input[name=starRank]').forEach(r=>r.checked=Number(r.value)===(Number(editing.rank)||2));document.querySelectorAll('input[name=placeStage]').forEach(r=>r.checked=r.value===(editing.stage==='visited'?'visited':'plan'));syncEditorStage();$('atlasEditorMore').open=!!isExisting&&!!(editing.photos?.length||editing.videos?.length||editing.date);
    $('deletePlace').style.display=isExisting?'block':'none';renderEditorPhotos();editorOriginSnapshot=editorSnapshot();
    if(!$('editor').open)$('editor').showModal();
    if(!window.matchMedia('(pointer:coarse)').matches)setTimeout(()=>{(isExisting||editing.title?$('placeNote'):$('placeName')).focus({preventScroll:true})},80)
  }
  function renderEditorPhotos(){
    const el=$('editPhotos');el.innerHTML='';
    editorPhotos.forEach((pic,i)=>{const div=document.createElement('div');div.className='photo-thumb';div.innerHTML=`<img src="${photoSrc(pic.src)}" alt="选择的照片"><button class="photo-remove" type="button" aria-label="删除照片">×</button>`;div.querySelector('button').onclick=()=>{editorPhotos.splice(i,1);renderEditorPhotos()};el.append(div)});
    editorVideos.forEach((v,i)=>{const div=document.createElement('div');div.className='photo-thumb video-thumb';div.innerHTML='<span style="font-size:24px">▶</span><span class="video-filename">'+escape(v.name||'视频')+'</span><button class="photo-remove" type="button" aria-label="删除视频">×</button>';div.querySelector('button').onclick=()=>{editorVideos.splice(i,1);renderEditorPhotos()};el.append(div)});
    if(editorPhotos.length<50||editorVideos.length<6){const b=document.createElement('button');b.type='button';b.className='add-photos';b.innerHTML='<span><b>＋</b>照片 / 视频</span>';b.onclick=()=>$('photoUpload').click();el.append(b)}
  }
  async function shrink(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onerror=()=>reject(Error('图片无法读取'));fr.onload=()=>{const im=new Image();im.onerror=()=>reject(Error('图片格式不支持'));im.onload=()=>{const max=1600,scale=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.86))};im.src=fr.result};fr.readAsDataURL(file)})}
  let savingEditor=false,ingestingMedia=false;
  async function commitEditor(openMemory=false){
    if(!editing||savingEditor)return;
    if(ingestingMedia){toast('影像正在处理，请稍候再保存');return}
    const title=$('placeName').value.trim();if(!title){toast('请填写目的地名称');return}
    savingEditor=true;const btn=$('savePlace');btn.disabled=true;
    try{const p={...editing,title,date:$('placeDate').value||'',stage:document.querySelector('input[name=placeStage]:checked')?.value==='visited'?'visited':'plan',note:$('placeNote').value.trim(),rank:Number(document.querySelector('input[name=starRank]:checked')?.value||2),photos:editorPhotos,videos:editorVideos,demo:false};
      await upsert(p);await refresh();editing=null;editorOriginSnapshot='';if(openMemory)showPlace(p.id,true);else closeMemory();if($('editor').open)$('editor').close();
      toast(storageIsTransient?'浏览器未能持久保存，请立即导出备份':p.stage==='visited'?'★ 足迹已更新':'收藏和想去原因已保存');
    }catch(err){console.error(err);toast('保存失败，请减少照片或视频大小')}finally{savingEditor=false;btn.disabled=false}
  }
  async function savePlace(e){e.preventDefault();await commitEditor(true)}
  async function ingestFiles(files,targetId=null){
    if(ingestingMedia){toast('影像正在处理，请稍候再添加');return}
    ingestingMedia=true;$('savePlace').disabled=true;
    try{await ingestFilesNow(files,targetId)}finally{ingestingMedia=false;$('savePlace').disabled=false}
  }
  async function ingestFilesNow(files,targetId=null){
    const dst=targetId?places.find(x=>x.id===targetId):null;
    if(targetId&&!dst){toast('地点已不存在，未保存影像');return}
    let photos=dst?[...(dst.photos||[])]:editorPhotos;
    let videos=dst?[...(dst.videos||[])]:editorVideos;
    let added=0;
    for(const f of files){try{
      if(f.type.startsWith('image/')){if(photos.length>=50){toast('照片最多 50 张');continue}const src=await shrink(f);photos.push({src,name:f.name});added++}
      else if(f.type.startsWith('video/')||/\.(mp4|mov|webm)$/i.test(f.name)){
        if(videos.length>=6){toast('视频最多 6 条');continue}
        const item=await storeVideo(f);if(item){videos.push(item);added++}
      }
    }catch(err){console.warn(err);toast('部分文件上传失败，请检查格式或存储空间')}}
    if(dst && added){const next={...dst,photos,videos};
      try{await upsert(next);await refresh();showPlace(next.id,false);toast('新增 '+added+' 项旅行影像'+(fallback?'（临时存储，请导出备份）':'，已保存到本机'))}catch(err){console.error(err);toast('视频保存失败，当前浏览器空间可能不足')}
    }else{editorPhotos=photos;editorVideos=videos;renderEditorPhotos();if(added){$('atlasEditorMore').open=true;toast('已选择 '+added+' 项影像，请点“保存星标”完成保存')}}
  }
  function mediaItems(p){return [...(p.photos||[]).filter(q=>photoSrc(q.src)).map(q=>({...q,kind:'photo'})),...(p.videos||[]).filter(v=>v?.blob instanceof Blob).map(v=>({...v,kind:'video'}))]}
  function openViewer(id,index){const p=places.find(x=>x.id===id);if(!p)return;stopInlineVideos(false);viewingPlace=p;photoIndex=index||0;updateViewer();$('viewer').classList.add('visible')}
  function stopVideo(){const video=$('viewerVideo');video.pause();video.removeAttribute('src');video.load();if(activeVideoUrl){URL.revokeObjectURL(activeVideoUrl);activeVideoUrl=null}}
  function updateViewer(){if(!viewingPlace)return;const list=mediaItems(viewingPlace);if(!list.length)return;
    const ph=list[((photoIndex%list.length)+list.length)%list.length];photoIndex=((photoIndex%list.length)+list.length)%list.length;
    $('viewerTitle').textContent=viewingPlace.title;stopVideo();
    if(ph.kind==='video'){activeVideoUrl=makeVideoURL(ph);$('viewerImage').style.display='none';$('viewerVideo').style.display='block';$('viewerVideo').src=activeVideoUrl||'';$('viewerVideo').muted=false;$('viewerVideo').playsInline=true;$('viewerVideo').play().catch(()=>{if($('viewerVideo').error)toast('当前浏览器无法播放此视频编码，请尝试 MP4（H.264）或 WebM')})}
    else{$('viewerVideo').style.display='none';$('viewerImage').style.display='block';$('viewerImage').src=photoSrc(ph.src)}
    $('viewerCaption').textContent=`${photoIndex+1} / ${list.length}${ph.kind==='video'?' · 视频':ph.demo?' · 演示图片，非实拍':''}`;
    $('viewerPrev').style.display=list.length>1?'block':'none';$('viewerNext').style.display=list.length>1?'block':'none';
  }
  function closeViewer(){stopVideo();$('viewer').classList.remove('visible');if(selectedId){const p=places.find(x=>x.id===selectedId);if(p)startInlineVideos(p)}}
  function loadMapView(){try{const v=JSON.parse(localStorage.getItem('atlas-map-view')||'null');return v&&Number.isFinite(v.lat)&&Math.abs(v.lat)<=85&&Number.isFinite(v.lng)&&Math.abs(v.lng)<=180&&Number.isFinite(v.zoom)&&v.zoom>=2&&v.zoom<=19?v:null}catch{return null}}
  function rememberMapView(){try{const c=currentCenter();localStorage.setItem('atlas-map-view',JSON.stringify({lat:c.lat,lng:c.lng,zoom:currentZoom()}))}catch{}}
  function initMap(){
    document.body.classList.add('map-booting');
    const storedView=loadMapView(),initialView=storedView||loadLastCoords();
    map=new maplibregl.Map({container:'map',style:styleFor('figure'),center:initialView?[initialView.lng,initialView.lat]:[121.905,29.492],zoom:storedView?.zoom??13.35,
      minZoom:2,maxZoom:19,attributionControl:{compact:true},cooperativeGestures:false,
      dragRotate:false,pitchWithRotate:false,renderWorldCopies:true,fadeDuration:120});
    map.touchZoomRotate.disableRotation();
    updateLayerLabel();
    map.on('error',handleMapError);
    map.on('load',hideMapWarning);map.on('repaint',paintBuildings);map.on('moveend',()=>{rememberMapView();scheduleFigure();renderDestinations();if(automaticScaleMode&&!autoMapSwitching)updateAutomaticMode()});map.on('load',scheduleFigure);
    map.on('dragstart',()=>{userHasMovedMap=true;if(!picking){closeMemory();hideDestination()}closeSearchResults()});
    map.on('zoomstart',()=>{if(!picking)closeMemory()});
    window.addEventListener('resize',()=>map.resize(),{passive:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>map.resize(),240)});
    map.on('click',()=>{if(!picking)closeSearchResults()});map.on('maptap',selectPlaceAtTap);
    map.getContainer().addEventListener('click',event=>{
      if(event.target.closest('.map-local-marker,.poi-marker'))return;
      if(!picking){const hadSelection=!!(selectedId||selectedDestination);if(selectedId)closeMemory();if(selectedDestination)hideDestination();if(hadSelection)mapTapSuppressionUntil=Date.now()+400}
    });
    setTimeout(()=>map.resize(),350);
    mapMode='figure';updateLayerLabel();renderDestinations();
    const epoch=styleEpoch;
    styleTimeout=setTimeout(()=>{
      if(epoch!==styleEpoch)return;
      if(isVector()||isOfficial())return;
      if(!map.isSourceLoaded('base')){
        streetSource=Math.min(2,streetSource+1);installTileLayer('street');
      }
    },5200);
  }
  function closeSearchResults(clear=false){ const el=$('searchResults');el.classList.remove('visible');if(clear)el.replaceChildren(); }
  function renderSearchResults(items){
    const el=$('searchResults');el.innerHTML='';
    items.forEach(d=>{
      const lat=Number(d.lat),lng=Number(d.lon);
      if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
      const name=String(d.name||d.display_name||'地点').split(',')[0];
      const full=String(d.display_name||name);
      const b=document.createElement('button');b.type='button';b.className='search-result';
      b.innerHTML='<strong>'+escape(name)+'</strong><small>'+escape(full)+'</small>';
      b.onclick=()=>{
        closeSearchResults();$('searchInput').value=name;
        setPicking(false);closeMemory();
        setMapView(lat,lng,Math.max(Number(d.zoom)||0,14));
        addSearchMarker(lat,lng,name);
        showDestination({name,lat,lng,category:d.type||d.class||'目的地'});
      };
      el.append(b);
    });
    if(!el.children.length)el.innerHTML='<div class="search-state">没有找到地点，试试城市＋景点名称</div>';
    el.classList.add('visible');
  }
  let searchDebounce=null,searchController=null;
  function invalidateSearch(){clearTimeout(searchDebounce);searchRequest++;searchController?.abort();searchController=null}
  async function performSearch(e){
    e?.preventDefault();invalidateSearch();
    const q=$('searchInput').value.trim();if(!q)return;
    const rId=++searchRequest;
    // A saved destination should be immediately discoverable, even without network access.
    const savedMatches=(Array.isArray(places)?places:[]).filter(p=>!p.demo&&String(p.title||p.name||'').toLocaleLowerCase().includes(q.toLocaleLowerCase())).slice(0,8);
    if(savedMatches.length){
      const panel=$('searchResults');panel.replaceChildren();
      const heading=document.createElement('div');heading.className='search-state';heading.textContent='★ 我的收藏 · '+savedMatches.length+' 个匹配地点';panel.append(heading);
      savedMatches.forEach(p=>{const b=document.createElement('button');b.type='button';b.className='search-result';
        const title=document.createElement('strong');title.textContent='★ '+String(p.title||p.name||'收藏地点');
        const sub=document.createElement('small');sub.textContent='已收藏 · 点击查看想去原因与旅行影像';b.append(title,sub);
        b.onclick=()=>{closeSearchResults();$('searchInput').value=String(p.title||p.name||'');setPicking(false);showPlace(p.id,true)};panel.append(b)});
      panel.classList.add('visible');return;
    }
    const coordinateMatch=q.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,，]\s*(-?\d{1,3}(?:\.\d+)?)$/);
    if(coordinateMatch){const lat=Number(coordinateMatch[1]),lng=Number(coordinateMatch[2]);if(Math.abs(lat)<=90&&Math.abs(lng)<=180){setMapView(lat,lng,15);addSearchMarker(lat,lng,q);closeSearchResults();showDestination({name:q,lat,lng,category:'目的地'});return}}
    if(isOfficial()){
      const panel=$('searchResults');panel.innerHTML='<div class="search-state">正在搜索高德地点…</div>';panel.classList.add('visible');
      try{const data=await officialSearchPlaces(q);if(rId===searchRequest)renderSearchResults(data.map(p=>({lat:p.lat,lon:p.lng,name:p.name,display_name:[p.name,p.address,p.city].filter(Boolean).join(' · '),type:p.category})));}
      catch(err){console.warn(err);toast('高德搜索暂不可用，正在尝试备用搜索服务');}
      if(rId!==searchRequest)return;
      if(panel.querySelectorAll('.search-result').length)return;
    }
    if(rId!==searchRequest)return;
    const panel=$('searchResults');panel.innerHTML='<div class="search-state">正在查找地点…</div>';panel.classList.add('visible');
    searchController=new AbortController();const controller=searchController;
    try{const data=await window.AtlasServices.search(q,{signal:controller.signal,center:currentCenter(),allowFallback:!!e});if(rId===searchRequest)renderSearchResults(data)}
    catch(err){if(rId===searchRequest&&!controller.signal.aborted){panel.innerHTML='<div class="search-state">网络搜索暂时不可用。请按搜索重试，或拖动地图后标记地点。</div>';panel.classList.add('visible')}}
  }
  // ZIP backup uses the standard "stored" ZIP format to preserve binary video files;
  // no external library or remote upload is needed.
  function zipCRC(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
  function zipArchive(files){
    const encoder=new TextEncoder(),chunks=[],directory=[];let offset=0;
    for(const file of files){const name=encoder.encode(file.name),data=file.data,crc=zipCRC(data);
      const header=new Uint8Array(30+name.length),view=new DataView(header.buffer);
      view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0,true);view.setUint16(8,0,true);
      view.setUint32(14,crc,true);view.setUint32(18,data.length,true);view.setUint32(22,data.length,true);view.setUint16(26,name.length,true);header.set(name,30);
      chunks.push(header,data);
      const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);
      cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
      cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.set(name,46);directory.push(central);
      offset+=header.length+data.length;
    }
    const directorySize=directory.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),view=new DataView(end.buffer);
    view.setUint32(0,0x06054b50,true);view.setUint16(8,files.length,true);view.setUint16(10,files.length,true);view.setUint32(12,directorySize,true);view.setUint32(16,offset,true);
    return new Blob([...chunks,...directory,end],{type:'application/zip'});
  }
  async function downloadBackup(){
  if(window.FootprintMediaCore && !fallback){
    try{
      toast('正在验证并打包全部地点与照片视频…');
      const repo=window.FootprintMediaCore.createRepository(window.indexedDB);
      const archive=await repo.backup();
      if(!(archive instanceof Blob)||!archive.size)throw Error('BACKUP_EMPTY');
      const url=URL.createObjectURL(archive),a=document.createElement('a');
      a.href=url;a.download='Footprint_Map_完整备份_'+today()+'.zip';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      toast('完整 ZIP 已生成，请保存至「文件」');
    }catch(err){console.error('Media D backup failed',err);toast('备份失败：未生成不完整的文件，请检查存储空间')}
    return;
  }

    try{
      toast('正在打包所有星标、照片和视频…');const encoder=new TextEncoder(),files=[],records=[];
      for(const p of places){const out={...p,videos:[]};
        for(const v of p.videos||[]){if(!(v?.blob instanceof Blob))continue;
          const fileName='videos/'+String(v.id||uid()).replace(/[^a-z0-9-]/gi,'')+'.bin';
          const buf=new Uint8Array(await v.blob.arrayBuffer());files.push({name:fileName,data:buf});
          out.videos.push({id:v.id,name:v.name,type:v.type,size:v.size,archivePath:fileName});
        }
        records.push(out);
      }
      files.unshift({name:'travel-places.json',data:encoder.encode(JSON.stringify({format:'travel-footprints-v10',exportedAt:new Date().toISOString(),places:records}))});
      const blob=zipArchive(files),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='旅行足迹_含照片视频_'+today()+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
      toast('ZIP 完整备份已生成，请保存到「文件」或云盘');
    }catch(err){console.error(err);toast('备份失败，请检查可用内存或减少大视频')}
  }
  function parseZip(buffer){const bytes=new Uint8Array(buffer),view=new DataView(buffer),decoder=new TextDecoder(),map=new Map();let pos=0,count=0;
    while(pos+30<=bytes.length&&view.getUint32(pos,true)===0x04034b50){
      if(++count>8000)throw Error('ZIP 包含过多文件');const method=view.getUint16(pos+8,true);
      if(method!==0)throw Error('仅支持本站生成的无压缩 ZIP');
      const size=view.getUint32(pos+18,true),nameLength=view.getUint16(pos+26,true),extra=view.getUint16(pos+28,true),from=pos+30+nameLength+extra;
      if(from+size>bytes.length)throw Error('损坏的 ZIP 文件');
      const name=decoder.decode(bytes.subarray(pos+30,pos+30+nameLength));
      if(!name.includes('..')&&!name.startsWith('/')&&!map.has(name))map.set(name,bytes.slice(from,from+size));
      pos=from+size;
    }return map;
  }
  async function importBackup(file){
  if(window.FootprintMediaCore && !fallback){
    try{
      if(!file)throw Error('NO_FILE');
      if(!confirm('准备导入旅行备份：会验证文件完整性，并保留当前已有的地点与媒体。确认继续？'))return;
      const repo=window.FootprintMediaCore.createRepository(window.indexedDB);
      const result=await repo.restore(file,{conflict:'merge'});
      await refresh();
      closeDrawer();
      toast('已完整恢复 '+Number(result?.restored||0)+' 处地点；原有媒体已保留');
    }catch(err){console.error('Media D restore rejected',err);toast('导入失败：备份损坏、位置冲突或存储空间不足；原有数据未被部分覆盖')}
    return;
  }

    try{
      let data=null,media=null;
      if(/\.zip$/i.test(file.name)){
        media=parseZip(await file.arrayBuffer());const json=media.get('travel-places.json');if(!json)throw Error('zip format');data=JSON.parse(new TextDecoder().decode(json));
      }else data=JSON.parse(await file.text());
      const a=data.places;if(!Array.isArray(a)||!['travel-footprints-v1','travel-footprints-v10'].includes(data.format)||a.length>1000)throw Error('file format');
      if(!confirm(`将导入 ${a.length} 处收藏。相同 ID 的记录会被更新，是否继续？`))return;
      const importRecords=[];
      for(const x of a){if(!x||typeof x.title!=='string'||!Number.isFinite(Number(x.lat))||!Number.isFinite(Number(x.lng)))continue;
        const videos=[];
        for(const v of (Array.isArray(x.videos)?x.videos:[])){
          const bytes=media?.get(v.archivePath);if(!bytes||fallback)continue;
          videos.push({id:String(v.id||uid()),name:String(v.name||'旅行视频'),type:String(v.type||'video/mp4'),size:bytes.length,blob:new Blob([bytes],{type:v.type||'video/mp4'})});
        }
        const p={...x,id:String(x.id||uid()),title:x.title.slice(0,90),lat:Number(x.lat),lng:Number(x.lng),poiId:String(x.poiId||''),date:String(x.date||''),note:String(x.note||'').slice(0,12000),rank:Math.max(1,Math.min(3,Number(x.rank)||2)),stage:x.stage==='visited'?'visited':'plan',starred:x.starred!==false,photos:Array.isArray(x.photos)?x.photos.slice(0,50).filter(y=>photoSrc(y?.src)).map(y=>({...y,src:y.src,name:String(y.name||'').slice(0,200),demo:!!y.demo})):[],videos,demo:!!x.demo};
        if(Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180)importRecords.push(p);
      }
      await upsertMany(importRecords);
      await refresh();closeDrawer();toast('已恢复 '+importRecords.length+' 处星标、文字、照片'+(storageIsTransient?'（仅当前会话可用，请立即导出备份）':fallback?'（当前浏览器不支持视频恢复）':'和视频'));
    }catch(err){console.error(err);toast('无法导入：请选择本网站导出的 JSON 或 ZIP 备份')}
  }
  // V28: MapLibre vector recovery layer; no credentials required and no duplicate place database.
  // Preserve AMap as the first choice when a real deployment has its official API configured.
  let vectorMap=null,vectorSelectionMarker=null,vectorYouMarker=null,vectorStarting=false;
  const isVector=()=>mapMode==='vector'&&!!vectorMap;
  function mapConnection(message,active=true){const el=$('mapConnectionNote');el.textContent=message;el.hidden=!active;}
  function vectorSetStyle(){
    if(!vectorMap)return;
    try{window.AtlasFigureGround?.apply?.(vectorMap)}catch(err){console.warn('建筑地图样式待加载',err)}
    try{window.AtlasRouteBuildings?.attach?.(vectorMap)}catch(err){console.warn('建筑体块待加载',err)}
    const layers=vectorMap.getStyle()?.layers||[];
    for(const layer of layers){if(layer.type!=='symbol')continue;
      try{const id=String(layer.id).toLowerCase(),src=String(layer['source-layer']||'').toLowerCase(),key=id+src;
        if(/poi|housenumber/.test(key)){
          /* build .20 · 用户批注:地图丰富度优先——POI 再提前半档(12.4 起)、交通类 14 起,
             图标实色,文字略加深,尽量接近高德的密度观感(无 Key 的 OSM 上限,正式高德等部署注入)。 */
          const transit=/transit|station|bus|rail|subway|aeroway|airport|ferry|parking/.test(key);
          vectorMap.setLayerZoomRange(layer.id,transit?14:12.4,24);
          try{vectorMap.setPaintProperty(layer.id,'text-color',transit?'#6f7468':'#5a5e56');vectorMap.setPaintProperty(layer.id,'text-halo-color','#faf9f4');vectorMap.setPaintProperty(layer.id,'text-halo-width',1.2)}catch(_){}
          try{vectorMap.setPaintProperty(layer.id,'icon-opacity',1)}catch(_){}
        }
        else if(/road|street|transport/.test(key))vectorMap.setLayerZoomRange(layer.id,14,24);
        else if(/place|city|town|village/.test(key))vectorMap.setLayerZoomRange(layer.id,Math.max(layer.minzoom||0,4),18);
        const tf=layer.layout?.['text-field'];
        /* build .18 · 标签单语言化:bright 样式默认 name:latin+name:nonlatin 双行,叠出 Chongming/崇明区 双语重影;
           统一改为 中文优先、本地文字兜底 的单行字段。 */
        if(tf){const s=JSON.stringify(tf);if(/name/i.test(s))try{vectorMap.setLayoutProperty(layer.id,'text-field',['coalesce',['get','name:zh'],['get','name:nonlatin'],['get','name:latin'],['get','name']])}catch(_){}}
      }catch(_){}
    }
    // Figure-ground is strictly overhead 2D: do not add 3D extrusion layers.
    updateVectorCamera(true);
  }
  function updateVectorCamera(){
    if(!isVector())return;
    try{if(Math.abs(vectorMap.getPitch())>0.1)vectorMap.setPitch(0);if(Math.abs(vectorMap.getBearing())>0.1)vectorMap.setBearing(0)}catch(_){}
    document.body.classList.remove('atlas-3d');
    document.body.classList.toggle('atlas-distant',vectorMap.getZoom()<13.5);
    $('btnZoomIn')?.setAttribute('aria-label','放大地图');
    $('btnZoomOut')?.setAttribute('aria-label','缩小地图');
  }
  /* build .21 · 星 pin DOM 复用：地图移动/缩放只更新坐标，不再整屏重建——照片 pin 不再闪白框乱跳 */
  const bmStarCache=new Map();
  let vectorBookmarkFrame=0;
  function scheduleVectorBookmarkRender(){
    if(vectorBookmarkFrame||document.hidden)return;
    vectorBookmarkFrame=requestAnimationFrame(()=>{
      vectorBookmarkFrame=0;
      if(isVector())renderVectorBookmarks();
    });
  }
  function renderVectorBookmarks(){
    if(vectorBookmarkFrame){cancelAnimationFrame(vectorBookmarkFrame);vectorBookmarkFrame=0}
    if(!isVector())return;
    const pane=$('atlasBookmarkOverlay');
    const z=vectorMap.getZoom();
    const rect=$('atlasVectorMap').getBoundingClientRect();
    /* build .21 · 用户批注：星大小对齐高德——全缩放级别近似恒定，只保留 0.72–1.12 的轻微呼吸，不再随放大膨胀成巨块 */
    const starScale=Math.min(1.12,Math.max(0.72,Math.pow(1.14,z-13.8)));
    const STAR_SVG='<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3.7 25.2 13.5 36.1 15.2 28.3 23 30.1 34 20 28.7 9.9 34 11.7 23 3.9 15.2 14.8 13.5Z" fill="#D7B36E" stroke="#344149" stroke-width="2.2" stroke-linejoin="round"/></svg>';
    const items=[];
    for(const p of places.filter(x=>x.starred!==false)){
      let xy;try{xy=vectorMap.project([+p.lng,+p.lat])}catch(e){continue}
      if(xy.x<0||xy.y<0||xy.x>rect.width||xy.y>rect.height)continue;
      items.push({p,x:xy.x,y:xy.y,rank:Math.max(1,Math.min(3,Number(p.rank)||2))});
    }
    items.sort((a,b)=>b.rank-a.rank);
    const seen=new Set();
    const makeStar=it=>{
      const key=String(it.p.id);
      let b=bmStarCache.get(key);
      if(!b){
        b=document.createElement('button');b.type='button';b.className='atlas-bookmark-hit';b.dataset.placeId=key;
        b.innerHTML=STAR_SVG;
        b.dataset.rank=String(it.rank);b.setAttribute('aria-label','打开收藏 '+it.p.title);
        b.onclick=e=>{e.preventDefault();e.stopPropagation();if(selectedId===it.p.id&&$('memorySheet').classList.contains('visible'))closeMemory();else showPlace(it.p.id,true)};
        bmStarCache.set(key,b);
      }
      b.style.left=it.x+'px';b.style.top=it.y+'px';
      b.style.fontSize='34px';
      b.classList.toggle('selected',selectedId===it.p.id);
      seen.add(key);
      return b;
    };
    const sweep=()=>{for(const [k,el] of bmStarCache){if(!seen.has(k)){el.remove();bmStarCache.delete(k)}}};
    if(z>=11.5){
      pane.querySelectorAll('.atlas-star-cluster').forEach(c=>c.remove());
      for(const it of items){const node=makeStar(it);if(node.parentNode!==pane)pane.append(node)}
      sweep();return;
    }
    /* build .18 · 聚合重做:贪心聚类,半径随缩放放大;簇心再做一轮合并,保证 chip 之间最小间距,
       不再出现 7★/24★/62★ 互叠成堆。 */
    const R=Math.min(150,Math.max(44,64+(11.5-z)*26)),clusters=[];
    for(const it of items){
      let best=null,bd=Infinity;
      for(const c of clusters){const d=Math.hypot(c.x-it.x,c.y-it.y);if(d<R&&d<bd){best=c;bd=d}}
      if(best){best.n++;best.sx+=it.x;best.sy+=it.y;best.lat+=+it.p.lat;best.lng+=+it.p.lng;best.items.push(it);best.x=best.sx/best.n;best.y=best.sy/best.n}
      else clusters.push({n:1,sx:it.x,sy:it.y,x:it.x,y:it.y,lat:+it.p.lat,lng:+it.p.lng,items:[it]});
    }
    for(let i=0;i<clusters.length;i++)for(let j=clusters.length-1;j>i;j--){
      const a=clusters[i],b=clusters[j];
      if(Math.hypot(a.x-b.x,a.y-b.y)<56){a.n+=b.n;a.sx+=b.sx;a.sy+=b.sy;a.lat+=b.lat;a.lng+=b.lng;a.x=a.sx/a.n;a.y=a.sy/a.n;a.items.push(...b.items);clusters.splice(j,1)}
    }
    pane.querySelectorAll('.atlas-star-cluster').forEach(c=>c.remove()); /* 簇 chip 是纯文本，重建无闪烁 */
    for(const c of clusters){
      if(c.n<2){const node=makeStar(c.items[0]);if(node.parentNode!==pane)pane.append(node);continue}
      const chip=document.createElement('button');chip.type='button';chip.className='atlas-star-cluster';chip.textContent=c.n+' ★';
      chip.style.left=(c.sx/c.n)+'px';chip.style.top=(c.sy/c.n)+'px';
      chip.setAttribute('aria-label',c.n+' 个收藏地点，点击放大查看');
      /* build .20 · 用户批注：点聚合星要「展开到能看清这个范围的所有星」，而不是固定级别冲到簇心 */
      chip.onclick=e=>{e.preventDefault();e.stopPropagation();fitMapPlaces(c.items.map(it=>it.p),15.4)};
      pane.append(chip);
    }
    sweep();
  }
  function updateVectorUserLocation(){
    if(!isVector()||!currentUserCoords)return;
    if(vectorYouMarker)vectorYouMarker.remove();
    const d=document.createElement('span');d.className='atlas-vector-you';d.setAttribute('aria-label','当前位置');
    vectorYouMarker=new window.maplibregl.Marker({element:d,anchor:'center'}).setLngLat([currentUserCoords.lng,currentUserCoords.lat]).addTo(vectorMap);
  }
  function showVectorSelection(place){
    if(!isVector())return;
    if(vectorSelectionMarker)vectorSelectionMarker.remove();
    const pin=document.createElement('div');pin.className='atlas-vector-selection fp-vector-selection';
    const token=document.createElement('span');token.className='fp-vector-token';
    const img=document.createElement('img');img.src=window.AtlasPOIIcons?.fileFor(place.category,place.name)||'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0IiBhcmlhLWxhYmVsPSJOZWFyYnkiPgogPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMTYxNjE2IiBzdHJva2Utd2lkdGg9IjMuNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KICA8cGF0aCBkPSJNMzEgMTAgQzQxIDkgNDggMTcgNDcgMjcgQzQ2IDM2IDM5IDQxIDMxIDUxIEMyNCA0MiAxNiAzNCAxNiAyNiBDMTYgMTYgMjMgMTAgMzEgMTBaIi8+CiAgPGNpcmNsZSBjeD0iMzEiIGN5PSIyNiIgcj0iNi4xIi8+CiAgPHBhdGggZD0iTTE1IDQ3IEM5IDQ5IDggNTMgMTQgNTUgQzIyIDU5IDQxIDU5IDUwIDU1IEM1NSA1MyA1NCA0OSA0NyA0NyIgc3Ryb2tlLXdpZHRoPSIyLjQiLz4KIDwvZz4KPC9zdmc+';img.alt='';img.setAttribute('aria-hidden','true');token.append(img);pin.append(token);
    vectorSelectionMarker=new window.maplibregl.Marker({element:pin,anchor:'center'}).setLngLat([+place.lng,+place.lat]).addTo(vectorMap);
    // Keep the current camera and map scale unchanged; only the selection pin appears.
  }
  function guessPoiCategory(props){return props.class||props.subclass||props.type||props.category||'地点'}
  function readPoiName(props){return props['name:zh']||props.name_zh||props.name||props['name:en']||props.name_en||props.ref||''}
  function getPoiFromFeatures(e){
    if(!isVector())return null;
    /* build .22 · 录屏批注「点地图标题乱跳」：旧版命中盒 44/64px 太大，且 queryRenderedFeatures
       返回顺序与点击距离无关，两个相邻村名（上兑/上龙龛）之间等于抽签。
       改为：收紧命中盒（先 22px 后 38px），候选一律按标签几何点到点击点的屏幕距离排序取最近。 */
    let poi=null;
    for(const pad of [22,38]){
      let feats=[];
      try{feats=vectorMap.queryRenderedFeatures([[e.point.x-pad,e.point.y-pad],[e.point.x+pad,e.point.y+pad]])}catch(err){return null}
      const pool=feats.filter(f=>/poi|place|station|shop|amenity|tourism|historic|museum|hotel|restaurant|cafe|railway|mountain_peak|attraction|park|garden/.test((f.layer?.id||'').toLowerCase()+' '+(f.sourceLayer||'')+' '+(f.properties?.class||'')+' '+(f.properties?.subclass||''))&&readPoiName(f.properties||{}));
      if(!pool.length)continue;
      poi=pool.map(f=>{
        let d=Infinity;
        try{
          if(f.geometry?.type==='Point'&&Array.isArray(f.geometry.coordinates)){
            const px=vectorMap.project(f.geometry.coordinates);
            d=Math.hypot(px.x-e.point.x,px.y-e.point.y);
          }
        }catch(_){}
        return{f,d};
      }).sort((a,b)=>a.d-b.d)[0].f;
      break;
    }
    if(!poi)return null;
    const coords=poi.geometry?.type==='Point'&&Array.isArray(poi.geometry.coordinates)?poi.geometry.coordinates:[e.lngLat.lng,e.lngLat.lat];
    return {name:String(readPoiName(poi.properties)),lng:coords[0],lat:coords[1],category:guessPoiCategory(poi.properties),address:poi.properties?.address||'',id:String(poi.properties?.id||'')};
  }
  // V31 vector POIs: render real tile-derived names as proper 44px buttons, not
  // tiny paint-only symbols. Distant maps stay quiet; names progressively appear.
  let vectorPoiRenderQueued=false;
  function scheduleVectorPOIs(){
    if(vectorPoiRenderQueued)return;
    vectorPoiRenderQueued=true;
    requestAnimationFrame(()=>{vectorPoiRenderQueued=false;renderVectorPOIs()});
  }
  function renderVectorPOIs(){
    /* build .17 · 停用 DOM 文字 pin:矢量瓦片已烘焙同名标签,DOM 药丸叠在上面即是重复/重影。
       点击仍走 selectVectorTap → queryRenderedFeatures(底图烘焙标签本身可点)。 */
    const pane=$('atlasPoiOverlay');if(pane)pane.replaceChildren();
  }
  let reverseReq=0,lastVectorPickAt=0,lastVectorPickKey='';
  async function selectVectorTap(e){
    if(!isVector()||picking||$('editor').open)return;
    if(selectedId){closeMemory();return;}
    const point=getPoiFromFeatures(e);
    if(point){
      /* build .22 · 同一点击的重复事件（触屏+仿真 click 连发）不得把卡片刷新成另一个名字：
         350ms 内同一地点只认一次；点到真正不同的地点才切换。 */
      const key=String(point.id||'')+'|'+point.name+'|'+point.lng.toFixed(5)+'|'+point.lat.toFixed(5);
      const now=Date.now();
      if(key===lastVectorPickKey&&now-lastVectorPickAt<350)return;
      lastVectorPickKey=key;lastVectorPickAt=now;
      showDestination(point);return;
    }
    // iPhone Maps behavior: blank map tap returns to the map, not a fabricated place card.
    hideDestination();
  }
  let fallbackScriptRequest=null;
  function injectMapLibre(){
    if(window.maplibregl)return Promise.resolve(window.maplibregl);
    if(fallbackScriptRequest)return fallbackScriptRequest;
    fallbackScriptRequest=new Promise((resolve,reject)=>{
      const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdn.jsdelivr.net/npm/maplibre-gl@5.12.0/dist/maplibre-gl.css';document.head.append(css);
      const t=setTimeout(()=>reject(Error('矢量地图组件加载超时')),14500);
      const finish=()=>{clearTimeout(t);window.maplibregl?resolve(window.maplibregl):reject(Error('矢量地图组件启动失败'))};
      const load=(url,fallback)=>{const sc=document.createElement('script');sc.src=url;sc.async=true;sc.onload=finish;sc.onerror=()=>{if(fallback)load(fallback,null);else{clearTimeout(t);reject(Error('矢量地图脚本读取失败'))}};document.head.append(sc)};
      load('https://cdn.jsdelivr.net/npm/maplibre-gl@5.12.0/dist/maplibre-gl.js','https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.js');
    });return fallbackScriptRequest;
  }
  let vectorRenderWatch=null,vectorHasRenderedOnce=false;
  function inspectVectorAfterReturn(){
    if(!isVector()||!vectorMap)return;
    try{
      vectorMap.resize();vectorMap.triggerRepaint();
      const cv=vectorMap.getCanvas();
      if(!cv||cv.width<10||cv.height<10||!cv.isConnected){recoverFromVectorFailure('地图绘制中断，已恢复基础地图。');return}
      // pageshow also fires during the FIRST navigation, before style loads.
      // Never destroy a healthy first-load renderer from the resume watcher.
      if(!vectorHasRenderedOnce)return;
      if(!vectorMap.isStyleLoaded?.()&&document.visibilityState==='visible'){
        clearTimeout(vectorRenderWatch);
        vectorRenderWatch=setTimeout(()=>{
          if(!isVector()||!vectorMap||document.visibilityState!=='visible')return;
          try{if(!vectorMap.isStyleLoaded?.())recoverFromVectorFailure('地图资源未能恢复，已切换到基础地图。')}
          catch(_){recoverFromVectorFailure('地图无法恢复，已切换到基础地图。')}
        },12000);
      }
    }catch(_){recoverFromVectorFailure('地图显示异常，已恢复基础地图。')}
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(inspectVectorAfterReturn,150)},{passive:true});
  window.addEventListener('pageshow',()=>setTimeout(inspectVectorAfterReturn,200),{passive:true});
  let rasterRecoveryTimer=null;
  function recoverFromVectorFailure(message){
    const camera={...currentCenter(),zoom:currentZoom()};
    // Source-neutral diagnostics for a real zoom/context-loss regression.
    // Never record geographic coordinates, place IDs or personal content.
    window.__atlasVectorRecoveryTrace={
      reason:String(message||'矢量地图无法继续绘制').slice(0,160),
      zoom:Number(camera.zoom)||0,
      at:new Date().toISOString()
    };
    console.warn('地图渲染回退原因',window.__atlasVectorRecoveryTrace.reason);
    const failed=vectorMap;vectorMap=null;
    failed?.remove();
    vectorSelectionMarker=null;vectorYouMarker=null;
    document.body.classList.remove('vector-active','map-booting');
    document.body.classList.add('legacy-recovery');
    $('atlasVectorMap').hidden=true;
    // Recovery must never mark a blank raster canvas as a successful remote map.
    // Wait for actual raster source completion, not merely MapLibre construction.
    try{
      if(!map)initMap();
      map.jumpTo({center:[camera.lng,camera.lat],zoom:camera.zoom});
      renderMarkers();
      if(currentUserCoords)addLocationMarker(currentUserCoords.lat,currentUserCoords.lng);
      mapMode='figure';
      document.body.classList.remove('map-booting','atlas-remote-ready');
      map.resize();renderDestinations();
      const warning=message||'矢量地图无法连接，正在尝试基础地图。';
      mapConnection(warning,true);
      let settled=false;
      const confirmRaster=()=>{
        if(settled||!map||mapMode!=='figure')return;
        let ready=false;
        try{ready=!!map.isSourceLoaded?.('base')&&!!map.loaded?.()&&!!map.areTilesLoaded?.()}catch(_){}
        if(!ready)return;
        settled=true;
        clearTimeout(rasterRecoveryTimer);
        map.off?.('idle',confirmRaster);
        document.body.classList.add('atlas-remote-ready');
        mapConnection('',false);
        hideMapWarning();
      };
      clearTimeout(rasterRecoveryTimer);
      map.on('idle',confirmRaster);
      rasterRecoveryTimer=setTimeout(()=>{
        if(settled)return;
        map.off?.('idle',confirmRaster);
        document.body.classList.remove('atlas-remote-ready');
        showMapWarning('地图瓦片未能加载。仍可管理星标、照片与路线，请检查网络后重试。');
        mapConnection('地图资源连接失败；请检查网络后重试。',true);
      },10000);
      confirmRaster();
    }catch(error){
      console.warn('基础地图恢复失败',error);
      document.body.classList.remove('atlas-remote-ready');
      showMapWarning('地图组件无法加载。收藏、媒体与路线仍可使用。');
      mapConnection('地图组件加载失败，请检查网络后重试。',true);
    }
  }
  // Read-only map readiness probe for acceptance: UI mounted != actual tiles ready.
  // No credentials, coordinates or personal data are exposed.
  window.__atlasMapHealth=()=>{
    const provider=isOfficial()?'amap':isVector()?'openfreemap-vector':'raster-fallback';
    let ready=false,canvas=false;
    try{
      if(provider==='amap'){
        canvas=!!$('amapSurface')?.querySelector('canvas');
        ready=canvas&&document.body.classList.contains('atlas-remote-ready');
      }else if(provider==='openfreemap-vector'){
        const c=vectorMap?.getCanvas?.();
        canvas=!!(c&&c.width>10&&c.height>10);
        ready=canvas&&!!vectorMap?.isStyleLoaded?.()&&!!vectorMap?.areTilesLoaded?.()&&document.body.classList.contains('atlas-remote-ready');
      }else{
        canvas=!!map?.getCanvas?.();
        ready=canvas&&!!map?.isSourceLoaded?.('base')&&!!map?.loaded?.()&&!!map?.areTilesLoaded?.()&&document.body.classList.contains('atlas-remote-ready');
      }
    }catch(_){}
    return {provider,ready:!!ready,canvas:!!canvas,warning:!!$('mapError')?.classList.contains('visible'),status:document.body.classList.contains('map-booting')?'loading':ready?'ready':'unavailable'};
  };
  async function activateVectorMap(forceRetry=false){
    if(vectorStarting||vectorMap||(map&&window.AtlasServices?.staticHost&&!forceRetry))return;
    vectorStarting=true;
    /* build .18 · 启动只保留 atlasMapLoader 一个指示器,不再叠第二条 toast */
    try{
      await injectMapLibre();
      const c=currentCenter();
      vectorHasRenderedOnce=false;
      $('atlasVectorMap').hidden=false;
      vectorMap=new window.maplibregl.Map({container:'atlasVectorMap',style:'https://tiles.openfreemap.org/styles/bright',center:[c.lng,c.lat],zoom:Math.max(2,Math.min(19,currentZoom())),pitch:0,bearing:0,maxPitch:0,minZoom:2,maxZoom:19,attributionControl:{compact:true},dragRotate:false,renderWorldCopies:false,
        // Keep every POI, tile, place click and building detail. Bound WebGL
        // Retina backing pixels on iPhone to 2x instead of native 3x.
        pixelRatio:mobileStableMap?Math.min(window.devicePixelRatio||1,2):undefined});
      mapMode='vector';document.body.classList.remove('legacy-recovery');document.body.classList.add('vector-active');document.body.classList.remove('amap-active');
      vectorMap.touchZoomRotate.disableRotation();
      // A WebGL context may be lost transiently during a heavy street-zoom
      // on iOS / software GPU. MapLibre itself can restore the canvas; removing
      // the entire map synchronously prevents that recovery and causes a blank
      // raster fallback on the very same exhausted graphics context.
      const activeCanvas=vectorMap.getCanvas();
      let contextRestoreTimer=null,contextRestorePending=false;
      activeCanvas?.addEventListener('webglcontextlost',event=>{
        event.preventDefault();
        if(!isVector()||vectorMap?.getCanvas?.()!==activeCanvas)return;
        contextRestorePending=true;
        document.body.classList.remove('atlas-remote-ready');
        mapConnection('地图图形正在恢复，请稍候…',true);
        clearTimeout(contextRestoreTimer);
        contextRestoreTimer=setTimeout(()=>{
          if(contextRestorePending&&isVector()&&vectorMap?.getCanvas?.()===activeCanvas)
            recoverFromVectorFailure('WebGL 图形上下文在恢复期限内未恢复，已尝试基础地图。');
        },6000);
      });
      activeCanvas?.addEventListener('webglcontextrestored',()=>{
        if(!contextRestorePending)return;
        contextRestorePending=false;
        clearTimeout(contextRestoreTimer);
        if(!isVector()||vectorMap?.getCanvas?.()!==activeCanvas)return;
        try{vectorMap.resize();vectorMap.triggerRepaint()}catch(_){}
        // The renderer will mark ready only once the refreshed style and
        // actual visible tiles finish loading.
        const restoreReady=()=>{
          if(!isVector()||vectorMap?.getCanvas?.()!==activeCanvas)return;
          if(vectorMap.isStyleLoaded?.()&&vectorMap.areTilesLoaded?.()){
            document.body.classList.add('atlas-remote-ready');
            mapConnection('',false);
            vectorMap.off('idle',restoreReady);
          }
        };
        vectorMap.on('idle',restoreReady);restoreReady();
      });
      let loaded=false,tilesReady=false,vectorTileTimer=null;
      const confirmVectorTiles=()=>{
        if(tilesReady||!isVector()||!vectorMap)return;
        let ready=false;
        try{
          const canvas=vectorMap.getCanvas?.();
          ready=!!(canvas&&canvas.width>10&&canvas.height>10&&
            vectorMap.isStyleLoaded?.()&&vectorMap.areTilesLoaded?.());
        }catch(_){}
        if(!ready)return;
        tilesReady=true;vectorHasRenderedOnce=true;clearTimeout(vectorTileTimer);
        vectorMap.off('idle',confirmVectorTiles);
        document.body.classList.add('atlas-remote-ready');
        document.body.classList.remove('map-booting');
        hideMapWarning();
        mapConnection('',false);
      };
      vectorMap.on('remove',()=>{
        clearTimeout(vectorRenderWatch);vectorRenderWatch=null;
        clearTimeout(vectorTileTimer);
        vectorMap?.off('idle',confirmVectorTiles);
      });
      vectorMap.once('load',()=>{
        loaded=true;vectorSetStyle();renderVectorBookmarks();scheduleVectorPOIs();
        updateVectorUserLocation();if(selectedDestination)showVectorSelection(selectedDestination);
        // A loaded style is not evidence that the visible map tiles rendered.
        vectorMap.on('idle',confirmVectorTiles);confirmVectorTiles();
      });
      vectorMap.on('error',e=>{
        if(!tilesReady){console.warn('矢量瓦片加载中',e.error);
          mapConnection('矢量瓦片仍未就绪，正在等待或回退到基础地图');}
      });
      vectorMap.on('click',selectVectorTap);
      vectorMap.on('move',()=>{userHasMovedMap=true;scheduleVectorBookmarkRender();if(selectedId)relayoutMemoryOpen();const pane=$('atlasPoiOverlay');if(pane)pane.style.opacity='0'});
      vectorMap.on('moveend',()=>{rememberMapView();renderVectorBookmarks();scheduleVectorPOIs();const pane=$('atlasPoiOverlay');if(pane)pane.style.opacity='1';/* Legacy raster camera synchronizes once on provider fallback, not on every vector gesture. */});
      vectorMap.on('zoomend',()=>{updateVectorCamera();renderVectorBookmarks();scheduleVectorPOIs()});
      vectorMap.on('styledata',scheduleVectorPOIs);
      vectorTileTimer=setTimeout(()=>{
        if(!tilesReady&&mapMode==='vector')
          recoverFromVectorFailure('矢量地图瓦片连接超时，已切换到基础地图。');
      },13500);
    }catch(e){console.error(e);recoverFromVectorFailure('无法加载矢量建筑图，已切换到基础地图。');}
    finally{vectorStarting=false}
  }

  async function init(){
    await database();
    const initFlag=await getMeta('initialized');
    if(!initFlag){await setMeta('initialized',true)}
    try{if(!window.AtlasServices?.staticHost)initMap();else document.body.classList.add('map-booting')}catch(err){console.error('地图组件启动失败:',err);showMapWarning('地图组件遇到问题，但不会影响你的收藏和照片，请在「足迹」中查看或导出备份。')}
    await refresh();setTimeout(showIncomingShare,400);bootCurrentLocation();
    // Startup uses the authorized AMap credentials; any failure leaves the existing read-only fallback visible.
    officialView='white';automaticScaleMode=false;
    // Stay on architectural black/white map; initialize official AMap near building scale only.
    // No automatic provider switching: use the AMap map at every zoom level.
    // Retain hidden legacy nodes for compatibility, but remove all alternative layer actions.
    $('btnLayers').onclick=()=>{};
    for(const key of ['chipSatellite','chipStreet','chipFigure','chipAmap','amapStreet','amapSatellite','amapModel'])$(key).onclick=()=>{};
    toggleLayerMenu(false);
    $('selectionBack').onclick=hideDestination;$('selectionClose').onclick=hideDestination;
    $('btnStars').onclick=openDrawer;$('closePoiFilters').onclick=()=>{$('poiFilters').hidden=true};document.querySelectorAll('[data-poi-category]').forEach(btn=>btn.onclick=()=>setPoiFilter(btn.dataset.poiCategory));
    $('amapForm').addEventListener('submit',e=>{e.preventDefault();activateOfficial()});$('amapClose').onclick=()=>$('amapSetup').close();$('amapCancel').onclick=()=>$('amapSetup').close();
    $('retryMap').onclick=()=>{hideMapWarning();mapConnection('',false);if(window.AtlasServices?.staticHost&&!isVector()){document.body.classList.add('map-booting');activateVectorMap(true);return}if(!map){location.reload();return}streetSource=0;installTileLayer('street',true)};
    $('btnZoomIn').onclick=()=>(map||isVector()||isOfficial())?zoomMap(1):toast('地图尚未加载');$('btnZoomOut').onclick=()=>(map||isVector()||isOfficial())?zoomMap(-1):toast('地图尚未加载');
    $('btnLocate').onclick=()=>{userHasMovedMap=false;requestCurrentLocation(true)};
    // AMap is the only displayed provider; initialize it automatically once controls are ready.
    // build .17 · 所有设备(含 iPhone)都优先尝试高德:部署环境注入了 AMAP_WEB_KEY 即用高德,
    // 未配置时 activateOfficial 的 catch 会自动回落到矢量底图,行为与原来一致。
    Promise.resolve().then(()=>window.AtlasServices?.staticHost?activateVectorMap():activateOfficial());
    $('quickNear').onclick=()=>{discoverNear();closeSearchResults()};$('quickStars').onclick=openDrawer;$('quickPin').onclick=()=>{$('navAdd').click()};
    $('chipDiscover').onclick=discoverNear;
    $('chipAll').onclick=()=>{closeMemory();setPicking(false);if(places.length)fitMapPlaces(places,12);else toast('还没有收藏的地点')};
    $('chipList').onclick=openDrawer;$('navList').onclick=openDrawer;$('navMap').onclick=()=>{closeDrawer();closeMemory();closeSearchResults();setPicking(false);requestAnimationFrame(inspectVectorAfterReturn)};$('navBackup').onclick=openDrawer;$('navAdd').onclick=confirmPicking;$('cancelPick').onclick=()=>setPicking(false);$('closeDrawer').onclick=closeDrawer;$('closeMemory').onclick=closeMemory;$('cover').onclick=closeDrawer;$('searchForm').onsubmit=performSearch;$('searchInput').addEventListener('input',()=>{invalidateSearch();closeSearchResults(true);if($('searchInput').value.trim().length>=2)searchDebounce=setTimeout(()=>performSearch(),420)});$('searchInput').addEventListener('focus',()=>{if($('searchInput').value.trim().length>=2&&$('searchResults').children.length)$('searchResults').classList.add('visible')});
    $('closeEditor').onclick=requestEditorClose;$('editorForm').onsubmit=savePlace;document.querySelectorAll('input[name=placeStage]').forEach(r=>r.addEventListener('change',syncEditorStage));$('atlasKeepEditing').onclick=()=>$('atlasDiscardDialog').close();$('atlasDiscardChanges').onclick=discardEditor;
    $('editor').addEventListener('click',e=>{if(e.target===$('editor'))requestEditorClose()});
    $('editor').addEventListener('cancel',e=>{e.preventDefault();requestEditorClose()});
    $('photoUpload').onchange=async e=>{const files=[...e.target.files];e.target.value='';if(files.length)await ingestFiles(files)};
    $('directUpload').onchange=async e=>{const files=[...e.target.files],id=e.target.dataset.target;e.target.value='';if(files.length&&id)await ingestFiles(files,id)};
    $('deletePlace').onclick=()=>{if(editing&&!savingEditor&&!ingestingMedia&&!$('atlasDeleteDialog').open)$('atlasDeleteDialog').showModal()};
    $('atlasCancelDelete').onclick=()=>$('atlasDeleteDialog').close();$('atlasKeepStar').onclick=()=>$('atlasUnstarDialog').close();
    $('atlasConfirmDelete').onclick=async()=>{if(!editing||savingEditor||ingestingMedia)return;
      const btn=$('atlasConfirmDelete');btn.disabled=true;
      try{await remove(editing.id);$('atlasDeleteDialog').close();editing=null;editorOriginSnapshot='';$('editor').close();closeMemory();await refresh();toast('地点已删除')}
      catch(err){console.error(err);toast('删除失败，请检查存储空间后重试')}
      finally{btn.disabled=false}
    };
    $('closeShareNotice').onclick=()=>{$('shareNotice').classList.remove('visible');history.replaceState(null,'',location.pathname)}; $('shareNotice').onclick=e=>{if(e.target===$('shareNotice'))$('closeShareNotice').click()};$('closeNavigationChooser').onclick=()=>$('navigationChooser').classList.remove('visible');$('navigationChooser').onclick=e=>{if(e.target===$('navigationChooser'))$('closeNavigationChooser').click()};$('closeViewer').onclick=closeViewer;$('viewerPrev').onclick=()=>{photoIndex--;updateViewer()};$('viewerNext').onclick=()=>{photoIndex++;updateViewer()};
    /* build .21 · 用户批注：全屏看图必须能左右滑切换 */
    (function(){const v=$('viewer');let sx=null,sy=0;
      v.addEventListener('touchstart',e=>{if(e.touches.length!==1||e.target.closest('button,video')){sx=null;return}sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
      v.addEventListener('touchend',e=>{if(sx===null||!v.classList.contains('visible'))return;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;sx=null;
        if(Math.abs(dx)<52||Math.abs(dx)<Math.abs(dy)*1.35)return;
        if(dx<0)$('viewerNext').click();else $('viewerPrev').click();
      },{passive:true});v.addEventListener('touchcancel',()=>{sx=null},{passive:true});
    })();
    $('viewer').onclick=e=>{if(e.target===$('viewer'))closeViewer()};

    document.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const {action,id,idx}=btn.dataset;if(action==='photo')openViewer(id,Number(idx));if(action==='edit'){const p=places.find(x=>x.id===id);if(p)beginEdit(p)}if(action==='upload'){const p=places.find(x=>x.id===id);if(p){$('directUpload').dataset.target=p.id;$('directUpload').click()}}});
    document.addEventListener('pointerdown',e=>{if(!$('layerMenu').hidden&&!e.target.closest('#layerMenu')&&!e.target.closest('#btnLayers'))toggleLayerMenu(false)},{passive:true});
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        if(e.defaultPrevented||$('editor').open||$('atlasDiscardDialog').open||$('atlasDeleteDialog').open||$('atlasUnstarDialog').open||$('amapSetup').open)return;
        if($('viewer').classList.contains('visible')){e.preventDefault();closeViewer();return}
        if($('atlasRoutesSheet').classList.contains('open')){e.preventDefault();window.__atlasRoutesEntry?.show(false);return}
        if($('drawer').classList.contains('visible')){e.preventDefault();closeDrawer();return}
        if(picking){e.preventDefault();setPicking(false);return}
        if($('destinationCard').classList.contains('visible')){e.preventDefault();hideDestination()}
        return;
      }
      if($('viewer').classList.contains('visible')&&e.key==='ArrowLeft'){$('viewerPrev').click();e.preventDefault()}
      if($('viewer').classList.contains('visible')&&e.key==='ArrowRight'){$('viewerNext').click();e.preventDefault()}
    });
    $('exportBtn').onclick=downloadBackup;$('importBtn').onclick=()=>$('importFile').click();$('importFile').onchange=e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value=''};
    if(location.protocol==='file:')toast('本地网页用于源码检查，完整地图请访问已部署网站');
    else { /* V22: distant black/white figure-ground, near plan-view building model. */ }
  }
  // Stage1.29: public, read-only map bridge for hand-drawn POI overlay.
  // All coordinates use the active renderer, never the hidden legacy map.
  window.__atlasPOIBridge={
    vector:()=>isVector()?vectorMap:null,
    raster:()=>!isVector()&&!isOfficial()?map:null,
    official:()=>isOfficial()?officialMap:null,
    officialPlaces:()=>officialNearbyPlaces.slice(),
    projectOfficial:(place)=>{if(!isOfficial()||!officialSDK)return null;try{const xy=wgsToGcj(Number(place.lng),Number(place.lat));const pt=officialMap.lngLatToContainer(new officialSDK.LngLat(xy[0],xy[1]));return{x:Number(pt.getX?.()??pt.x),y:Number(pt.getY?.()??pt.y)}}catch(_){return null}},
    select:(place)=>showDestination(place),
    selectSaved:(id)=>showPlace(id,true)
  };
  window.dispatchEvent(new Event('atlas:map-bridge'));
  window.__atlasRealPOIQA=()=>({mode:mapMode,shown:isOfficial()?$('atlasPoiOverlay')?.querySelectorAll('.atlas-poi-hit').length:Number($('atlasPoiOverlay')?.dataset.realPoiCount||0),backend:officialPoiBackendAvailable,officialReady:isOfficial()&&document.body.classList.contains('atlas-remote-ready'),vectorReady:isVector()&&vectorMap.loaded(),offline:!document.body.classList.contains('atlas-remote-ready')});
  window.__atlasQA=()=>({mode:mapMode,zoom:currentZoom(),pitch:isVector()?vectorMap.getPitch():isOfficial()?officialMap.getPitch():0,poiButtons:$('atlasPoiOverlay')?.querySelectorAll('button')?.length||0,selected:selectedDestination?.name||null,popup:$('destinationCard').classList.contains('visible'),has3D:isVector()?!!vectorMap.getLayer('atlas-3d-buildings'):!!officialBuildings});
  // Scheme B: keep the map still when the detail bubble opens. Layout adapts around the anchor.
  window.__atlasReframeForCollage=()=>{};
  window.__atlasDismissSavedPlace=()=>closeMemory();
  window.__atlasOrbitState=()=>{const p=places.find(x=>x.id===selectedId);return p?{id:p.id,title:p.title,note:p.note,date:p.date,lat:Number(p.lat),lng:Number(p.lng),photoCount:p.photos?.length||0,videoCount:p.videos?.length||0,references:p.references||[],guides:p.guides||[],url:p.url||'',link:p.link||''}:null};
  /* ── 我的路线入口：有已存路线 → 面板；无 → 直接进规划页 ── */
  window.__atlasRoutesEntry={
    db:null,
    list(){return window.FootprintMediaCore.createRepository(indexedDB).listRoutes()},
    async openFromMenu(){const plans=await this.list();this.render(plans);this.show(true)},
    render(plans){const sheet=$('atlasRoutesSheet'),list=sheet.querySelector('.rs-list');list.replaceChildren();
      for(const p of plans){const a=document.createElement('a');a.className='rs-row';a.href='./route-view.html?saved='+encodeURIComponent(p.id);
        const n=Array.isArray(p.placeIds)?p.placeIds.length:(Array.isArray(p.selected)?p.selected.length:(Array.isArray(p.stops)?p.stops.length:0));
        const days=p.startDate?(p.startDate+(p.endDate&&p.endDate!==p.startDate?' → '+p.endDate:'')):'未标日期';
        a.innerHTML='<span class="rs-badge">☆</span><span class="rs-meta"><b></b><span></span></span><span class="rs-go">›</span>';
        a.querySelector('b').textContent=p.title;a.querySelector('.rs-meta span').textContent=n+' 个收藏点 · '+days;list.append(a)}
      if(!plans.length){const d=document.createElement('div');d.className='rs-empty';d.style.cssText='padding:22px 14px;color:#8b8c87;font-size:12px;line-height:1.7';d.textContent='还没有保存的路线。点底部「路线」，用地图选点或收藏点选点开始规划。';list.append(d)}
      sheet.querySelector('.rs-new').href=$('atlasJourneyEntry').getAttribute('href')},
    show(on){$('atlasRoutesSheet').classList.toggle('open',on);$('atlasRoutesVeil').classList.toggle('open',on);if(on)$('atlasRoutesSheet').querySelector('.rs-close').focus()},
    init(){const link=$('atlasJourneyEntry');if(!link)return;
      $('atlasRoutesVeil').addEventListener('click',()=>this.show(false));
      $('atlasRoutesSheet').querySelector('.rs-close').addEventListener('click',()=>this.show(false));
      document.addEventListener('keydown',e=>{if(e.key==='Escape')this.show(false)})}
  };
  window.__atlasRoutesEntry.init();
  window.__atlasFirstStarGuide={evaluate(){try{const el=$('atlasFirstStar');if(!el)return;const done=localStorage.getItem('atlas-first-star-done')==='1';el.hidden=done||places.some(p=>p.starred!==false)}catch(e){}},dismiss(){try{localStorage.setItem('atlas-first-star-done','1')}catch(e){}const el=$('atlasFirstStar');if(el)el.hidden=true}};
  document.getElementById('atlasFirstStar')?.querySelector('.fs-close')?.addEventListener('click',()=>window.__atlasFirstStarGuide.dismiss());
  window.__atlasFlowRefresh=async()=>{await refresh()}; window.__fpSearchCenter=()=>currentCenter(); window.__fpSearchSelect=(d)=>{const lat=Number(d.lat),lng=Number(d.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;closeSearchResults();setPicking(false);closeMemory();setMapView(lat,lng,Math.max(Number(d.zoom)||0,14));addSearchMarker(lat,lng,d.name||'地点');showDestination({name:d.name||'地点',lat,lng,address:d.address||'',id:d.id||'',category:d.category||'地点'})}; window.__atlasMobilePoiAPI={
 get map(){return map;},
 center:()=>currentCenter(),
 zoom:()=>currentZoom(),
 project:(lng,lat)=>{try{const p=map?._pixel?.(lng,lat),r=$('map').getBoundingClientRect();return p&&Number.isFinite(+p.x)&&Number.isFinite(+p.y)?{x:+p.x+r.left,y:+p.y+r.top}:null}catch(_){return null}},
 select:(p)=>{if(p&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)&&!window.__atlasTripPicking)showDestination({...p,name:p.name||'地点'})}
};
window.__atlasRefreshPins=()=>{if(isOfficial())renderBookmarkOverlay();else if(isVector())renderVectorBookmarks();else renderMarkers()};
  window.__atlasPickMapAPI={
  project:(lng,lat)=>{
    if(!Number.isFinite(lng)||!Number.isFinite(lat))return null;
    try{
      if(isOfficial()&&officialMap&&officialSDK){
        const ll=wgsToGcj(lng,lat),p=officialMap.lngLatToContainer(new officialSDK.LngLat(ll[0],ll[1]));
        const x=Number(p?.getX?.()??p?.x),y=Number(p?.getY?.()??p?.y);
        return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
      }
      if(isVector()&&vectorMap){const p=vectorMap.project([lng,lat]);return {x:p.x,y:p.y}}
      if(map?.project){const p=map.project([lng,lat]);return {x:p.x,y:p.y}}
      if(map?._pixel){const p=map._pixel(lng,lat);return {x:p.x,y:p.y}}
    }catch(e){console.debug('地点投影暂时不可用',e)}
    return null;
  },
  zoom:()=>currentZoom(),
  zoomTo:(lat,lng,z)=>setMapView(Number(lat),Number(lng),z,true)
};
// Entering route selection must never alter camera position/scale.
window.__atlasEnsurePickZoom=()=>{};
window.__atlasCameraQA=()=>{const c=currentCenter();return {lng:c.lng,lat:c.lat,zoom:currentZoom(),provider:mapMode,routePicking:!!window.__atlasTripPicking}};
window.__atlasSaveMapView=rememberMapView;
  window.__atlasEditPlace=id=>{const p=places.find(x=>x.id===id);if(p)beginEdit(p)};
  window.__atlasDemo={select:(name,lat,lng)=>showDestination({name,lat,lng,category:'地点'}),close:hideDestination,openSaved:(id)=>showPlace(id,true),getSaved:()=>places.map(x=>({id:x.id,title:x.title,starred:x.starred})),zoom:(n)=>zoomMap(n),vector:()=>activateVectorMap()};
  init().catch(err=>{console.error('初始化失败:',err);showMapWarning('旅行地图启动异常：'+(err?.message||'未知原因')+'。请点击重试。');});
})();
