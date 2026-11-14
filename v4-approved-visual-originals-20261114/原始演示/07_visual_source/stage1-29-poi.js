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
  const z=Number(currentMap?.getZoom?.()||15);const named=z>=15.25&&!currentMap?.isStyleLoaded?.();
  const W=innerWidth,H=innerHeight;const limit=z<13.3?0:z<14.4?12:z<16?20:34;
  const edges={left:28,right:W-28,top:90,bottom:Math.min(H-140,$('appDock')?.getBoundingClientRect().top-22||H-130)};
  const kept=[];cells.clear();
  // Category-rich scenic elements first; generic POIs are subordinate.
  rows=rows.filter(p=>Boolean(categoryFor(p.category,p.name)));rows.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
  for(const p of rows){if(kept.length>=limit)break;let xy;try{xy=project(p)}catch(_){continue}if(!xy||!Number.isFinite(xy.x)||!Number.isFinite(xy.y))continue;
   if(xy.x<edges.left||xy.x>edges.right||xy.y<edges.top||xy.y>edges.bottom)continue;
   const cell=Math.floor(xy.x/(named?92:58))+':'+Math.floor(xy.y/(named?56:55));if(cells.has(cell))continue;cells.add(cell);kept.push({p,xy});
  }
  const fragment=document.createDocumentFragment();
  for(const {p,xy} of kept){const b=document.createElement('button');b.type='button';b.className='fp-poi';
   b.style.left=xy.x+'px';b.style.top=xy.y+'px';b.title=p.name;b.setAttribute('aria-label','查看'+p.name);b.dataset.poiCategory=categoryFor(p.category,p.name);b.dataset.poiId=p.id;
   const token=document.createElement('span');token.className='fp-poi-token';const img=document.createElement('img');img.src=fileFor(p.category,p.name);img.alt='';img.setAttribute('aria-hidden','true');token.append(img);b.append(token);
   if(named){const label=document.createElement('span');label.className='fp-poi-label';label.textContent=p.name;b.append(label)}
   b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const old=pane.querySelector('.fp-poi.is-selected');old?.classList.remove('is-selected','is-tapped');
    b.classList.add('is-selected');b.classList.remove('is-tapped');void b.offsetWidth;b.classList.add('is-tapped');
    activePointer=p.id;try{navigator.vibrate?.(8)}catch(_){}
    // Keep the native location selection: never invent a second, duplicate marker.
    window.setTimeout(()=>{if(!b.isConnected)return;bridge?.select?.({name:p.name,lat:p.lat,lng:p.lng,category:p.category,id:p.id})},125);
   });fragment.append(b);
  }
  pane.replaceChildren(fragment);pane.dataset.realPoiCount=String(kept.length);
  return kept.length;
 }
 function doRender(){queued=0;bridge=window.__atlasPOIBridge||bridge;if(!bridge)return;
  const map=bridge.vector?.(),off=bridge.official?.();const pane=$('atlasPoiOverlay');if(!pane)return;
  if(map&&map.isStyleLoaded?.()){
   currentMap=map;const rows=candidatesFromVector(map);
   const shown=renderRows(rows,p=>map.project([p.lng,p.lat]));
   if(shown>0){
    // Preserve native POI text labels, especially for unknown categories.
    // Replacing the entire label layer previously erased many important names.
    const labels=nativeLabelLayers(map);
    for(const l of labels){try{map.setPaintProperty(l.id,'icon-opacity',0)}catch(_){}}
   }
   return;
  }
  if(off){currentMap={getZoom:()=>off.getZoom?.()};renderRows(bridge.officialPlaces?.()||[],p=>bridge.projectOfficial?.(p));return}
  pane.replaceChildren();
 }
 function schedule(){if(queued)return;queued=window.setTimeout(doRender,140)}
 function attach(){bridge=window.__atlasPOIBridge;if(!bridge)return false;
  const map=bridge.vector?.(),off=bridge.official?.();
  if(map&&!map.__fpPoi29Bound){map.__fpPoi29Bound=true;map.on?.('moveend',schedule);map.on?.('zoomend',schedule);map.on?.('load',schedule);map.on?.('styledata',schedule);map.on?.('sourcedata',schedule);}
  if(off&&!off.__fpPoi29Bound){off.__fpPoi29Bound=true;off.on?.('moveend',schedule);off.on?.('zoomend',schedule);}
  schedule();return Boolean(map||off);
 }
 let polls=0;const start=()=>{if(attach())return;const t=setInterval(()=>{if(attach()||++polls>80)clearInterval(t)},300)};
 window.addEventListener('atlas:map-bridge',()=>{attach()}, {passive:true});
 window.addEventListener('resize',schedule,{passive:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
