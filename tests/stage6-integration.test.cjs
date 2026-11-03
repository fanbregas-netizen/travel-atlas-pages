/* Stage 6 integrated regression: user data integrity, iPhone diagnostics, backup startup and media caps. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const home=fs.readFileSync('index.html','utf8');
const placesUI=fs.readFileSync('footprint-home.js','utf8');
const backupUI=fs.readFileSync('atlas-stage5-backup-ui.js','utf8');
const qaCode=fs.readFileSync('atlas-stage6-qa.js','utf8');
const worker=fs.readFileSync('sw.js','utf8');
const workflow=fs.readFileSync('.github/workflows/deploy-pages.yml','utf8');
async function run(){
 assert(home.includes('<meta name="atlas-app-release" content="V5.1.Stage6.20261103.stability">'),'Separate app release marker must be present');
 assert(home.includes('V4.Review.20261103.architectural-b-v46'),'Original accepted architectural map must be untouched');
 assert(home.includes('atlas-stage6-qa.js?v=stage6-v51')&&home.includes('atlas-stage6-qa.css?v=stage6-v51'),'On-device diagnostics must be available');
 assert(home.includes('footprint-home.js?v=stage6-v51'),'iPhone should load corrected photo uploader');
 assert(home.includes('atlas-stage5-backup-ui.js?v=stage6-v51'),'iPhone should load corrected backup binding');
 assert(worker.includes('atlas-v4-shell-stage6-integrated-v51'),'Safari service-worker shell must be new');
 assert(worker.includes('atlas-stage6-qa.js')&&worker.includes('atlas-stage6-qa.css'),'PWA needs diagnostic assets');
 assert(workflow.includes('node tests/stage6-integration.test.cjs'),'Deploy must require this regression test');
 assert(placesUI.includes('if(videos.length>=6'),'Direct upload must honor max six videos per bookmark');
 assert(placesUI.includes('if(latestPhotos.length>50||latestVideos.length>6)'),'Final write must reject over-limit media');
 assert(placesUI.includes('const latest=await readPlace(id)'),'Direct upload must avoid stale Place overwrites');
 assert(placesUI.includes('generation!==albumSelectionEpoch'),'Async EXIF jobs must not attach to later album selection');
 assert(backupUI.includes("document.addEventListener('DOMContentLoaded',bindReady"),'Backup UI should reconnect after deferred scripts are ready');
 // Actually simulate an iPhone's late-loaded backup module.
 const controls={
  exportBtn:{disabled:false,textContent:'Old ZIP',onclick:null},
  importBtn:{textContent:'Old import',onclick:null},
  importFile:{accept:'',onchange:null}
 };
 let onReady=null;
 const doc={
  readyState:'loading',getElementById:id=>controls[id]||null,
  querySelector:()=>null,addEventListener:(event,fn)=>{if(event==='DOMContentLoaded')onReady=fn}
 };
 const fakeWindow={};
 new Function('window','document',backupUI)(fakeWindow,doc);
 assert.equal(typeof controls.exportBtn.onclick,'object','Backup should wait for DOM readiness');
 assert.equal(typeof onReady,'function','The corrected backup must register DOM ready fallback');
 onReady();
 assert.equal(typeof controls.exportBtn.onclick,'function','Backup should bind after deferred script finishes');
 assert(controls.exportBtn.textContent.includes('完整档案'));
 assert(controls.importFile.accept.includes('.zip')&&controls.importFile.accept.includes('.json'));
 // Native read-only device snapshot must not include private note, coordinates, photos or names.
 const diagnosticModule={exports:{}};
 const device={
  navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X)',storage:{estimate:async()=>({usage:12345678,quota:99999999})}},
  caches:{keys:async()=>['atlas-v4-shell-stage6-integrated-v51']},
  __atlasArchitectQA:()=>({version:'architectural-b-v46',mode:'figure',pitch:0,zoom:17.1,architectureScale:true,legacyRasterDisabled:true,loaded:9,failed:0,coverage:.875}),
  __atlasPlaceStore:{readAll:async()=>[
   {id:'private-1',title:'SECRET_PLACE_NAME',note:'PRIVATE_BRIEF_TEXT',lat:23.314,lng:113.514,photos:[{src:'SECRET_IMAGE_BYTES'}],videos:[{}],visitedAt:'2026-10-10'},
   {id:'private-2',title:'Other',lat:31.2,lng:121.2,photos:[],videos:[]}
  ],save:async()=>{},isFallback:()=>false,isTransient:()=>false},
  AtlasCompleteArchive:{},AtlasBackupV5:{},AtlasVisitMedia:{},__footprintHome:{}
 };
 const reportDoc={readyState:'loading',addEventListener(){},querySelector:()=>({content:'V5.1.Stage6.20261103.stability'})};
 new Function('window','document','module',qaCode)(device,reportDoc,diagnosticModule);
 const qa=diagnosticModule.exports,report=await qa.inspect(),output=qa.collectSummary(report);
 assert.equal(report.storageMode,'IndexedDB 持久存储');
 assert.equal(report.stars,2);
 assert.equal(report.visited,1);
 assert.equal(report.photos,1);
 assert.equal(report.videos,1);
 assert.equal(report.map.coverage,.875);
 assert(report.map.northUp&&report.map.legacyRasterDisabled);
 assert(report.offlineCache.includes('V5.1'));
 for(const privateValue of ['SECRET_PLACE_NAME','PRIVATE_BRIEF_TEXT','SECRET_IMAGE_BYTES','113.514','23.314'])
  assert(!output.includes(privateValue),'Diagnostics must never leak sensitive location or media content: '+privateValue);
 // Feed seven videos through the actual quick-upload function, verify it saves only six.
 const begin=placesUI.indexOf('async function addMedia(id,files){');
 const end=placesUI.indexOf('function closeViewer(){',begin);
 assert(begin>0&&end>begin,'Direct upload source extraction failed');
 const factory=new Function('readPlace','writePlace','renderPlace','feedback','isPhoto','shrinkPhoto','visitCore','window',
  'let busy=false;'+placesUI.slice(begin,end)+';return addMedia;');
 const original={id:'p1',note:'old brief',photos:[],videos:[]};
 let called=0,written=null;
 const feedback=[];
 const upload=factory(
  async()=>{called++;return called===1?structuredClone(original):{...structuredClone(original),note:'a later edited brief'}},
  async p=>{written=p},
  async()=>{},msg=>feedback.push(msg),
  ()=>false,async()=>null,()=>({fingerprint:f=>f.name+'-'+f.size+'-'+f.lastModified}),
  {__atlasPlaceStore:{isFallback:()=>false}}
 );
 const videos=Array.from({length:7},(_,i)=>({name:'video'+i+'.mp4',type:'video/mp4',size:3,lastModified:100+i,arrayBuffer:async()=>new Uint8Array([i]).buffer}));
 await upload('p1',videos);
 assert(written,'Quick upload must write the place');
 assert.equal(written.videos.length,6,'Seventh video must be skipped, never overfill the archive');
 assert.equal(written.note,'a later edited brief','Upload must not revert concurrent Brief edits');
 assert(feedback.some(s=>s.includes('跳过 1 项')),'Skipped media should be reported to the user');
 console.log('PASS Stage 6: original map, deferred backup binding, privacy-safe device QA, iPhone cache, media cap, fresh Brief preservation');
}
run().catch(e=>{console.error(e);process.exitCode=1});
