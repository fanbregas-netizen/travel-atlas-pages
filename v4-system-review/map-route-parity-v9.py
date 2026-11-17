#!/usr/bin/env python3
"""Scoped V4 route map parity: icon vocabulary and native centering only.
Leaves approved C V5 sheet, dates, route ordering and storage untouched.
Called after map-route-smooth.py in the isolated review build.
"""
from pathlib import Path
import sys
p=Path(sys.argv[1]); s=p.read_text(encoding='utf-8')
def once(a,b,label):
 global s
 count=s.count(a)
 if count!=1:raise SystemExit(f'{label}: expected one anchor, found {count}')
 s=s.replace(a,b,1)

if p.name=='route-cards-v5-live.js':
 once(
 "let liveMapPickMode=null,liveMapPickHint=null;const livePendingRoutePlaces=new Map();",
 "let liveMapPickMode=null,liveMapPickHint=null;let liveTopPlaceId=null;const livePendingRoutePlaces=new Map();",
 'single-foreground-route-poi')

 once(
 "  const selectionMapRender=mapRender;",
 """  // Reuse the same V3 hand-drawn symbol family as the main POI overlay.
  // Route positions remain the original C V5 button records, not new markers.
  function routeIcon(spot){
   const t=String(spot.category||'')+' '+String(spot.name||'')+' '+String(spot.sub||'');
   const icons=[
    [/海|波|潮|海滩|沙滩|滨海|水域/i,'22_sea'],
    [/湖|水库|水面/i,'26_lake'],
    [/山|峰|岭|雪山|峡谷/i,'21_mountain'],
    [/森林|树林|林场|植物园/i,'23_forest'],
    [/古镇|老街|历史街区|古村/i,'24_town'],
    [/博物馆|美术馆|展览馆/i,'45_museum'],
    [/公园|花园|园林|绿地/i,'46_park'],
    [/咖啡|coffee|cafe/i,'47_coffee'],
    [/餐厅|饭店|小吃|美食/i,'43_food'],
    [/酒店|民宿|宾馆/i,'44_stay'],
    [/地铁|公交|火车站|车站/i,'48_transit']
   ];
   const found=icons.find(([pattern])=>pattern.test(t));
   return './icons/'+(found?found[1]:'16_add_place')+'.svg';
  }
  const selectionMapRender=mapRender;""",
 'same-approved-handdrawn-poi-family')

 once(
 "class=\"rc-pin rc-choice-pin ${{selected?'selected':''}\"",
 "class=\"rc-pin rc-choice-pin ${{selected?'selected':''} ${{String(spot.id)===liveTopPlaceId?'fp-route-tapped':''}\"",
 'persistent-selected-route-poi-class')
 once(
 "data-place-id=\"${{spot.id}\" data-rc=\"pick-${{spot.id}\"",
 "data-place-id=\"${{spot.id}\" data-route-only=\"${{spot.routeOnly?'1':'0'}\" data-rc=\"pick-${{spot.id}\"",
 'route-poi-identity')
 once(
 ">${{spot.starred!==false?'★':'＋'}</button>",
 "><img class=\"fp-route-poi-art\" src=\"${{routeIcon(spot)}\" alt=\"\" aria-hidden=\"true\"></button>",
 'handdrawn-symbol-instead-of-plus')

 once(
 " allPlaces.push(p);const mode=liveMapPickMode;",
 " allPlaces.push(p);liveTopPlaceId=p.id;const mode=liveMapPickMode;",
 'new-real-map-poi-owns-foreground')

 once(
 """ const newPin=Array.from(routeMap.querySelectorAll('#rc-map-pins [data-place-id]')).find(el=>el.dataset.placeId===p.id);
 if(newPin&&!window.matchMedia?.('(prefers-reduced-motion:reduce)')?.matches){
   requestAnimationFrame(()=>newPin.isConnected&&newPin.classList.add('fp-map-pick-arrive'));
   newPin.addEventListener('animationend',()=>newPin.classList.remove('fp-map-pick-arrive'),{once:true});
 }
 toast(mode==='add'?'已在路线中间添加地图途经点':'已选中真实地图位置');""",
 """ // The card/render may rebuild this very pin: locate the final DOM
 // on the next frame, then animate its icon without creating a duplicate.
 requestAnimationFrame(()=>{
  const node=Array.from(routeMap.querySelectorAll('#rc-map-pins [data-place-id]')).find(el=>el.dataset.placeId===p.id);
  if(!node)return;
  node.classList.add('fp-route-tapped');
  if(!window.matchMedia?.('(prefers-reduced-motion:reduce)')?.matches)
   node.classList.add('fp-map-pick-arrive');
 });
 toast(mode==='add'?'已在路线中间添加地图途经点':'已选中真实地图位置');""",
 'smooth-new-pin-after-card-render')

 once(
 """ liveMap.on('click',e=>{
  if(!liveMapPickMode||!e.lngLat)return;
  const point=namedFeatureAtTap(e);
  const lng=point?.lng??Number(e.lngLat.lng),lat=point?.lat??Number(e.lngLat.lat);
  if(!livePickedPoint(lng,lat,point?.name||''))return;
  if(!window.matchMedia?.('(prefers-reduced-motion:reduce)')?.matches){
   liveMap.stop();
   liveMap.easeTo({center:[lng,lat],offset:[0,-58],duration:360,
    easing:t=>1-Math.pow(1-t,3),essential:true});
  }
 });""",
 """ liveMap.on('click',e=>{
  if(!liveMapPickMode||!e.lngLat)return;
  const point=namedFeatureAtTap(e);
  const lng=point?.lng??Number(e.lngLat.lng),lat=point?.lat??Number(e.lngLat.lat);
  if(!livePickedPoint(lng,lat,point?.name||''))return;
  // Same camera motor as approved homepage: move the geographic POI to
  // the true center without zooming the MAP or offsetting the anchor.
  if(!window.matchMedia?.('(prefers-reduced-motion:reduce)')?.matches){
   liveMap.stop();
   liveMap.easeTo({center:[lng,lat],zoom:liveMap.getZoom(),duration:470,
    easing:t=>t*t*(3-2*t),essential:true});
  }
 });""",
 'home-map-center-no-offset-no-zoom')

 once(
 " window.__atlasLivePlannerMap=liveMap;",
 """ window.__atlasLivePlannerMap=liveMap;
 // Tap a previously saved marker with the same Apple-like POI raise/center.
 // The existing C V5 button listener still owns selection and route state.
 routeMap.querySelector('#rc-map-pins')?.addEventListener('click',e=>{
  const pin=e.target.closest('button[data-place-id]');if(!pin)return;
  const place=allPlaces.find(p=>String(p.id)===pin.dataset.placeId);
  if(!place)return;
  liveTopPlaceId=place.id;
  requestAnimationFrame(()=>{
   const pane=routeMap.querySelector('#rc-map-pins');
   const current=Array.from(pane?.querySelectorAll('[data-place-id]')||[]).find(n=>n.dataset.placeId===String(place.id));
   pane?.querySelectorAll('.fp-route-tapped').forEach(n=>n.classList.remove('fp-route-tapped','fp-map-pick-arrive'));
   if(current){
    current.classList.add('fp-route-tapped');
    if(!window.matchMedia?.('(prefers-reduced-motion:reduce)')?.matches)current.classList.add('fp-map-pick-arrive');
   }
  });
  if(window.matchMedia?.('(prefers-reduced-motion:reduce)')?.matches)return;
  const v=liveMap.project([+place.lng,+place.lat]),box=liveMap.getContainer();
  if(Math.hypot(v.x-box.clientWidth/2,v.y-box.clientHeight/2)<2)return;
  liveMap.stop();
  liveMap.easeTo({center:[+place.lng,+place.lat],zoom:liveMap.getZoom(),
   duration:470,easing:t=>t*t*(3-2*t),essential:true});
 });
""",
 'click-existing-route-poi-raises-and-centers')

elif p.name=='route-view.html':
 once(
 "b.onclick=e=>{e.stopPropagation();activate(i,false)};",
 "b.onclick=e=>{e.stopPropagation();activate(i,true)};",
 'route-view-pin-also-centers-like-home')
 once(
 "map.easeTo({center:[+p.lng,+p.lat],zoom:Math.max(11,Math.min(14,map.getZoom())),duration:480,essential:true})",
 "map.stop();map.easeTo({center:[+p.lng,+p.lat],zoom:map.getZoom(),duration:470,easing:t=>t*t*(3-2*t),essential:true})",
 'route-view-stop-no-unexpected-zoom')
else:
 raise SystemExit('out of scope: '+p.name)

p.write_text(s,encoding='utf-8')
print('PASS route map approved home visual and interaction parity:',p)
