'use strict';
/* V4 .19: the user's 17-second Safari recording showed POI labels selecting a
 * destination but the card waiting 240ms and jumping into position while
 * the map unnecessarily zoomed. Test the REAL entry, not an orphan spring. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const {chromium}=require('playwright-core');
const bin=['google-chrome','google-chrome-stable','chromium'].map(x=>{try{return cp.execFileSync('which',[x],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!bin)throw Error('Chrome missing');
const url='https://fanbregas-netizen.github.io/travel-atlas-pages/v4-review-20261116/';
fs.mkdirSync('v4-current-pages-evidence',{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:bin,args:['--no-sandbox','--disable-dev-shm-usage']});
 const report=[];
 try{
 for(const width of [375,390,430]){
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
  const page=await ctx.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'index.html?v19=live-rebound-'+width,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__atlasDemo?.select&&!!window.FootprintElasticHandoff?.revealCard&&!!window.FootprintRubberSpring?.step&&!!window.FootprintV5Spring?.step&&!!window.__atlasSearchHistorySpring18,null,{timeout:22000});
  const first=await page.evaluate(async()=>{
    const initial=window.__atlasQA?.()?.zoom||null;
    window.__atlasDemo.select('中山公园',31.224361,121.456569);
    // A visible card within two animation frames, not after 240ms.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const card=document.getElementById('destinationCard');
    const mid={visible:card.classList.contains('visible'),elasticState:card.dataset.fpElasticState,
       y:card.style.translate,scale:card.style.scale,
       noNewZoom:Math.abs((window.__atlasQA?.()?.zoom||0)-(initial||0))<.02,
       before:initial,after:window.__atlasQA?.()?.zoom||null};
    return mid;
  });
  assert.equal(first.visible,true,'real POI card still has delayed reveal');
  assert.equal(first.elasticState,'entering','real POI card did not enter on C V5 motor');
  assert.match(first.y,/px/,'card has no physical translation during reveal');
  assert.match(first.scale,/ /,'card has no vertical elastic stretch');
  assert.equal(first.noNewZoom,true,'POI selection forcibly zoomed map despite user already zoomed');
  await page.waitForTimeout(920);
  const settled=await page.evaluate(()=>{
    const card=document.getElementById('destinationCard');
    return {visible:card.classList.contains('visible'),state:card.dataset.fpElasticState,translate:card.style.translate,scale:card.style.scale,overshoot:card.dataset.fpElasticOvershoot};
  });
  assert.ok(settled.visible&&settled.state==='idle'&&settled.translate===''&&settled.scale==='','card spring failed to settle');
  assert.equal(settled.overshoot,'1','card never physically overshot the rest position: animation is only an ease-in');
  const change=await page.evaluate(async()=>{
    window.__atlasDemo.select('古猗园',31.291361,121.479569);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const el=document.getElementById('destinationCard');
    return {visible:el.classList.contains('visible'),name:document.getElementById('destinationTitle').textContent,
       state:el.dataset.fpElasticState,translate:el.style.translate};
  });
  assert.equal(change.visible,true,'switching POIs blanked destination card again');
  assert.equal(change.name,'古猗园');
  assert.equal(change.state,'entering','POI-to-POI card continuity lacks elastic response');
  await page.waitForTimeout(850);
  await page.screenshot({path:'v4-current-pages-evidence/v19-real-poi-card-'+width+'.png',fullPage:false});
  await page.evaluate(()=>window.__atlasDemo.close());
  const closed=await page.evaluate(()=>{
    const el=document.getElementById('destinationCard');
    return {visible:el.classList.contains('visible'),trans:el.style.translate};
  });
  assert.equal(closed.visible,false,'close action regressed');
  assert.equal(closed.trans,'','POI card keeps stale spring transform after close');

  // Saved places must NOT play conflicting CSS fpCardIn on top of B05/V3.
  const cardAnim=await page.evaluate(()=>{
    const rule=[...document.styleSheets].find(s=>s.href?.includes('real-poi-card-spring-v19.css'));
    return {loaded:!!rule};
  });
  assert.equal(cardAnim.loaded,true,'new card collision stylesheet not deployed');

  await page.evaluate(()=>localStorage.setItem('fp-search-history-v1',JSON.stringify([{q:'中山公园',name:'中山公园'}])));
  await page.locator('#dockSearch').click({timeout:8000});
  await page.waitForSelector('#fpSearchSheet:not([hidden]) .fp-search-row',{timeout:7000});
  await page.waitForFunction(()=>{
    const e=document.getElementById('fpSearchSheet');
    return e?.dataset.fpElasticHistory==='cv5';
  },null,{timeout:4500});
  const history=await page.evaluate(()=>{
    const e=document.getElementById('fpSearchSheet');
    return {engine:e.dataset.fpElasticHistory,scale:e.style.scale,translate:e.style.translate};
  });
  assert.equal(history.engine,'cv5','search history did not enter the C V5 physical motor');
  await page.waitForTimeout(1100);
  const historyRest=await page.locator('#fpSearchSheet').evaluate(e=>({scale:e.style.scale,peak:Number(e.dataset.fpElasticHistoryPeak),settled:e.dataset.fpElasticHistorySettled}));
  assert.equal(historyRest.scale,'','history did not settle to default scale');
  assert.equal(historyRest.settled,'1','history motor did not complete');
  assert.ok(historyRest.peak>1.02,'history did not physically overshoot 1.02x: '+JSON.stringify(historyRest));
  await page.locator('#fpSearchActiveTop .fp-search-cancel').click();
  assert.deepEqual(errors,[],'browser JS failures');
  report.push({width,first,settled,change,closed,history});
  await ctx.close();
 }
 fs.writeFileSync('v4-current-pages-evidence/v19-real-handoff-report.json',JSON.stringify(report,null,2));
 console.log('PASS V4 .19 real POI selection -> C-V5 spring card, zero fixed delay, no forced zoom, same-card switch, real search history spring on 375/390/430',JSON.stringify(report));
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL REAL V4 .19 POI HANDOFF: '+e.stack);process.exitCode=1});
