'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const url='https://fanbregas-netizen.github.io/travel-atlas-pages/v4-iphone-fluidity-20261113/';
const which=process.env.BROWSER||'chromium';
async function drag(page,selector,dy){
 const loc=page.locator(selector).first(),b=await loc.boundingBox();
 assert.ok(b,'gesture source missing '+selector);
 const x=b.x+b.width*.49,y=b.y+Math.min(25,b.height*.38);
 await page.mouse.move(x,y);await page.mouse.down();
 for(let i=1;i<=12;i++){await page.mouse.move(x,y+dy*i/12,{steps:1});await wait(15)}
 await page.mouse.up();await wait(1050);
}
(async()=>{
 const browser=await ({chromium,webkit})[which].launch({headless:true,...(which==='chromium'?{args:['--no-sandbox']}:{})});
 const ctx=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1'
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForSelector('#appDock',{timeout:35000});
 await wait(4600);
 let startup=await page.evaluate(()=>{
  const map=document.querySelector('#atlasVectorMap canvas'),r=map?.getBoundingClientRect();
  return {
   stable:window.__atlasStableMapEnabled,
   namespace:window.__atlasPreviewNamespace,
   orbitElement:!!document.getElementById('atlasOrbit'),
   oldOrbitScript:!!document.querySelector('[data-inline="atlas-orbit.js"]'),
   oldOrbitCSS:!!document.querySelector('[data-inline="atlas-orbit.css"]'),
   mapHealth:window.__atlasMapHealth?.(),
   vectorActive:document.body.classList.contains('vector-active'),
   canvasRatio:r?.width>0?Number((map.width/r.width).toFixed(2)):null,
   canvasSize:map?{width:map.width,height:map.height}:null,
   originalDock:!!document.querySelector('#appDock .dock-btn'),
   expectedRestored:window.__atlasSheetIntegration?.version,
   originalStar:!!document.getElementById('dockStars'),
   originalIcon:!!document.querySelector('#appDock img'),
   text:document.title
  }
 });
 console.log('FLUIDITY_STARTUP '+which+' '+JSON.stringify(startup));
 assert.ok(startup.originalDock&&startup.originalStar&&startup.originalIcon,'original Dock and artwork missing');
 assert.ok(startup.stable,'Mobile low-power path not enabled');
 assert.equal(startup.orbitElement,false,'retired four-way constellation mounted');
 assert.equal(startup.oldOrbitScript,false);
 assert.equal(startup.oldOrbitCSS,false);
 assert.ok(startup.namespace?.startsWith('fp-v4-fluidity-'),'isolated storage prefix missing');
 if(startup.canvasRatio!==null){
  assert.ok(startup.canvasRatio<=2.06,'iPhone vector backing unexpectedly >2x: '+startup.canvasRatio);
  assert.ok(startup.canvasRatio>=1,'Map image must be nonzero');
 }
 await page.locator('#dockSearch').click({timeout:18000});
 await page.waitForFunction(()=>document.body.classList.contains('fp-search-open'),null,{timeout:10000});
 await wait(900);
 const opened=await page.evaluate(()=>({
  focused:document.activeElement?.id,
  level:window.__atlasSheetIntegration?.search?.getState()?.sheet,
  height:document.getElementById('fpSearchSheet')?.getBoundingClientRect().height,
  hidden:document.getElementById('fpSearchSheet')?.hidden
 }));
 console.log('FLUIDITY_SEARCH_OPEN '+which+' '+JSON.stringify(opened));
 assert.equal(opened.focused,'fpSearchField','actual search input not focused');
 assert.ok(!opened.hidden&&opened.level==='full','real search sheet did not fully open');
 await drag(page,'#fpSearchSheet .fp-search-top',130);
 let down=await page.evaluate(()=>({level:window.__atlasSheetIntegration?.search?.getState()?.sheet,height:document.getElementById('fpSearchSheet')?.getBoundingClientRect().height}));
 console.log('FLUIDITY_SEARCH_DRAG '+which+' '+JSON.stringify(down));
 assert.ok(down.height<opened.height-30,'search card did not move downward');
 await page.locator('#fpSearchSheet .fp-search-close').click({timeout:16000});
 await page.waitForFunction(()=>!document.body.classList.contains('fp-search-open'),null,{timeout:12000});
 await page.locator('#dockStars').click({timeout:12000});
 await page.waitForFunction(()=>document.querySelector('#drawer')?.classList.contains('visible'),null,{timeout:12000});
 const saved=await page.evaluate(()=>({visible:document.querySelector('#drawer')?.classList.contains('visible'),physical:window.__atlasCollectionSheet?.getState()?.level,tabs:!!document.getElementById('fpvCollectionTabs')}));
 console.log('FLUIDITY_SAVED '+which+' '+JSON.stringify(saved));
 assert.ok(saved.visible&&saved.tabs&&saved.physical,'real B05 collection lost');
 await page.locator('#fpvRoutesTab').click({timeout:15000});
 await wait(280);
 assert.equal(await page.locator('#fpvCollectionTabs').getAttribute('data-active'),'routes');
 const bad=errors.filter(e=>/TypeError|ReferenceError|SyntaxError|Uncaught/.test(e));
 console.log('FLUIDITY_RUNTIME '+which+' '+JSON.stringify({errors:bad,otherErrors:errors.slice(0,8)}));
 assert.equal(bad.length,0,'real product exception');
 await browser.close();
 console.log('PASS FLUIDITY_BROWSER '+which);
})().catch(e=>{console.error('FAIL FLUIDITY_BROWSER '+which+' '+e.stack);process.exit(1)});
