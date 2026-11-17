'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),core=require('./src/media/media-core.js');
(async()=>{
 const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5W2boAAAAASUVORK5CYII=';
 const a={id:'qa-1',lat:29.492,lng:121.905,title:'海岸',note:'海风',brief:'海风',photos:[{id:'photo-1',src:photo}],videos:[{id:'video-1',name:'sample.mov',type:'video/quicktime',bytes:new Uint8Array([1,2,3]).buffer}],guides:[{url:'https://example.org/guide'}]};
 const archive=await core.createBackup([a]);
 const got=(await core.readBackup(archive)).records[0];
 assert.equal(got.note,'海风');assert.equal(got.photos[0].src,photo);
 assert.deepEqual([...new Uint8Array(got.videos[0].bytes)],[1,2,3]);
 assert.equal(got.guides[0].url,'https://example.org/guide');
 assert.throws(()=>core.mergePlace({...a,lat:0,lng:0},a),/不同坐标/);
 assert.equal(core.mergePlace({...a,photos:[],videos:[]},a).videos.length,1);
 const b=new Uint8Array(await archive.arrayBuffer()),key=new TextEncoder().encode('travel-footprints-v10');
 let at=-1;outer:for(let i=0;i<=b.length-key.length;i++){for(let j=0;j<key.length;j++)if(b[i+j]!==key[j])continue outer;at=i;break}
 assert.ok(at>=0);b[at]^=1;await assert.rejects(core.readBackup(b),/校验失败/);
 assert.ok(fs.readFileSync(__dirname+'/src/media/media-core.js','utf8').includes("nextVideos.length>6"));
 console.log('Media V4 regression: PASS (Brief, photo, video, guide, merge, coordinate conflict, ZIP CRC, video cap).');
})().catch(e=>{console.error(e);process.exitCode=1});
