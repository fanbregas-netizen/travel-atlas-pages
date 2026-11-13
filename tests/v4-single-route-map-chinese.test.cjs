'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../v4-single-route-unified-20261113'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const home=read('index.html'),planner=read('journey.html'),route=read('route-view.html');
const live=read('src/interaction/route-cards-v5-live.js');
const accepted=read('src/interaction/demo/v5/route-cards-v5.css');
const mapHome=read('v4-map-runtime.js');
const mapStyle=read('src/map/shared-v4-map.js');
const nav=read('src/interaction/one-route-entry.js'),navStyle=read('src/visual/one-route-unified-ui.css');
const spring=read('src/interaction/v5-unified-spring.js');
const sheet=read('src/interaction/physical-sheet.js');
const collection=read('src/interaction/v4-approved-collection-sheet.js');

test('home direct C V5 entry, old planner hidden, storage and map not deleted',()=>{
 assert.match(home,/id="dockRoute"/);
 assert.match(home,/src\/interaction\/one-route-entry\.js/);
 assert.match(nav,/document\.addEventListener\('click'/);
 assert.match(nav,/location\.assign\(entry\)/);
 for(const id of ['dockRoutePop','atlasRoutesSheet','tpBar','fp30Routes','fpvRoutesTab']){
  assert.match(navStyle,new RegExp('#'+id));
 }
 assert.match(home,/src\/media\/media-core\.js/);
 assert.match(home,/src\/interaction\/real-product-bridge\.js/);
 assert.match(home,/src\/visual\/v4-visual-acceptance-pass\.css/);
});
test('home and both route pages share exact raster basemap',()=>{
 assert.match(home,/src\/map\/shared-v4-map\.js/);
 assert.match(planner,/src\/map\/shared-v4-map\.js/);
 assert.match(route,/src\/map\/shared-v4-map\.js/);
 assert.match(mapHome,/window\.FootprintSharedMap\.figureStyle\(\)/);
 assert.match(live,/window\.FootprintSharedMap\?\.figureStyle/);
 assert.match(route,/window\.FootprintSharedMap\?\.figureStyle/);
 assert.match(mapStyle,/tile\.openstreetmap\.org/);
 assert.match(mapStyle,/atlas-map-view/);
 assert.match(live,/async function liveMountMap\(\)/);
 assert.doesNotMatch(live,/async function liveMountMap\(\)\{\s*if\(!allPlaces\.length\)return/);
});
test('real map adds middle stops and preserves route-only coordinates without creating golden stars',()=>{
 assert.match(live,/function startLiveMapPick\(mode\)/);
 assert.match(live,/liveMap\.on\('click',e=>/);
 assert.match(live,/function livePickedPoint\(lng,lat\)/);
 assert.match(live,/state\.stops\.splice\(insert,0,p\)/);
 assert.match(live,/routeOnly:true/);
 assert.match(live,/starred:false/);
 assert.match(live,/await liveStoreRouteOnlyStops\(\)/);
 assert.match(live,/await liveRepository\.saveRoute\(item\)/);
 assert.match(live,/async function liveSavedRouteList\(\)/);
 assert.match(live,/cmd==='live-saved-list'/);
 assert.match(live,/cmd==='add-source-map'/);
 assert.doesNotMatch(live,/rc-mini-map">\$\{document\.querySelector\('#map/);
});
test('C V5 approved gesture code, original visual source, and no visible English nav labels',()=>{
 assert.match(planner,/src\/interaction\/demo\/v5\/route-cards-v5\.css/);
 assert.match(planner,/src\/interaction\/route-cards-v5-live\.js/);
 assert.match(planner,/lang="zh-CN"/);
 assert.match(planner,/<title>足迹地图｜路线规划<\/title>/);
 assert.match(route,/<title>足迹地图｜路线地图<\/title>/);
 assert.match(live,/function springTo\(target\)/);
 assert.match(live,/function datePlus\(days\)/);
 assert.match(live,/if\(cmd==='date-commit'\)/);
 assert.match(live,/if\(cmd==='date-cancel'\)/);
 assert.match(live,/路线 · 选点/);
 assert.doesNotMatch(live,/textContent=stage==='select'\?'ROUTE/);
 assert.match(route,/>路线地图<\/span>/);
 assert.doesNotMatch(route,/>TRAVEL ATLAS<\/span>/);
 assert.doesNotMatch(home,/filmLabel\.textContent='TRAVEL MEMORIES'/);
 assert.match(accepted,/#rc-main/);
});
test('physical search, geographic card, collection use the approved C V5 physics',()=>{
 assert.match(home,/src\/interaction\/v5-unified-spring\.js/);
 assert.match(spring,/const stiffness=\.105\*frames/);
 assert.match(spring,/Math\.pow\(\.75,frames\)/);
 assert.match(sheet,/window\.FootprintV5Spring/);
 assert.match(collection,/window\.FootprintV5Spring/);
 new Function(live);new Function(nav);new Function(mapStyle);new Function(spring);
});
