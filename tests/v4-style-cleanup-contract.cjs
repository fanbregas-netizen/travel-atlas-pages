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
assert.deepEqual(markers,Array.from({length:32},(_,i)=>i+1),'all historic style blocks must remain ordered');
// Exact old/new CSS-text parity, not a subjective "looks the same" claim.
const cp=require('node:child_process');
const original=cp.execFileSync('git',['show','origin/main:v4-review-20261116/index.html'],{encoding:'utf8',maxBuffer:8*1024*1024});
const blocks=[...original.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1].trim());
const copied=[...legacy.matchAll(/\/\* ===== original inline style \d+\/32[^\n]*\n([\s\S]*?)(?=\n\/\* ===== original inline style|$)/g)].map(m=>m[1].trim());
assert.equal(blocks.length,32,'baseline changed; manual review required');
assert.deepEqual(copied,blocks,'CSS content differs from original! Not a mechanical extraction');
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
console.log('PASS structural extraction: 32/32 source-ordered CSS blocks, no inline style, all stylesheet refs present. Visual parity NOT YET TESTED.');
