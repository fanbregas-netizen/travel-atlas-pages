
'use strict';
/* Real DOM Chromium iPhone-size review for isolated route-logic page.
 * No demo data are persisted. The page itself loads the approved real route
 * viewer with its fixed synthetic acceptance dataset, not IndexedDB. */
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const base=process.env.INTERACTION_REVIEW_BASE_URL||'https://fanbregas-netizen.github.io/travel-atlas-pages/v4-interaction-system-review-20261117/';
const executablePath=['google-chrome','google-chrome-stable','chromium'].map(n=>{try{return cp.execFileSync('which',[n],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!executablePath)throw Error('Chromium browser unavailable');
fs.mkdirSync('interaction-motion-evidence',{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
  const page=await ctx.newPage();
  page.setDefaultTimeout(30000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'route-logic-review-20261117.html?review-browser=1',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__fpRouteLogicUI?.getState&&!!window.__atlasRV?.places?.length,null,{timeout:40000});
  assert.equal(await page.locator('#stopsDock #fpRouteTools').count(),1,'review must reuse existing route Dock');
  let st=await page.evaluate(()=>window.__fpRouteLogicUI.getState());
  assert.equal(st.order.length,6);
  const firstId=st.order[0];
  await page.waitForTimeout(1300); // let genuine map tiles paint before visual QA
  await page.screenshot({path:'interaction-motion-evidence/route-logic-initial.png'});
  await page.locator('#fpRouteTools [data-open="order"]').click();
  await page.locator('#fpRoutePanel [data-action="recommend"]').click();
  assert.equal(await page.locator('#fpRoutePanel [data-action="apply"]').count(),1);
  const comparison=await page.locator('#fpRoutePanel .fp-r-metric').innerText();
  assert.ok(comparison.includes('当前顺序')&&comparison.includes('推荐顺序'));
  await page.locator('#fpRoutePanel [data-action="apply"]').click();
  st=await page.evaluate(()=>window.__fpRouteLogicUI.getState());
  assert.notEqual(st.order[0],firstId,'recommendation should reorder this intentionally tangled scenario');
  assert.equal(st.order[0],await page.evaluate(()=>window.__atlasRV.places[0].id),'map stop order should mirror planner');
  await page.locator('#fpRoutePanel [data-action="undo"]').click();
  assert.equal((await page.evaluate(()=>window.__fpRouteLogicUI.getState())).order[0],firstId,'undo should restore order');
  await page.locator('#fpRoutePanel [data-tab="pick"]').click();
  await page.locator('#fpRoutePanel [data-pick="rd_7_jiangxin"]').click();
  st=await page.evaluate(()=>window.__fpRouteLogicUI.getState());
  assert.equal(st.order.length,7,'adding an optional point should update the route');
  assert.equal(await page.evaluate(()=>window.__atlasRV.places.length),7,'route map should gain the optional point');
  await page.locator('#fpRoutePanel [data-tab="mode"]').click();
  await page.locator('#fpRoutePanel [data-mode="bike"]').click();
  assert.equal((await page.evaluate(()=>window.__fpRouteLogicUI.getState())).mode,'bike');
  await page.locator('#fpRoutePanel [data-leg]').first().selectOption('walk');
  assert.equal(await page.evaluate(()=>window.__fpRouteHasNonDrivingLegs),true,'mixed leg selection should force non-navigation display');
  await page.locator('#fpRoutePanel [data-tab="setup"]').click();
  await page.locator('#fpRoutePanel [data-setting="to"]').selectOption('same');
  assert.equal((await page.evaluate(()=>window.__fpRouteLogicUI.getState())).destination,'返回起点');
  const originPins=await page.locator('#fpRouteStartPin, #fpRouteEndPin').count();
  assert.equal(originPins,2,'both endpoint anchors must exist');
  await page.screenshot({path:'interaction-motion-evidence/route-logic-settings.png'});
  await page.locator('#fpRoutePanel [data-close-panel]').click();
  await page.evaluate(()=>document.querySelector('.route-pin')?.click());
  await page.waitForFunction(()=>document.body.classList.contains('fp-route-place-open'),null,{timeout:15000});
  assert.ok((await page.locator('#fpRouteCardTitle').innerText()).length>1,'route pin should open the unified location card');
  assert.equal(await page.locator('#stopBubble:visible').count(),0,'legacy route callout must stay hidden');
  await page.screenshot({path:'interaction-motion-evidence/route-logic-card.png'});
  await page.locator('#fpRouteCard [data-card-close]').click();
  assert.equal(await page.locator('body.fp-route-place-open').count(),0,'card close should restore route UI');
  assert.equal(await page.locator('#stopsDock #fpRouteTools').count(),1,'there must still be one route Dock after card dismissal');
  fs.writeFileSync('interaction-motion-evidence/route-logic-qa.json',JSON.stringify({checks:16,initialStops:6,addedStops:7,recommendation:'applied and undone',modes:'bike and walking leg',card:'opens and closes',pageErrors:errors},null,2));
  assert.ok(!errors.some(e=>/route-logic-review-v1|Uncaught TypeError/i.test(e)),'preview runtime error: '+errors.join('; '));
  console.log('PASS: iPhone 390x844 route planner -- real map page, single Dock, route order, modes, endpoint, detail');
  await ctx.close();
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL route-logic review:',e.stack||e);process.exit(1)});
