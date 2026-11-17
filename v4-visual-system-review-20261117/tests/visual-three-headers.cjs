'use strict';
/* Actual public GitHub Pages live V8 + iPhone-size Chromium screenshots.
 * Read only: never modifies repository product or end-user storage. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const {chromium}=require('playwright-core');
const binary=['google-chrome','google-chrome-stable','chromium'].map(x=>{try{return cp.execFileSync('which',[x],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!binary)throw new Error('Chrome not installed on QA runner');
const base='https://fanbregas-netizen.github.io/travel-atlas-pages/v4-visual-system-review-20261117/';
const output='visual-review-live-evidence';
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:binary,args:['--no-sandbox','--disable-dev-shm-usage']});
 const evidence={source:'public GitHub Pages, not local files',url:base,viewport:{width:390,height:844},results:[],pageErrors:[]};
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
 const page=await context.newPage();
 page.on('pageerror',e=>{evidence.pageErrors.push(String(e.message).slice(0,250))});
 try{
  let resp=await page.goto(base+'index.html?visual=after&qa=render9',{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(resp?.status(),200,'main preview HTTP');
  await page.waitForFunction(()=>!!window.__atlasPlaceStore?.save&&!!window.__atlasDemo?.openSaved,null,{timeout:25000});
  await page.evaluate(async()=>{
   const id='visual-review-synthetic-place';
   await window.__atlasPlaceStore.save({id,title:'江宁路街道',address:'上海市静安区江宁路街道',lat:31.224361,lng:121.456569,starred:true,stage:'plan',rank:2,note:'验收卡片眉头及真实内容',photos:[],videos:[],guides:[],references:[]});
   // Saved places are mirrored in the LIVE map runtime, not automatically
   // appended by the repository API. Match the approved V18 E2E sequence.
   await window.__atlasSetBookmarkStarred(id,false);
   await window.__atlasSetBookmarkStarred(id,true);
   if(!window.__atlasDemo.getSaved().some(p=>String(p.id)===id))throw Error('Seeded place not synchronized into map runtime');
   window.__atlasDemo.openSaved(id);
  });
  await page.waitForSelector('#fpPlaceCard:not([hidden]) .atlas-card-grip',{timeout:12000});
  await page.waitForTimeout(650);
  const place=await page.evaluate(()=>{
   const e=document.querySelector('#fpPlaceCard'),grab=e.querySelector('.atlas-card-grip'),old=e.querySelector(':scope > .sheet-grab'),header=e.querySelector('.fp-card-header'),title=e.querySelector('.fp-card-name'),close=e.querySelector('.fp-card-close');
   const box=x=>{if(!x)return null;const r=x.getBoundingClientRect();return {top:Math.round(r.top),left:Math.round(r.left),width:Math.round(r.width),height:Math.round(r.height)}};
   const eb=box(e),gb=box(grab),hb=box(header),titleBox=box(title),stage=box(e.querySelector('.fp-place-stage'));
   return {visible:!e.hidden,oldGripDisplay:old?getComputedStyle(old).display:'absent',actualGrab:gb,decorativeGrip:box(old),card:eb,title:titleBox,stage,close:box(close),header:hb,gripCenterOffset:Math.round((gb.left+gb.width/2)-(eb.left+eb.width/2)),headerHeight:hb.height,stageToTitleGap:stage?stage.top-(titleBox.top+titleBox.height):null};
  });
  evidence.results.push({card:'place',...place});
  await page.screenshot({path:output+'/place.png',fullPage:false});
  assert.equal(place.oldGripDisplay,'none','duplicate old decorative grip must be hidden');
  assert.ok(place.actualGrab&&place.actualGrab.width>=40,'actual bound grip must remain');
  assert.ok(Math.abs(place.gripCenterOffset)<=1,'interactive grip not centered within entire card: '+place.gripCenterOffset);
  assert.ok(place.headerHeight<=146,'place card header has huge whitespace height '+place.headerHeight);
  assert.ok(place.stageToTitleGap<58,'place status row incorrectly pushed far below title: '+place.stageToTitleGap);
  await page.evaluate(()=>document.querySelector('#fpPlaceCard .fp-card-close')?.click());
  await page.waitForTimeout(1100);
  await page.evaluate(()=>document.getElementById('dockStars')?.click());
  await page.waitForSelector('#drawer.visible .drawer-head',{timeout:10000});
  await page.waitForTimeout(500);
  const favorite=await page.evaluate(()=>{
   const e=document.querySelector('#drawer'),g=e.querySelector('.drawer-head .sheet-grab'),h=e.querySelector('.drawer-head h2'),c=e.querySelector('#closeDrawer');
   const box=x=>{const r=x.getBoundingClientRect();return {top:Math.round(r.top),left:Math.round(r.left),width:Math.round(r.width),height:Math.round(r.height)}};
   return {visible:e.classList.contains('visible'),grab:box(g),title:box(h),close:box(c),count:e.querySelector('#sheetCount')?.textContent};
  });
  evidence.results.push({card:'favorites',...favorite});
  await page.screenshot({path:output+'/favorites.png',fullPage:false});
  assert.ok(favorite.visible,'collection visible');
  resp=await page.goto(base+'journey.html?visual=after&qa=render9',{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(resp?.status(),200,'route preview HTTP');
  await page.waitForFunction(()=>window.__atlasRouteV5Live?.ready===true&&!!document.getElementById('rc-main'),null,{timeout:30000});
  await page.waitForTimeout(750);
  const route=await page.evaluate(()=>{
   const e=document.querySelector('#rc-main'),g=document.querySelector('#rc-grab .rc-handle'),h=document.querySelector('#rc-title'),c=document.querySelector('#rc-grab .rc-dismiss');
   const box=x=>{const r=x.getBoundingClientRect();return {top:Math.round(r.top),left:Math.round(r.left),width:Math.round(r.width),height:Math.round(r.height)}};
   return {visible:!!e&&getComputedStyle(e).display!=='none',grab:box(g),title:box(h),close:box(c),titleText:h.textContent,ready:window.__atlasRouteV5Live.ready};
  });
  evidence.results.push({card:'route',...route});
  await page.screenshot({path:output+'/route.png',fullPage:false});
  for(const card of ['place','favorites','route'])assert.ok(fs.statSync(output+'/'+card+'.png').size>10000,card+' screenshot missing');
  fs.writeFileSync(output+'/metrics.json',JSON.stringify(evidence,null,2));
  console.log('PASS PUBLIC CHROME RENDERED: '+JSON.stringify(evidence.results));
  console.log('CAPTURED '+fs.readdirSync(output).join(', '));
 }catch(e){
  fs.writeFileSync(output+'/metrics.json',JSON.stringify({...evidence,error:String(e.stack||e)},null,2));
  await page.screenshot({path:output+'/failure.png',fullPage:false}).catch(()=>{});
  console.error('PUBLIC VISUAL RENDER FAIL: '+String(e.stack||e));
  process.exitCode=1;
 }finally{await context.close();await browser.close()}
})();