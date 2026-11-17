'use strict';
// Real DOM of the isolated full V4 product. No fabricated layout, no DB writes.
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const cp=require('node:child_process'),fs=require('node:fs');
const base=process.env.INTERACTION_REVIEW_BASE_URL||'https://fanbregas-netizen.github.io/travel-atlas-pages/v4-interaction-system-review-20261117/';
const exec=['google-chrome','google-chrome-stable','chromium'].map(x=>{try{return cp.execFileSync('which',[x],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!exec)throw Error('Chrome not installed');
const wait=n=>new Promise(r=>setTimeout(r,n));
const out='interaction-motion-evidence';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:exec,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results=[];
 try{
  for(const width of [375,390,430]){
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await context.newPage();
   await page.goto(base+'index.html?paired-dock-qa='+width,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!!window.__atlasCardDockMotion?.getState&&!!window.__atlasCollectionSheet?.getState,{timeout:24000});
   await page.evaluate(()=>{
    const top=document.getElementById('fpTopSearch'),bottom=document.getElementById('appDock');
    window.__pairedTrace={top:[],bottom:[]};
    for(const [node,part] of [[top,'top'],[bottom,'bottom']]){
     const original=node.animate.bind(node);
     node.animate=(frames,options)=>{
      window.__pairedTrace[part].push({frames,options,at:performance.now()});
      return original(frames,options);
     };
    }
   });
   const read=()=>({
    state:window.__atlasCardDockMotion.getState(),
    top:{
     opacity:getComputedStyle(document.getElementById('fpTopSearch')).opacity,
     visibility:getComputedStyle(document.getElementById('fpTopSearch')).visibility,
     rect:document.getElementById('fpTopSearch').getBoundingClientRect().toJSON()
    },
    bottom:{
     opacity:getComputedStyle(document.getElementById('appDock')).opacity,
     visibility:getComputedStyle(document.getElementById('appDock')).visibility,
     rect:document.getElementById('appDock').getBoundingClientRect().toJSON()
    },
    traces:window.__pairedTrace
   });
   const initially=await page.evaluate(read);
   assert.equal(initially.state.active,false,'home starts with modal cover');
   await page.evaluate(()=>{
    const el=document.getElementById('drawer');
    el.classList.remove('fp30-hub');
    el.classList.add('fp30-detail','visible');
   });
   await wait(600);
   const opened=await page.evaluate(read);
   assert.equal(opened.state.reason,'collection','collection not registered by pair controller');
   assert.equal(opened.top.visibility,'hidden','top search not hidden when collection opened');
   assert.equal(opened.bottom.visibility,'hidden','bottom Dock not hidden when collection opened');
   assert.ok(opened.traces.top.some(x=>x.frames?.at(-1)?.translate==='0 -77px'),'missing search-up exit');
   assert.ok(opened.traces.bottom.some(x=>x.frames?.at(-1)?.transform?.includes('86px')),'missing bottom-down exit');
   await page.screenshot({path:out+'/paired-collection-'+width+'.png'});
   // Real close button: collection motor moves the card fully offscreen FIRST.
   await page.locator('#closeDrawer').click();
   await page.waitForFunction(()=>!document.getElementById('drawer').classList.contains('visible')&&
      window.__atlasCardDockMotion.getState().active===false,null,{timeout:4500});
   await wait(590);
   const returned=await page.evaluate(read);
   assert.equal(returned.top.visibility,'visible','top search failed to return');
   assert.equal(returned.bottom.visibility,'visible','bottom Dock failed to return');
   assert.equal(returned.state.top,'visible');
   assert.equal(returned.state.bottom,'visible');
   const topReturns=returned.traces.top.filter(x=>x.frames?.some(f=>f.translate==='0 6px'));
   const lowerReturns=returned.traces.bottom.filter(x=>x.frames?.some(f=>f.transform?.includes('-5px')));
   assert.equal(topReturns.length,1,'top search return should be one downward spring');
   assert.equal(lowerReturns.length,1,'bottom Dock return should be one upward spring');
   assert.ok(topReturns[0].at>=opened.traces.top.at(-1).at,'top reentry must occur after opening exit');
   await page.screenshot({path:out+'/paired-home-return-'+width+'.png'});
   // Existing cards all use the same shared gate; change only native state
   // classes here, without fake content, data persistence or extra controllers.
   const surfaces=['destination-selected','memory-open','fp-place-open'];
   const surfaceResults=[];
   for(const stateClass of surfaces){
    await page.evaluate(value=>document.body.classList.add(value),stateClass);
    await wait(460);
    const hidden=await page.evaluate(read);
    assert.ok(hidden.state.active,'card state '+stateClass+' did not hide Docks');
    assert.equal(hidden.top.visibility,'hidden','search stayed visible for '+stateClass);
    assert.equal(hidden.bottom.visibility,'hidden','Dock stayed visible for '+stateClass);
    await page.evaluate(value=>document.body.classList.remove(value),stateClass);
    await wait(600);
    const shown=await page.evaluate(read);
    assert.equal(shown.state.active,false,'card state '+stateClass+' stuck active');
    assert.equal(shown.top.visibility,'visible','search failed to return for '+stateClass);
    assert.equal(shown.bottom.visibility,'visible','Dock failed to return for '+stateClass);
    surfaceResults.push({card:stateClass,exit:true,pairedReturn:true});
   }
   const report={width,opened:{reason:opened.state.reason,top:opened.top.visibility,bottom:opened.bottom.visibility},
    restored:{top:returned.top.visibility,bottom:returned.bottom.visibility},
    topReturnFrames:topReturns[0].frames,bottomReturnFrames:lowerReturns[0].frames,
    surfaces:surfaceResults};
   results.push(report);
   await context.close();
  }
  fs.writeFileSync(out+'/paired-dock-report.json',JSON.stringify(results,null,2));
  console.log('PASS paired Dock movement on 375/390/430: card opens => search UP / Dock DOWN; card fully closes => search DOWN spring / Dock UP spring; collection, POI, memory and place gates');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL paired Dock acceptance: '+e.stack);process.exitCode=1});
