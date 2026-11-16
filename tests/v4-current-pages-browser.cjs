'use strict';
/* Footprint Map V4 Pages CURRENT preview acceptance. New isolated product only.
 * Read-only, fresh iPhone contexts, no real user data. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const {chromium}=require('playwright-core');
const root='https://fanbregas-netizen.github.io/travel-atlas-pages/v4-review-20261116/';
const artifact='v4-current-pages-evidence';
fs.mkdirSync(artifact,{recursive:true});
const chrome=['google-chrome','google-chrome-stable','chromium'].map(x=>{try{return cp.execFileSync('which',[x],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!chrome)throw Error('Chrome not installed');
const stamp='V4.C.ApprovedPoiSVG.20261116.9';
async function probe(){
 const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 const report=[];
 try{
  for(const width of [375,390,430]){
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[],broken=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{
    if(r.url().startsWith(root)&&r.status()>=400)broken.push({code:r.status(),url:r.url()});
   });
   const response=await page.goto(root+'index.html?verify='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForTimeout(1800);
   const home=await page.evaluate(()=>({
    version:document.querySelector('meta[name="atlas-app-version"]')?.content||document.documentElement.innerHTML.match(/V4\.C\.ApprovedPoiSVG\.20261116\.9/)?.[0],
    status:document.readyState,
    modules:{poi:typeof window.AtlasPOIMotion?.play==='function',poiIcon:typeof window.AtlasPOIIcons?.categoryFor==='function',physical:!!window.TravelAtlasPhysicalSheet,media:!!window.FootprintMediaCore?.createRepository,app:!!window.__atlasDemo},
    dock:[...document.querySelectorAll('#appDock > button')].map(b=>b.id),
    search:!!document.querySelector('#fpTopSearch #dockSearch'),
    map:!!document.querySelector('#map'),
    card:!!document.querySelector('#fpPlaceCard'),
    overflow:document.documentElement.scrollWidth-innerWidth,
    searchAlign:(()=>{let a=document.querySelector('#fpTopSearch')?.getBoundingClientRect();return a?Math.abs((a.left+a.right)/2-innerWidth/2):999})()
   }));
   const result={width,status:response?.status(),home,errors,broken};
   report.push(result);
   await page.screenshot({path:`${artifact}/home-${width}.png`,fullPage:false});
   assert.equal(result.status,200,'home HTTP on '+width);
   assert.ok(String(home.version).includes(stamp),'current source version absent');
   for(const [key,v]of Object.entries(home.modules))assert.ok(v,width+' missing '+key);
   assert.ok(home.map&&home.card&&home.search,width+' page missing core UI');
   assert.deepEqual(home.dock,['dockStars','dockMap','dockRoute'],'3 item Dock order');
   assert.ok(home.overflow<=6,width+' horizontal overflow '+home.overflow);
   assert.ok(home.searchAlign<=4,width+' search is off centre '+home.searchAlign);
   assert.deepEqual(broken,[],width+' local resources 404');
   assert.deepEqual(errors,[],width+' page JavaScript errors');

   if(width===390){
    await page.evaluate(()=>{
     const probe=document.createElement('div');probe.id='poiSvgAcceptanceProbe';
     probe.className='fp-vector-token';probe.style.cssText='position:fixed;top:-100px;left:-100px;width:48px;height:48px';
     document.body.append(probe);
     window.AtlasPOIMotion.play(probe,'sea','海岸');
    });
    await page.waitForFunction(()=>!!document.querySelector('#poiSvgAcceptanceProbe .fp-internal-poi-envelope .fp-internal-poi-svg'),null,{timeout:8000});
    const poi=await page.evaluate(()=>{
     const p=document.querySelector('#poiSvgAcceptanceProbe'),svg=p?.querySelector('svg'),shell=p?.querySelector('.fp-internal-poi-envelope');
     const internalPaths=svg?.querySelectorAll('path').length||0;
     const morph=svg?.querySelectorAll('animate[attributeName="d"]').length||0;
     const anim=getComputedStyle(shell).animationName;
     const transform=getComputedStyle(shell).scale;
     return {internalPaths,morph,anim,transform,content:p?.innerHTML.slice(0,270)};
    });
    result.poi=poi;
    assert.ok(poi.morph>=3,'real SVG water path morph not connected');
    assert.match(poi.anim,/fpInternalPinScaleReturn/,'reviewed scale not playing');
    const star=await page.evaluate(()=>{
     const e=document.createElement('span');e.id='starMotionAcceptanceProbe';e.innerHTML='<svg viewBox="0 0 40 40"><path d="M20 3.7 25.2 13.5 36.1 15.2 28.3 23 30.1 34 20 28.7 9.9 34 11.7 23 3.9 15.2 14.8 13.5Z" fill="#D7B36E" /></svg>';document.body.append(e);
     window.AtlasPOIMotion.playStar(e);return {before:e.querySelectorAll('animate').length};
    });
    await page.waitForTimeout(110);
    result.star=await page.evaluate(()=>({active:!!document.querySelector('#starMotionAcceptanceProbe svg.fp-internal-star-animate'),morph:!!document.querySelector('#starMotionAcceptanceProbe animate[data-fp-star-morph]')}));
    assert.ok(result.star.active&&result.star.morph,'star morph not playing on the actual SVG');
    await page.locator('#dockSearch').click({timeout:5000});
    await page.waitForTimeout(160);
    result.search=await page.evaluate(()=>({
     open:document.body.classList.contains('fp-search-open'),
     topField:!!document.querySelector('#fpSearchActiveTop #fpSearchField'),
     results:!!document.querySelector('#fpSearchSheet'),
     originalDockHidden:!document.querySelector('#appDock #dockSearch')
    }));
    await page.screenshot({path:`${artifact}/search-390.png`,fullPage:false});
    assert.ok(result.search.open&&result.search.topField&&result.search.results,'search field handoff broken');
    await page.locator('#fpSearchActiveTop .fp-search-cancel').click({timeout:5000});
    await page.waitForTimeout(160);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('fp-search-open')),false,'search cancel did not close');
    for(const path of ['journey.html','route-view.html','icon-motion-review-20261116.html','index-preview.html','src/interaction/demo/v5/index.html']){
      const x=await page.goto(root+path,{waitUntil:'domcontentloaded',timeout:60000});
      const entry={path,status:x?.status()||0};report.push(entry);
      assert.equal(entry.status,200,'missing original Vercel product page '+path);
    }
   }
   await context.close();
  }
  fs.writeFileSync(artifact+'/results.json',JSON.stringify(report,null,2));
  console.log('V4 NEW Pages complete preview and SVG motion PASS',JSON.stringify(report));
 }catch(err){
  fs.writeFileSync(artifact+'/results.json',JSON.stringify(report,null,2));
  throw err;
 }finally{await browser.close()}
}
probe().catch(err=>{console.error(err);process.exitCode=1});
