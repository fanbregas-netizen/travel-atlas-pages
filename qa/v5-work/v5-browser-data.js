/* Synthetic data only. Every IndexedDB name is prefixed; never reads user DBs. */
async function runFootprintDataQA(api, factory) {
 const results=[], prefix='fp-work-qa-'+Date.now()+'-';
 const idb={open:(name,...args)=>factory.open(prefix+name,...args)};
 const check=(name,ok)=>{results.push({name,passed:!!ok});if(!ok)throw Error(name)};
 const open=(name,stores)=>new Promise((ok,no)=>{const q=idb.open(name,1);q.onupgradeneeded=()=>{for(const [name,keyPath] of stores)q.result.createObjectStore(name,{keyPath})};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
 const tx=async(db,stores,mode,fn)=>new Promise((ok,no)=>{const t=db.transaction(stores,mode);fn(t);t.oncomplete=ok;t.onabort=()=>no(t.error)});
 const main='private-travel-footprints-v1',legacy='travel-atlas-journeys-v1';
 const a={id:'qa-a',title:'测试旧收藏',lat:31.23,lng:121.47,starred:true,note:'旧版 Brief',brief:'旧版 Brief',photos:[{id:'photo',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='}],videos:[]};
 const route=(id,title)=>({id,title,startDate:'2026-11-21',endDate:'2026-11-22',stops:[{placeId:a.id,day:1,time:'09:00'}]});
 try{
  const db=await open(main,[['places','id'],['meta','key']]);
  await tx(db,['places','meta'],'readwrite',t=>{t.objectStore('places').put(a);t.objectStore('meta').put({key:'journey/clash',value:route('clash','新版路线')})});db.close();
  const old=await open(legacy,[['plans','id']]);await tx(old,'plans','readwrite',t=>{t.objectStore('plans').put(route('clash','旧版路线'));t.objectStore('plans').put(route('legacy','旧版独有路线'))});old.close();
  const repo=api.createRepository(idb);
  check('V4 收藏读取',(await repo.list()).length===1);
  check('V4 照片读取',(await repo.read(a.id)).photos[0].src===a.photos[0].src);
  check('V4 Brief 读取',(await repo.read(a.id)).note===a.note);
  const routes=await repo.listRoutes();check('旧路线迁移',routes.length===2);
  check('同 ID 新路线不被旧路线覆盖',routes.find(r=>r.id==='clash').title==='新版路线');
  check('重复迁移不重复记录',(await repo.listRoutes()).length===2);
  await repo.saveBrief(a.id,'V5 更新后的 Brief');check('V5 Brief 回写',(await repo.read(a.id)).note==='V5 更新后的 Brief');
  const reopened=api.createRepository(idb);check('关闭数据库后重新读取',(await reopened.read(a.id)).brief==='V5 更新后的 Brief');
  const bytes=new Uint8Array(32*1024*1024);for(let i=0;i<bytes.length;i+=4096)bytes[i]=(i/4096)%251;
  await repo.addMedia(a.id,[{kind:'video',id:'large',name:'synthetic-32MiB.mp4',type:'video/mp4',bytes:bytes.buffer}]);
  check('32 MiB 合成视频持久化',(await repo.read(a.id)).videos[0].bytes.byteLength===bytes.length);
  const zip=await repo.backup(),parsed=await api.readBackup(zip);
  check('ZIP 同时包含地点与路线',parsed.records.length===1&&parsed.routes.length===2);
  const restored=api.createRepository(idb,'restored');await restored.restore(zip);
  check('ZIP 照片完整恢复',(await restored.read(a.id)).photos[0].src===a.photos[0].src);
  const out=new Uint8Array((await restored.read(a.id)).videos[0].bytes);
  check('32 MiB 视频逐字节恢复',out.length===bytes.length&&out.every((v,i)=>v===bytes[i]));
  check('ZIP 路线站点顺序恢复',(await restored.listRoutes()).every(r=>r.stops[0].placeId===a.id));
  const bad=await api.createBackup([{...a,lat:1,lng:1}]);let rejected=false;try{await restored.restore(bad)}catch(e){rejected=e.code==='PLACE_MISMATCH'}
  check('地点同 ID 异坐标冲突拒绝',rejected);check('冲突后原 Brief 未变化',(await restored.read(a.id)).note==='V5 更新后的 Brief');
  const badRoute=await api.createBackup([],[route('clash','冲突内容')]);rejected=false;try{await restored.restore(badRoute)}catch(e){rejected=e.code==='ROUTE_CONFLICT'}check('路线同 ID 内容冲突拒绝',rejected);
  const damaged=new Uint8Array(await zip.arrayBuffer());damaged[60]^=1;rejected=false;try{await restored.restore(damaged)}catch(e){rejected=true}check('损坏 ZIP 拒绝写入',rejected);
  rejected=false;try{await repo.saveRoute(route('atomic','不应保存'),{places:[{...a,routeOnly:true,starred:false}]})}catch(e){rejected=true}
  check('临时路线地点碰撞整笔事务回滚',rejected&&!(await repo.listRoutes()).some(r=>r.id==='atomic'));
  check('原收藏星标仍保留',(await repo.read(a.id)).starred===true);
  return {status:'PASS',prefix,results,zipBytes:zip.size,mediaBytes:bytes.length,kind:'real-browser IndexedDB, synthetic media bytes (not playable video)'};
 }catch(e){return {status:'FAIL',prefix,results,error:String(e.stack||e)}}
}
if(typeof module==='object')module.exports=runFootprintDataQA;
