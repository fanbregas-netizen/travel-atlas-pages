/* Footprint Map V3 ink pictograms for real geolocated POIs.
 * No separate Overpass projection; query the active MapLibre tile source only.
 * Preserves road and settlement names; de-duplicates native POI labels. */
(()=>{'use strict';
 const icons={mountain:'21_mountain',sea:'22_sea',forest:'23_forest',town:'24_town',creative:'25_creative',lake:'26_lake',food:'43_food',stay:'44_stay',museum:'45_museum',park:'46_park',coffee:'47_coffee',transit:'48_transit',shopping:'49_shopping',school:'50_school',hospital:'51_hospital',library:'52_library',pharmacy:'53_pharmacy',bank:'54_bank',parking:'55_parking',sport:'56_sport',civic:'57_civic',worship:'58_worship'};
 // Exact semantic match. Specific social infrastructure BEFORE scenery or generic POIs.
 const rules=[
  ['school',/(?:school|college|university|kindergarten|academy|education|校园|学校|小学|中学|高中|大学|学院|幼儿园|教育)/i],
  ['hospital',/(?:hospital|clinic|doctors|dentist|healthcare|hospitality_care|医院|诊所|卫生院|医疗|牙科)/i],
  ['pharmacy',/(?:pharmacy|chemist|drugstore|药店|药房)/i],
  ['library',/(?:library|reading_room|图书馆|阅览室)/i],
  ['bank',/(?:bank|atm|银行|取款机)/i],
  ['parking',/(?:parking|car_park|停车场|停车库)/i],
  ['sport',/(?:stadium|sports_centre|pitch|sport|体育馆|运动场|球场|体育场|健身房)/i],
  ['civic',/(?:townhall|town_hall|police|fire_station|post_office|courthouse|government|市政府|派出所|消防站|邮局|政府|政务)/i],
  ['worship',/(?:place_of_worship|church|mosque|synagogue|chapel|教堂|清真寺|礼拜堂)/i],
  ['transit',/(?:bus_station|bus_stop|railway|train_station|subway|metro|tram_stop|airport|aerodrome|transport|地铁|公交站|火车站|机场|轨道交通)/i],
  ['coffee',/(?:cafe|coffee|tea_house|coffee_shop|咖啡|茶馆)/i],
  ['food',/(?:restaurant|fast_food|bakery|food_court|bar|pub|餐厅|餐馆|小吃|美食|餐饮|面包店|酒吧)/i],
  ['stay',/(?:hotel|hostel|guest_house|lodging|motel|resort|酒店|民宿|旅馆|住宿|客栈)/i],
  ['museum',/(?:museum|memorial|exhibition|博物馆|纪念馆|展览馆|文物馆)/i],
  ['creative',/(?:gallery|artwork|art_centre|creative|design_studio|艺术中心|美术馆|画廊|创意园|艺术园|设计中心)/i],
  ['town',/(?:historic|temple|castle|ruins|old_town|ancient_town|古镇|古城|老街|遗址|寺庙|古寺)/i],
  ['park',/(?:park|garden|zoo|aquarium|playground|植物园|公园|花园|动物园|游乐场)/i],
  ['mountain',/(?:mountain|peak|volcano|hiking|cliff|山峰|雪山|峡谷|登山|徒步)/i],
  ['sea',/(?:ocean|beach|coast|bay|island|waterfront|海滩|海滨|沙滩|海湾|海岛)/i],
  ['lake',/(?:lake|river|pond|wetland|waterfall|spring|湖泊|湖|湿地|水库|瀑布|河流)/i],
  ['forest',/(?:forest|woodland|nature_reserve|森林|自然保护区|林场)/i],
  ['shopping',/(?:supermarket|shopping_mall|marketplace|department_store|convenience|商场|购物中心|超市|便利店|菜市场)/i],
 ];
 function categoryFor(category,name=''){
   const signal=String(category||'').trim(),label=String(name||'').trim();
   // Never classify a school as a lake because its source layer says 'water'.
   const strongName=rules.slice(0,9).find(([_,rx])=>rx.test(label))?.[0];
   return strongName||rules.find(([_,rx])=>rx.test(signal))?.[0]||rules.find(([_,rx])=>rx.test(label))?.[0]||null;
 }
 const fileFor=(category,name)=>{const key=categoryFor(category,name);if(!key)return null;const path='./icons/'+icons[key]+'.svg';return window.__atlasInlineIconPaths?.[path]||path};
 window.AtlasPOIIcons={categoryFor,fileFor,icons:Object.freeze({...icons})};
 const $=id=>document.getElementById(id);
 const cells=new Set();let currentMap=null,bridge=null,queued=0,activePointer='',lastMapStyle='';
 const mapRect=()=>($('atlasVectorMap')||document.body).getBoundingClientRect();
 function nativeLabelLayers(map){try{return(map.getStyle()?.layers||[]).filter(l=>/poi|amenity|tourism|shop|leisure|historic/i.test(l.id+' '+(l['source-layer']||''))&&l.type==='symbol'&&l.layout?.visibility!=='none')}catch(_){return[]}}
 function candidatesFromVector(map){
  const style=map.getStyle?.()||{},layers=style.layers||[],points=[];
  const seen=new Set();
  const poiLayers=layers.filter(l=>/poi|amenity|tourism|shop|leisure|historic/i.test((l['source-layer']||'')+' '+l.id));
  const sources=new Set();
  for(const layer of poiLayers){const source=layer.source,sl=layer['source-layer'];if(!source||!sl)continue;const key=source+'~'+sl;if(sources.has(key))continue;sources.add(key);
   let rows=[];try{rows=map.querySourceFeatures(source,{sourceLayer:sl})||[]}catch(_){}
   for(const f of rows){const p=f.properties||{},name=String(p['name:zh']||p.name_zh||p.name||p['name:en']||'').trim();
    if(!name||name.length>38||f.geometry?.type!=='Point')continue;
    const geo=f.geometry.coordinates;if(!geo||!Number.isFinite(geo[0])||!Number.isFinite(geo[1]))continue;
    const cat=[p.class,p.subclass,p.type,p.amenity,p.tourism,p.leisure,p.shop,p.natural,p.historic,p.landuse].filter(Boolean).join(' ');
    const id=String(f.id??p.id??name)+'|'+geo[0].toFixed(5)+','+geo[1].toFixed(5);if(seen.has(id))continue;seen.add(id);
    if(!categoryFor(cat,name))continue;points.push({id,name,lng:geo[0],lat:geo[1],category:cat});if(points.length>=360)break;
   }
  }
  if(points.length)return points;
  // Fallback for tile styles that have no publicly queryable source layer.
  let drawn=[];try{drawn=map.queryRenderedFeatures()||[]}catch(_){}
  return drawn.filter(f=>/poi|amenity|tourism|shop|leisure|historic/i.test(f.layer?.id||'')&&f.geometry?.type==='Point').slice(0,250).map(f=>({id:String(f.id||f.properties?.id||''),name:String(f.properties?.['name:zh']||f.properties?.name||''),lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0],category:[f.properties?.class,f.properties?.subclass,f.properties?.amenity,f.properties?.tourism].filter(Boolean).join(' ')})).filter(p=>p.name&&categoryFor(p.category,p.name));
 }
 function renderRows(rows,project,scale=1){const pane=$('atlasPoiOverlay');if(!pane||!project)return 0;
  const z=Number(currentMap?.getZoom?.()||15);const named=z>=15.25;
  const W=innerWidth,H=innerHeight;const limit=z<10.5?0:z<13.3?7:z<14.4?13:z<16?24:40;
  const edges={left:28,right:W-28,top:90,bottom:Math.min(H-140,$('appDock')?.getBoundingClientRect().top-22||H-130)};
  // The same physical point has ONE icon: saved yellow star replaces POI.
  const identity=window.FootprintPOIIdentity;
  const savedAnchors=(window.__atlasSavedPOIAnchors?.()||[]).filter(p=>Number.isFinite(+p.lat)&&Number.isFinite(+p.lng));
  // One shared geographic identity replaces the old 43px/screen heuristic.
  const isBehindStar=p=>identity?.nearSaved?.(p,savedAnchors)||false;
  const kept=[];cells.clear();
  // Category-rich scenic elements first; generic POIs are subordinate.
  const essential=new Set(['museum','creative','town','park','mountain','sea','lake','forest']);
  rows=rows.filter(p=>{const type=categoryFor(p.category,p.name);return !!type&&(z>=13.3||essential.has(type))});
  rows.sort((a,b)=>Number(b.fpSource==='amap')-Number(a.fpSource==='amap')||a.name.localeCompare(b.name,'zh-CN'));
  for(const p of rows){if(kept.length>=limit)break;let xy;try{xy=project(p)}catch(_){continue}if(!xy||!Number.isFinite(xy.x)||!Number.isFinite(xy.y))continue;
   if(xy.x<edges.left||xy.x>edges.right||xy.y<edges.top||xy.y>edges.bottom||isBehindStar(p))continue;
   if(kept.some(v=>identity?.samePlace?.(v.p,p)))continue;
   const cell=Math.floor(xy.x/(named?92:58))+':'+Math.floor(xy.y/(named?56:55));if(cells.has(cell))continue;cells.add(cell);kept.push({p,xy});
  }
  // Retain rendered POI DOM across map movement. Recreating every button on
  // zoomend interrupted the 1.3s SVG subpath animation and caused label flicker.
  const prior=new Map([...pane.querySelectorAll(':scope > .fp-poi')].map(node=>[node.dataset.poiId,node]));
  const fragment=document.createDocumentFragment();
  const visibleIds=new Set();
  for(const {p,xy} of kept){
   const id=String(p.id);
   visibleIds.add(id);
   let b=prior.get(id),fresh=!b;
   if(!b){
    b=document.createElement('button');b.type='button';b.className='fp-poi';
    b.dataset.poiId=id;
    const token=document.createElement('span');token.className='fp-poi-token';
    const img=document.createElement('img');img.src=fileFor(p.category,p.name);img.alt='';img.setAttribute('aria-hidden','true');token.append(img);b.append(token);
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const old=pane.querySelector('.fp-poi.is-selected');if(old!==b)old?.classList.remove('is-selected','is-tapped');
      b.classList.add('is-selected');activePointer=b.dataset.poiId;
      // The pictogram pops while the camera smoothly pans at a CONSTANT zoom.
      window.AtlasPOIMotion?.popSelected?.(b.querySelector('.fp-poi-token'));
      window.AtlasPOIMotion?.play(b.querySelector('.fp-poi-token'),b.dataset.poiCategory,b.dataset.poiName);
      try{navigator.vibrate?.(8)}catch(_){}
      const selected={name:b.dataset.poiName,lat:Number(b.dataset.poiLat),lng:Number(b.dataset.poiLng),category:b.dataset.poiRawCategory,id:b.dataset.poiId};
      // Let the inner artwork reach its first spring peak before opening the
      // place sheet. The georeferenced outer POI itself never transforms.
      // The selected icon already animates in place; the card opens in the SAME tap frame.
      // Delaying 220ms spawned another selected marker over it, visible as ghosting.
      if(b.isConnected)bridge?.select?.(selected);
    });
   }
   b.style.removeProperty('translate');
   b.style.left=xy.x+'px';b.style.top=xy.y+'px';b.title=p.name;
   b.setAttribute('aria-label','查看'+p.name);
   b.dataset.poiCategory=categoryFor(p.category,p.name);
   b.dataset.poiRawCategory=p.category;
   b.dataset.poiName=p.name;b.dataset.poiLat=p.lat;b.dataset.poiLng=p.lng;
   let label=b.querySelector('.fp-poi-label');
   if(named){if(!label){label=document.createElement('span');label.className='fp-poi-label';b.append(label)}if(label.textContent!==p.name)label.textContent=p.name}
   else if(label)label.remove();
   b.classList.toggle('is-selected',activePointer===id&&document.body.classList.contains('destination-selected'));
   // Existing POIs must stay attached: detaching on every map frame resets
   // WebKit SVG subpath timing and makes a tapped pictogram stutter.
   if(fresh)fragment.append(b);
  }
  // Keep the selected SVG attached even when the POI density grid changes
  // during centering: replacing it would truncate the accepted spring.
  for(const [id,node] of prior){
   if(visibleIds.has(id))continue;
   const geo={id,lat:Number(node.dataset.poiLat),lng:Number(node.dataset.poiLng)};
   const xy=Number.isFinite(geo.lat)&&Number.isFinite(geo.lng)?project(geo):null;
   const nowSaved=isBehindStar({...geo,name:node.dataset.poiName});
   if(id===activePointer&&!nowSaved)continue;
   if(nowSaved&&id===activePointer)activePointer='';
   node.remove();
  }
  if(fragment.childNodes.length)pane.append(fragment);
  pane.dataset.realPoiCount=String(kept.length);
  return kept.length;
 }
 function doRender(){queued=0;bridge=window.__atlasPOIBridge||bridge;if(!bridge)return;
  const map=bridge.vector?.(),off=bridge.official?.();const pane=$('atlasPoiOverlay');if(!pane)return;
  if(map&&map.isStyleLoaded?.()){
   // Keep a single camera-owned POI transform until the pan commits at moveend.
   if(window.__atlasPOICentering)return;
   currentMap=map;window.FootprintAMapPOI?.attach?.(map);
   const nativeRows=candidatesFromVector(map),amapRows=window.FootprintAMapPOI?.visible?.(map)||[];
   const shown=renderRows([...amapRows,...nativeRows],p=>map.project([p.lng,p.lat]));
   if(shown>0){
    // Preserve native POI text labels, especially for unknown categories.
    // Replacing the entire label layer previously erased many important names.
    const labels=nativeLabelLayers(map);
    for(const l of labels){try{if(map.getPaintProperty(l.id,'icon-opacity')!==0)map.setPaintProperty(l.id,'icon-opacity',0)}catch(_){}}
   }
   return;
  }
  if(off){currentMap={getZoom:()=>off.getZoom?.()};renderRows(bridge.officialPlaces?.()||[],p=>bridge.projectOfficial?.(p));return}
  pane.replaceChildren();
 }
 // Reposition EXISTING georeferenced SVG buttons with the map on every visual
 // frame. Never detach nodes or replay SVG motion while the camera eases.
 let anchorFrame=0;
 function queueAnchorSync(){
  // Automatic centering is now handled by one shared parent compositor
  // translation in the map renderer itself. No per-POI rAF in this path.
  if(window.__atlasPOICentering)return;
  if(anchorFrame||document.hidden)return;
  anchorFrame=requestAnimationFrame(()=>{
   anchorFrame=0;
   const m=bridge?.vector?.(),pane=$('atlasPoiOverlay');
   if(!m||!pane)return;
   for(const b of pane.querySelectorAll(':scope > .fp-poi')){
    const lng=Number(b.dataset.poiLng),lat=Number(b.dataset.poiLat);
    if(!Number.isFinite(lng)||!Number.isFinite(lat))continue;
    const p=m.project([lng,lat]);
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    // Do not relayout ~20 individual POI hit targets every WebGL frame.
    // Keep their baseline left/top stable and track camera pixels through
    // a compositor-only translate; their SVG animation remains independent.
    const baseX=parseFloat(b.style.left),baseY=parseFloat(b.style.top);
    if(Number.isFinite(baseX)&&Number.isFinite(baseY))
      b.style.translate=(p.x-baseX)+'px '+(p.y-baseY)+'px';
    else {b.style.left=p.x+'px';b.style.top=p.y+'px'}
   }
  });
 }
 document.addEventListener('atlas:saved-stars-changed',()=>{if(queued){clearTimeout(queued);queued=0}doRender()});
 document.addEventListener('atlas:poi-source-updated',schedule);
 document.addEventListener('atlas:poi-cleared',()=>{
  activePointer='';
  $('atlasPoiOverlay')?.querySelectorAll('.fp-poi.is-selected').forEach(n=>n.classList.remove('is-selected'));
 });
 // Synchronous end-of-pan commit before the map renderer removes the
 // shared overlay translation; avoids the one-frame marker disappearance.
 window.__atlasPOICommitCurrent=()=>{
  if(queued){clearTimeout(queued);queued=0}
  doRender();
 };
 function schedule(){if(queued)return;queued=window.setTimeout(doRender,140)}
 function attach(){bridge=window.__atlasPOIBridge;if(!bridge)return false;
  const map=bridge.vector?.(),off=bridge.official?.();
  if(map&&!map.__fpPoi29Bound){map.__fpPoi29Bound=true;map.on?.('move',queueAnchorSync);map.on?.('moveend',schedule);map.on?.('zoomend',schedule);map.on?.('load',schedule);map.on?.('styledata',schedule);map.on?.('sourcedata',schedule);}
  if(off&&!off.__fpPoi29Bound){off.__fpPoi29Bound=true;off.on?.('moveend',schedule);off.on?.('zoomend',schedule);}
  schedule();return Boolean(map||off);
 }
 let polls=0;const start=()=>{if(attach())return;const t=setInterval(()=>{if(attach()||++polls>80)clearInterval(t)},300)};
 window.addEventListener('atlas:map-bridge',()=>{attach()}, {passive:true});
 window.addEventListener('resize',schedule,{passive:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
