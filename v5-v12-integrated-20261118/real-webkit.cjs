'use strict';
/* Browser WebKit regression of ACTUAL V5 product with V12 visual and route
 * detail, not V12's old #rvParity prototype. Not physical iPhone Safari. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {webkit}=require('playwright');
const path='http://127.0.0.1:8765/v5-v12-unified-full-product-20261118/';
const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==';
(async()=>{
 const browser=await webkit.launch({headless:true});
 try{
  for(const width of [375,390]){
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   const id='v12-real-route-'+width,a='v12-a-'+width,b='v12-b-'+width;
   await page.goto(path+'index.html',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!!window.__atlasPlaceStore?.save&&!!window.FootprintMediaCore&&window.__atlasCardDockMotion?.version==='paired-v2',null,{timeout:35000});
   assert.equal(await page.locator('#fpPlaceCard').count(),1);
   assert.equal(await page.locator('#drawer').count(),1);
   const fixture=await page.evaluate(async({id,a,b,photo})=>{
    await window.__atlasPlaceStore.save({id:a,title:'V12 海边',lat:29.492,lng:121.905,starred:true,stage:'plan',note:'海风与沿岸建筑',photos:[{id:'alpha-image',src:photo}],guides:[{url:'https://example.org/architecture',title:'沿岸建筑资料'}]});
    await window.__atlasPlaceStore.save({id:b,title:'V12 古镇',lat:29.496,lng:121.910,starred:true,stage:'plan',note:'旧街屋檐',photos:[]});
    const repo=FootprintMediaCore.createRepository(indexedDB);
    await repo.saveRoute({id,title:'V12 视觉巡游',startDate:'2026-11-20',endDate:'2026-11-21',stops:[{placeId:a,order:1,day:1},{placeId:b,order:2,day:1}],placeIds:[a,b]});
    return (await repo.listRoutes()).find(x=>x.id===id)?.id;
   },{id,a,b,photo});
   assert.equal(fixture,id);
   await page.goto(path+'journey.html?saved='+encodeURIComponent(id),{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.__footprintV5ProductReady===true&&window.__fpV12RouteDetail?.version==='V12-shared-placeId'&&window.__footprintV5Demo?.state().step==='view',null,{timeout:55000});
   await page.waitForSelector('#pins [data-pin]',{timeout:20000});
   const before=await page.evaluate(()=>{const r=document.getElementById('atlasMap').getBoundingClientRect();return {w:r.width,h:r.height}});
   await page.locator('#pins [data-pin="'+a+'"]').dispatchEvent('click');
   await page.waitForFunction(()=>document.getElementById('v12-place-bubble')?.dataset.placeId===document.querySelector('#pins [data-pin]')?.dataset.pin || !document.getElementById('v12-place-bubble')?.hidden,null,{timeout:11000});
   assert.equal(await page.locator('#v12-place-bubble').getAttribute('data-place-id'),a);
   await page.locator('#v12-place-bubble').dispatchEvent('click');
   await page.waitForFunction(()=>document.querySelector('.v12-route-sections[data-place-id="'+arguments[0]+'"]'),a,{timeout:25000});
   const card=page.locator('.v12-route-sections');
   assert.equal(await card.locator('.fp-block').count(),4);
   const titles=await card.locator('.fp-section-label').allTextContents();
   assert.deepEqual(titles,['为什么想去','照片与视频','相关资料','附近地点']);
   assert.ok((await card.textContent()).includes('海风与沿岸建筑'));
   assert.equal(await card.locator('.v12-media-tile').count(),1);
   assert.ok((await card.textContent()).includes('沿岸建筑资料'));
   assert.ok((await card.textContent()).includes('V12 古镇'));
   assert.equal(await page.locator('#rvParity').count(),0,'old duplicate V12 prototype must not exist');
   assert.equal(await page.locator('#v12-place-bubble').count(),1,'one bubble only');
   const rect=await page.evaluate(()=>{const r=document.getElementById('atlasMap').getBoundingClientRect();return {w:r.width,h:r.height}});
   assert.equal(rect.w,before.w);assert.equal(rect.h,before.h);
   await card.locator('[data-v12-action=edit-brief]').click();
   const editor=card.locator('.v12-editor');
   assert.equal(await editor.locator('textarea').evaluate(e=>getComputedStyle(e).fontSize),'16px');
   await editor.locator('textarea').fill('V12 路线同步保存的真实 Brief');
   await editor.locator('[data-v12-action=save-brief]').click();
   await page.waitForFunction(text=>document.querySelector('.v12-route-sections')?.textContent?.includes(text),'V12 路线同步保存的真实 Brief',{timeout:15000});
   const got=await page.evaluate(async id=>FootprintMediaCore.createRepository(indexedDB).read(id),a);
   assert.equal(got.note,'V12 路线同步保存的真实 Brief');
   await card.locator('[data-v12-action=edit-link]').click();
   await card.locator('.v12-editor textarea').fill('https://example.org/new-v12-source');
   await card.locator('.v12-editor input').fill('新资料');
   await card.locator('[data-v12-action=save-link]').click();
   await page.waitForFunction(()=>document.querySelector('.v12-route-sections')?.textContent?.includes('新资料'),null,{timeout:12000});
   const saved=await page.evaluate(async id=>FootprintMediaCore.createRepository(indexedDB).read(id),a);
   assert.ok(saved.guides.some(g=>g.title==='新资料'));
   fs.mkdirSync('v12-full-product-webkit-evidence',{recursive:true});
   await page.screenshot({path:'v12-full-product-webkit-evidence/'+width+'-route-shared-detail.png'});
   await page.locator('[data-action=close-detail]').click();
   await page.waitForFunction(()=>window.__fpV12RouteDetail?.getState().open===false,null,{timeout:11000});
   assert.equal(await page.locator('.v12-route-sections').count(),0);
   await page.locator('#pins [data-pin="'+b+'"]').dispatchEvent('click');
   await page.locator('#v12-place-bubble').dispatchEvent('click');
   await page.waitForFunction(id=>document.querySelector('.v12-route-sections')?.dataset.placeId===id,b,{timeout:14000});
   assert.ok((await page.locator('.v12-route-sections').textContent()).includes('旧街屋檐'));
   assert.ok(!(await page.locator('.v12-route-sections').textContent()).includes('新资料'));
   assert.deepEqual(errors.filter(e=>/ReferenceError|SyntaxError|TypeError/.test(e)),[]);
   await context.close();
   console.log('PASS WebKit '+width+'px: V12 real V5 bubble, four sections, shared placeId, Brief/links write-back, no duplicate sheet');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
