'use strict';
/* V4.16 full-product edit, safe-area and header acceptance.
   All writes are in a fresh, isolated iPhone browser profile and the dedicated
   Pages preview's independently namespaced IndexedDB. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const {chromium}=require('playwright-core');
const root='https://fanbregas-netizen.github.io/travel-atlas-pages/v4-review-20261116/';
const bin=['google-chrome','google-chrome-stable','chromium'].map(v=>{try{return cp.execFileSync('which',[v],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!bin)throw Error('Chrome unavailable');
const out='v4-current-pages-evidence';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:bin,args:['--no-sandbox','--disable-dev-shm-usage']});
 const reports=[];
 try{
 for(const width of [375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',async dialog=>{await dialog.accept()});
  try{
   await page.goto(root+'index.html?v16-edit-qa='+width,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!!window.__atlasPlaceStore?.save && !!window.__atlasDemo?.openSaved && !!window.FootprintMediaCore,null,{timeout:20000});
   const id='v16-qa-'+width;
   const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5pbiQAAAAASUVORK5CYII=';
   await page.evaluate(({id,pixel})=>window.__atlasPlaceStore.save({id,lat:31.22436,lng:121.45657,title:'卡片验收地点',starred:true,stage:'plan',rank:2,note:'原始手记',date:'',photos:[{name:'验收像素',src:pixel}],videos:[],references:[],guides:[]}),{id,pixel});
   await page.evaluate(async id=>{await window.__atlasSetBookmarkStarred(id,false);await window.__atlasSetBookmarkStarred(id,true);window.__atlasDemo.openSaved(id)},id);
   await page.waitForSelector('#fpPlaceCard:not([hidden]) .fp-section-edit',{timeout:12000});
   const buttons=page.locator('#fpPlaceCard .fp-subheading > .fp-subaction');
   assert.ok(await buttons.count()>=4,'section actions missing');
   const states=await buttons.evaluateAll(nodes=>nodes.map(b=>({text:b.textContent,opacity:getComputedStyle(b).opacity,pointer:getComputedStyle(b).pointerEvents,visible:b.getBoundingClientRect().height>0})));
   assert.ok(states.every(x=>Number(x.opacity)>.95&&x.pointer==='auto'&&x.visible),'subsection edit is hidden / untappable '+JSON.stringify(states));
   const section=page.locator('#fpPlaceCard .fp-block');
   await section.nth(0).locator('.fp-subheading button').click();
   await section.nth(0).locator('.fp-inline-editor textarea').waitFor({state:'visible'});
   await section.nth(0).locator('.fp-inline-editor textarea').fill('本轮保存的旅行手记');
   await section.nth(0).getByRole('button',{name:'保存记录'}).click();
   await page.waitForFunction(id=>document.querySelector('#fpPlaceCard .fp-brief-text')?.textContent==='本轮保存的旅行手记',id,{timeout:8000});
   const saved=await page.evaluate(id=>window.FootprintMediaCore.createRepository(window.indexedDB).read(id).then(x=>x.note),id);
   assert.equal(saved,'本轮保存的旅行手记','Brief not persisted');
   await section.nth(0).locator('.fp-subheading button').click();
   await section.nth(0).locator('.fp-inline-editor textarea').fill('应取消的草稿');
   await section.nth(0).getByRole('button',{name:'取消'}).click();
   await page.waitForFunction(()=>!document.querySelector('#fpPlaceCard .fp-block .fp-inline-editor'),null,{timeout:8000});
   assert.equal(await page.evaluate(id=>window.FootprintMediaCore.createRepository(window.indexedDB).read(id).then(x=>x.note),id),saved,'cancel overwrote data');

   await section.nth(2).locator('.fp-subheading button').click();
   await section.nth(2).locator('.fp-guide-editor textarea').waitFor({state:'visible'});
   await section.nth(2).locator('.fp-guide-editor textarea').fill('上海散步 https://xhslink.com/accepted16 复制分享文案');
   await section.nth(2).getByRole('button',{name:'保存链接'}).click();
   await page.waitForSelector('#fpPlaceCard .fp-guide-open[href*="xhslink.com/accepted16"]',{timeout:8000});
   const savedGuide=await page.evaluate(id=>window.FootprintMediaCore.createRepository(window.indexedDB).read(id).then(p=>p.guides.find(g=>g.url.includes('accepted16'))),id);
   assert.equal(savedGuide?.source,'小红书','share source not stored');

   const chooser=page.waitForEvent('filechooser',{timeout:7000});
   await section.nth(1).locator('.fp-subheading button').click();
   const fileChooser=await chooser;
   assert.ok(fileChooser.isMultiple(),'media picker is not the approved multi-file input');

   await section.nth(1).locator('.fp-media-mosaic button').first().click();
   await page.waitForSelector('#fpMediaViewer .fp-viewer-close',{timeout:8000});
   const newX=await page.locator('#fpMediaViewer .fp-viewer-close').boundingBox();
   assert.ok(newX&&Math.abs(newX.width-44)<1&&Math.abs(newX.height-44)<1,'place image viewer close is not 44px '+JSON.stringify(newX));
   assert.ok(newX.x+newX.width<=width-3&&newX.y>=0&&newX.y<115,'place image viewer close outside iPhone safe bounds '+JSON.stringify(newX));
   await page.locator('#fpMediaViewer .fp-viewer-close').click();
   await page.waitForFunction(()=>!document.querySelector('#fpMediaViewer'),null,{timeout:10000});

   await page.evaluate(()=>document.querySelector('#viewer').classList.add('visible'));
   const legacyX=await page.locator('#viewer .viewer-top #closeViewer').boundingBox();
   assert.ok(legacyX&&Math.abs(legacyX.width-44)<1&&Math.abs(legacyX.height-44)<1,'legacy viewer close has wrong size '+JSON.stringify(legacyX));
   assert.ok(legacyX.x+legacyX.width<=width-3&&legacyX.y>=0&&legacyX.y<115,'legacy close out of safe area '+JSON.stringify(legacyX));
   await page.screenshot({path:out+'/viewer-x-v16-'+width+'.png',fullPage:false});
   await page.locator('#closeViewer').click();
   assert.equal(await page.locator('#viewer').evaluate(el=>el.classList.contains('visible')),false,'viewer close is nonfunctional');

   await page.evaluate(()=>document.getElementById('drawer').classList.add('visible'));
   const header=await page.evaluate(()=>{
    const d=document.querySelector('#drawer .drawer-head');
    const x=d.querySelector('#closeDrawer').getBoundingClientRect();
    const title=d.querySelector('h2').getBoundingClientRect();
    const sheet=document.querySelector('#drawer').getBoundingClientRect();
    return {closeW:x.width,closeH:x.height,sameLine:Math.abs(x.top-title.top)<30,sheetW:sheet.width};
   });
   assert.ok(header.closeW>=43&&header.sameLine,'collection heading/close not aligned '+JSON.stringify(header));
   await page.screenshot({path:out+'/collection-header-v16-'+width+'.png',fullPage:false});

   const route=await page.goto(root+'journey.html?v16-route-qa='+width,{waitUntil:'domcontentloaded',timeout:60000});
   assert.equal(route?.status(),200);
   await page.waitForSelector('body.route-v5-live #rc-main #rc-title',{timeout:12000});
   const routeHeader=await page.evaluate(()=>{
    const title=document.querySelector('#rc-title').getBoundingClientRect();
    const sub=document.querySelector('#rc-subtitle').getBoundingClientRect();
    const close=document.querySelector('#rc-main .rc-dismiss').getBoundingClientRect();
    return {titleW:title.width,subTop:sub.top,titleTop:title.top,closeW:close.width,closeH:close.height,closeX:close.x,bodyW:innerWidth};
   });
   assert.ok(routeHeader.closeW>=43&&routeHeader.closeH>=43,'route close is not accessible');
   assert.ok(routeHeader.closeX+routeHeader.closeW<=width,'route close outside viewport');
   assert.deepEqual(errors,[],'JavaScript errors in full preview');
   reports.push({width,sections:states.map(x=>x.text),brief:saved,guide:savedGuide?.source,newX,legacyX,header,routeHeader});
  }finally{await context.close()}
 }
 fs.writeFileSync(out+'/edit-header-viewer-v16.json',JSON.stringify(reports,null,2));
 console.log('PASS V4.16: real per-section Brief save/cancel, guide save, multi-media picker, BOTH viewer X controls, collection/route headers in 375/390/430px',JSON.stringify(reports));
 }finally{await browser.close()}
})().catch(e=>{console.error('V4 .16 real UI acceptance failed: '+e.stack);process.exitCode=1});
