'use strict';
/* V5 blank recording product: nearby card checks real map coordinates and
 * Overpass around contract. HTTP fixtures are deterministic; no production data. */
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base='http://127.0.0.1:8765/v5-recording-clean-20261123/';
const out=path.resolve(__dirname,'../v5-recording-nearby-evidence');fs.mkdirSync(out,{recursive:true});
const main={elements:[
  {type:'node',id:1,lat:-33.869,lon:151.211,tags:{tourism:'museum','name:zh':'样例文化馆',name:'Example museum'}},
  {type:'way',id:2,center:{lat:-33.872,lon:151.220},tags:{leisure:'park',name:'样例公园'}},
  {type:'node',id:3,lat:-33.869,lon:151.211,tags:{tourism:'museum',name:'样例文化馆'}},
  {type:'node',id:4,lat:-30.999,lon:152.999,tags:{tourism:'museum',name:'超出距离的地点'}},
  {type:'node',id:5,lat:-33.869,lon:151.212,tags:{tourism:'museum'}},
]};
async function exercise(name,engine){
 const browser=await engine.launch({headless:true,args:name==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
 const page=await context.newPage();
 let primary=0,backup=0;
 try{
  await page.route('https://overpass.private.coffee/api/interpreter**',async route=>{
   primary++;
   const query=new URL(route.request().url()).searchParams.get('data')||'';
   if(!query.includes('nwr(around:')||query.includes('photon.komoot.io/reverse'))
     return route.fulfill({status:400,body:'bad nearby query'});
   if(query.includes('-33.868800'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(main)});
   if(query.includes('40.800000'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:[]})});
   return route.fulfill({status:503,body:'busy'});
  });
  await page.route('https://overpass-api.de/api/interpreter**',async route=>{
   backup++;
   const query=new URL(route.request().url()).searchParams.get('data')||'';
   if(query.includes('-33.880000'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    elements:[{type:'node',id:7,lat:-33.8805,lon:151.212,tags:{tourism:'viewpoint',name:'备用观景台'}}]})});
   return route.fulfill({status:503,body:'busy'});
  });
  const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>!!window.AtlasServices?.nearby&&!!window.__footprintHome?.openSaved&&!!window.__atlasPlaceStore?.readAll,null,{timeout:30000});
  await page.waitForTimeout(1500);
  const first=await page.evaluate(()=>window.AtlasServices.nearby(-33.8688,151.2093));
  assert.equal(first.places.length,2);
  assert.equal(first.places[0].name,'样例文化馆');
  assert.equal(first.places[1].name,'样例公园');
  assert(first.places.every(x=>Number.isFinite(x.distance)&&x.lat&&x.lng&&x.lon&&x.distance<=7500));
  const before=primary;
  const cached=await page.evaluate(()=>window.AtlasServices.nearby(-33.8688,151.2093));
  assert.equal(primary,before,'same-point repeat must reuse cache');
  assert.equal(cached.places.length,2);
  const viaBackup=await page.evaluate(()=>window.AtlasServices.nearby(-33.88,151.21));
  assert.equal(viaBackup.places[0]?.name,'备用观景台');
  assert(backup>=1,'should try second endpoint after 503');
  const empty=await page.evaluate(()=>window.AtlasServices.nearby(40.8,-73.1));
  assert.equal(empty.places.length,0);
  await page.evaluate(()=>{
   const pane=document.getElementById('atlasPoiOverlay');
   const el=document.createElement('button');el.className='fp-poi';
   Object.assign(el.dataset,{poiCategory:'park',poiRawCategory:'garden',poiName:'地图里已加载的公园',poiId:'loaded-map-9',poiLat:'30.112',poiLng:'120.112'});
   pane.append(el);
  });
  const fallback=await page.evaluate(()=>window.AtlasServices.nearby(30.111,120.111));
  assert.equal(fallback.partial,true);
  assert.equal(fallback.places[0]?.name,'地图里已加载的公园');
  const error=await page.evaluate(async()=>{try{await window.AtlasServices.nearby(40.5,-73.5);return ''}catch(e){return e.message}});
  assert.match(error,/暂不可用/);
  // Seed a single local test place only within the independent recording namespace.
  await page.evaluate(async()=>{
   const repo=window.FootprintMediaCore.createRepository(indexedDB);
   await repo.read('nearby-qa');
   const opened=await new Promise((resolve,reject)=>{
    const req=indexedDB.open('private-travel-footprints-v5-recording-clean-20261123',1);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   await new Promise((resolve,reject)=>{
    const tx=opened.transaction('places','readwrite');
    tx.objectStore('places').put({id:'nearby-qa',title:'附近搜索测试地点',lat:-33.8688,lng:151.2093,starred:true,stage:'plan',photos:[],videos:[]});
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
   });opened.close();
   await window.__atlasFlowRefresh();
  });
  await page.evaluate(()=>window.__footprintHome.openSaved('nearby-qa'));
  const button=page.locator('#fpPlaceCard button').filter({hasText:'查看附近'}).first();
  await button.waitFor({state:'visible',timeout:18000});
  await button.click();
  const cards=page.locator('#fpPlaceCard .fp-social-list .fp-subaction');
  await cards.first().waitFor({state:'visible',timeout:15000});
  assert.equal(await cards.count(),2);
  assert.match(await cards.first().innerText(),/样例文化馆/);
  assert.doesNotMatch(await page.locator('#fpPlaceCard .fp-social-list').innerText(),/附近未找到景点/);
  await page.screenshot({path:path.join(out,name+'-nearby-card.png')});
  console.log(JSON.stringify({browser:name,result:'PASS',aroundQuery:true,realGeocodedRows:2,
   secondaryEndpoint:true,mapTileFallback:true,emptyDistinctFromError:true,
   cache:true,realV5CardRendered:true,primaryRequests:primary,backupRequests:backup}));
 }finally{await context.close();await browser.close()}
}
(async()=>{for(const [n,e] of [['chromium',chromium],['webkit',webkit]])await exercise(n,e)})()
 .catch(e=>{console.error(e.stack||e);process.exitCode=1});
