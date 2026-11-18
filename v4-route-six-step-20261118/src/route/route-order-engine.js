/* Footprint Map | route planning engine v1
 * Pure, side-effect-free helpers. No media, map, or storage writes.
 * Recommendations use geographic straight-line distances only (NOT road ETA).
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FootprintRouteEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MODES=Object.freeze(['car','walk','bike','transit']);
 const LABELS=Object.freeze({car:'驾车',walk:'步行',bike:'骑行',transit:'公共交通'});
 const normalizeMode=value=>MODES.includes(value)?value:'car';
 const pairKey=(a,b)=>JSON.stringify([String(a),String(b)]);
 function validCoord(p){
  if(!p||p.lat===null||p.lng===null||p.lat===''||p.lng==='')return false;
  const lat=Number(p.lat),lng=Number(p.lng);
  return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
 }
 function distanceKm(a,b){
  if(!validCoord(a)||!validCoord(b))return 0;
  const rad=x=>Number(x)*Math.PI/180;
  const dLat=rad(b.lat)-rad(a.lat),dLon=rad(b.lng)-rad(a.lng);
  const x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 12742*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));
 }
 function sanitizeLegModes(input,stops,primary){
  const output={},mode=normalizeMode(primary);
  const raw=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  for(let i=1;i<stops.length;i++){
   const a=stops[i-1]?.id??stops[i-1]?.placeId,b=stops[i]?.id??stops[i]?.placeId;
   if(a==null||b==null)continue;
   const key=pairKey(a,b),choice=raw[key];
   if(MODES.includes(choice)&&choice!==mode)output[key]=choice;
  }
  return output;
 }
 function recommend(options){
  const opts=options||{},original=Array.isArray(opts.stops)?opts.stops.map(s=>({...s})):[];
  const places=Array.isArray(opts.places)?opts.places:[];
  const byId=new Map(places.filter(p=>p&&p.id!=null).map(p=>[String(p.id),p]));
  const id=s=>String(s?.id??s?.placeId??'');
  const originId=String(opts.originPlaceId||'');
  const destId=String(opts.destinationPlaceId||'');
  const locked=new Set(Array.isArray(opts.lockedPlaceIds)?opts.lockedPlaceIds.map(String):[]);
  const warnings=[];
  if(original.length>120){return {order:original,baselineKm:0,suggestedKm:0,changed:false,warnings:['站点数量超过推荐上限；请分段手动整理。'],method:'geodesic-only'};}
  if(original.some(s=>!byId.has(id(s))||!validCoord(byId.get(id(s)))))warnings.push('部分站点坐标缺失，仅优化有效坐标之间的直线距离。');
  const start=byId.get(originId),end=byId.get(destId);
  if(originId&&!start)warnings.push('起点缺少已收藏坐标，建议未计算出发地到首站的距离。');
  if(destId&&!end)warnings.push('终点缺少已收藏坐标，建议未计算末站到终点的距离。');
  if(!originId||!destId)warnings.push('未选择有坐标的起终点，建议仅供途经点顺序参考。');
  const sequence=original.map(id);
  function total(ids){
   let sum=0,prev=validCoord(start)?start:null;
   for(const item of ids){
    const p=byId.get(item);
    if(validCoord(p)){
     if(prev)sum+=distanceKm(prev,p);
     prev=p;
    }
   }
   if(prev&&validCoord(end))sum+=distanceKm(prev,end);
   return sum;
  }
  const baseline=total(sequence);
  if(sequence.length<2)return {order:original,baselineKm:baseline,suggestedKm:baseline,changed:false,warnings,method:'geodesic-only'};
  const protectedPosition=new Set();
  original.forEach((s,i)=>{
   // Without explicit anchored coordinates, the user's first and last chosen
   // stops are the intuitive journey boundaries. Never reverse the itinerary
   // merely because a shorter straight-line connection exists backwards.
   const intuitiveBoundary=(!originId&&i===0)||(!destId&&i===original.length-1);
   if(intuitiveBoundary||locked.has(id(s))||/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(s.time||''))||id(s)===originId||id(s)===destId)protectedPosition.add(i);
  });
  const day=s=>Math.max(1,Math.min(60,Number(s.day)||1));
  let best=sequence.slice(),bestScore=baseline;
  // Only swap stops inside their existing day and never move locks/appointments.
  // The current day assignment, explicit times and stable placeIds are invariant.
  for(let pass=0;pass<Math.min(80,sequence.length*4);pass++){
   let improved=false,swapA=-1,swapB=-1,score=bestScore;
   for(let a=0;a<best.length;a++){
    if(protectedPosition.has(a))continue;
    for(let b=a+1;b<best.length;b++){
     if(protectedPosition.has(b)||day(original[a])!==day(original[b]))continue;
     const candidate=best.slice();[candidate[a],candidate[b]]=[candidate[b],candidate[a]];
     const km=total(candidate);
     if(km+1e-6<score){score=km;swapA=a;swapB=b;improved=true;}
    }
   }
   if(!improved)break;
   [best[swapA],best[swapB]]=[best[swapB],best[swapA]];
   bestScore=score;
  }
  if(originId&&sequence.includes(originId)&&sequence[0]!==originId)warnings.push('所选起点在站点列表中不是第一站；请手动调整其日期与位置。');
  if(destId&&sequence.includes(destId)&&sequence.at(-1)!==destId)warnings.push('所选终点在站点列表中不是最后一站；请手动调整其日期与位置。');
  if(original.some(s=>s.time))warnings.push('已保留计划到达时间，仍需人工核对时间是否合理。');
  const originalById=new Map(original.map(s=>[id(s),s]));
  const order=best.map(x=>({...originalById.get(x)}));
  return {order,baselineKm:baseline,suggestedKm:bestScore,changed:best.some((x,i)=>x!==sequence[i]),warnings,method:'geodesic-only'};
 }
 return Object.freeze({MODES,LABELS,normalizeMode,pairKey,validCoord,distanceKm,sanitizeLegModes,recommend});
});
