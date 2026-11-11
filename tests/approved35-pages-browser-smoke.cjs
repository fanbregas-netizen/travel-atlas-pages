'use strict';
const fs=require('node:fs');
const os=require('node:os');
const cp=require('node:child_process');
const { chromium }=require('playwright-core');
const base='https://fanbregas-netizen.github.io/travel-atlas-pages/integration-v4-approved35-review/';
const evidence='approved35-pages-evidence';
fs.mkdirSync(evidence,{recursive:true});
const chrome=['google-chrome','google-chrome-stable','chromium'].map(name=>{try{return cp.execFileSync('which',[name],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!chrome)throw Error('Chrome not installed');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 let failed=false;
 const results=[];
 try {
  for(const width of [375,390,430]){
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,ignoreHTTPSErrors:false,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto(base+'index.html?ci='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForTimeout(2000);
   const value=await page.evaluate(()=>({
    dock:!!document.querySelector('#appDock'),
    map:!!document.querySelector('#map'),
    card:!!document.querySelector('#fpPlaceCard'),
    media:!!window.FootprintMediaCore?.createRepository,
    visual:!!document.querySelector('link[data-visual-integrated="pr15"]'),
    path:location.pathname,
    overflow:document.documentElement.scrollWidth-innerWidth,
    mode:window.__atlasInteractionMode||null
   }));
   const item={width,status:response?.status()||0,...value,errors};
   results.push(item);
   await page.screenshot({path:evidence+'/home-'+width+'.png',fullPage:true});
   if(item.status!==200||!value.dock||!value.map||!value.card||!value.media||!value.visual||value.overflow>6||errors.length)failed=true;
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage();
  for(const p of ['journey.html','route-view.html']){
   const res=await page.goto(base+p+'?ci='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForTimeout(400);
   const entry={page:p,status:res?.status()||0,title:await page.title(),hasBody:await page.locator('body').count()};
   results.push(entry);
   await page.screenshot({path:evidence+'/'+p+'.png',fullPage:true});
   if(entry.status!==200||!entry.hasBody)failed=true;
  }
  await context.close();
  fs.writeFileSync(evidence+'/results.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
  if(failed)process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
