/* Footprint Map V4 | User-approved 22 POI internal SVG motions.
 * Runs only on real map selection. Neither map projection nor original SVG files are changed.
 * The outer geographic marker never gets a transform; inner artwork scales 1 -> 1.10 -> 1.
 * Source of every part animation: icon-motion-review-20261116.html.
 */
(()=>{'use strict';
const NS='http://www.w3.org/2000/svg';
const motionFailures=new Set();
const categoryToFile={mountain:'21_mountain',sea:'22_sea',forest:'23_forest',town:'24_town',creative:'25_creative',lake:'26_lake',food:'43_food',stay:'44_stay',museum:'45_museum',park:'46_park',coffee:'47_coffee',transit:'48_transit',shopping:'49_shopping',school:'50_school',hospital:'51_hospital',library:'52_library',pharmacy:'53_pharmacy',bank:'54_bank',parking:'55_parking',sport:'56_sport',civic:'57_civic',worship:'58_worship'};
const durations={mountain:850,sea:1300,forest:1100,town:920,creative:930,lake:1250,food:760,stay:870,museum:920,park:950,coffee:1150,transit:780,shopping:870,school:800,hospital:760,library:1100,pharmacy:740,bank:950,parking:840,sport:900,civic:850,worship:930};
const morphSea=[
['M7 23 C14 18 17 29 24 24 C31 18 35 28 42 24 C48 20 53 26 57 23',
 'M7 23 C14 27 17 19 24 24 C31 29 35 19 42 24 C48 27 53 20 57 23'],
['M7 35 C13 31 17 41 24 36 C31 31 35 41 42 36 C48 32 53 39 57 35',
 'M7 35 C13 39 17 30 24 36 C31 40 35 31 42 36 C48 39 53 31 57 35'],
['M12 47 C18 43 22 52 29 47 C35 43 39 52 45 47 C50 44 53 49 56 47',
 'M12 47 C18 51 22 43 29 47 C35 51 39 43 45 47 C50 50 53 44 56 47']
];
const starBase='M20 3.7 25.2 13.5 36.1 15.2 28.3 23 30.1 34 20 28.7 9.9 34 11.7 23 3.9 15.2 14.8 13.5Z';
const starShape='M20 2.6 25.6 13.2 37.2 14.8 28.8 23 30.5 35.2 20 29.1 9.4 35.2 11.2 23 2.8 14.8 14.4 13.2Z';
function svgNode(tag){return document.createElementNS(NS,tag)}
function setA(n,o){for(const [k,v] of Object.entries(o))n.setAttribute(k,String(v));return n}
function morph(n,from,to,dur,offset=0){
 const a=setA(svgNode('animate'),{attributeName:'d',values:[from,to,from].join(';'),dur:dur+'ms',keyTimes:'0;0.5;1',begin:'indefinite',fill:'remove'});
 a.dataset.animation='1';a.dataset.offset=String(offset);n.append(a);
}
function move(n,values,dur,type='translate',offset=0){
 const a=setA(svgNode('animateTransform'),{attributeName:'transform',attributeType:'XML',type,values:values.join(';'),dur:dur+'ms',begin:'indefinite',fill:'remove',additive:'sum'});
 a.dataset.animation='1';a.dataset.offset=String(offset);n.append(a);
}
function attr(n,name,values,dur,offset=0){
 const a=setA(svgNode('animate'),{attributeName:name,values:values.join(';'),dur:dur+'ms',begin:'indefinite',fill:'remove'});
 a.dataset.animation='1';a.dataset.offset=String(offset);n.append(a);
}
function draw(n,length,dur,offset=0){
 n.setAttribute('stroke-dasharray',String(length)+' '+String(length));
 attr(n,'stroke-dashoffset',[String(length),'0','0'],dur,offset);
}
function pieces(svg){
 const paths=[];
 for(const path of Array.from(svg.querySelectorAll('path'))){
  const d=path.getAttribute('d')||'';
  const chunks=d.match(/M[^M]*/g)||[d];
  if(chunks.length===1){paths.push(path);continue}
  const group=svgNode('g');
  for(const part of chunks){
   const n=path.cloneNode(false);n.setAttribute('d',part.trim());group.append(n);paths.push(n);
  }
  path.replaceWith(group);
 }
 return paths;
}
function addDetails(svg,id,dur){
 const p=pieces(svg);
 switch(id){
 case '21_mountain': draw(p[1],28,650);draw(p[2],25,650,160);break;
 case '22_sea':p.slice(0,3).forEach((n,i)=>morph(n,morphSea[i][0],morphSea[i][1],dur,i*100));break;
 case '23_forest': move(p[1],['0 0','-1.1 0','1 0','0 0'],dur,'translate');move(p[3],['0 0','1.3 -0.6','-1.2 0.3','0 0'],dur,'translate',90);break;
 case '24_town':p.slice(4,7).forEach((n,i)=>draw(n,22,650,i*120));draw(p[p.length-1],57,730);break;
 case '25_creative':p.slice(1,4).forEach((n,i)=>attr(n,'opacity',['0.25','1','0.75','1'],dur,i*110));if(p[4])draw(p[4],18,700);break;
 case '26_lake': {
  const n=p[1],d=n?.getAttribute('d');
  if(n&&d) morph(n,d,'M23 30 C29 33 39 27 42 33',dur);
  const edge=p[2],e=edge?.getAttribute('d');
  if(edge&&e)morph(edge,e,'M9 51 C17 54 25 47 34 50 C42 53 49 46 56 49',dur,100);
  break;
 }
 case '43_food':p.slice(0,3).forEach((n,i)=>draw(n,30,540,i*100));break;
 case '44_stay':p.slice(4,6).forEach((n,i)=>move(n,['0 0','0 -2.6','0 1','0 0'],dur,'translate',i*95));break;
 case '45_museum':p.slice(2,6).forEach((n,i)=>draw(n,27,700,i*115));break;
 case '46_park':move(p[0],['0 27 36','3 27 36','-2 27 36','0 27 36'],dur,'rotate');if(p[2])move(p[2],['0 0','1.7 -1','-1 0','0 0'],dur);break;
 case '47_coffee':p.slice(-2).forEach((n,i)=>{move(n,['0 0','0 -4','0 -8'],dur,'translate',i*120);attr(n,'opacity',['1','0.85','0'],dur,i*120)});break;
 case '48_transit':p.slice(1,4).forEach((n,i)=>{attr(n,'opacity',['0.3','1','0.4','1'],dur,i*90)});break;
 case '49_shopping':move(p[1],['0 0','0 -3','0 -1','0 0'],dur);break;
 case '50_school':{const door=p.find(n=>n.getAttribute('d')?.includes('M25 52'));if(door)move(door,['0 0','2 0','0 0'],dur);const clock=p[p.length-1];if(clock)draw(clock,18,dur);break}
 case '51_hospital':p.slice(-2).forEach((n,i)=>draw(n,36,660,i*125));break;
 case '52_library':p.slice(-2).forEach((n,i)=>move(n,['0 0','-2 -1','1 0','0 0'],dur,'translate',i*120));break;
 case '53_pharmacy':p.forEach((n,i)=>draw(n,46,600,i*120));break;
 case '54_bank':p.slice(2,6).forEach((n,i)=>draw(n,30,690,i*90));break;
 case '55_parking':draw(p[0],95,dur);break;
 case '56_sport': {
  const original=svg.querySelector('circle'); if(original)original.setAttribute('data-fixed-outer-circle','true');
  const inside=svgNode('g');p.forEach(n=>inside.append(n));svg.querySelector('g')?.append(inside);
  move(inside,['0 32 32','12 32 32','31 32 32','0 32 32'],dur,'rotate');
  break;
 }
 case '57_civic':{
  const round=svg.querySelector('circle');if(round){attr(round,'r',['3','5','3'],dur);attr(round,'opacity',['1','0.6','1'],dur)}
  p.slice(2,6).forEach((n,i)=>draw(n,30,680,i*100));break;
 }
 case '58_worship':{
  const door=p.find(n=>(n.getAttribute('d')||'').startsWith('M25 53'));
  if(door)move(door,['0 0','2.5 0','0 0'],dur);
  p.slice(-2).forEach((n,i)=>draw(n,19,620,i*90));break;
 }
 }
}

const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
const templateCache=new Map();
function sourceFor(id){
 if(templateCache.has(id))return templateCache.get(id);
 const path='./icons/'+id+'.svg',embedded=window.__atlasInlineIconPaths?.[path];
 const promise=(embedded?.startsWith('data:image/svg+xml;base64,')
  ?Promise.resolve(atob(embedded.substring('data:image/svg+xml;base64,'.length)))
  :fetch(path,{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('SVG '+r.status);return r.text()}))
  .then(text=>{
    const doc=new DOMParser().parseFromString(text,'image/svg+xml');
    if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg')throw Error('Invalid trusted POI SVG');
    return doc.documentElement;
  }).catch(err=>{templateCache.delete(id);throw err});
 templateCache.set(id,promise);return promise;
}
// Compose one SVG motion per category while idle, not during a live tap.
const preparedCache=new Map();
function preparedFor(entry){
 if(preparedCache.has(entry.id))return preparedCache.get(entry.id);
 const promise=sourceFor(entry.id).then(source=>{
  const svg=document.importNode(source,true);
  svg.removeAttribute('width');svg.removeAttribute('height');
  svg.setAttribute('aria-hidden','true');svg.classList.add('fp-internal-poi-svg');
  addDetails(svg,entry.id,durations[entry.kind]);
  return svg;
 }).catch(error=>{preparedCache.delete(entry.id);throw error});
 preparedCache.set(entry.id,promise);return promise;
}
function categoryId(category,name){
 const raw=String(category||'').trim().toLowerCase();
 // Upstream may supply the canonical POI category (sea, town, food, etc.)
 // rather than a full OSM tag. Do not silently drop reviewed animations.
 const kind=categoryToFile[raw]?raw:window.AtlasPOIIcons?.categoryFor?.(category,name);
 return categoryToFile[kind]?{kind,id:categoryToFile[kind]}:null;
}
function begin(svg){for(const node of svg.querySelectorAll('[data-animation]')){
 try{const offset=Number(node.dataset.offset||0);if(offset&&node.beginElementAt)node.beginElementAt(offset/1000);else node.beginElement?.()}catch(_){}
}}
let sequence=0;
function play(target,category,name){
 if(!target||reduced()||document.hidden)return;
 const entry=categoryId(category,name);if(!entry)return;
 // One animation owner per target; no animation during every mapmove/zoom frame.
 const token=String(++sequence);target.dataset.poiMotionRequest=token;
 preparedFor(entry).then(template=>{
  if(!target.isConnected||target.dataset.poiMotionRequest!==token||reduced())return;
  const svg=template.cloneNode(true);
  const shell=document.createElement('span');shell.className='fp-internal-poi-envelope';shell.append(svg);
  target.replaceChildren(shell);
  // Force ONLY the artwork's scale; the map library owns georeferenced location.
  // Newly inserted node: class activation needs no forced synchronous reflow.
  shell.classList.add('fp-internal-poi-animate');
  begin(svg);
  shell.addEventListener('animationend',()=>shell.classList.remove('fp-internal-poi-animate'),{once:true});
 }).catch(error=>{
  // Retain original icon, but never silently conceal a broken live animation.
  if(!motionFailures.has(entry.id))console.warn('[Footprint Map] SVG motion unavailable:',entry.id,error);
  motionFailures.add(entry.id);
 });
}
const starActive=new WeakMap();
function playStar(marker){
 if(!marker||reduced()||document.hidden)return;
 const svg=marker.querySelector('svg'),path=svg?.querySelector('path');if(!svg||!path)return;
 const previous=starActive.get(svg);if(previous?.timer){clearTimeout(previous.timer);}
 for(const old of svg.querySelectorAll('[data-fp-star-morph]'))old.remove();
 const original=path.getAttribute('d');
 if(!original)return;
 const next='M20 2.6 25.6 13.2 37.2 14.8 28.8 23 30.5 35.2 20 29.1 9.4 35.2 11.2 23 2.8 14.8 14.4 13.2Z';
 const a=document.createElementNS('http://www.w3.org/2000/svg','animate');
 for(const [k,v] of Object.entries({attributeName:'d',values:[original,next,original].join(';'),dur:'760ms',begin:'indefinite',fill:'remove'}))a.setAttribute(k,v);
 a.dataset.fpStarMorph='1';path.append(a);
 svg.classList.remove('fp-internal-star-animate');
 // Let Safari commit removal before replaying CSS motion, without sync layout.
 const serial=(previous?.serial||0)+1;
 const state={serial,timer:null};starActive.set(svg,state);
 requestAnimationFrame(()=>{
  if(!svg.isConnected||starActive.get(svg)!==state)return;
  svg.classList.add('fp-internal-star-animate');
  try{a.beginElement?.()}catch(_){}
 });
 state.timer=setTimeout(()=>{
  if(starActive.get(svg)!==state)return;
  a.remove();svg.classList.remove('fp-internal-star-animate');starActive.delete(svg);
 },960);
}
// Load two trusted icon families per idle slice after the main map settles.
function prewarm(){
 const categories=Object.keys(categoryToFile);let i=0;
 const schedule=()=>{
  if(i>=categories.length)return;
  if('requestIdleCallback' in window)window.requestIdleCallback(step,{timeout:1800});
  else setTimeout(()=>step(null),75);
 };
 const step=deadline=>{
  let count=0;
  while(i<categories.length&&count<2&&(count===0||!deadline||deadline.timeRemaining()>3)){
   const kind=categories[i++];preparedFor({kind,id:categoryToFile[kind]}).catch(()=>{});count++;
  }
  schedule();
 };
 schedule();
}
if(document.readyState==='complete')setTimeout(prewarm,550);
else window.addEventListener('load',()=>setTimeout(prewarm,550),{once:true});
window.AtlasPOIMotion=Object.freeze({play,playStar,categoryId,version:'v4-internal-svg-13'});
})();
