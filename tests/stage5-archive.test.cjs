/* Stage 5 archive regression — safe restore without rewriting real user data. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('atlas-stage5-archive.js','utf8');
const ui=fs.readFileSync('atlas-stage5-backup-ui.js','utf8');
const homepage=fs.readFileSync('index.html','utf8');
const worker=fs.readFileSync('sw.js','utf8');
const archiveModule={exports:{}};new Function('window','module',source)({},archiveModule);
const zip=archiveModule.exports;
const places=[
 {id:'p1',title:'海边',lat:28.1001,lng:121.01,
  note:'海的声音',visitedAt:'2026-10-01T09:45:00Z',visitSource:'gps-confirmed',stage:'visited',
  references:[{url:'https://example.com/story',title:'旅行参考'}],
  photos:Array.from({length:13},(_,i)=>({name:'image-'+i+'.jpg',src:'data:image/jpeg;base64,AAAA'})),
  videos:[{id:'video1',name:'clip.MOV',type:'video/quicktime',bytes:new Uint8Array([0,255,2,3,4,255]).buffer}],
  starred:true,rank:3},
 {id:'p2',title:'山上',lat:27.8,lng:120.3,photos:[],videos:[],stage:'planned'}
];
const plans=[{id:'trip-1',title:'10月线路',placeIds:['p1','p2'],
  stops:[{placeId:'p1',day:1},{placeId:'p2',day:2}],startDate:'2026-10-01',endDate:'2026-10-02'}];
async function run(){
 const data=await zip.pack(places,plans);
 assert.equal(data.type,'application/zip');
 const bytes=await data.arrayBuffer(),parsed=zip.inspect(bytes);
 assert.equal(parsed.format,'travel-atlas-complete-v11');
 assert.equal(parsed.places.length,2);
 assert.equal(parsed.plans.length,1);
 assert.equal(parsed.places[0].photos.length,13,'Do not lose photo 10+');
 assert.equal(parsed.places[0].visitedAt,places[0].visitedAt);
 assert.deepEqual(parsed.places[0].references,places[0].references);
 assert.deepEqual(parsed.plans[0].stops,plans[0].stops);
 assert.equal(parsed.places[0].videos[0].blob.size,6);
 const mediaBytes=new Uint8Array(await parsed.places[0].videos[0].blob.arrayBuffer());
 assert.deepEqual(Array.from(mediaBytes),[0,255,2,3,4,255],'Exact binary video roundtrip');
 let bad=new Uint8Array(bytes);bad[65]^=1;
 assert.throws(()=>zip.inspect(bad.buffer),/完整性验证失败/);
 const old=zip.zip([{name:'travel-places.json',data:new TextEncoder().encode(JSON.stringify({
  format:'travel-footprints-v10',places:[{...places[1],id:'old1'}]
 }))}]);
 const restoredOld=zip.inspect(await old.arrayBuffer());
 assert.equal(restoredOld.places.length,1,'Legacy stored ZIP must remain importable');
 assert.throws(()=>zip.unzip(new Uint8Array([1,2,3,4]).buffer),/无效或过大/);
 assert.throws(()=>zip.zip([{name:'../invalid',data:new Uint8Array([1])}]),/不安全/);
 await assert.rejects(()=>zip.pack([{...places[0],id:'p1',videos:[{name:'missing-video'}]}],[]),/未完整读取/);
 await assert.rejects(()=>zip.pack([{...places[0],id:'p1'},places[0]],[]),/重复 ID/);
 assert(!source.includes('fetch('),'Archive serialization must not send data over network');
 assert(!ui.includes('fetch('),'Backup UX must never upload files');
 assert(ui.includes('store.importNew(info.fresh)'),'Restores only new IDs');
 assert(!ui.includes('store.save('),'Do not overwrite existing records');
 assert(ui.includes('core.inspect(await archive.arrayBuffer())'),'Export must self-verify before claiming success');
 assert(ui.includes('await putNewPlans(info.routes)'),'Itinerary records must restore');
 assert(ui.includes('if(store.isFallback?.())throw Error'),'No unverified session-only restore');
 assert(homepage.includes('store.add(p)'),'IDB restoring must use add() not put()');
 assert(homepage.includes("tx=db.transaction('places','readwrite')"),'Places import must be one transaction');
 assert(homepage.includes('atlas-stage5-archive.js?v=stage5-v50'),'Backup engine not loaded');
 assert(homepage.includes('atlas-stage5-backup-ui.js?v=stage5-v50'),'Restore UI not loaded');
 assert(homepage.includes('V4.Review.20261103.architectural-b-v46'),'Do not change approved map style');
 assert(worker.includes('atlas-v4-shell-stage5-archive-v50'),'Safari cache stale');
 const uiWindow={};new Function('window',ui)(uiWindow);
 const preview=uiWindow.AtlasBackupV5.previewText(parsed,[{id:'p1'}],[{id:'trip-1'}]);
 assert.equal(preview.fresh.length,1,'Existing bookmarks skipped');
 assert.equal(preview.routes.length,0,'Existing trips skipped');
 assert.match(preview.message,/不会被覆盖|已存在或演示记录将跳过/);
 console.log('PASS Stage 5: video byte integrity, 13 photos, visits, routes, legacy import, CRC corruption, non-destructive restore, offline-only');
}
run().catch(e=>{console.error(e);process.exitCode=1});
