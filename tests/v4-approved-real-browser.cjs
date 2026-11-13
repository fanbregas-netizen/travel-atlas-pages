'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const page=await ctx.newPage();
 const errors=[],warn=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 page.on('console',m=>{if(m.type()==='error')warn.push(m.text().slice(0,160))});
 const url='https://fanbregas-netizen.github.io/travel-atlas-pages/v4-approved-ux-real-review-20261113/';
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
 await page.waitForSelector('#appDock',{timeout:20000});
 await page.waitForTimeout(2000);
 const initial=await page.evaluate(()=>({
  originalDock:!!document.querySelector('#appDock .dock-btn'),
  originalStars:!!document.querySelector('#dockStars'),
  v7:window.__fpRealSearchMotion?.version||null,
  tactile:document.getElementById('appDock')?.dataset.approvedDockMotion,
  isolated:window.__atlasPreviewNamespace,
  title:document.title,
  starCount:document.querySelectorAll('#atlasBookmarkOverlay .atlas-bookmark-hit').length,
  b3:window.__atlasSheetIntegration?.version,
  collection:document.querySelector('#drawer')?.dataset.physicalB05,
  searchInput:!!document.querySelector('#fpSearchField')
 }));
 console.log('INITIAL',JSON.stringify(initial));
 assert.ok(initial.originalDock&&initial.originalStars&&initial.tactile,'Original Dock or approved tactile motion missing');
 assert.ok(initial.v7===7,'Interaction B original V7 real search morph missing');
 assert.ok(initial.isolated?.includes('approved-real'),'Private saved-place namespace not isolated');
 assert.ok(initial.searchInput,'Existing actual search field missing');
 await page.locator('#dockSearch').click({timeout:10000});
 await page.waitForTimeout(1200);
 const after=await page.evaluate(()=>({
  searchOpen:document.body.classList.contains('fp-search-open'),
  searchHidden:document.getElementById('fpSearchSheet')?.hidden,
  state:window.__atlasSheetIntegration?.search?.getState()?.sheet,
  motion:window.__atlasSheetIntegration?.searchMotion?.state()?.sheet,
  inputFocused:document.activeElement?.id==='fpSearchField',
  mapDock:document.getElementById('appDock')?.getBoundingClientRect().width
 }));
 console.log('SEARCH_OPEN',JSON.stringify(after));
 assert.ok(after.searchOpen,'Real Dock click failed to open search');
 assert.equal(after.searchHidden,false,'Real search sheet is hidden after open');
 assert.ok(['full','half','peek'].includes(after.state),'Real search sheet controller not engaged');
 // Close by the real product button and require that no ghost panel remains.
 const close=page.locator('#fpSearchSheet .fp-search-close').first();
 await close.click({timeout:10000});
 await page.waitForTimeout(1300);
 const afterClose=await page.evaluate(()=>({open:document.body.classList.contains('fp-search-open'),hidden:document.getElementById('fpSearchSheet')?.hidden,state:window.__atlasSheetIntegration?.search?.getState()?.sheet}));
 console.log('SEARCH_CLOSE',JSON.stringify(afterClose));
 assert.ok(!afterClose.open,'Search open class survived closing');
 await page.locator('#dockStars').click({timeout:10000});
 await page.waitForTimeout(450);
 const saved=await page.evaluate(()=>({visible:document.querySelector('#drawer')?.classList.contains('visible'),tabs:!!document.getElementById('fpvCollectionTabs'),physical:window.__atlasCollectionSheet?.getState?.()}));
 console.log('COLLECTION',JSON.stringify(saved));
 assert.ok(saved.visible&&saved.tabs,'Real B05 collection did not open');
 assert.ok(saved.physical?.level,'Physical B05 collection not mounted');
 await page.locator('#fpvRoutesTab').click({timeout:10000});
 const routes=await page.evaluate(()=>document.getElementById('fpvCollectionTabs')?.dataset.active);
 console.log('TABS',routes);assert.equal(routes,'routes');
 // Do not assert on external map availability or make writes to actual data.
 console.log('PAGE_ERRORS',JSON.stringify(errors));console.log('CONSOLE_ERRORS',JSON.stringify(warn.slice(0,7)));
 assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError|SyntaxError/.test(x)),[],'Actual product runtime JS errors');
 await browser.close();
 console.log('PASS real V4 Dock→search→close→B05 collection transitions with original data hooks');
})().catch(e=>{console.error('FAIL real V4 review: '+e.stack);process.exit(1)});

// Repeat after 2026-11-13 V4 low-jank geometry and inactive-RAF fix.
