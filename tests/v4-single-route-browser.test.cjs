'use strict';
const assert=require('node:assert/strict'),{chromium,webkit}=require('playwright');
const kind=process.env.BROWSER||'chromium';
const base=process.env.BASE||'https://fanbregas-netizen.github.io/travel-atlas-pages/v4-single-route-unified-20261113/';
(async()=>{
 const browser=await ({chromium,webkit})[kind].launch({headless:true,...(kind==='chromium'?{args:['--no-sandbox']}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,
 userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:65000});
  await page.waitForSelector('#appDock',{timeout:30000});
  await page.waitForFunction(()=>window.__fpSingleRouteNavigation?.version==='唯一 C V5',null,{timeout:15000});
  const home=await page.evaluate(()=>({
   routeText:document.querySelector('#dockRoute')?.textContent?.trim(),
   legacyRoutePopup:getComputedStyle(document.getElementById('dockRoutePop')).display,
   legacyRouteSheet:getComputedStyle(document.getElementById('atlasRoutesSheet')).display,
   storedNamespace:window.__atlasPreviewNamespace,
   homepageBase:FootprintSharedMap.figureStyle().sources.base.tiles[0],
   sheetPhysics:FootprintV5Spring.version,
   collectionPhysics:!!window.__atlasCollectionSheet
  }));
  assert.equal(home.storedNamespace,'fp-v4-single-route-unified-20261113-');
  assert.equal(home.legacyRoutePopup,'none');
  assert.equal(home.legacyRouteSheet,'none');
  assert.ok(home.homepageBase.includes('tile.openstreetmap.org'));
  assert.ok(home.sheetPhysics.includes('C V5'));
  await page.locator('#dockRoute').click({timeout:15000});
  await page.waitForURL('**/journey.html',{timeout:20000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.loaded===true,null,{timeout:25000});
  await page.waitForFunction(()=>!!window.__atlasLivePlannerMap,null,{timeout:30000});
  const empty=await page.evaluate(()=>({
   selected:window.__atlasRouteV5Live.state.order,
   mapStyle:window.__atlasLivePlannerMap?.getStyle()?.sources?.base?.tiles?.[0],
   mapCanvas:!!document.querySelector('#rc-live-map-canvas canvas'),
   title:document.title,step:document.getElementById('rc-step')?.textContent
  }));
  assert.equal(empty.selected.length,0);
  assert.ok(empty.mapCanvas,'No real geographic map under empty C V5');
  assert.ok(empty.mapStyle?.includes('tile.openstreetmap.org'),'Route did not use home tiles');
  assert.ok(empty.title.startsWith('足迹地图'));
  assert.ok(empty.step.includes('路线'));
  await page.locator('#rc-body [data-rc="source-map"]').click({timeout:15000});
  await page.waitForFunction(()=>!document.getElementById('rc-live-map-pick-hint')?.hidden,null,{timeout:12000});
  // Real pointer interaction on the map canvas, not a simulated POI list.
  const canvas=page.locator('#rc-live-map-canvas canvas').first();
  await canvas.click({position:{x:90,y:225},timeout:16000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live.state.order.length===1,null,{timeout:12000});
  await canvas.click({position:{x:205,y:245},timeout:16000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live.state.order.length===2,null,{timeout:12000});
  const first=await page.evaluate(()=>window.__atlasRouteV5Live.state.order);
  assert.ok(first.every(p=>p.id.startsWith('route-point-')));
  await page.locator('#rc-footer [data-rc="stage-order"]').click({timeout:17000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live.state.stage==='order',null,{timeout:10000});
  await page.locator('#rc-footer [data-rc="stage-preview"]').click({timeout:17000});
  await page.locator('#rc-footer [data-rc="mini-add"]').click({timeout:17000});
  await page.locator('#rc-mini [data-rc="add-source-map"]').click({timeout:17000});
  await page.waitForFunction(()=>!document.getElementById('rc-live-map-pick-hint')?.hidden,null,{timeout:10000});
  await canvas.click({position:{x:310,y:220},timeout:16000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live.state.order.length===3,null,{timeout:10000});
  const three=await page.evaluate(()=>window.__atlasRouteV5Live.state.order);
  assert.deepEqual(three.map(x=>x.id),[first[0].id,three[1].id,first[1].id],'Map stop did not insert in the middle');
  assert.ok(three[1].id.startsWith('route-point-'));
  await page.locator('#rc-footer [data-rc="stage-preview"]').click({timeout:17000});
  await page.locator('#rc-footer [data-rc="mini-save"]').click({timeout:17000});
  await page.locator('#rc-save-name').fill('中文旅行路线');
  await page.locator('#rc-mini [data-rc="save-confirm"]').click({timeout:17000});
  await page.waitForFunction(()=>!!window.__atlasRouteV5Live.state.savedId,null,{timeout:22000});
  const saved=await page.evaluate(async()=>{
   const id=window.__atlasRouteV5Live.state.savedId;
   const repo=FootprintMediaCore.createRepository(indexedDB);
   const route=(await repo.listRoutes()).find(x=>x.id===id);
   const all=await repo.list();
   return {id,route,places:all.filter(x=>route.stops.some(s=>s.placeId===x.id))};
  });
  assert.ok(saved.route?.stops?.length===3);
  assert.deepEqual(saved.route.stops.map(x=>x.placeId),three.map(x=>x.id));
  assert.equal(saved.places.length,3,'Map-only stops not written to existing Media D repository');
  assert.ok(saved.places.every(x=>x.routeOnly===true&&x.starred===false));
  await page.reload({waitUntil:'domcontentloaded',timeout:65000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.loaded===true,null,{timeout:20000});
  // Saved itinerary uses the same accepted original C V5 editor.
  await page.goto(base+'journey.html?saved='+encodeURIComponent(saved.id),{waitUntil:'domcontentloaded',timeout:65000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.loaded===true,null,{timeout:20000});
  const reopened=await page.evaluate(()=>window.__atlasRouteV5Live.state);
  assert.deepEqual(reopened.order.map(x=>x.id),three.map(x=>x.id));
  await page.locator('#rc-footer [data-rc="stage-preview"]').click({timeout:17000});
  await page.locator('#rc-footer [data-rc="open-real-map"]').click({timeout:17000});
  await page.waitForURL('**/route-view.html?saved=*',{timeout:20000});
  await page.waitForFunction(()=>window.__atlasRV?.places?.length===3,null,{timeout:22000});
  const map=await page.evaluate(()=>({
   names:window.__atlasRV.places.map(x=>x.title),
   ids:window.__atlasRV.places.map(x=>x.id),
   source:FootprintSharedMap.figureStyle().sources.base.tiles[0],
   edit:document.getElementById('routeEditV5')?.getAttribute('href'),
   legacyAdd:getComputedStyle(document.getElementById('addStop')).display,
   brand:document.querySelector('.atlas-brand-top')?.textContent,
   title:document.title
  }));
  assert.deepEqual(map.ids,three.map(x=>x.id));
  assert.equal(map.legacyAdd,'none');
  assert.ok(map.edit.includes('journey.html?saved='));
  assert.equal(map.brand,'路线地图');
  assert.ok(map.title.startsWith('足迹地图'));
  await page.locator('#routeEditV5').click({timeout:16000});
  await page.waitForURL('**/journey.html?saved=*',{timeout:16000});
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.loaded===true,null,{timeout:20000});
  await page.evaluate(()=>window.__atlasRouteV5Live.stage('select'));
  await page.locator('#rc-footer [data-rc="live-saved-list"]').click({timeout:15000});
  const savedLabel=await page.locator('#rc-mini').innerText();
  assert.ok(savedLabel.includes('中文旅行路线'));
  console.log('V4_ONE_ROUTE_SHARED_MAP_PASS '+kind+' '+JSON.stringify({home,empty,first,three,routeId:saved.id,reopened:reopened.order,map,errors:errors.slice(0,6)}));
  assert.equal(errors.filter(x=>/TypeError|ReferenceError|SyntaxError|Uncaught/.test(x)).length,0,errors.join('; '));
 }finally{await browser.close()}
})().catch(e=>{console.error('V4_ONE_ROUTE_SHARED_MAP_FAIL '+kind+' '+e.stack);process.exit(1)});
