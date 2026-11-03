/* Footprint Map V5.0 | private archive UI.
 * Explicit export/import only. No background sync, remote upload or destructive replace.
 */
(function(root){
'use strict';
const $=id=>document.getElementById(id),ARCHIVE_DB='travel-atlas-journeys-v1';
let candidate=null,modal=null,progress=null,restoreBtn=null,closeBtn=null,working=false;
function openPlansDb(){
 return new Promise((resolve,reject)=>{
  if(!root.indexedDB){reject(Error('当前浏览器不支持旅行路线数据库'));return}
  const req=root.indexedDB.open(ARCHIVE_DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('plans'))req.result.createObjectStore('plans',{keyPath:'id'})};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('路线数据库无法读取'));
  req.onblocked=()=>reject(Error('旅行路线数据库被其他窗口占用'));
 });
}
async function getPlans(){
 const db=await openPlansDb();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('plans','readonly'),req=tx.objectStore('plans').getAll();
  req.onsuccess=()=>resolve(req.result||[]);
  req.onerror=()=>reject(req.error||Error('路线数据读取失败'));
  tx.onabort=()=>reject(tx.error||Error('路线读取事务已中断'));
 })}finally{db.close()}
}
async function putNewPlans(records){
 if(!records.length)return 0;
 const db=await openPlansDb();
 try{
  const current=await new Promise((resolve,reject)=>{
   const tx=db.transaction('plans','readonly'),req=tx.objectStore('plans').getAllKeys();
   req.onsuccess=()=>resolve(new Set((req.result||[]).map(String)));
   req.onerror=()=>reject(req.error);
  });
  const rows=records.filter(p=>!current.has(String(p.id)));
  if(!rows.length)return 0;
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('plans','readwrite');
   tx.oncomplete=resolve;
   tx.onabort=()=>reject(tx.error||Error('路线保存失败'));
   tx.onerror=()=>reject(tx.error||Error('路线写入失败'));
   try{for(const item of rows)tx.objectStore('plans').add(item)}
   catch(e){try{tx.abort()}catch(_){}reject(e)}
  });
  return rows.length;
 }finally{db.close()}
}
function notify(message,error=false){
 if(modal?.open&&progress){progress.textContent=message;progress.dataset.error=error?'yes':'no'}
 else if(typeof root.__atlasToast==='function')root.__atlasToast(message);
 else{
  const box=$('atlasBackupNotice')||document.createElement('p');box.id='atlasBackupNotice';box.textContent=message;
  const row=document.querySelector('#drawer .backuprow');if(row&&!box.parentNode)row.after(box);
 }
}
function buildModal(){
 if(modal)return;
 modal=document.createElement('dialog');modal.id='atlasRestorePreview';
 modal.setAttribute('aria-label','预览即将恢复的旅行档案');
 modal.innerHTML='<div class="atlas-restore-head"><div><small>PRIVATE ARCHIVE · V5.0</small><h2>核对旅行数据备份</h2></div><button type="button" id="atlasRestoreClose" aria-label="关闭">×</button></div>'+
 '<p id="atlasRestoreDetails" class="atlas-restore-details"></p>'+
 '<p class="atlas-restore-warning">安全恢复：默认只添加当前设备没有的地点和路线。任何相同 ID 的收藏、Brief、照片视频都不会被覆盖；演示数据不会写入真实收藏库。ZIP 只在本机读取。</p>'+
 '<p id="atlasRestoreProgress" class="atlas-restore-progress" role="status" aria-live="polite"></p>'+
 '<div class="atlas-restore-actions"><button id="atlasRestoreConfirm" type="button">只补齐缺失记录</button><button id="atlasRestoreCancel" type="button">取消</button></div>';
 document.body.append(modal);
 progress=$('atlasRestoreProgress');restoreBtn=$('atlasRestoreConfirm');closeBtn=$('atlasRestoreClose');
 closeBtn.onclick=()=>{if(!working){candidate=null;modal.close()}};
 $('atlasRestoreCancel').onclick=closeBtn.onclick;
 restoreBtn.onclick=commitImport;
 modal.addEventListener('cancel',e=>{if(working)e.preventDefault();else candidate=null});
}
function readableBytes(n){return n>=1024*1024?(n/1048576).toFixed(1)+' MB':Math.ceil(n/1024)+' KB'}
function previewText(archive,existing,plans){
 const present=new Set(existing.map(p=>String(p.id))),planIds=new Set(plans.map(p=>String(p.id)));
 const clean=archive.places.filter(p=>!p.demo),fresh=clean.filter(p=>!present.has(p.id));
 const routes=archive.plans.filter(p=>!planIds.has(p.id)&&!p.demo);
 const photos=fresh.reduce((n,p)=>n+(p.photos||[]).length,0);
 const videos=fresh.reduce((n,p)=>n+(p.videos||[]).length,0);
 const visited=fresh.filter(p=>p.visitedAt).length;
 return {
  message:'备份版本：'+archive.format+'；ZIP：'+readableBytes(archive.bytes)+'。\n'+
   '文件包含：'+archive.places.length+' 处星标、'+archive.plans.length+' 条旅行路线。\n'+
   '本次将新增：'+fresh.length+' 处星标、'+routes.length+' 条路线，包含 '+photos+' 张照片、'+videos+' 条视频、'+visited+' 项到访记录。\n'+
   '已存在或演示记录将跳过：'+(archive.places.length-fresh.length)+' 处星标、'+(archive.plans.length-routes.length)+' 条路线。',
  fresh, routes
 };
}
async function download(){
 if(working)return;
 const button=$('exportBtn'),store=root.__atlasPlaceStore,core=root.AtlasCompleteArchive;
 if(!core||!store?.readAll){notify('备份组件尚未准备好，请刷新页面');return}
 working=true;if(button)button.disabled=true;
 try{
  notify('正在读取星标、旅行影像与路线…');
  const [places,plans]=await Promise.all([store.readAll(),getPlans()]);
  const archive=await core.pack(places,plans);
  // Self-read the archive before claiming it was saved.
  const verify=core.inspect(await archive.arrayBuffer());
  if(verify.places.length!==places.length||verify.plans.length!==plans.length)throw Error('备份校验数量不一致');
  const url=URL.createObjectURL(archive),a=document.createElement('a');
  a.href=url;a.download='FootprintMap_TravelAtlas_完整备份_'+new Date().toLocaleDateString('sv-SE')+'.zip';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  notify('备份已生成：'+verify.places.length+' 处星标、'+verify.plans.length+' 条路线，包含全部已存媒体。请保存到「文件」App 并妥善保管。');
 }catch(e){notify('完整备份未生成：'+String(e?.message||e),true)}
 finally{working=false;if(button)button.disabled=false}
}
async function prepareImport(file){
 if(!file||working)return;
 const core=root.AtlasCompleteArchive,store=root.__atlasPlaceStore;
 if(!core||!store?.readAll){notify('恢复组件尚未准备好，请刷新页面',true);return}
 buildModal();candidate=null;restoreBtn.disabled=true;
 if(!modal.open)modal.showModal();
 working=true;progress.dataset.error='no';progress.textContent='正在本机读取并校验 ZIP 备份…';
 try{
  if(file.size>core.MAX_TOTAL)throw Error('文件超过 512MB 安全上限');
  const buffer=await file.arrayBuffer(),archive=core.inspect(buffer);
  const [existing,plans]=await Promise.all([store.readAll(),getPlans()]);
  const info=previewText(archive,existing,plans);
  candidate={archive,info};
  $('atlasRestoreDetails').textContent=info.message;
  progress.textContent=info.fresh.length||info.routes.length?'已验证文件完整性。请确认后恢复；不会覆盖现有记录。':'当前设备已有这些记录，无需重复导入。';
  restoreBtn.disabled=!(info.fresh.length||info.routes.length)||store.isFallback?.();
  if(store.isFallback?.())progress.textContent='当前浏览器正在使用不可靠的备用存储；为避免数据丢失，本次禁止恢复。请使用 Safari 正常模式。';
 }catch(e){progress.dataset.error='yes';progress.textContent='预检失败，未修改任何数据：'+String(e?.message||e)}
 finally{working=false}
}
async function commitImport(){
 if(working||!candidate)return;
 const archive=candidate.archive,store=root.__atlasPlaceStore;
 working=true;restoreBtn.disabled=true;closeBtn.disabled=true;$('atlasRestoreCancel').disabled=true;
 try{
  // Check collisions again. Saved records may have changed since preview.
  if(store.isFallback?.())throw Error('不可靠的备用存储无法安全恢复');
  const [existing,plans]=await Promise.all([store.readAll(),getPlans()]);
  const info=previewText(archive,existing,plans);
  if(!(info.fresh.length||info.routes.length)){progress.textContent='当前记录均已存在，无需恢复。';return}
  progress.textContent='正在恢复 '+info.fresh.length+' 处收藏与 '+info.routes.length+' 条路线…';
  // One IDB transaction for all new places. Existing records are never updated.
  if(info.fresh.length){
   if(typeof store.importNew!=='function')throw Error('收藏事务接口不可用');
   await store.importNew(info.fresh);
  }
  let count=0;
  try{count=await putNewPlans(info.routes)}
  catch(err){
   progress.dataset.error='yes';
   progress.textContent='已恢复 '+info.fresh.length+' 处星标；路线写入未完成：'+String(err?.message||err)+'。请保留备份 ZIP，稍后可再次安全导入补齐路线。';
   return;
  }
  candidate=null;progress.textContent='恢复完成：新增 '+info.fresh.length+' 处星标、'+count+' 条路线。已存在的数据未覆盖；请返回地图与「我的路线」检查。';
  notify('旅行数据已恢复。');
 }catch(err){progress.dataset.error='yes';progress.textContent='恢复失败：'+String(err?.message||err)+'。原有收藏不会被覆盖。'}
 finally{working=false;closeBtn.disabled=false;$('atlasRestoreCancel').disabled=false;restoreBtn.disabled=true}
}
function install(){
 const oldExport=$('exportBtn'),oldImport=$('importBtn'),fileInput=$('importFile');
 if(!oldExport||!oldImport||!fileInput)return;
 oldExport.onclick=download;
 oldExport.textContent='↓ 完整档案 ZIP';
 oldImport.textContent='↑ 安全恢复档案';
 oldImport.onclick=()=>fileInput.click();
 fileInput.accept='.zip,application/zip';
 fileInput.onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(file)prepareImport(file)};
 const description=document.querySelector('#drawer .footnote');
 if(description)description.textContent='完整备份包括地图星标、Brief、照片视频、到访记录和已保存旅行路线。全部保存在当前浏览器；换设备之前请导出 ZIP，恢复时默认不覆盖已有内容。';
}
const api={install,download,prepareImport,previewText};
root.AtlasBackupV5=api;
})(typeof window!=='undefined'?window:globalThis);
