'use strict';
// Guard the first no-design-change cleanup. Does NOT certify Safari visuals.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'../v4-review-20261116');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const legacy=fs.readFileSync(path.join(base,'legacy-inline-cascade.css'),'utf8');
const external=[...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)/gi)].map(m=>m[1]);
const markers=[...legacy.matchAll(/\/\* ===== original inline style (\d+)\/32 /g)].map(m=>Number(m[1]));
assert.equal((html.match(/<style\b/gi)||[]).length,0,'reintroduced inline style blocks');
assert.equal(external.filter(x=>x.startsWith('./legacy-inline-cascade.css')).length,1,'single preserved cascade link');
for(const file of ['atlas-services.js','atlas-constellation-core.js','atlas-route-buildings.js','stage1-polish.js','stage1-finish.js']){
 assert.equal(html.split('<script src="./'+file+'"></script>').length-1,1,
   'exactly one cacheable script load required: '+file);
 assert.ok(!html.includes('data-inline="'+file+'"'),'duplicate embedded script: '+file);
 assert.ok(fs.existsSync(path.join(base,file)),'moved inline script target missing: '+file);
}

assert.deepEqual(markers,Array.from({length:32},(_,i)=>i+1),'all historic style blocks must remain ordered');
// Prove that ONLY mechanically identified rules from the RETIRED route
// controller differ from baseline. Every other original selector/declaration
// and the order of the 32 historic blocks must remain byte-for-byte equal.
const cp=require('node:child_process');
const original=cp.execFileSync('git',['show','origin/main:v4-review-20261116/index.html'],{encoding:'utf8',maxBuffer:8*1024*1024});
const blocks=[...original.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1].trim());
const copied=[...legacy.matchAll(/\/\* ===== original inline style \d+\/32[^\n]*\n([\s\S]*?)(?=\n\/\* ===== original inline style|$)/g)].map(m=>m[1].trim());
assert.equal(blocks.length,32,'baseline changed; manual review required');
const {stripRetiredRouteRules}=require('./v4-retired-route-css-filter.cjs');
const stripped=blocks.map(block=>stripRetiredRouteRules(block));
assert.deepEqual(copied,stripped.map(x=>x.css.trim()),
 'A non-retired CSS selector/declaration differs from the original; manual review required');
assert.equal(stripped.reduce((n,x)=>n+x.removed,0),84,'expected 84 known-retired top-level route rules');
assert.equal(stripRetiredRouteRules(legacy).removed,0,'retired route styles reintroduced');
assert.ok(legacy.length>300000,'unrelated map, media or card styles were removed');
assert.ok(external.length>=17,'removed an expected review stylesheet');
for(const href of external.filter(x=>x.startsWith('./'))){
 const file=href.split('?')[0];
 assert.ok(fs.existsSync(path.resolve(base,file)),'missing CSS reference: '+file);
}
// Real #fpPlaceCard and #fpSearchSheet are created by the original product
// controller. They cannot be required as static HTML attributes.
const home=fs.readFileSync(path.join(base,'footprint-home.js'),'utf8');
const runtime=fs.readFileSync(path.join(base,'v4-map-runtime.js'),'utf8');
for(const id of ['fpPlaceCard','fpSearchSheet','drawer','destinationCard','atlasPoiOverlay']){
 assert.ok((html+'\\n'+home+'\\n'+runtime).includes(id),'product sheet/overlay owner missing: '+id);
}
for(const script of ['v4-map-runtime.js','footprint-home.js','v4-approved-collection-sheet.js','route-cards-v5-live.js']){
 assert.ok(html.includes(script)||fs.existsSync(path.join(base,'src/interaction',script)),
   'important integration entry absent: '+script);
}
console.log('PASS 32/32 baseline CSS blocks; 84 retired route rules removed by deterministic filter; all other properties byte-identical. Safari visual parity remains separate.');
