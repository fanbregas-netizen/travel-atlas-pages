'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'../v4-review-20261116');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const html=read('index.html'),runtime=read('v4-map-runtime.js');
const home=read('footprint-home.js');
const collection=read('src/interaction/v4-approved-collection-sheet.js');
const poi=read('src/interaction/poi-card-handoff-v19.js');
const accepted=read('src/visual/accepted-four-screen-v18.css');
assert.ok(!home.includes("placeCard.append(grab)"),'duplicate decorative grip reintroduced');
assert.match(accepted,/atlas-card-grip::before/);
assert.match(html,/collectionTabs\.hidden=singleRoute&&section==='places'/);
assert.ok(!html.includes('data-inline="trip-picker.js"'),'retired route engine still executes on map');
assert.ok(!html.includes('id="drawerSaveBox"'),'hidden second route/collection selector still present');
assert.match(html,/if\(section==='routes'\)\{location\.assign\('\.\/journey\.html'\);return\}/);

assert.match(html,/fp30DetailHead'\)\.hidden=singleRoute&&section==='places'/);
assert.match(runtime,/__atlasCollectionSheet\?\.requestClose\?\.\(finish\)/);
assert.match(runtime,/__atlasCollectionSheet\?\.reveal\?\.\(\)/);
assert.match(runtime,/commit:commitDestinationContent/);
assert.ok(runtime.indexOf('const commitDestinationContent')<runtime.indexOf('const reveal=()=>'));
assert.match(poi,/if\(p>=\.5&&!committed\)\{committed=true;commit\?\.\(\)\}/);
assert.match(poi,/const dip=Math\.sin\(Math\.PI\*p\)/);
assert.match(collection,/window\.__atlasCollectionSheet=\{reveal,requestClose/);
assert.match(collection,/el\.inert=true/);
assert.match(collection,/if\(visible===wasVisible\)return/);
assert.match(collection,/document\.addEventListener\('pointermove'/);
assert.match(collection,/document\.addEventListener\('pointerup'/);
assert.match(collection,/now-pendingSince>=32/);
assert.match(collection,/timer=setTimeout\(tick,32\)/);
assert.match(collection,/const next=motor\.step\(pos,to,velocity,elapsed\)/);
assert.match(collection,/let wasVisible=el\.classList\.contains\('visible'\)/);
assert.match(poi,/el\.inert=!!renew/);
assert.match(home,/window\.__atlasDemo\?\.close\?\.\(\)/);
const cleanPoiCss=read('src/visual/real-poi-card-spring-v19.css');
assert.match(cleanPoiCss,/body\.fp-search-open #destinationCard/);

assert.match(poi,/const poiMotion=new WeakMap/);
const journey=read('journey.html'),route=read('src/interaction/route-cards-v5-live.js');
assert.ok(journey.indexOf('v5-unified-spring.js')<journey.indexOf('route-cards-v5-live.js'));
assert.match(route,/window\.FootprintV5Spring/);
new (require('node:vm').Script)(route,{filename:'route-cards-v5-live.js'});

assert.match(accepted,/body\.fp-single-route-owner #drawer\.fp30-detail #fpvCollectionTabs/);
assert.match(accepted,/grid-template-rows:minmax\(44px,auto\) 44px!important/);
assert.match(accepted,/overflow-y:auto!important;overscroll-behavior:contain!important/);
for(const file of ['v4-map-runtime.js','src/interaction/v4-approved-collection-sheet.js','src/interaction/poi-card-handoff-v19.js']){
 new (require('node:vm').Script)(read(file),{filename:file});
}
for(const id of ['destinationCard','fpPlaceCard','drawer','fpSearchSheet']){
 assert.ok(html.includes(id)||runtime.includes(id)||home.includes(id),'missing real sheet owner: '+id);
}
console.log('PASS: collection uses one B05 controller with opening/closing spring; POI reuses one real card and defers title commit; single-route collection removes redundant layout. Safari motion remains unverified.');
