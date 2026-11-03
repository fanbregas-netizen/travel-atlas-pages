/* Footprint Map V4.9 | Location-aware, user-confirmed photo matching.
 * Reads GPS only from photos the visitor explicitly selects. No network, no
 * automatic Photos library access, no geolocation on module load.
 */
(function(root){
'use strict';
const MAX_FILES=24,MAX_VIDEO_BYTES=40*1024*1024,PHOTO_LIMIT=50,VIDEO_LIMIT=6,MAX_MATCH_METERS=2000;
const radians=n=>n*Math.PI/180;
function distanceMeters(a,b){
 const lat1=Number(a?.lat),lon1=Number(a?.lng??a?.lon),lat2=Number(b?.lat),lon2=Number(b?.lng??b?.lon);
 if(![lat1,lon1,lat2,lon2].every(Number.isFinite)||Math.abs(lat1)>90||Math.abs(lat2)>90||Math.abs(lon1)>180||Math.abs(lon2)>180)return Infinity;
 const dlat=radians(lat2-lat1),dlon=radians(lon2-lon1);
 const h=Math.sin(dlat/2)**2+Math.cos(radians(lat1))*Math.cos(radians(lat2))*Math.sin(dlon/2)**2;
 return 6371008.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
function nearestStar(coords,places,limitMeters=MAX_MATCH_METERS){
 const limit=Number.isFinite(limitMeters)?Math.max(0,limitMeters):MAX_MATCH_METERS;
 if(!coords||!Array.isArray(places))return null;
 let nearest=null;
 for(const p of places){
  if(p?.starred===false||p?.demo||!p?.id)continue;
  const meters=distanceMeters(coords,p);
  if(meters<=limit&&(!nearest||meters<nearest.meters))nearest={id:String(p.id),title:String(p.title||p.name||''),meters};
 }
 return nearest;
}
function fingerprint(file){
 return [String(file?.name||'').slice(0,200),Number(file?.size)||0,Number(file?.lastModified)||0].join(':');
}
const knownPhoto=file=>/^image\/(jpeg|png|webp|heic|heif)$/i.test(String(file?.type||''))||/\.(jpe?g|png|webp|heic|heif)$/i.test(String(file?.name||''));
const knownVideo=file=>/^video\//i.test(String(file?.type||''))||/\.(mp4|mov|webm|m4v)$/i.test(String(file?.name||''));
function parseExifGps(buffer){
 try{
  const bytes=buffer instanceof ArrayBuffer?new Uint8Array(buffer):new Uint8Array(buffer?.buffer||[]);
  if(bytes.length<48||bytes[0]!==0xff||bytes[1]!==0xd8)return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=2;
  while(offset+4<bytes.length){
   if(bytes[offset]!==0xff){offset++;continue}
   const marker=bytes[offset+1];if(marker===0xda||marker===0xd9)break;
   const length=view.getUint16(offset+2,false);
   if(length<2||offset+2+length>bytes.length)break;
   if(marker===0xe1&&length>=16){
    const exif=offset+4;
    if(bytes[exif]===69&&bytes[exif+1]===120&&bytes[exif+2]===105&&bytes[exif+3]===102&&bytes[exif+4]===0&&bytes[exif+5]===0){
     const base=exif+6,end=offset+2+length;
     if(base+8>end)return null;
     const le=bytes[base]===0x49&&bytes[base+1]===0x49;
     if(!le&&!(bytes[base]===0x4d&&bytes[base+1]===0x4d))return null;
     const u16=p=>{if(p<base||p+2>end)throw Error('EXIF bounds');return view.getUint16(p,le)};
     const u32=p=>{if(p<base||p+4>end)throw Error('EXIF bounds');return view.getUint32(p,le)};
     if(u16(base+2)!==42)return null;
     const find=(p,tag)=>{
      if(p<base||p+2>end)return null;
      const n=Math.min(u16(p),150);if(p+2+n*12>end)return null;
      for(let i=0;i<n;i++){const entry=p+2+i*12;if(u16(entry)===tag)return {type:u16(entry+2),count:u32(entry+4),value:u32(entry+8),entry};}
      return null;
     };
     const gpsRef=find(base+u32(base+4),0x8825);
     if(!gpsRef||gpsRef.type!==4||gpsRef.count!==1)return null;
     const gps=base+gpsRef.value,latRef=find(gps,1),latValue=find(gps,2),lonRef=find(gps,3),lonValue=find(gps,4);
     if(!latRef||!latValue||!lonRef||!lonValue||latValue.type!==5||lonValue.type!==5||latValue.count<3||lonValue.count<3)return null;
     const ref=e=>String.fromCharCode(bytes[e.entry+8]||0).toUpperCase();
     const latSign=ref(latRef),lonSign=ref(lonRef);
     if(!['N','S'].includes(latSign)||!['E','W'].includes(lonSign))return null;
     const degrees=e=>{
      const off=base+e.value;if(off<base||off+24>end)throw Error('EXIF GPS out of range');
      let n=0;
      for(let i=0;i<3;i++){const numerator=u32(off+i*8),denom=u32(off+i*8+4);if(!denom)throw Error('EXIF GPS denominator');n+=(numerator/denom)/[1,60,3600][i]}
      return n;
     };
     const lat=degrees(latValue)*(latSign==='S'?-1:1),lng=degrees(lonValue)*(lonSign==='W'?-1:1);
     return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng,source:'photo-exif'}:null;
    }
   }
   offset+=2+length;
  }
 }catch(e){/* malformed or scrubbed metadata is normal */}
 return null;
}
async function readFileGps(file){
 if(!file||!(/jpe?g/.test(String(file.type||''))||/\.jpe?g$/i.test(String(file.name||''))))return null;
 if(typeof file.slice!=='function')return null;
 try{return parseExifGps(await file.slice(0,512*1024).arrayBuffer())}catch{return null}
}
const api=Object.freeze({MAX_FILES,MAX_VIDEO_BYTES,PHOTO_LIMIT,VIDEO_LIMIT,MAX_MATCH_METERS,
 distanceMeters,nearestStar,fingerprint,knownPhoto,knownVideo,parseExifGps,readFileGps});
root.AtlasVisitMedia=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
