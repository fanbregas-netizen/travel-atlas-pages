'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const variant=process.env.BROWSER||'chromium',url='https://fanbregas-netizen.github.io/travel-atlas-pages/v4-approved-four-systems-live-20261113/';
(async()=>{
 const browser=await ({chromium,webkit})[variant].launch({headless:true,...(variant==='chromium'?{args:['--no-sandbox']}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:65000});
  await page.waitForSelector('#appDock',{timeout:27000});
  await page.waitForFunction(()=>window.FootprintMediaCore&&window.__atlasSheetIntegration?.version==='B-V3-real-product',null,{timeout:27000});
  const checks=await page.evaluate(()=>({
   namespace:window.__atlasPreviewNamespace,
   cardOwners:document.querySelectorAll('#fpPlaceCard').length,
   dockOwners:document.querySelectorAll('#appDock').length,
   searchOwners:document.querySelectorAll('#fpSearchSheet').length,
   collectionOwners:document.querySelectorAll('#drawer').length,
   mediaBackup:typeof FootprintMediaCore.createRepository(indexedDB).backup==='function',
   visualBorder:getComputedStyle(document.getElementById('appDock')).borderRadius,
   sheetLevels:window.TravelAtlasSheet?.OPEN_LEVELS?.join(',')||''
  }));
  assert.equal(checks.namespace,'fp-v4-four-systems-live-20261113-');
  assert.deepEqual([checks.cardOwners,checks.dockOwners,checks.searchOwners,checks.collectionOwners],[1,1,1,1]);
  assert.equal(checks.mediaBackup,true);
  assert.ok(checks.visualBorder!=='0px'&&checks.visualBorder!=='none','Visual C styling not applied');
  assert.equal(checks.sheetLevels,'peek,half,full');
  await page.locator('#dockSearch').click({timeout:18000});
  await page.waitForFunction(()=>document.body.classList.contains('fp-search-open'),null,{timeout:18000});
  await page.locator('#fpSearchSheet .fp-search-close').click({timeout:18000});
  await page.waitForFunction(()=>!document.body.classList.contains('fp-search-open'),null,{timeout:13000});
  const data=await page.evaluate(async()=>{
   const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==';
   const place={id:'visual-media-one',title:'真实星标与影像',lat:31.32,lng:120.62,starred:true,
    note:'实际 Brief 保存在 IndexedDB',photos:[{id:'photo-one',name:'原始照片',src:png}]};
   const req=indexedDB.open('private-travel-footprints-v1',1);
   const db=await new Promise((resolve,reject)=>{
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('places'))req.result.createObjectStore('places',{keyPath:'id'});
      if(!req.result.objectStoreNames.contains('meta'))req.result.createObjectStore('meta',{keyPath:'key'})};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)
   });
   await new Promise((resolve,reject)=>{
    const tx=db.transaction('places','readwrite');tx.objectStore('places').put(place);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)
   });db.close();
   const repo=FootprintMediaCore.createRepository(indexedDB);
   await repo.saveRoute({id:'media-route',title:'媒体与路线同存储',stops:[{placeId:place.id,day:1}],startDate:'2026-11-20',endDate:'2026-11-20'});
   const archive=await repo.backup();
   const restored=await FootprintMediaCore.readBackup(archive);
   if(!(archive.length>100))throw Error('Media D ZIP backup was empty');
   if(!restored.records.some(p=>p.id===place.id))throw Error('Media D ZIP lost bookmarked media');
   if(!restored.routes.some(p=>p.id==='media-route'))throw Error('Media D ZIP lost route');
   await repo.restore(archive,{conflict:'merge'});
   return {bytes:archive.length,places:restored.records.length,routes:restored.routes.length};
  });
  await page.reload({waitUntil:'domcontentloaded',timeout:65000});
  await page.waitForSelector('#appDock',{timeout:27000});
  await page.locator('#dockStars').click({timeout:19000});
  await page.waitForFunction(()=>document.querySelector('#drawer')?.classList.contains('visible'),null,{timeout:16000});
  const stored=await page.evaluate(()=>document.getElementById('spotList')?.textContent||'');
  assert.ok(stored.includes('真实星标与影像'),'Collection has not rendered a real stored bookmark');
  await page.locator('#spotList .spotrow').first().click({timeout:13000});
  await page.waitForFunction(()=>!document.getElementById('fpPlaceCard')?.hidden,null,{timeout:15000});
  const card=await page.evaluate(()=>({
   place:document.getElementById('fpPlaceCard')?.dataset.placeId,
   level:window.__atlasSheetIntegration?.card?.getState()?.sheet,
   text:document.getElementById('fpPlaceCard')?.innerText?.slice(0,500)
  }));
  assert.equal(card.place,'visual-media-one');
  assert.ok(card.text.includes('实际 Brief 保存在 IndexedDB'));
  assert.ok(['peek','half','full'].includes(card.level));
  await page.evaluate(()=>window.__atlasSheetIntegration.card.snapTo('full'));
  await page.waitForFunction(()=>window.__atlasSheetIntegration.card.getState().sheet==='full',null,{timeout:12000});
  console.log('FOUR_SYSTEMS_HOME_MEDIA_PASS '+variant+' '+JSON.stringify({checks,data,card:card.place,errors:errors.slice(0,4)}));
  assert.equal(errors.filter(x=>/TypeError|ReferenceError|SyntaxError|Uncaught/.test(x)).length,0,errors.join('; '));
 }finally{await browser.close()}
})().catch(e=>{console.error('FOUR_SYSTEMS_HOME_MEDIA_FAIL '+variant+' '+e.stack);process.exit(1)});
