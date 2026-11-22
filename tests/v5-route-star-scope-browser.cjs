'use strict';
/* Production-root V5 regression: 261 synthetic saved stars, 5 route stops.
 * Never accesses a user's Safari profile or uploads personal records.
 */
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const root='http://127.0.0.1:8765/';
const dir=path.resolve(__dirname,'../v5-route-star-scope-evidence');
fs.mkdirSync(dir,{recursive:true});
async function run(name,engine,width){
 const browser=await engine.launch({headless:true,args:name==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage();
 try{
  const response=await page.goto(root,{waitUntil:'domcontentloaded',timeout:35000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>typeof window.FootprintUnifiedRoute?.open==='function'&&typeof window.__atlasPlaceStore?.readAll==='function',null,{timeout:24000});
  await page.evaluate(async()=>{
   await window.__atlasPlaceStore.readAll();
   const db=await new Promise((resolve,reject)=>{
    const q=indexedDB.open('private-travel-footprints-v1',1);
    q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
   });
   const tx=db.transaction(['places','meta'],'readwrite');
   const places=tx.objectStore('places'),meta=tx.objectStore('meta');
   for(let i=0;i<261;i++){
    const id='scope-star-'+String(i).padStart(3,'0');
    places.put({id,title:'收藏地点 '+i,lat:29.492+(i%16)*.00009,lng:121.905+Math.floor(i/16)*.00009,
      starred:true,stage:'plan',note:'测试收藏',photos:[],videos:[]});
   }
   const stops=Array.from({length:5},(_,i)=>({placeId:'scope-star-'+String(i).padStart(3,'0'),day:1,order:i+1}));
   meta.put({key:'journey/route-scope-5',value:{id:'route-scope-5',title:'本次五站路线',startDate:'2026-11-22',
    endDate:'2026-11-24',updatedAt:'2026-11-22T15:00:00.000Z',
    placeIds:stops.map(x=>x.placeId),stops}});
   await new Promise((resolve,reject)=>{
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
   });
   db.close();
  });
  await page.reload({waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>typeof window.FootprintUnifiedRoute?.open==='function'&&
   window.__atlasDemo?.getSaved?.().length===261,null,{timeout:22000});
  await page.evaluate(()=>window.__atlasDemo?.vector?.());
  await page.waitForFunction(()=>!!window.__atlasPOIBridge?.vector?.(),null,{timeout:28000});
  // Keep the browser camera inside the intentionally tight fixture cluster.
  await page.evaluate(()=>window.__atlasPOIBridge.vector().jumpTo({center:[121.9058,29.4927],zoom:13.5}));
  await page.waitForTimeout(270);
  const before=await page.locator('#atlasBookmarkOverlay .atlas-bookmark-hit').count();
  assert(before>100,name+' homepage did not render synthetic favorites '+before);
  await page.evaluate(()=>window.FootprintUnifiedRoute.open('route-scope-5'));
  await page.waitForFunction(()=>window.FootprintUnifiedRoute?.state.step==='view'&&
   window.__fpRouteStarScope?.ids?.size===5&&window.__fpRouteStarScope.allowAll===false,null,{timeout:20000});
  await page.waitForFunction(()=>document.querySelectorAll('#atlasBookmarkOverlay .atlas-bookmark-hit').length===5,null,{timeout:10000});
  const visible=await page.locator('#atlasBookmarkOverlay .atlas-bookmark-hit').evaluateAll(a=>a.map(x=>x.dataset.placeId));
  assert.deepEqual(visible.sort(),Array.from({length:5},(_,i)=>'scope-star-'+String(i).padStart(3,'0')));
  assert.equal(await page.locator('#atlasBookmarkOverlay .fp-route-stop-order').count(),5);
  await page.screenshot({path:path.join(dir,name+'-'+width+'-route-only-five.png')});
  // Swipe the physical card: the route should not reinstall 256 hidden nodes.
  const header=page.locator('#fpUnifiedRoute .fp-route-heading');
  const rect=await header.boundingBox();assert(rect,'route header missing');
  const x=rect.x+70,y=rect.y+rect.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  for(let i=1;i<=8;i++)await page.mouse.move(x,y-i*10);
  await page.mouse.up();
  await page.waitForTimeout(260);
  assert.equal(await page.locator('#atlasBookmarkOverlay .atlas-bookmark-hit').count(),5,'drag re-rendered unrelated stars');
  await page.locator('#fpUnifiedRoute [data-command="saved"]').first().click();
  await page.locator('#fpUnifiedRoute [data-command="new"]').first().click();
  await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.step==='pick'&&
   window.__fpRouteStarScope?.ids?.size===0&&!window.__fpRouteStarScope.allowAll,null,{timeout:12000});
  await page.waitForFunction(()=>document.querySelectorAll('#atlasBookmarkOverlay .atlas-bookmark-hit').length===0);
  await page.locator('#fpUnifiedRoute [data-command="toggle"][data-id="scope-star-000"]').click();
  await page.locator('#fpUnifiedRoute [data-command="toggle"][data-id="scope-star-001"]').click();
  await page.waitForFunction(()=>window.__fpRouteStarScope?.ids?.size===2);
  await page.waitForFunction(()=>document.querySelectorAll('#atlasBookmarkOverlay .atlas-bookmark-hit').length===2);
  // Explicit map picker is the only route step that should show available stars.
  await page.locator('#fpUnifiedRoute [data-command="pickmode"][data-value="map"]').click();
  await page.waitForFunction(()=>window.__fpRouteStarScope?.allowAll===true);
  await page.waitForFunction(()=>document.querySelectorAll('#atlasBookmarkOverlay .atlas-bookmark-hit').length>100);
  const picking=await page.locator('#atlasBookmarkOverlay .atlas-bookmark-hit').count();
  // Choosing "地图选点" slides the card offscreen by design. Restore it
  // through its approved mini-grip before tapping the collection-list tab.
  if(await page.evaluate(()=>window.FootprintUnifiedRoute.state.mapFocus)){
   await page.evaluate(()=>window.FootprintUnifiedRoute.leaveMapFocus());
   await page.waitForFunction(()=>!window.FootprintUnifiedRoute.state.mapFocus);
   await page.waitForTimeout(430);
  }
  await page.locator('#fpUnifiedRoute [data-command="pickmode"][data-value="list"]').click();
  await page.waitForFunction(()=>window.__fpRouteStarScope?.allowAll===false);
  await page.waitForFunction(()=>document.querySelectorAll('#atlasBookmarkOverlay .atlas-bookmark-hit').length===2);
  await page.locator('#fpUnifiedRoute [data-command="exit"]').click();
  await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.open===false&&
   window.__fpRouteStarScope===undefined,null,{timeout:7000});
  await page.waitForFunction(()=>document.querySelectorAll('#atlasBookmarkOverlay .atlas-bookmark-hit').length>100,null,{timeout:9000});
  const after=await page.locator('#atlasBookmarkOverlay .atlas-bookmark-hit').count();
  const data=await page.evaluate(async()=>({places:(await window.__atlasPlaceStore.readAll()).length,
   routes:(await window.FootprintMediaCore.createRepository(indexedDB).listRoutes()).length}));
  assert.equal(data.places,261);
  assert.equal(data.routes,1);
  console.log(JSON.stringify({browser:name,width,result:'PASS',allBefore:before,routeVisible:5,
   mapPicking:picking,allRestored:after,placesUnchanged:data.places,routeUnchanged:data.routes}));
 }finally{await context.close();await browser.close()}
}
(async()=>{for(const [name,engine] of [['chromium',chromium],['webkit',webkit]])
 for(const width of [390,430])await run(name,engine,width)})()
 .catch(e=>{console.error(e.stack||e);process.exitCode=1});
