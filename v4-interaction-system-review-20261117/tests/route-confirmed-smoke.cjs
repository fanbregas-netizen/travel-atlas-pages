'use strict';
const assert=require('node:assert/strict'),cp=require('node:child_process'),fs=require('node:fs');
const {chromium}=require('playwright-core');
const chrome=['google-chrome','chromium'].map(n=>{try{return cp.execFileSync('which',[n],{encoding:'utf8'}).trim()}catch{return ''}}).find(Boolean);
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'});
  const page=await ctx.newPage();page.setDefaultTimeout(8000);
  page.on('pageerror',e=>console.log('PAGEERROR',e.stack));
  page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,250))});
  const base='http://127.0.0.1:8765/v4-interaction-system-review-20261117/';
  console.log('SMOKE 1 seed');
  await page.goto(base+'index.html',{waitUntil:'domcontentloaded',timeout:15000});
  await page.evaluate(async()=>{
    const p={id:'qa-smoke',title:'真实示例地点',lat:30,lng:120,starred:true,note:'可核对 Brief',photos:[]};
    await new Promise((resolve,reject)=>{
      const req=indexedDB.open('private-travel-footprints-v1',1);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('places'))db.createObjectStore('places',{keyPath:'id'});
        if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
      };
      req.onerror=()=>reject(req.error);
      req.onsuccess=()=>{
        const db=req.result,tx=db.transaction('places','readwrite');
        tx.objectStore('places').put(p);
        tx.oncomplete=()=>{db.close();resolve()};
        tx.onerror=()=>reject(tx.error);
      };
    });
  });
  console.log('SMOKE 2 journey navigation');
  await page.goto(base+'journey-real-confirmed-20261118.html',{waitUntil:'domcontentloaded',timeout:15000});
  console.log('SMOKE 3 waiting app state');
  await page.waitForFunction(()=>!!window.__atlasJourneyRoute?.getState&&document.querySelectorAll('#places .place').length===1,null,{timeout:10000});
  const st=await page.evaluate(()=>({selected:window.__atlasJourneyRoute.getState().selected.length,sections:document.querySelectorAll('.builder>section.block').length,visual:!!window.__atlasJourneyVisual,rows:document.querySelectorAll('#places .place').length,tool:!!window.FootprintRouteEngine,media:!!window.FootprintMediaCore}));
  console.log('SMOKE READY',JSON.stringify(st));assert.equal(st.rows,1);assert.equal(st.visual,true);
  fs.mkdirSync('route-smoke-evidence',{recursive:true});await page.screenshot({path:'route-smoke-evidence/real-journey-390.png'});
  await ctx.close();
 }finally{await browser.close()}
})().catch(e=>{console.error('SMOKE FAILED',e.stack||e);process.exitCode=1});
