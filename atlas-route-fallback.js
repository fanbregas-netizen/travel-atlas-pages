/* Lightweight, dependency-free raster slippy map. No WebGL or remote JS required. */
(function(){
'use strict';
const PI=Math.PI, MAXLAT=85.05112878;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const modulo=(x,n)=>((x%n)+n)%n;
const world=zoom=>256*Math.pow(2,zoom);
function lngToX(lng,z){return (lng+180)/360*world(z)}
function latToY(lat,z){const r=clamp(lat,-MAXLAT,MAXLAT)*PI/180;return (1-Math.log(Math.tan(r)+1/Math.cos(r))/PI)/2*world(z)}
function pixelToLng(x,z){return modulo(x,world(z))/world(z)*360-180}
function pixelToLat(y,z){return Math.atan(Math.sinh(PI*(1-2*y/world(z))))*180/PI}
class LngLatBounds{
 constructor(){this.points=[]}extend(p){this.points.push([+p[0],+p[1]]);return this}
}
class Marker{
 constructor(options){this.el=options.element;this.coordinates=[0,0];this.map=null;}
 setLngLat(a){this.coordinates=[+a[0],+a[1]];if(this.map)this.map._placeMarker(this);return this}
 addTo(map){this.map=map;this.el.classList.add('map-local-marker');map.markerPane.appendChild(this.el);map.markers.add(this);map._placeMarker(this);return this}
 getElement(){return this.el}
 remove(){this.map?.markers.delete(this);this.map=null;this.el.remove()}
}
class Map{
 constructor(opt){
  this.el=typeof opt.container==='string'?document.getElementById(opt.container):opt.container;
  if(!this.el)throw Error('地图容器不存在');
  this.style=opt.style;this.center={lng:+opt.center[0],lat:+opt.center[1]};this.zoom=+opt.zoom;
  this.minZoom=opt.minZoom??2;this.maxZoom=opt.maxZoom??19;this.markers=new Set();this.events={};this.items=new MapCollection();
  this.epoch=0;this.isReady=false;this.baseLoaded=false;this.pointerStates=new globalThis.Map();
  this.el.innerHTML='';this.el.classList.add('simplemap');
  this.tilePane=document.createElement('div');this.tilePane.className='simplemap-tiles';
  this.labelPane=document.createElement('div');this.labelPane.className='simplemap-labels';
  this.markerPane=document.createElement('div');this.markerPane.className='simplemap-markers';this.destinationPane=document.createElement('div');this.destinationPane.className='simplemap-destinations';
  this.attribution=document.createElement('div');this.attribution.className='simplemap-attrib';
  this.figureCanvas=document.createElement('canvas');this.figureCanvas.className='figure-canvas';this.figureCanvas.setAttribute('aria-hidden','true');this.el.append(this.tilePane,this.labelPane,this.figureCanvas,this.destinationPane,this.markerPane,this.attribution);
  this.el.style.touchAction='none';this.el.addEventListener('pointerdown',e=>this._down(e));
  this.el.addEventListener('pointermove',e=>this._move(e));this.el.addEventListener('pointerup',e=>this._up(e));
  this.el.addEventListener('pointercancel',e=>this._up(e));this.el.addEventListener('wheel',e=>this._wheel(e),{passive:false});
  this.el.addEventListener('dblclick',e=>{e.preventDefault();this._zoomAt(this.zoom+1,e.clientX,e.clientY)});
  this.touchZoomRotate={disableRotation:()=>{}};
  this._render();setTimeout(()=>{this._fire('load');},0);
 }
 on(name,handler){(this.events[name]??=[]).push(handler);return this}
 once(name,handler){const wrapped=(e)=>{this.off(name,wrapped);handler(e)};return this.on(name,wrapped)}
 off(name,handler){this.events[name]=(this.events[name]||[]).filter(h=>h!==handler);return this}
 _fire(name,data){(this.events[name]||[]).slice().forEach(h=>{try{h(data)}catch(e){console.error('地图交互出错',e)}})}
 getCenter(){return {...this.center}}
 getZoom(){return this.zoom}
 getContainer(){return this.el}
 getCanvas(){return this.el}
 getPitch(){return 0}
 getBearing(){return 0}
 project(a){return this._pixel(+a[0],+a[1])}
 easeTo(opts){this.jumpTo(opts)}
 loaded(){return this.baseLoaded}
 isSourceLoaded(sourceId){return sourceId==='base' && this.baseLoaded}
 _pixel(lng,lat){const z=this.zoom,cx=lngToX(this.center.lng,z),cy=latToY(this.center.lat,z),px=lngToX(lng,z),py=latToY(lat,z),w=world(z);let dx=px-cx;if(dx>w/2)dx-=w;if(dx< -w/2)dx+=w;return {x:this.el.clientWidth/2+dx,y:this.el.clientHeight/2+py-cy}}
 _latlngAt(x,y){const rect=this.el.getBoundingClientRect(),cx=lngToX(this.center.lng,this.zoom),cy=latToY(this.center.lat,this.zoom);return {lng:pixelToLng(cx+x-rect.left-rect.width/2,this.zoom),lat:pixelToLat(cy+y-rect.top-rect.height/2,this.zoom)}}
 _placeMarker(m){const p=this._pixel(m.coordinates[0],m.coordinates[1]);m.el.style.left=p.x+'px';m.el.style.top=p.y+'px';m.el.style.display=(p.x< -65||p.y< -65||p.x>this.el.clientWidth+65||p.y>this.el.clientHeight+65)?'none':'block'}
 _render(){
  const w=this.el.clientWidth||window.innerWidth,h=this.el.clientHeight||window.innerHeight;
  const tileZ=clamp(Math.floor(this.zoom),0,19),scale=Math.pow(2,this.zoom-tileZ),count=Math.pow(2,tileZ);
  const cx=lngToX(this.center.lng,tileZ),cy=latToY(this.center.lat,tileZ),tx=cx/256,ty=cy/256;
  const left=Math.floor(tx-w/(512*scale)),right=Math.ceil(tx+w/(512*scale));
  const top=clamp(Math.floor(ty-h/(512*scale)),0,count-1),bottom=clamp(Math.ceil(ty+h/(512*scale)),0,count-1);
  // No legacy raster fetches at architectural zoom. This is one geographic
  // renderer, not two maps composited with different zoom/loading cadence.
  const vectorCanvasOnly=document.body.classList.contains('atlas-canvas-primary')&&this.zoom>=12;
  const defs=vectorCanvasOnly?[]:[{id:'base',pane:this.tilePane,template:this.style.sources?.base?.tiles?.[0]}];
  if(!vectorCanvasOnly&&this.style.sources?.labels)defs.push({id:'labels',pane:this.labelPane,template:this.style.sources.labels.tiles?.[0]});
  if(vectorCanvasOnly){
    if(this.tilePane.childElementCount)this.tilePane.replaceChildren();
    if(this.labelPane.childElementCount)this.labelPane.replaceChildren();
  }
  for(const def of defs){if(!def.template)continue;const keep=new Set();
   for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
    const nx=modulo(x,count),key=`${tileZ}:${x}:${y}`,px=(x*256-cx)*scale+w/2,py=(y*256-cy)*scale+h/2;
    let img=def.pane.querySelector(`img[data-key="${key}"]`);
    if(!img){img=document.createElement('img');img.dataset.key=key;img.draggable=false;img.alt='';img.decoding='async';img.loading='eager';img.style.position='absolute';img.style.pointerEvents='none';img.style.userSelect='none';img.style.opacity='0';img.onload=()=>{if(!img.isConnected)return;img.style.opacity='1';if(def.id==='base'){this.baseLoaded=true;this._fire('idle')}};
     img.onerror=()=>{if(!img.isConnected)return;img.remove();this._fire('error',{sourceId:def.id,error:new Error('地图图片读取失败')})};
     def.pane.appendChild(img);const src=def.template.replace('{z}',tileZ).replace('{x}',nx).replace('{y}',y);img.src=src;
    }
    keep.add(key);img.style.left=Math.round(px)+'px';img.style.top=Math.round(py)+'px';img.style.width=Math.ceil(256*scale+0.4)+'px';img.style.height=Math.ceil(256*scale+0.4)+'px';
   }
   Array.from(def.pane.children).forEach(im=>{if(!keep.has(im.dataset.key))im.remove()});
  }
  if(!this.style.sources?.labels)this.labelPane.innerHTML='';
  this.attribution.textContent=document.body.classList.contains('fg-active')?'OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors':(this.style?.sources?.base?.attribution||'© OpenStreetMap contributors');
  this.markers.forEach(m=>this._placeMarker(m));this._fire('repaint');
 }
 _moveCenter(dx,dy){const z=this.zoom;this.center={lng:pixelToLng(lngToX(this.center.lng,z)-dx,z),lat:pixelToLat(clamp(latToY(this.center.lat,z)-dy,0,world(z)),z)};this._render()}
 _zoomAt(z,clientX,clientY,continuous=false){const goal=clamp(z,this.minZoom,this.maxZoom);const point=this._latlngAt(clientX,clientY);this.zoom=goal;const rect=this.el.getBoundingClientRect(),offsetX=clientX-rect.left-rect.width/2,offsetY=clientY-rect.top-rect.height/2;
  const newCx=lngToX(point.lng,goal)-offsetX,newCy=latToY(point.lat,goal)-offsetY;this.center={lng:pixelToLng(newCx,goal),lat:pixelToLat(newCy,goal)};this._fire('zoomstart');this._render();if(!continuous)this._fire('moveend')}
 _down(e){
  if(e.target.closest('.map-local-marker,.poi-marker'))return;
  if(e.button!==undefined&&e.button!==0)return;
  this.pointerStates.set(e.pointerId,{x:e.clientX,y:e.clientY});
  this.tapStart=this.pointerStates.size===1?{x:e.clientX,y:e.clientY}:null;
  this.dragging=false;
  try{this.el.setPointerCapture(e.pointerId)}catch(err){}
  if(this.pointerStates.size===1)this.oldP={x:e.clientX,y:e.clientY};
  if(this.pointerStates.size===2){this.tapStart=null;const a=[...this.pointerStates.values()];this.pinch={dist:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),zoom:this.zoom,mid:{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}}}
 }
 _move(e){
  if(!this.pointerStates.has(e.pointerId))return;
  const prev=this.pointerStates.get(e.pointerId);this.pointerStates.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(this.pointerStates.size>=2){
   if(!this.dragging){this.dragging=true;this.tapStart=null;this._fire('dragstart')}
   const a=[...this.pointerStates.values()],dist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mid={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};
   if(!this.pinch)this.pinch={dist:dist||1,zoom:this.zoom,mid};
   const next=this.pinch.zoom+Math.log2(Math.max(1,dist)/Math.max(1,this.pinch.dist));
   this._zoomAt(next,mid.x,mid.y,true);this.oldP=mid;
  }else{
   if(!this.dragging){
    const start=this.tapStart||prev;
    if(Math.hypot(e.clientX-start.x,e.clientY-start.y)<9)return;
    this.dragging=true;this.tapStart=null;this._fire('dragstart');
   }
   this._moveCenter(e.clientX-prev.x,e.clientY-prev.y);
  }
 }
 _up(e){
  if(!this.pointerStates.has(e.pointerId))return;
  const tap=e.type!=='pointercancel'&&!this.dragging&&!!this.tapStart&&Math.hypot(e.clientX-this.tapStart.x,e.clientY-this.tapStart.y)<9&&this.pointerStates.size===1;
  this.pointerStates.delete(e.pointerId);
  if(this.pointerStates.size<2){this.pinch=null;if(this.pointerStates.size===1)this.oldP=[...this.pointerStates.values()][0]}
  if(!this.pointerStates.size){if(this.dragging)this._fire('moveend');this.dragging=false}
  if(tap){const location=this._latlngAt(e.clientX,e.clientY);setTimeout(()=>this._fire('maptap',location),50)}
  this.tapStart=null;
 }
 _wheel(e){e.preventDefault();this._zoomAt(this.zoom-clamp(e.deltaY,-150,150)/280,e.clientX,e.clientY)}
 setStyle(style){this.style=style;this.baseLoaded=false;this.tilePane.innerHTML='';this.labelPane.innerHTML='';this._render()}
 jumpTo(opts){if(opts.center)this.center={lng:+opts.center[0],lat:clamp(+opts.center[1],-MAXLAT,MAXLAT)};if(typeof opts.zoom==='number')this.zoom=clamp(opts.zoom,this.minZoom,this.maxZoom);this._render();this._fire('moveend')}
 flyTo(opts){this.jumpTo(opts)}
 zoomTo(z){this._zoomAt(z,this.el.getBoundingClientRect().left+this.el.clientWidth/2,this.el.getBoundingClientRect().top+this.el.clientHeight/2)}
 fitBounds(bounds,opts={}){const pts=Array.isArray(bounds)?bounds:(bounds.points||[]);if(!pts.length)return;const minLng=Math.min(...pts.map(p=>p[0])),maxLng=Math.max(...pts.map(p=>p[0])),minLat=Math.min(...pts.map(p=>p[1])),maxLat=Math.max(...pts.map(p=>p[1]));const zmax=Math.min(opts.maxZoom||17,this.maxZoom);
  let z=zmax;const pad=opts.padding||{},usableW=Math.max(160,this.el.clientWidth-(pad.left||0)-(pad.right||0)),usableH=Math.max(180,this.el.clientHeight-(pad.top||0)-(pad.bottom||0));
  while(z>this.minZoom && (Math.abs(lngToX(maxLng,z)-lngToX(minLng,z))>usableW||Math.abs(latToY(maxLat,z)-latToY(minLat,z))>usableH))z-=.25;
  this.jumpTo({center:[(minLng+maxLng)/2,(minLat+maxLat)/2],zoom:z});}
 resize(){this._render()}
 }
 class MapCollection{} // avoids Map constructor shadowing with built-in Map for marker registry
 function readProto(bytes){let i=0;return {
    get pos(){return i},get size(){return bytes.length},
    varint(){let n=0,s=0,v;do{if(i>=bytes.length)throw Error('PBF 截断');v=bytes[i++];n+=(v&127)*Math.pow(2,s);s+=7;if(s>63)throw Error('PBF 格式不支持')}while(v&128);return n},
    bytes(){const len=this.varint();if(len<0||i+len>bytes.length)throw Error('PBF 大小错误');const b=bytes.subarray(i,i+len);i+=len;return b},
    skip(w){if(w===0)this.varint();else if(w===2)this.bytes();else if(w===5)i+=4;else if(w===1)i+=8;else throw Error('PBF 字段错误')}
  }}
  function decodeShape(buf,minPoints=3){
    const p=readProto(buf);let x=0,y=0,contours=[],line=null,seen=0;
    while(p.pos<p.size&&seen<20000){
      const c=p.varint(),cmd=c&7,num=c>>3;
      if(!num||num>20000)break;
      if(cmd===1||cmd===2){
        for(let j=0;j<num;j++){
          const xx=p.varint(),yy=p.varint();seen++;
          x+=(xx>>>1)^-(xx&1);y+=(yy>>>1)^-(yy&1);
          if(cmd===1){line=[];contours.push(line)}
          if(line)line.push([x,y]);
        }
      }else if(cmd===7){/* Canvas/Path2D closes polygons itself. */}
      else break;
    }
    return contours.filter(r=>r.length>=minPoints);
  }
  // Decode only the OpenMapTiles geometry needed for an actual 2D architectural map.
  // Roads, water and greenery are vector layers, not grayscale filters on street-map screenshots.
  function decodeBuildings(buffer){
    const p=readProto(new Uint8Array(buffer)),dec=new TextDecoder();
    const result={buildings:[],roads:[],water:[],parks:[],waterways:[],poi:[],extent:4096};
    const supported=new Set(['building','transportation','water','waterway','landcover','landuse','poi','place']);
    while(p.pos<p.size){
      const tag=p.varint(),field=tag>>3,wire=tag&7;
      if(field!==3||wire!==2){p.skip(wire);continue}
      const layer=readProto(p.bytes());
      let name='',features=[],extent=4096,keys=[],values=[];
      while(layer.pos<layer.size){
        const t=layer.varint(),field=t>>3,w=t&7;
        if(field===1&&w===2)name=dec.decode(layer.bytes());
        else if(field===2&&w===2)features.push(layer.bytes());
        else if(field===3&&w===2)keys.push(dec.decode(layer.bytes()));
        else if(field===4&&w===2){
          const v=readProto(layer.bytes());let str='';
          while(v.pos<v.size){const t2=v.varint(),k=t2>>3,ww=t2&7;
            if(k===1&&ww===2)str=dec.decode(v.bytes());else v.skip(ww)}
          values.push(str);
        }else if(field===5&&w===0)extent=layer.varint();
        else layer.skip(w);
      }
      if(!supported.has(name))continue;
      result.extent=extent||4096;
      let accepted=0;
      const cap=name==='building'?900:name==='transportation'?900:name==='poi'?90:400;
      for(const bytes of features){
        if(accepted>=cap)break;
        const feature=readProto(bytes);let kind=0,geom=null,tags=null;
        while(feature.pos<feature.size){
          const t=feature.varint(),k=t>>3,w=t&7;
          if(k===3&&w===0)kind=feature.varint();
          else if(k===4&&w===2)geom=feature.bytes();
          else if(k===2&&w===2)tags=feature.bytes();
          else feature.skip(w);
        }
        if(!geom)continue;
        let props=null;
        const properties=()=>{
          if(props!==null)return props;
          props={};if(!tags)return props;
          const tp=readProto(tags);
          while(tp.pos<tp.size){const ki=tp.varint(),vi=tp.varint();if(keys[ki]!==undefined&&values[vi]!==undefined)props[keys[ki]]=values[vi]}
          return props;
        };
        if(name==='building'&&kind===3){
          const rings=decodeShape(geom);if(rings.length){result.buildings.push(rings);accepted++}
        }else if(name==='transportation'&&kind===2){
          const lines=decodeShape(geom,2);if(!lines.length)continue;
          const cls=String(properties().class||properties().subclass||'street');
          const importance=/motorway|trunk|primary/.test(cls)?'major':/secondary|tertiary|street|residential|living_street/.test(cls)?'street':'minor';
          result.roads.push({lines,importance});accepted++;
        }else if(name==='water'&&kind===3){
          const rings=decodeShape(geom);if(rings.length){result.water.push(rings);accepted++}
        }else if(name==='waterway'&&kind===2){
          const lines=decodeShape(geom,2);if(lines.length){result.waterways.push(lines);accepted++}
        }else if((name==='landcover'||name==='landuse')&&kind===3){
          const cls=String(properties().class||properties().subclass||'');
          if(!/park|grass|wood|forest|green|garden|meadow|recreation|nature|cemetery|scrub/.test(cls))continue;
          const rings=decodeShape(geom);if(rings.length){result.parks.push(rings);accepted++}
        }else if((name==='poi'||name==='place')&&kind===1){
          const props=properties();
          const title=String(props['name:zh']||props.name||props['name:en']||'').trim();
          if(!title||title.length>28)continue;
          const points=decodeShape(geom,1),pt=points[0]?.[0];
          if(pt){result.poi.push({name:title,x:pt[0],y:pt[1],category:String(props.class||name),extent,kind:name});accepted++}
        }
      }
    }
    return result;
  }

