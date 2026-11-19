/* Footprint Map V5 | one geographic identity for saved stars and POI.
 * Shared by vector, fallback raster and official POI adapter. No map state,
 * user-data writes, provider credentials or screen-pixel heuristics.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FootprintPOIIdentity=api;
})(typeof window!=='undefined'?window:this,()=>{'use strict';
 const valid=p=>p&&p.lat!==''&&p.lng!==''&&p.lat!=null&&p.lng!=null&&
  Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)&&Math.abs(+p.lat)<=90&&Math.abs(+p.lng)<=180;
 const nameKey=s=>String(s||'').toLowerCase().replace(/[\s·•（）()\-_/，,。.:：]/g,'');
 function meters(a,b){
  if(!valid(a)||!valid(b))return Infinity;
  const rad=Math.PI/180,mid=(+a.lat+(+b.lat))*.5*rad;
  return Math.hypot((+a.lat-(+b.lat))*111195,(+a.lng-(+b.lng))*111195*Math.cos(mid));
 }
 function identical(a,b){
  if(!valid(a)||!valid(b))return false;
  // Provider IDs can survive display-name edits; never match a blank ID.
  if(a.id&&b.poiId&&String(a.id)===String(b.poiId))return true;
  const d=meters(a,b);
  const n=nameKey(a.name||a.title),savedName=nameKey(b.title||b.name);
  // <=9m covers same physical point even after minor coordinate roundoff;
  // 28m with equal names helps GPS offsets without eating adjacent places.
  return d<=9||(d<=28&&n&&n===savedName);
 }
 function nearSaved(p,anchors){return Array.isArray(anchors)&&anchors.some(s=>identical(p,s))}
 function samePlace(a,b){
  const first=nameKey(a?.name||a?.title),second=nameKey(b?.name||b?.title);
  return !!first&&first===second&&meters(a,b)<=28;
 }
 return Object.freeze({valid,nameKey,meters,identical,nearSaved,samePlace});
});
