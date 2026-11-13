'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const browserName=process.env.BROWSER||'chromium';
const url='https://fanbregas-netizen.github.io/travel-atlas-pages/v4-safari-sheet-transition-20261113/';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await ({chromium,webkit})[browserName].launch({headless:true,...(browserName==='chromium'?{args:['--no-sandbox']}:{})});
 const context=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1'
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForFunction(()=>window.__atlasSheetIntegration?.version==='B-V3-real-product',null,{timeout:25000});
 await page.waitForSelector('#appDock',{timeout:25000});
 const isolation=await page.evaluate(()=>({base:document.baseURI,namespace:window.__atlasPreviewNamespace}));
 assert.ok(isolation.base.endsWith('/v4-safari-sheet-transition-20261113/'),
  'preview inherited wrong base, silently loading old candidate: '+JSON.stringify(isolation));
 assert.equal(isolation.namespace,'fp-v4-safari-sheet-transition-20261113-','preview shares old candidate data');
 const patches=await page.evaluate(async()=>{
  const source=await Promise.all([
   './footprint-home.js','./src/interaction/physical-sheet.js',
   './src/interaction/home-dock-search-motion-v7.js','./v4-map-runtime.js'
  ].map(async file=>{const r=await fetch(file,{cache:'no-store'});if(!r.ok)throw Error(file+': '+r.status);return r.text()}));
  return {
   drawerGuard:source[0].includes("if($('drawer')?.classList.contains('visible'))"),
   dynamicViewport:source[1].includes("on(window.visualViewport,'resize',resettleForViewport"),
   dismissHook:source[2].includes('dismiss:onSearchDismiss'),
   drawerExit:source[3].includes("window.__fpCloseSearch?.();window.__fpRealSearchMotion?.cleanup?.()")
  };
 });
 assert.ok(Object.values(patches).every(Boolean),'Missing deployed patch '+JSON.stringify(patches));
 await page.locator('#dockSearch').click({timeout:20000});
 await page.waitForFunction(()=>document.body.classList.contains('fp-search-open'),null,{timeout:12000});
 await pause(1050);
 let state=await page.evaluate(()=>({
  focused:document.activeElement?.id,
  sheet:window.__atlasSheetIntegration?.search?.getState()?.sheet,
  height:document.getElementById('fpSearchSheet')?.getBoundingClientRect().height,
  map:!!document.querySelector('#atlasVectorMap')
 }));
 assert.equal(state.focused,'fpSearchField');
 assert.equal(state.sheet,'full');
 assert.ok(state.height>600,'full sheet not extended at 844px: '+state.height);
 await page.setViewportSize({width:390,height:570});
 await pause(1050);
 const smaller=await page.evaluate(()=>({
  sheet:window.__atlasSheetIntegration?.search?.getState()?.sheet,
  height:document.getElementById('fpSearchSheet')?.getBoundingClientRect().height
 }));
 assert.equal(smaller.sheet,'full','keyboard-like viewport shrink lost search state');
 assert.ok(smaller.height>=390&&smaller.height<state.height-45,'viewport spring failed to resettle: '+JSON.stringify({state,smaller}));
 await page.setViewportSize({width:390,height:844});
 await pause(1050);
 const expanded=await page.locator('#fpSearchSheet').boundingBox();
 assert.ok(expanded?.height>600,'sheet did not return to full viewport');
 // The map runtime must resolve the transition before opening B05, even
 // when switching during the shared-element flight.
 await page.evaluate(()=>document.getElementById('dockStars').click());
 await page.waitForFunction(()=>document.querySelector('#drawer')?.classList.contains('visible'),null,{timeout:12000});
 const collection=await page.evaluate(()=>({
  open:document.body.classList.contains('fp-search-open'),
  flight:document.body.classList.contains('fp-search-ux-flight'),
  drawer:document.querySelector('#drawer')?.classList.contains('visible')
 }));
 assert.ok(collection.drawer&&!collection.open&&!collection.flight,'search flight obscures collection '+JSON.stringify(collection));
 await page.locator('#closeDrawer').click({timeout:15000});
 await page.waitForFunction(()=>!document.querySelector('#drawer')?.classList.contains('visible'),null,{timeout:10000});
 await page.locator('#dockSearch').click({timeout:15000});
 await page.waitForFunction(()=>document.body.classList.contains('fp-search-open'),null,{timeout:10000});
 await page.locator('#fpSearchSheet .fp-search-close').click({timeout:15000});
 await page.waitForFunction(()=>!document.body.classList.contains('fp-search-open'),null,{timeout:10000});
 await pause(900);
 assert.equal(await page.evaluate(()=>document.body.classList.contains('fp-search-ux-flight')),false);
 assert.equal(errors.filter(x=>/TypeError|ReferenceError|SyntaxError|Uncaught/.test(x)).length,0,
  'browser runtime exceptions '+JSON.stringify(errors));
 console.log('PASS SAFARI_SHEET_HANDOFF '+browserName+' '+JSON.stringify({patches,state,smaller,collection,errors:errors.slice(0,4)}));
 await browser.close();
})().catch(e=>{console.error('FAIL SAFARI_SHEET_HANDOFF '+browserName+' '+e.stack);process.exit(1)});
