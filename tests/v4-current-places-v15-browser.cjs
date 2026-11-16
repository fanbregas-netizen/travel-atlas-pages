'use strict';
/* Real isolated iPhone browser state test: all writes are inside a throwaway
 * Playwright context, NEVER in anyone's Safari or the production site. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const {chromium}=require('playwright-core');
const root='https://fanbregas-netizen.github.io/travel-atlas-pages/v4-review-20261116/';
const browserPath=['google-chrome','google-chrome-stable','chromium'].map(x=>{try{return cp.execFileSync('which',[x],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!browserPath)throw Error('Chromium not installed');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  const response=await page.goto(root+'index.html?acceptance-v15=1',{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response?.status(),200);
  await page.waitForFunction(()=>!!window.__atlasPlaceStore?.save && !!window.__atlasSetBookmarkStarred && !!window.__atlasSetPlaceStage && !!window.FootprintMediaCore && !!window.__atlasDemo?.openSaved,null,{timeout:20000});
  const proof=await page.evaluate(async()=>{
   const id='v15-isolated-acceptance-place';
   const store=window.__atlasPlaceStore;
   const base={id,title:'验收地点',lat:31.224361,lng:121.456569,starred:true,stage:'plan',date:'',rank:2,note:'演示文字',photos:[],videos:[],guides:[],references:[]};
   await store.save(base);
   const before=(await store.readAll()).find(x=>x.id===id);
   await window.__atlasSetBookmarkStarred(id,false);
   const empty=(await store.readAll()).find(x=>x.id===id);
   await window.__atlasSetPlaceStage(id,'visited');
   const visited=(await store.readAll()).find(x=>x.id===id);
   await window.__atlasSetBookmarkStarred(id,true);
   const restored=(await store.readAll()).find(x=>x.id===id);
   const parsed=window.FootprintGuideLinks.parse('公园路线 https://xhslink.com/accepted15 复制此条信息');
   await window.FootprintMediaCore.createRepository(window.indexedDB).saveGuide(id,{
    url:parsed.url,title:parsed.title,source:parsed.source,originalText:parsed.originalText
   });
   const after=await window.FootprintMediaCore.createRepository(window.indexedDB).read(id);
   return {
    id,initial:before?.starred,
    empty:empty?.starred,noteKept:empty?.note,
    stage:visited?.stage,restored:restored?.starred,
    guide:after?.guides?.find(x=>x.url===parsed.url),
    mediaKept:Array.isArray(after?.photos)&&Array.isArray(after?.videos)
   };
  });
  assert.equal(proof.initial,true);
  assert.equal(proof.empty,false,'star did not unbookmark');
  assert.equal(proof.noteKept,'演示文字','unstar destroyed saved Brief');
  assert.equal(proof.stage,'visited','optional stage not persisted');
  assert.equal(proof.restored,true,'star cannot restore original record');
  assert.equal(proof.guide?.source,'小红书','guide source not persisted');
  assert.match(proof.guide?.originalText||'',/复制此条信息/,'share text not preserved');
  assert.equal(proof.mediaKept,true);
  await page.evaluate(id=>window.__atlasDemo.openSaved(id),proof.id);
  await page.waitForSelector('#fpPlaceCard:not([hidden]) .fp-star-toggle',{timeout:15000});
  const card=await page.evaluate(()=>{
   const header=document.querySelector('#fpPlaceCard .fp-card-header');
   const star=header?.querySelector('.fp-star-toggle');
   const nav=header?.querySelector('.fp-place-navigation');
   const close=header?.querySelector('.fp-card-close');
   const guide= document.querySelector('#fpPlaceCard .fp-guide-open');
   return {title:header?.querySelector('.fp-card-name')?.textContent,
     star:star?.getAttribute('aria-pressed'),nav:!!nav,close:!!close,
     navAdjacent:star?.parentElement===nav?.parentElement,guideHref:guide?.href,
     masterEdit:!!header?.querySelector('.fp-edit-toggle')};
  });
  assert.equal(card.title,'验收地点');
  assert.equal(card.star,'true');
  assert.ok(card.nav&&card.close&&card.navAdjacent&&!card.masterEdit,'header action hierarchy wrong');
  assert.match(card.guideHref||'',/xhslink.com\/accepted15/);
  await page.locator('#fpPlaceCard .fp-star-toggle').click({timeout:6000});
  await page.waitForFunction(()=>document.querySelector('#fpPlaceCard .fp-star-toggle')?.getAttribute('aria-pressed')==='false',null,{timeout:10000});
  await page.locator('#fpPlaceCard .fp-star-toggle').click({timeout:6000});
  await page.waitForFunction(()=>document.querySelector('#fpPlaceCard .fp-star-toggle')?.getAttribute('aria-pressed')==='true',null,{timeout:10000});
  const style=await page.evaluate(()=>{
   const header=document.querySelector('#fpPlaceCard .fp-card-header');
   const nav=header.querySelector('.fp-place-navigation').getBoundingClientRect();
   const star=header.querySelector('.fp-star-toggle').getBoundingClientRect();
   const title=header.querySelector('.fp-card-name').getBoundingClientRect();
   const close=header.querySelector('.fp-card-close').getBoundingClientRect();
   return {navW:nav.width,starW:star.width,sameRow:Math.abs(nav.top-star.top)<4,closeTop:close.top,titleTop:title.top,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert.ok(Math.abs(style.navW-style.starW)<=2,'star/nav icon geometry inconsistent: '+JSON.stringify(style));
  assert.ok(style.sameRow&&style.closeTop<style.navW+titleTop,'card header lacks expected two-row hierarchy');
  assert.ok(style.overflow<=6,'horizontal overflow: '+JSON.stringify(style));
  assert.deepEqual(errors,[],'new runtime JavaScript errors');
  fs.mkdirSync('v4-current-pages-evidence',{recursive:true});
  await page.screenshot({path:'v4-current-pages-evidence/place-header-v15-390.png',fullPage:false});
  console.log('PASS isolated V4.15 live persistence, reversible tap, stage, guides and 390px header',JSON.stringify({proof,card,style}));
 }finally{await context.close();await browser.close()}
})().catch(e=>{console.error('FAIL V4 .15 live browser: '+e.stack);process.exitCode=1});
