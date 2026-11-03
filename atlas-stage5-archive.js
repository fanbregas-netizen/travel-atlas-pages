/* Footprint Map V5.0 | private offline ZIP archive core.
 * No network; no compression dependency; archived media is binary, never JSONized.
 */
(function(root){
'use strict';
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const dv=(buf)=>new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
const MAX_TOTAL=512*1024*1024,MAX_FILES=9000,MAX_JSON=64*1024*1024,MAX_PLACES=1000,MAX_PLANS=2000;
const MAX_VIDEO=100*1024*1024;
const crcTable=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0}
function crc32(bytes){let crc=0xffffffff;for(let i=0;i<bytes.length;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);return (crc^0xffffffff)>>>0}
function bytesOf(value){
 if(value instanceof Uint8Array)return value;
 if(value instanceof ArrayBuffer)return new Uint8Array(value);
 if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
 if(Array.isArray(value))return Uint8Array.from(value);
 return null;
}
function checkName(name){
 if(typeof name!=='string'||name.length<1||name.length>220||name.includes('..')||name.startsWith('/')||name.includes('\\')||name.includes('\0'))throw Error('ZIP 包含不安全的文件路径');
 return name;
}
function zip(files){
 if(!Array.isArray(files)||!files.length||files.length>MAX_FILES)throw Error('备份文件数量超出限制');
 const names=new Set(),pieces=[],central=[];
 let offset=0,total=22;
 for(const f of files){
  const name=checkName(f.name);if(names.has(name))throw Error('备份中存在重复路径 '+name);names.add(name);
  const path=encoder.encode(name),data=bytesOf(f.data);
  if(!data||path.length>65535||data.length>0xffffffff)throw Error('媒体数据无法写入 ZIP');
  total+=76+path.length*2+data.length;if(total>MAX_TOTAL)throw Error('备份超过 512MB；请先减少大视频或分批保存');
  const crc=crc32(data),local=new Uint8Array(30+path.length),v=dv(local);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);
  v.setUint16(8,0,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);
  v.setUint16(26,path.length,true);local.set(path,30);
  const entry=new Uint8Array(46+path.length),e=dv(entry);
  e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x800,true);
  e.setUint32(16,crc,true);e.setUint32(20,data.length,true);e.setUint32(24,data.length,true);
  e.setUint16(28,path.length,true);e.setUint32(42,offset,true);entry.set(path,46);
  pieces.push(local,data);central.push(entry);offset+=local.length+data.length;
 }
 const centralSize=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),e=dv(end);
 if(offset+centralSize+22>MAX_TOTAL)throw Error('ZIP 文件超过本机安全容量');
 e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);
 e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
 return new Blob([...pieces,...central,end],{type:'application/zip'});
}
function unzip(buffer){
 const bytes=bytesOf(buffer);if(!bytes||bytes.length>MAX_TOTAL||bytes.length<22)throw Error('备份 ZIP 无效或过大');
 const view=dv(bytes);let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
  if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){eocd=i;break}
 }
 if(eocd<0)throw Error('ZIP 尾部目录缺失');
 const count=view.getUint16(eocd+10,true),dirSize=view.getUint32(eocd+12,true),dirOffset=view.getUint32(eocd+16,true);
 if(count>MAX_FILES||count!==view.getUint16(eocd+8,true)||dirOffset+dirSize>eocd)throw Error('ZIP 目录格式不正确');
 let cursor=dirOffset;const entries=new Map();
 for(let i=0;i<count;i++){
  if(cursor+46>eocd||view.getUint32(cursor,true)!==0x02014b50)throw Error('ZIP 文件目录损坏');
  const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),crc=view.getUint32(cursor+16,true);
  const compressed=view.getUint32(cursor+20,true),size=view.getUint32(cursor+24,true),nl=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true),offset=view.getUint32(cursor+42,true);
  if(method!==0||compressed!==size||flags&1)throw Error('仅支持本站生成的未加密 ZIP 备份');
  if(cursor+46+nl+extra+comment>eocd)throw Error('ZIP 文件名损坏');
  const name=checkName(decoder.decode(bytes.subarray(cursor+46,cursor+46+nl)));
  if(entries.has(name)||offset+30>dirOffset||view.getUint32(offset,true)!==0x04034b50)throw Error('ZIP 文件目录重复或损坏');
  const localFlags=view.getUint16(offset+6,true),localMethod=view.getUint16(offset+8,true),localName=view.getUint16(offset+26,true),localExtra=view.getUint16(offset+28,true);
  if(localMethod!==0||localFlags&1)throw Error('ZIP 本地文件头不受支持');
  const from=offset+30+localName+localExtra;
  if(from+size>dirOffset)throw Error('ZIP 媒体长度超出目录边界');
  const localPath=checkName(decoder.decode(bytes.subarray(offset+30,offset+30+localName)));
  if(localPath!==name)throw Error('ZIP 本地文件名与目录不一致');
  const data=bytes.subarray(from,from+size);
  if(crc32(data)!==crc)throw Error('ZIP 完整性验证失败：'+name);
  entries.set(name,data);cursor+=46+nl+extra+comment;
 }
 if(cursor!==dirOffset+dirSize)throw Error('ZIP 中央目录长度不匹配');
 return entries;
}
function validPlace(p){
 return p&&typeof p==='object'&&!Array.isArray(p)&&typeof p.id==='string'&&p.id.length>0&&p.id.length<=200&&
 typeof p.title==='string'&&p.title.length<=300&&p.lat!=null&&p.lng!=null&&
 Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lng))<=180&&
 (!p.photos||Array.isArray(p.photos))&&(!p.videos||Array.isArray(p.videos))&&
 (p.photos?.length||0)<=50&&(p.videos?.length||0)<=6;
}
function validPlan(p){
 return p&&typeof p==='object'&&!Array.isArray(p)&&typeof p.id==='string'&&p.id.length>0&&p.id.length<=140&&
 (!p.placeIds||Array.isArray(p.placeIds)&&p.placeIds.length<=100)&&
 (!p.stops||Array.isArray(p.stops)&&p.stops.length<=100);
}
async function pack(places,plans=[]){
 if(!Array.isArray(places)||places.length>MAX_PLACES||!Array.isArray(plans)||plans.length>MAX_PLANS)throw Error('备份记录数量超过上限');
 const files=[],records=[],used=new Set(),ids=new Set();
 for(const p of places){
  if(!validPlace(p))throw Error('星标中存在无效位置或媒体数量：'+String(p?.id||'unknown'));
  if(ids.has(p.id))throw Error('收藏中存在重复 ID');ids.add(p.id);
  const record={...p,videos:[]};
  for(let i=0;i<(p.videos||[]).length;i++){
   const video=p.videos[i],blob=video?.blob instanceof Blob?video.blob:null;
   const bytes=blob?new Uint8Array(await blob.arrayBuffer()):bytesOf(video?.bytes);
   if(!bytes||!bytes.length||bytes.length>MAX_VIDEO)throw Error('星标 '+p.title+' 的第 '+(i+1)+' 条视频未完整读取，请检查原数据');
   const path='videos/'+records.length+'-'+i+'.bin';
   if(used.has(path))throw Error('媒体路径冲突');used.add(path);
   files.push({name:path,data:bytes});
   const {blob:ignoredBlob,bytes:ignoredBytes,...details}=video;
   record.videos.push({...details,archivePath:path,size:bytes.length});
  }
  records.push(record);
 }
 const planIds=new Set();
 for(const p of plans){if(!validPlan(p)||planIds.has(p.id))throw Error('存在无效或重复的路线记录');planIds.add(p.id)}
 const doc={format:'travel-atlas-complete-v11',schemaVersion:11,exportedAt:new Date().toISOString(),places:records,plans};
 const json=encoder.encode(JSON.stringify(doc));
 if(json.length>MAX_JSON)throw Error('档案清单过大，请减少内嵌照片');
 files.unshift({name:'travel-places.json',data:json});
 return zip(files);
}
function inspect(buffer){
 const entries=unzip(buffer),json=entries.get('travel-places.json');
 if(!json||json.length>MAX_JSON)throw Error('备份中缺少有效的 travel-places.json');
 let doc;try{doc=JSON.parse(decoder.decode(json))}catch{throw Error('档案清单 JSON 损坏')}
 if(!['travel-atlas-complete-v11','travel-footprints-v10','travel-footprints-v1'].includes(doc?.format))throw Error('不支持的备份格式');
 const ps=doc.places,plans=Array.isArray(doc.plans)?doc.plans:[];
 if(!Array.isArray(ps)||ps.length>MAX_PLACES||plans.length>MAX_PLANS)throw Error('备份记录数量不符合限制');
 const ids=new Set(),routeIDs=new Set(),out=[];
 for(const p of ps){
  if(!validPlace(p)||ids.has(p.id))throw Error('收藏信息不完整或包含重复 ID');ids.add(p.id);
  const videos=[];
  for(const v of p.videos||[]){
   if(!v||typeof v!=='object')throw Error('备份视频记录无效');
   if(v.archivePath){
    const path=checkName(v.archivePath),content=entries.get(path);
    if(!content||!content.length||content.length>MAX_VIDEO)throw Error('备份视频文件丢失或超过限制：'+path);
    const {archivePath,...meta}=v;
    videos.push({...meta,blob:new Blob([content],{type:meta.type||'video/mp4'})});
   }else if(v.blob instanceof Blob){videos.push(v)}
   else throw Error('备份中存在未存档的视频');
  }
  out.push({...p,videos});
 }
 for(const plan of plans){if(!validPlan(plan)||routeIDs.has(plan.id))throw Error('路线记录不完整或有重复 ID');routeIDs.add(plan.id)}
 return {format:doc.format,places:out,plans,exportedAt:doc.exportedAt||'',files:entries.size,bytes:bytesOf(buffer).length};
}
const api=Object.freeze({crc32,zip,unzip,pack,inspect,validPlace,validPlan,MAX_TOTAL});
root.AtlasCompleteArchive=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