// Route only: 2D architectural map tiles share Footprint Map's real WGS84 source.
const TILE='https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf';
const atlasTiles=new globalThis.Map(),atlasPending=new Set();
let requestTimer=null;
function available(map){
 const zoom=map.getZoom(),z=Math.min(14,Math.floor(zoom));
 if(z<12)return [];
 const scale=2**(zoom-z),w=map.el.clientWidth,h=map.el.clientHeight,N=2**z;
 const x=lngToX(map.center.lng,z),y=latToY(map.center.lat,z);
 const a=Math.floor((x-w/(2*scale))/256),b=Math.ceil((x+w/(2*scale))/256);
 const c=clamp(Math.floor((y-h/(2*scale))/256),0,N-1),d=clamp(Math.ceil((y+h/(2*scale))/256),0,N-1);
 const out=[];for(let yy=c;yy<=d;yy++)for(let xx=a;xx<=b;xx++)
 out.push({z,xx,yy,x:modulo(xx,N),key:z+'/'+modulo(xx,N)+'/'+yy});
 return out.slice(0,28);
}
function fetchArchitecture(map){
 clearTimeout(requestTimer);
 requestTimer=setTimeout(()=>{
  for(const tile of available(map)){
   if(atlasTiles.has(tile.key)||atlasPending.has(tile.key)||atlasPending.size>=3)continue;
   atlasPending.add(tile.key);
   fetch(TILE.replace('{z}',tile.z).replace('{x}',tile.x).replace('{y}',tile.yy))
    .then(r=>{if(!r.ok)throw Error('Map tile '+r.status);return r.arrayBuffer()})
    .then(buf=>{atlasTiles.set(tile.key,decodeBuildings(buf));if(atlasTiles.size>36)atlasTiles.delete(atlasTiles.keys().next().value);paintArchitecture(map)})
    .catch(err=>{console.warn('2D route tile unavailable',err?.message);atlasTiles.set(tile.key,{extent:4096,buildings:[],roads:[],water:[],parks:[],waterways:[]})})
    .finally(()=>{atlasPending.delete(tile.key);fetchArchitecture(map)});
  }
 },180);
}
function tone(zoom){
 const keys=[[11,48],[14.3,52],[15.08,91],[15.48,151],[15.83,199],[16.25,232],[16.65,249],[17.1,255]];
 for(let i=1;i<keys.length;i++)if(zoom<=keys[i][0]){
  const a=keys[i-1],b=keys[i],v=Math.round(a[1]+(b[1]-a[1])*clamp((zoom-a[0])/(b[0]-a[0]),0,1));
  return 'rgb('+v+','+Math.min(255,v+2)+','+v+')';
 }
 return '#ffffff';
}
function outline(rings,closed=true){
 const p=new Path2D();for(const ring of rings)if(ring.length){
  p.moveTo(ring[0][0],ring[0][1]);for(let i=1;i<ring.length;i++)p.lineTo(ring[i][0],ring[i][1]);if(closed)p.closePath();
 }return p;
}
function paintArchitecture(map){
 const cv=map.figureCanvas,w=map.el.clientWidth,h=map.el.clientHeight,zoom=map.getZoom();
 if(!cv||!w||!h)return;
 const dpr=Math.min(window.devicePixelRatio||1,1.5),ctx=cv.getContext('2d');if(!ctx)return;
 if(cv.width!==Math.ceil(w*dpr)||cv.height!==Math.ceil(h*dpr)){cv.width=Math.ceil(w*dpr);cv.height=Math.ceil(h*dpr);cv.style.width=w+'px';cv.style.height=h+'px'}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 if(zoom<12)return;
 ctx.fillStyle='#f9f8f5';ctx.fillRect(0,0,w,h);
 const tiles=available(map);if(!tiles.length)return;
 const z=tiles[0].z,scale=2**(zoom-z),cx=lngToX(map.center.lng,z),cy=latToY(map.center.lat,z);
 for(const tile of tiles){
  const data=atlasTiles.get(tile.key);if(!data?.extent)continue;
  const left=(tile.xx*256-cx)*scale+w/2,top=(tile.yy*256-cy)*scale+h/2,size=256*scale,unit=data.extent/size;
  ctx.save();ctx.beginPath();ctx.rect(left,top,size,size);ctx.clip();
  ctx.translate(left,top);ctx.scale(size/data.extent,size/data.extent);
  if(!data.routePaths){
   const lines={major:[],street:[],minor:[]};
   for(const road of data.roads||[])lines[road.importance]?.push(...road.lines);
   data.routePaths={
    buildings:outline((data.buildings||[]).flatMap(x=>x)),
    parks:outline((data.parks||[]).flatMap(x=>x)),
    water:outline((data.water||[]).flatMap(x=>x)),
    waterways:outline((data.waterways||[]).flatMap(x=>x),false),
    roads:[outline(lines.minor,false),outline(lines.street,false),outline(lines.major,false)]
   };
  }
  const p=data.routePaths;
  ctx.fillStyle='#e7eae2';ctx.fill(p.parks,'evenodd');
  ctx.fillStyle='#dce5e7';ctx.fill(p.water,'evenodd');
  ctx.strokeStyle='#c3d2d4';ctx.lineWidth=2.3*unit;ctx.stroke(p.waterways);
  for(const [i,width] of [1.15,2.5,4.35].entries()){
   ctx.strokeStyle='#c5c8c3';ctx.lineWidth=(width+1.1)*unit;ctx.stroke(p.roads[i]);
   ctx.strokeStyle='#fffefb';ctx.lineWidth=width*unit;ctx.stroke(p.roads[i]);
  }
  const relief=clamp((zoom-15.65)/1.5,0,1);
  if(relief)for(const shadow of [[5,6,'#424a43',.20],[2.5,3.4,'#70766f',.32]]){
   ctx.save();ctx.translate(shadow[0]*relief*unit,shadow[1]*relief*unit);
   ctx.globalAlpha=shadow[3]*relief;ctx.fillStyle=shadow[2];ctx.fill(p.buildings,'evenodd');ctx.restore();
  }
  ctx.fillStyle=tone(zoom);ctx.fill(p.buildings,'evenodd');
  if(zoom>=16.2){ctx.strokeStyle='#858b84';ctx.lineWidth=1.05*unit;ctx.stroke(p.buildings)}
  ctx.restore();
 }
}
function enableArchitecture(map){
 if(map._routeArchitecture)return;
 map._routeArchitecture=true;
 document.body.classList.add('atlas-canvas-primary','fg-active','route-canvas-fallback');
 map.on('repaint',()=>paintArchitecture(map));
 map.on('moveend',()=>fetchArchitecture(map));
 map.on('zoomstart',()=>fetchArchitecture(map));
 map._render();
 fetchArchitecture(map);
}

window.AtlasRouteFallback={Map,Marker,LngLatBounds,supported:()=>true,enableArchitecture};
})();