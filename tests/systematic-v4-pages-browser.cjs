'use strict';
/* Production-domain acceptance smoke for the isolated PR24 V4 integration.
 * Uses a fresh browser context, never accesses live user storage. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const {chromium}=require('playwright-core');
const root='https://fanbregas-netizen.github.io/travel-atlas-pages/v4-systematic-review-20261112/';
const evidence='systematic-v4-pages-evidence';
fs.mkdirSync(evidence,{recursive:true});
const executable=['google-chrome','google-chrome-stable','chromium'].map(name=>{try{return cp.execFileSync('which',[name],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!executable)throw Error('Chrome executable not found');
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:executable,args:['--no-sandbox','--disable-dev-shm-usage']});
 const report=[];
 try{
  for(const width of [375,390,430]){
   const ctx=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto(root+'index.html?ci='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!!window.__atlasDemo&&!!window.FootprintMediaCore&&!!window.__atlasSheetIntegration,null,{timeout:20000});
   const result=await page.evaluate(()=>({
    path:location.pathname,
    namespace:window.__atlasPreviewNamespace,
    map:!!document.getElementById('map'),
    dock:!!document.getElementById('appDock'),
    card:!!document.getElementById('fpPlaceCard'),
    physical:!!window.TravelAtlasPhysicalSheet,
    media:!!window.FootprintMediaCore?.createRepository,
    scrollOverflow:document.documentElement.scrollWidth-innerWidth,
    productionRoot:false
   }));
   assert.equal(response.status(),200);
   assert.equal(result.namespace,'atlas-v4-systematic-20261112-');
   for(const key of ['map','dock','card','physical','media'])assert.ok(result[key],width+' missing '+key);
   assert.ok(result.scrollOverflow<=6,width+' viewport horizontal overflow '+result.scrollOverflow);
   assert.equal(errors.length,0,width+' uncaught errors '+errors.join('; '));
   report.push({width,...result});
   await page.screenshot({path:evidence+'/home-'+width+'.png'});
   if(width===390){
    const isolated=await page.evaluate(async()=>{
      const db=await new Promise((res,rej)=>{const request=indexedDB.open('private-travel-footprints-v1',1);request.onsuccess=()=>res(request.result);request.onerror=()=>rej(request.error)});
      db.close();localStorage.setItem('smoke','ok');
      const keys=[...Array(localStorage.length)].map((_,i)=>localStorage.key(i));
      const databases=typeof indexedDB.databases==='function'?await indexedDB.databases():[];
      return {storage:keys.includes(window.__atlasPreviewNamespace+'smoke'),names:databases.map(d=>d.name)};
    });
    assert.ok(isolated.storage,'preview storage namespace is missing');
    if(isolated.names.length)assert.ok(isolated.names.includes('private-travel-footprints-v1'),'indexedDB.databases() does not follow namespace');
    report.push({isolated});
   }
   await ctx.close();
  }
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await ctx.newPage();
  for(const entry of ['journey.html','route-view.html','amap-import.html']){
    const response=await page.goto(root+entry+'?ci='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
    assert.equal(response.status(),200,entry+' HTTP');
    const state=await page.evaluate(()=>({namespace:window.__atlasPreviewNamespace,body:!!document.body}));
    assert.equal(state.namespace,'atlas-v4-systematic-20261112-',entry+' namespace');
    report.push({entry,...state});
    await page.screenshot({path:evidence+'/'+entry+'.png'});
  }
  await ctx.close();
  fs.writeFileSync(evidence+'/results.json',JSON.stringify(report,null,2));
  console.log('Systematic V4 public iPhone smoke passed',JSON.stringify(report));
 }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
