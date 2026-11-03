/* Travel Atlas V5.1 | On-device, read-only acceptance diagnostics.
 * No geolocation calls, no writes, no telemetry, no photo/Brief/coordinate contents.
 */
(function(root){
'use strict';
let dialog=null,statusEl=null,copyButton=null,lastResult=null;
const $=id=>document.getElementById(id);
const text=(tag,cls,value)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(value!=null)el.textContent=value;return el};
function safeMapInfo(){
 try{
  const value=root.__atlasArchitectQA?.()||null;
  if(!value)return null;
  const zoom=Number(value.zoom);
  return {
   version:String(value.version||'未知').slice(0,100),
   mode:String(value.mode||'unknown').slice(0,32),
   northUp:value.pitch===0,
   zoom:Number.isFinite(zoom)?Math.round(zoom*10)/10:null,
   architectureScale:!!value.architectureScale,
   loadedTiles:Math.max(0,Number(value.loaded)||0),
   failedTiles:Math.max(0,Number(value.failed)||0),
   coverage:Math.max(0,Math.min(1,Number(value.coverage)||0)),
   legacyRasterDisabled:!!value.legacyRasterDisabled
  };
 }catch{return null}
}
function collectSummary(values){
 const map=values.map;
 const summary=[
  'Travel Atlas 设备内运行检查（不含位置、照片、Brief）',
  '应用版本：'+values.appVersion,
  '浏览器：'+values.platform,
  '收藏存储：'+values.storageMode,
  '星标数量：'+values.stars+'；到访数量：'+values.visited+'；照片记录：'+values.photos+'；视频记录：'+values.videos,
  '保存/备份/归档组件：'+(values.storageApi?'正常':'不可用')+' / '+(values.archive?'正常':'不可用')+' / '+(values.album?'正常':'不可用'),
  '地图引擎：'+(map?map.mode:'未启动')+'；地图版本：'+(map?.version||'未知'),
  '地图视角：'+(map?.northUp?'正俯视':'未知或未符合')+'；建筑瓦片加载：'+(map?.loadedTiles??'?')+'；失败：'+(map?.failedTiles??'?'),
  '当前建筑覆盖：'+(map?.architectureScale?Math.round(map.coverage*100)+'%':'当前缩放暂不适用')+
    '；旧底图关闭：'+(map?.legacyRasterDisabled?'是':'未确认'),
  'Safari 离线缓存：'+values.offlineCache,
  '设备离线持久空间：'+values.storageEstimate,
  '检测：'+values.checkedAt,
  '注意：这些是本机即时运行数据，不代表远程地图服务或真实道路导航可用。'
 ];
 return summary.join('\n');
}
function storageDescription(store){
 if(!store?.readAll)return '未就绪';
 if(store.isTransient?.())return '临时会话（有丢失风险）';
 if(store.isFallback?.())return '备用存储（建议尽快备份）';
 return 'IndexedDB 持久存储';
}
async function inspect(){
 const store=root.__atlasPlaceStore,counts={stars:0,visited:0,photos:0,videos:0};
 let storageMode=storageDescription(store),storageApi=!!store?.readAll&&!!store?.save;
 if(store?.readAll){
  try{
   const places=await store.readAll();
   for(const p of places){
    if(!p||p.demo||p.starred===false)continue;
    counts.stars++;
    if(p.visitedAt||p.stage==='visited')counts.visited++;
    counts.photos+=Array.isArray(p.photos)?p.photos.length:0;
    counts.videos+=Array.isArray(p.videos)?p.videos.length:0;
   }
  }catch(e){storageMode='读取失败：'+String(e?.message||e).slice(0,85);storageApi=false}
 }
 let offlineCache='无法读取',storageEstimate='未知';
 try{
  if(root.caches?.keys){
   const keys=await root.caches.keys();
   const ours=keys.filter(x=>x.startsWith('atlas-v4-shell-'));
   offlineCache=ours.includes('atlas-v4-shell-stage6-integrated-v51')?'V5.1 已缓存':
    ours.length?'待更新（检测到 '+ours.length+' 个旧版本）':'未缓存或不受支持';
  }
 }catch{offlineCache='缓存不可读'}
 try{
  const info=await root.navigator?.storage?.estimate?.();
  if(Number.isFinite(info?.quota)&&Number.isFinite(info?.usage)){
   storageEstimate=Math.round(info.usage/1048576)+' / '+Math.round(info.quota/1048576)+' MB（估计）';
  }
 }catch{}
 const result={
  appVersion:document.querySelector('meta[name="atlas-app-release"]')?.content||'未知',
  platform:/iPhone|iPad|iPod/.test(root.navigator?.userAgent||'')?'iPhone / iPad Safari 环境':'其他浏览器环境',
  ...counts,storageMode,storageApi,
  archive:!!root.AtlasCompleteArchive&&!!root.AtlasBackupV5,
  album:!!root.AtlasVisitMedia&&!!root.__footprintHome,
  map:safeMapInfo(),offlineCache,storageEstimate,
  checkedAt:new Date().toLocaleString('zh-CN',{hour12:false})
 };
 return result;
}
function ensureDialog(){
 if(dialog)return;
 dialog=text('dialog','atlas-stage6-dialog');dialog.id='atlasStage6Dialog';
 dialog.setAttribute('aria-label','Travel Atlas 设备运行检查');
 dialog.innerHTML='<div class="atlas-stage6-head"><div><small>TRAVEL ATLAS · DEVICE CHECK</small><h2>运行检查</h2></div><button type="button" id="atlasStage6Close" aria-label="关闭">×</button></div>'+
 '<p class="atlas-stage6-caveat">只检查本机运行状态与记录数量，不读取或上传照片内容、Brief、精确位置。可复制诊断文字反馈问题。</p>'+
 '<pre id="atlasStage6Result" class="atlas-stage6-result" role="status" aria-live="polite"></pre>'+
 '<div class="atlas-stage6-actions"><button id="atlasStage6Retry" type="button">重新检查</button><button id="atlasStage6Copy" type="button">复制诊断报告</button></div>';
 document.body.append(dialog);
 statusEl=$('atlasStage6Result');copyButton=$('atlasStage6Copy');
 $('atlasStage6Close').onclick=()=>dialog.close();
 $('atlasStage6Retry').onclick=update;
 copyButton.onclick=async()=>{
  if(!lastResult)return;
  const message=collectSummary(lastResult);
  try{await root.navigator.clipboard.writeText(message);copyButton.textContent='已复制 ✓'}
  catch{
   const input=text('textarea');input.value=message;input.setAttribute('readonly','');input.style.position='fixed';input.style.left='-9999px';
   document.body.append(input);input.select();const ok=document.execCommand?.('copy');input.remove();
   copyButton.textContent=ok?'已复制 ✓':'复制不可用，请长按选择上方文字';
  }
 };
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
}
async function update(){
 ensureDialog();statusEl.textContent='正在读取本机状态…';
 try{lastResult=await inspect();statusEl.textContent=collectSummary(lastResult);copyButton.textContent='复制诊断报告'}
 catch(e){statusEl.textContent='检查失败：'+String(e?.message||e)}
 return lastResult;
}
function open(){ensureDialog();if(!dialog.open)dialog.showModal();update()}
function install(){
 const row=document.querySelector('#drawer .backuprow');if(!row||$('atlasStage6Open'))return;
 const button=text('button','secondary-btn atlas-stage6-entry','运行检查');
 button.type='button';button.id='atlasStage6Open';button.onclick=open;row.append(button);
}
const api=Object.freeze({install,open,inspect,collectSummary});
root.AtlasStage6QA=api;
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
 else install();
}
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
