'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{webkit}=require('playwright');
const width=Number(process.env.WIDTH)||390;
(async()=>{
 const browser=await webkit.launch({headless:true});
 const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(22000);page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765/v5-unified-full-product-20261118/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__atlasCollectionSheet?.getState?.()?.release==='Safari exit v2'&&window.__atlasCardDockMotion?.version==='paired-v2',null,{timeout:30000});
  assert.equal(await page.locator('#dockRoutePop').count(),0);
  assert.equal(await page.locator('#drawer').getAttribute('data-physical-b05'),'cv5');
  for(let i=0;i<3;i++){
   await page.locator('#dockStars').click();
   await page.waitForFunction(()=>document.getElementById('drawer')?.classList.contains('visible'));
   await page.waitForFunction(()=>window.__atlasCardDockMotion?.getState().bottom==='hidden');
   await page.waitForTimeout(330);
   const open=await page.evaluate(()=>({
    opacity:+getComputedStyle(document.getElementById('cover')).opacity,
    display:getComputedStyle(document.getElementById('cover')).display,
    height:window.__atlasCollectionSheet.getState().height,
    top:window.__atlasCardDockMotion.getState().top
   }));
   assert.equal(open.display,'block');
   assert.ok(open.opacity>.2,'map overlay did not fade in on WebKit');
   assert.ok(open.height>150,'card has no physical height');
   assert.equal(open.top,'hidden');
   if(i===1)await page.locator('#cover').dispatchEvent('click');
   else await page.locator('#closeDrawer').click();
   await page.waitForFunction(()=>!document.getElementById('drawer')?.classList.contains('visible'),null,{timeout:15000});
   await page.waitForFunction(()=>window.__atlasCardDockMotion?.getState().top==='visible'&&window.__atlasCardDockMotion?.getState().bottom==='visible',null,{timeout:15000});
   await page.waitForTimeout(480);
   const closed=await page.evaluate(()=>({
    opacity:+getComputedStyle(document.getElementById('cover')).opacity,
    closing:window.__atlasCollectionSheet.getState().closing,
    top:window.__atlasCardDockMotion.getState().top,
    bottom:window.__atlasCardDockMotion.getState().bottom
   }));
   assert.ok(closed.opacity<.04,'map overlay stuck or flashing after close');
   assert.equal(closed.closing,false,'collection exit left in closing state');
   assert.equal(closed.top,'visible');
   assert.equal(closed.bottom,'visible');
  }
  fs.mkdirSync('webkit-collection-v2-evidence',{recursive:true});
  await page.screenshot({path:'webkit-collection-v2-evidence/'+width+'-dock-restored.png'});
  await page.locator('#dockRoute').click();
  await page.waitForURL(/\/journey\.html(?:\?|$)/);
  assert.deepEqual(errors.filter(x=>/SyntaxError|ReferenceError|TypeError/.test(x)),[]);
  console.log('PASS WebKit '+width+'px: 3x collection close, overlay fade, paired Docks, V5 route navigation');
 }catch(e){await page.screenshot({path:'webkit-collection-v2-evidence/'+width+'-failure.png'}).catch(()=>{});console.error('PAGE ERRORS',errors);throw e}
 finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});