/* Bounded real OSM place markers for lightweight iPhone map; optional and safe offline. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const cache=new Map();let active=[],started=false,latest='',lastFetch=0,timer=0,controller=null;
const finite=n=>n!==null&&n!==undefined&&Number.isFinite(Number(n));
function type(t){const value=t?.tourism||t?.amenity||t?.shop||t?.leisure||t?.historic||'地点';const names={cafe:'咖啡',restaurant:'餐饮',bar:'酒吧',fast_food:'快餐',museum:'博物馆',gallery:'画廊',attraction:'景点',hotel:'酒店',park:'公园',supermarket:'超市',convenience:'商店',school:'学校',library:'图书馆',station:'车站',hospital:'医院'};return names[value]||'地点'}
function normalize(rows,lat,lng){return (rows.elements||[]).map(x=>({lat:Number(x.lat??x.center?.lat),lng:Number(x.lon??x.center?.lon),name:String(x.tags?.['name:zh']||x.tags?.name||'').trim(),id:String(x.type)+':'+String(x.id),category:type(x.tags),address:[x.tags?.['addr:street'],x.tags?.['addr:housenumber']].filter(Boolean).join(' ')})).filter(x=>finite(x.lat)&&finite(x.lng)&&x.name&&x.name.length<=48&&Math.abs(x.lat-lat)<.03&&Math.abs(x.lng-lng)<.03)}
async function fetchPlaces(lat,lng,radius){
 const circle='(around:'+radius+','+lat+','+lng+')';
 const kinds=['amenity','tourism','shop','leisure','historic'];
 const query='[out:json][timeout:9];('+kinds.map(k=>'node'+circle+'["name"]["'+k+'"];').join('')+'way'+circle+'["name"]["tourism"];way'+circle+'["name"]["amenity"];);out center 180;';
 controller?.abort();controller=new AbortController();const c=controller,t=setTimeout(()=>c.abort(),10500);
 try{const r=await fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(query),{signal:c.signal,headers:{Accept:'application/json'}});if(!r.ok)throw Error('OSM server '+r.status);return normalize(await r.json(),lat,lng)}
 finally{clearTimeout(t)}
}
function render(){if(!started)return;const p=$('atlasPoiOverlay'),api=window.__atlasMobilePoiAPI;if(!p||!api?.project)return;
 const width=innerWidth,height=innerHeight,z=api.zoom(),names=z>=14.8,cells=new Set(),max=z>=17?48:z>=15.5?36:22,frag=document.createDocumentFragment();let count=0;
 for(const x of active){const xy=api.project(x.lng,x.lat);if(!xy||xy.x<26||xy.x>width-28||xy.y<85||xy.y>height-155)continue;
  const cell=Math.floor(xy.x/(names?84:48))+':'+Math.floor(xy.y/(names?40:47));if(cells.has(cell))continue;cells.add(cell);
  const b=document.createElement('button');b.type='button';b.className='atlas-mobile-poi'+(names?' is-named':'');b.style.left=xy.x+'px';b.style.top=xy.y+'px';b.setAttribute('aria-label','查看真实地点 '+x.name);b.title=x.name;
  const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');b.append(dot);
  if(names){const title=document.createElement('span');title.textContent=x.name;b.append(title)}
  b.onclick=e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();api.select(x)};
  frag.append(b);if(++count>=max)break
 }
 p.replaceChildren(frag);p.dataset.realPoiCount=String(count)}
function schedule(){clearTimeout(timer);timer=setTimeout(update,450)}
async function update(){if(!started)return;const api=window.__atlasMobilePoiAPI,z=api?.zoom?.(),c=api?.center?.();if(!finite(z)||!c||!finite(c.lat)||!finite(c.lng))return;
 if(z<12.8){active=[];render();return}
 const lat=Number(c.lat).toFixed(3),lng=Number(c.lng).toFixed(3),rad=z>=16?650:z>=15?900:1350,key=lat+':'+lng+':'+rad,cached=cache.get(key);
 if(cached&&Date.now()-cached.time<420000){active=cached.places;render();return}
 if(Date.now()-lastFetch<11000){render();return}latest=key;lastFetch=Date.now();
 try{const places=await fetchPlaces(lat,lng,rad);if(latest!==key)return;cache.set(key,{time:Date.now(),places});if(cache.size>16)cache.delete(cache.keys().next().value);active=places;render()}
 catch(e){console.debug('Nearby OSM markers unavailable; map remains interactive',e?.message);render()}
}
function attach(){const api=window.__atlasMobilePoiAPI;if(started||!window.__atlasStableMapEnabled||!api?.map)return;started=true;
 api.map.on?.('moveend',schedule);api.map.on?.('zoomend',schedule);api.map.on?.('load',schedule);
 window.addEventListener('resize',render,{passive:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});schedule()}
function init(){let n=0;const t=setInterval(()=>{if(window.__atlasMobilePoiAPI?.map){clearInterval(t);attach()}else if(++n>=32)clearInterval(t)},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();