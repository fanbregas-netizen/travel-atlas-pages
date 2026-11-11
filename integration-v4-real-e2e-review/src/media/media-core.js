/* Footprint Map V4 / Media D.
 * Self-contained, opt-in media persistence core. No changes to map, sheet or
 * production bootstrapping. Load before calling window.FootprintMediaCore.
 * Retains IndexedDB v1: private-travel-footprints-v1/{places,meta}.
 */
(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FootprintMediaCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const DB_NAME = 'private-travel-footprints-v1';
  const MAX_BACKUP = 1024 * 1024 * 1024;
  const MAX_PLACES = 1000;
  const encoder = () => new TextEncoder();
  const decoder = () => new TextDecoder('utf-8', {fatal:true});
  function error(code, message) {const e = new Error(message); e.code = code; return e;}
  function idOf(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 256 || /[\u0000-\u001f\u007f]/.test(value))
      throw error('INVALID_PLACE_ID', '地点 ID 无效；不会把媒体写入其他地点');
    return value;
  }
  function validPlace(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw error('INVALID_PLACE', '地点记录无效');
    idOf(value.id);
    if (value.lat === '' || value.lng === '' || value.lat == null || value.lng == null ||
        !Number.isFinite(+value.lat) || !Number.isFinite(+value.lng) ||
        Math.abs(+value.lat) > 90 || Math.abs(+value.lng) > 180)
      throw error('INVALID_COORDINATES', '地点坐标无效：' + value.id);
    for (const key of ['photos','videos','references','guides']) {
      if (value[key] !== undefined && !Array.isArray(value[key]))
        throw error('INVALID_MEDIA', '地点的 ' + key + ' 字段无效');
    }
    return {...value, lat:+value.lat, lng:+value.lng};
  }
  function mediaKeys(x, kind) {
    const keys=[];
    if (x && typeof x === 'object') {
      if (typeof x.sha256 === 'string' && x.sha256) keys.push('hash:'+x.sha256);
      if (typeof x.id === 'string' && x.id) keys.push('id:'+x.id);
      if (kind === 'photos' && typeof x.src === 'string') keys.push('src:'+x.src);
      if ((kind === 'guides'||kind === 'references') && typeof (x.url||x.link) === 'string')
        keys.push('url:'+(x.url||x.link).trim());
    }
    if (typeof x === 'string')
      keys.push(kind === 'guides'||kind === 'references' ? 'url:'+x.trim() : 'src:'+x);
    return keys;
  }
  function combine(a,b,kind) {
    const result=[],seen=new Set();
    for(const item of [...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])]) {
      const keys=mediaKeys(item,kind);
      if(keys.some(key=>seen.has(key)))continue;
      keys.forEach(key=>seen.add(key));result.push(item);
    }
    return result;
  }
  function mergePlace(old, incoming, mode='merge') {
    const next=validPlace(incoming);
    if (!old) return next;
    const previous=validPlace(old);
    if (previous.id !== next.id) throw error('PLACE_MISMATCH','无法合并不同地点');
    const lat=(previous.lat+next.lat)/2*Math.PI/180;
    const meters=Math.hypot((previous.lat-next.lat)*111195,(previous.lng-next.lng)*111195*Math.cos(lat));
    if (meters > 250) throw error('PLACE_MISMATCH','备份中的相同 ID 对应不同坐标；未覆盖原地点 '+next.id);
    if (mode==='replace') return {...previous,...next};
    const merged={...previous,...next};
    for (const key of ['photos','videos','references','guides']) merged[key]=combine(previous[key],next[key],key);
    if (!String(next.note??next.brief??'').trim() && String(previous.note??previous.brief??'').trim()) {
      merged.note=previous.note??previous.brief;
      merged.brief=previous.brief??previous.note;
    }
    return merged;
  }
  function crc32(data) {
    let crc=0xffffffff;
    for (const byte of data) {crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    return (crc^0xffffffff)>>>0;
  }
  function bytesOf(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
    if (Array.isArray(data) && data.every(x=>Number.isInteger(x)&&x>=0&&x<=255)) return Uint8Array.from(data);
    return null;
  }
  async function binaryOf(media) {
    const data=media?.bytes??media?.blob;
    const direct=bytesOf(data);
    if (direct) return direct;
    if (data && typeof data.arrayBuffer==='function') return new Uint8Array(await data.arrayBuffer());
    throw error('MISSING_VIDEO_DATA','视频二进制内容缺失：'+String(media?.name||'未命名视频'));
  }
  function archiveName(name) {
    if (!name || name.length>240 || name.startsWith('/') || name.includes('\\') ||
        name.split('/').some(x=>x===''||x==='.'||x==='..') || /[\u0000-\u001f]/.test(name))
      throw error('INVALID_ARCHIVE_PATH','备份文件路径无效');
    return name;
  }
  function zipWrite(files) {
    if (!Array.isArray(files) || files.length>8000) throw error('BACKUP_TOO_LARGE','备份文件数量超限');
    let offset=0; const chunks=[],dir=[],names=new Set();
    for (const file of files) {
      const path=archiveName(file.name),name=encoder().encode(path),data=bytesOf(file.data);
      if (!data || names.has(path) || data.length>0xffffffff) throw error('INVALID_ARCHIVE','文件重复或数据无效：'+path);
      names.add(path);
      const crc=crc32(data),local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
      lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);
      lv.setUint16(8,0,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);
      lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);local.set(name,30);
      const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);
      cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
      cv.setUint16(8,0x800,true);cv.setUint16(10,0,true);
      cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);
      cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.set(name,46);
      chunks.push(local,data);dir.push(central);offset+=local.length+data.length;
      if (offset>MAX_BACKUP || offset>0xffffffff) throw error('BACKUP_TOO_LARGE','备份超过安全大小限制');
    }
    const dirSize=dir.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),dv=new DataView(end.buffer);
    if (offset+dirSize+22>MAX_BACKUP) throw error('BACKUP_TOO_LARGE','备份超过安全大小限制');
    dv.setUint32(0,0x06054b50,true);dv.setUint16(8,files.length,true);dv.setUint16(10,files.length,true);
    dv.setUint32(12,dirSize,true);dv.setUint32(16,offset,true);
    return new Blob([...chunks,...dir,end],{type:'application/zip'});
  }
  function zipRead(input) {
    const bytes=bytesOf(input);
    if (!bytes || bytes.byteLength>MAX_BACKUP || bytes.length<22) throw error('BAD_BACKUP','ZIP 大小无效');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const u16=(p)=>view.getUint16(p,true),u32=(p)=>view.getUint32(p,true);
    let end=-1;
    for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--){
      if(u32(p)===0x06054b50 && p+22+u16(p+20)===bytes.length){end=p;break;}
    }
    if (end<0) throw error('BAD_BACKUP','ZIP 目录缺失或损坏');
    const count=u16(end+10),start=u32(end+16),size=u32(end+12);
    if (count>8000 || count!==u16(end+8) || start+size!==end || u16(end+4)!==0 || u16(end+6)!==0)
      throw error('BAD_BACKUP','ZIP 目录信息不一致');
    const files=new Map();let pos=start;
    for(let i=0;i<count;i++) {
      if(pos+46>end || u32(pos)!==0x02014b50) throw error('BAD_BACKUP','ZIP 目录条目损坏');
      const flags=u16(pos+8),method=u16(pos+10),crc=u32(pos+16),length=u32(pos+20),original=u32(pos+24);
      const n=u16(pos+28),extra=u16(pos+30),comment=u16(pos+32),localOffset=u32(pos+42);
      if(method!==0 || (flags&9)!==0 || length!==original ||
         pos+46+n+extra+comment>end || localOffset+30>start)
        throw error('BAD_BACKUP','不支持压缩、加密或损坏的 ZIP 条目');
      const name=archiveName(decoder().decode(bytes.subarray(pos+46,pos+46+n)));
      if(files.has(name) || u32(localOffset)!==0x04034b50 || u16(localOffset+8)!==method)
        throw error('BAD_BACKUP','ZIP 文件重名或头部损坏');
      const ln=u16(localOffset+26),le=u16(localOffset+28);
      const localName=decoder().decode(bytes.subarray(localOffset+30,localOffset+30+ln));
      const dataStart=localOffset+30+ln+le;
      if(localName!==name || dataStart+length>start || u32(localOffset+14)!==crc ||
         u32(localOffset+18)!==length) throw error('BAD_BACKUP','ZIP 文件长度或位置损坏');
      const data=bytes.slice(dataStart,dataStart+length);
      if(crc32(data)!==crc) throw error('BACKUP_CHECKSUM_FAILED','备份校验失败：'+name);
      files.set(name,data);pos+=46+n+extra+comment;
    }
    if(pos!==end) throw error('BAD_BACKUP','ZIP 目录末尾信息无效');
    return files;
  }
  async function createBackup(records) {
    if (!Array.isArray(records) || records.length>MAX_PLACES) throw error('INVALID_BACKUP','备份地点数量无效');
    const seen=new Set(),files=[],places=[];
    for(const raw of records) {
      const p=validPlace(raw);
      if(seen.has(p.id))throw error('DUPLICATE_PLACE','备份包含重复地点 ID');
      seen.add(p.id);
      const copy={...p,videos:[]};
      for(const photo of p.photos||[]) {
        if(!photo || typeof photo.src!=='string' || !/^data:image\/(?:jpeg|png|webp);base64,/i.test(photo.src))
          throw error('MISSING_PHOTO_DATA','照片缺少可离线恢复的本地内容：'+String(photo?.name||'未命名照片'));
      }
      for(const video of p.videos||[]) {
        const bytes=await binaryOf(video),path='videos/'+places.length+'-'+copy.videos.length+'.bin';
        files.push({name:path,data:bytes});
        const {blob,bytes:oldBytes,archivePath,...meta}=video;
        copy.videos.push({...meta,archivePath:path,size:bytes.length});
      }
      places.push(copy);
    }
    files.unshift({name:'travel-places.json',data:encoder().encode(JSON.stringify({
      format:'travel-footprints-v10',schemaVersion:2,exportedAt:new Date().toISOString(),places
    }))});
    return zipWrite(files);
  }
  async function readBackup(input) {
    const bytes=bytesOf(input) || (input&&typeof input.arrayBuffer==='function'?
      new Uint8Array(await input.arrayBuffer()):null);
    if(!bytes || bytes.length>MAX_BACKUP)throw error('BAD_BACKUP','备份文件无效或过大');
    const isZip=bytes[0]===0x50 && bytes[1]===0x4b,files=isZip?zipRead(bytes):null;
    let payload;
    try {payload=JSON.parse(decoder().decode(isZip?files.get('travel-places.json'):bytes));}
    catch(e){throw error('BAD_BACKUP','无法读取备份清单 travel-places.json');}
    if(!payload || !['travel-footprints-v1','travel-footprints-v10'].includes(payload.format) ||
        !Array.isArray(payload.places) || payload.places.length>MAX_PLACES)
      throw error('BAD_BACKUP','备份版本或地点格式不兼容');
    const seen=new Set(),records=[];
    for(const raw of payload.places) {
      const p=validPlace(raw);
      if(seen.has(p.id))throw error('DUPLICATE_PLACE','备份中的地点 ID 重复');
      seen.add(p.id);
      const videos=[];
      for(const media of p.videos||[]) {
        if (!media || typeof media !== 'object') throw error('BAD_BACKUP','视频元数据无效');
        if (media.archivePath) {
          const data=files?.get(archiveName(media.archivePath));
          if(!data)throw error('MISSING_VIDEO_DATA','ZIP 缺少视频：'+media.archivePath);
          const {archivePath,...rest}=media;videos.push({...rest,size:data.length,bytes:data.buffer});
        } else if(media.bytes || media.blob) {
          const data=await binaryOf(media);videos.push({...media,bytes:data.buffer,blob:undefined});
        } else throw error('MISSING_VIDEO_DATA','备份缺少视频内容：'+String(media.name||''));
      }
      records.push({...p,videos});
    }
    return {format:payload.format,schemaVersion:payload.schemaVersion||1,records};
  }

  // Only user-selected browser Files are read. Caller explicitly supplies a
  // confirmed placeId to repository.addMedia; EXIF/GPS never auto-assigns.
  async function prepareSelectedFiles(files,{encodePhoto}={}) {
    const list=Array.from(files||[]);
    if(!list.length || list.length>40)throw error('INVALID_MEDIA','一次请选择 1–40 张照片或视频');
    const result=[];
    for(const file of list){
      if(!file || typeof file.name!=='string' || typeof file.arrayBuffer!=='function' ||
         !Number.isFinite(file.size))throw error('INVALID_MEDIA','文件格式无效');
      const type=file.type||'',photo=/^image\/(?:jpeg|png|webp|heic|heif)$/i.test(type)||
        /\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name);
      const video=/^video\//i.test(type)||/\.(?:mp4|mov|webm|m4v)$/i.test(file.name);
      if(!photo&&!video)throw error('INVALID_MEDIA','仅支持照片或视频：'+file.name);
      if(photo && file.size>18*1024*1024)throw error('PHOTO_TOO_LARGE','照片超过 18MB，请先压缩');
      if(video && file.size>80*1024*1024)throw error('VIDEO_TOO_LARGE','视频超过 80MB，请先裁剪');
      const bytes=new Uint8Array(await file.arrayBuffer());
      let hash;
      const subtle=typeof crypto!=='undefined'&&crypto.subtle;
      if(subtle){const digest=await subtle.digest('SHA-256',bytes);hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
      const base={id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,11),
        name:file.name.slice(0,200),addedAt:new Date().toISOString()};
      if(hash)base.sha256=hash;
      if(video){result.push({...base,kind:'video',type:type||'video/mp4',bytes:bytes.buffer});continue;}
      let src;
      if(typeof encodePhoto==='function')src=await encodePhoto(file);
      else if(typeof FileReader!=='undefined' && typeof Image!=='undefined' && typeof document!=='undefined')
        src=await new Promise((resolve,reject)=>{
          const reader=new FileReader();
          reader.onerror=()=>reject(error('INVALID_PHOTO','图片读取失败'));
          reader.onload=()=>{
            const img=new Image();
            img.onerror=()=>reject(error('INVALID_PHOTO','图片解码失败；请转换为 JPEG'));
            img.onload=()=>{
              try{
                const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
                const canvas=document.createElement('canvas');
                canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
                canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
                canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
                resolve(canvas.toDataURL('image/jpeg',0.82));
              }catch(e){reject(error('INVALID_PHOTO','图片转换失败：'+e.message));}
            };
            img.src=reader.result;
          };
          reader.readAsDataURL(file);
        });
      else throw error('IMAGE_ENCODER_REQUIRED','缺少本地图片编码器');
      if(typeof src!=='string'||!/^data:image\/(?:jpeg|png|webp);base64,/i.test(src))
        throw error('INVALID_PHOTO','图片编码结果不是可保存的本地图片');
      result.push({...base,kind:'photo',src});
    }
    return result;
  }
  function requestOpen(idb,dbName) {
    return new Promise((resolve,reject)=>{
      if(!idb || typeof idb.open!=='function') {reject(error('STORAGE_UNAVAILABLE','此浏览器无法使用 IndexedDB；请勿依赖临时数据'));return;}
      let settled=false,req;
      try {
        req=idb.open(dbName,1);
        req.onupgradeneeded=()=>{
          const db=req.result;
          if(!db.objectStoreNames.contains('places'))db.createObjectStore('places',{keyPath:'id'});
          if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
        };
        req.onsuccess=()=>{
          if(settled){req.result.close();return;}
          settled=true;const db=req.result;db.onversionchange=()=>db.close();resolve(db);
        };
        req.onerror=()=>{if(!settled){settled=true;reject(req.error||error('STORAGE_UNAVAILABLE','数据库打开失败'));}};
        req.onblocked=()=>{if(!settled){settled=true;reject(error('STORAGE_BLOCKED','请关闭其他占用数据库的标签页'));}};
      } catch(e) {reject(e);}
    });
  }
  function createRepository(idb=(typeof indexedDB!=='undefined'?indexedDB:null),dbName=DB_NAME) {
    async function transaction(store,mode,enqueue) {
      const db=await requestOpen(idb,dbName);
      try {
        return await new Promise((resolve,reject)=>{
          let tx,result,settled=false,explicitFailure=null;
          const fail=e=>{if(!settled){settled=true;reject(e)}};
          try {
            tx=db.transaction(store,mode);
            tx.oncomplete=()=>{if(!settled){settled=true;resolve(result)}};
            tx.onabort=()=>fail(explicitFailure||tx.error||error('STORAGE_ABORTED','存储事务中止；原数据未修改'));
            tx.onerror=()=>fail(tx.error||error('STORAGE_FAILED','存储失败；可能是空间不足'));
            enqueue(tx.objectStore(store),value=>{result=value},tx,(reason)=>{explicitFailure=reason;try{tx.abort()}catch(_){};});
          } catch(e){try{tx?.abort()}catch(_){}fail(e);}
        });
      } finally {db.close();}
    }
    const read=(id)=>transaction('places','readonly',(s,set)=>{
      const r=s.get(idOf(id));r.onsuccess=()=>set(r.result||null);r.onerror=()=>{};
    });
    const list=()=>transaction('places','readonly',(s,set)=>{
      const r=s.getAll();r.onsuccess=()=>set(r.result||[]);
    });
    function mutate(id,update) {
      return transaction('places','readwrite',(s,set,tx,abort)=>{
        const r=s.get(idOf(id));
        r.onsuccess=()=>{
          try {
            if(!r.result)throw error('PLACE_NOT_FOUND','收藏地点不存在，未保存影像');
            const next=validPlace(update(r.result));
            if(next.id!==id)throw error('PLACE_MISMATCH','地点 ID 不匹配');
            s.put(next);set(next);
          } catch(e){abort(e);}
        };
      });
    }
    const saveBrief=(id,brief)=>{
      if(typeof brief!=='string'||brief.length>12000)throw error('INVALID_BRIEF','Brief 最多 12000 字');
      return mutate(id,p=>({...p,note:brief,brief}));
    };
    const saveGuide=(id,guide)=>{
      const value=typeof guide==='string'?{url:guide}:guide;
      if(!value || typeof value.url!=='string' || !/^https?:\/\//i.test(value.url) || value.url.length>2048)
        throw error('INVALID_GUIDE','请提供有效的 http(s) 攻略链接');
      return mutate(id,p=>({...p,guides:combine(p.guides,[{...value,url:value.url.trim()}],'guides')}));
    };
    async function addMedia(placeId,items) {
      idOf(placeId);
      if(!Array.isArray(items)||items.length===0||items.length>40)throw error('INVALID_MEDIA','请选择 1–40 个影像文件');
      const prepared=[];
      for(const item of items){
        if(!item || typeof item!=='object' || !['photo','video'].includes(item.kind))
          throw error('INVALID_MEDIA','图片或视频类型无效');
        if(item.kind==='photo'){
          if(typeof item.src!=='string' || !/^data:image\/(?:jpeg|png|webp);base64,/i.test(item.src) ||
             item.src.length>24*1024*1024)throw error('INVALID_PHOTO','照片需先转换为本地 JPEG、PNG 或 WebP');
          prepared.push({...item,kind:undefined,addedAt:item.addedAt||new Date().toISOString()});
        }else {
          const bytes=await binaryOf(item);
          if(bytes.length>80*1024*1024)throw error('VIDEO_TOO_LARGE','单视频最大 80MB');
          const {kind,blob,...meta}=item;
          prepared.push({...meta,bytes:bytes.slice().buffer,addedAt:item.addedAt||new Date().toISOString()});
        }
      }
      const photo=prepared.filter((_,i)=>items[i].kind==='photo'),video=prepared.filter((_,i)=>items[i].kind==='video');
      return mutate(placeId,p=>{
        if(combine(p.photos,photo,'photos').length>50)throw error('PHOTO_LIMIT','单地点最多 50 张照片');
        return {...p,photos:combine(p.photos,photo,'photos'),videos:combine(p.videos,video,'videos')};
      });
    }
    async function restore(backup,{conflict='merge'}={}) {
      if(conflict!=='merge'&&conflict!=='replace')throw error('INVALID_RESTORE','恢复策略无效');
      const {records}=await readBackup(backup);
      if(!records.length)return {restored:0};
      await transaction('places','readwrite',(s,set,tx,abort)=>{
        let index=0,failed=false;
        const next=()=>{
          if(index>=records.length)return;
          const record=records[index++];
          const request=s.get(record.id);
          request.onsuccess=()=>{
            if(failed)return;
            try {s.put(mergePlace(request.result,record,conflict));next();}
            catch(e){failed=true;abort(e);}
          };
        };
        next();set(records.length);
      });
      return {restored:records.length};
    }
    async function backup() {return createBackup(await list());}
    return Object.freeze({read,list,saveBrief,saveGuide,addMedia,restore,backup});
  }
  return Object.freeze({DB_NAME,idOf,validPlace,mergePlace,crc32,zipWrite,zipRead,createBackup,readBackup,prepareSelectedFiles,createRepository});
});
