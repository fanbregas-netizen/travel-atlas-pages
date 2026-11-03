/* Stage 4: local-only visit, EXIF matching and safe media persistence. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const mediaSource=fs.readFileSync('atlas-visit-media.js','utf8');
const ui=fs.readFileSync('footprint-home.js','utf8');
const home=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('atlas-stage4-media.css','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const moduleObj={exports:{}};
new Function('window','module',mediaSource)({},moduleObj);
const mod=moduleObj.exports;
assert.equal(mod.MAX_FILES,24);
assert.equal(mod.PHOTO_LIMIT,50);
assert.equal(mod.VIDEO_LIMIT,6);
assert.equal(mod.MAX_VIDEO_BYTES,40*1024*1024);
assert(Math.abs(mod.distanceMeters({lat:0,lng:0},{lat:0,lng:1})-111195)<300);
assert.equal(mod.distanceMeters({lat:30,lng:120},{lat:30,lng:120}),0);
assert.equal(mod.distanceMeters({lat:95,lng:0},{lat:0,lng:0}),Infinity);
assert.equal(mod.nearestStar({lat:52.5167,lng:13.4},[
 {id:'near',title:'Nearby',lat:52.51675,lng:13.40002,starred:true},
 {id:'far',title:'Far',lat:52.6,lng:13.5,starred:true}
]).id,'near');
assert.equal(mod.nearestStar({lat:52,lng:13},[{id:'a',lat:52.6,lng:13.5,starred:true}]),null);
assert.equal(mod.fingerprint({name:'IMG_1.jpg',size:300,lastModified:10}),'IMG_1.jpg:300:10');
assert.equal(mod.knownVideo({name:'abc.MOV',type:''}),true);
assert.equal(mod.knownPhoto({name:'abc.HEIC',type:''}),true);
assert.equal(mod.parseExifGps(new Uint8Array([1,2,3,4]).buffer),null);
// Generate a minimal standards-compliant EXIF GPS block with WGS84 N/E coordinates.
function jpegGps(latDeg,latMin,lonDeg,lonMin){
 const t=Buffer.alloc(128,0);
 const w16=(o,n)=>t.writeUInt16LE(n,o),w32=(o,n)=>t.writeUInt32LE(n,o);
 t.write('II',0);w16(2,42);w32(4,8);w16(8,1);
 w16(10,0x8825);w16(12,4);w32(14,1);w32(18,26);w32(22,0);
 w16(26,4);
 const entry=(i,tag,type,count,v)=>{const p=28+12*i;w16(p,tag);w16(p+2,type);w32(p+4,count);w32(p+8,v);return p};
 entry(0,1,2,2,78);entry(1,2,5,3,80);entry(2,3,2,2,69);entry(3,4,5,3,104);
 w32(76,0);
 for(const [base,degrees,minutes] of [[80,latDeg,latMin],[104,lonDeg,lonMin]]){
  w32(base,degrees);w32(base+4,1);w32(base+8,minutes);w32(base+12,1);w32(base+16,0);w32(base+20,1);
 }
 const header=Buffer.from('Exif\0\0','binary'),n=header.length+t.length+2;
 return Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe1,(n>>8)&255,n&255]),header,t,Buffer.from([0xff,0xd9])]);
}
const jpeg=jpegGps(52,31,13,24);
const gps=mod.parseExifGps(jpeg);
assert(gps,'GPS EXIF not decoded');
assert(Math.abs(gps.lat-52.5166667)<.00001&&Math.abs(gps.lng-13.4)<.00001,'GPS EXIF wrong coordinates');
assert.equal(mod.nearestStar(gps,[{id:'berlin',title:'Berlin',lat:52.5167,lng:13.40001}]).id,'berlin');
assert(!mediaSource.includes('fetch('),'EXIF module must not transmit photo GPS');
assert(!mediaSource.includes('getCurrentPosition('),'EXIF parser must not request location on load');
assert(ui.includes('function visitWidget(p)'),'Visited panel missing');
assert(ui.includes('checkLocationForVisit(id)'),'On-demand geolocation check missing');
assert(ui.includes("await writePlace(fresh)"),'Visited marker is not persisted');
assert(ui.includes("matchedByExif"),'Album suggestion confirmation missing');
assert(ui.includes('row.select.value'),'User must confirm each file destination');
assert(ui.includes('fingerprint=core.fingerprint(file)'),'Duplicate guard missing');
assert(ui.includes("source:'local-album'"),'Uploaded media provenance not recorded');
assert(ui.includes('typeof window.__atlasPlaceStore?.save'),'Media updates must use same bookmark database');
assert(!ui.includes("catch(e){let saved;try{saved=JSON.parse(localStorage.getItem('travel-places')"),'Quota errors must not silently write to separate localStorage copy');
assert(home.includes('window.__atlasPlaceStore={readAll:()=>allStored(),save:'),'Unified store must use actual bookmarks');
assert(!home.includes("const next={...dst,photos,videos,stage:'visited'}"),'Selecting a photo must not falsely claim a visit');
assert(home.includes('atlas-stage4-media.css?v=stage4-v49')&&home.includes('atlas-visit-media.js?v=stage4-v49'),'Stage 4 entry not loaded');
assert(css.includes('.fp-visit-panel')&&css.includes('.fp-album-dialog'),'Mobile card UI CSS missing');
assert(sw.includes('atlas-visit-media.js')&&sw.includes('atlas-stage4-media.css'),'PWA cache needs new media modules');
// Verify that a write failure is propagated without a false "saved" result.
const writeStart=ui.indexOf('async function writePlace(p){'),writeEnd=ui.indexOf('const mediaOf=p=>',writeStart);
assert(writeStart>=0&&writeEnd>writeStart);
const write=Function('window','openDb',ui.slice(writeStart,writeEnd)+';return writePlace')(
 {__atlasPlaceStore:{save:async()=>{throw Error('QuotaExceededError')}}},async()=>{throw Error('do not open second store')});
async function run(){
 await assert.rejects(()=>write({id:'test',photos:[{src:'data:image/png;base64,a'}]}),/QuotaExceededError/);
 console.log('PASS: GPS EXIF, nearest star, explicit user selection, visited-only check-in, duplicate guard and single-store quota safety');
}
run().catch(e=>{console.error(e);process.exitCode=1});
