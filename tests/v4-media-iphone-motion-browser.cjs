'use strict';
/* Media-only iPhone gesture regression against the ACTUAL V4 product.
   Never replaces the application with a mocked UI. */
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const bin=['google-chrome','google-chrome-stable','chromium'].map(x=>{try{return cp.execFileSync('which',[x],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!bin)throw Error('Chromium not found');
const root=process.env.MEDIA_QA_ROOT||'https://fanbregas-netizen.github.io/travel-atlas-pages/v4-media-system-review-20261117/';
const output='v4-media-motion-evidence';fs.mkdirSync(output,{recursive:true});
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5pbiQAAAAASUVORK5CYII=';
async function gesture(cdp,coords){
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:coords[0][0],y:coords[0][1]}]});
 for(let i=1;i<coords.length;i++){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:coords[i][0],y:coords[i][1]}]});
  await new Promise(resolve=>setTimeout(resolve,19));
 }
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:bin,args:['--no-sandbox','--disable-dev-shm-usage']});
 const reports=[];
 try{
  for(const width of [375,390,430]){
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('dialog',d=>d.accept());
   try{
    const response=await page.goto(root+'index.html?media-iphone-qa='+width,{waitUntil:'domcontentloaded',timeout:65000});
    assert.equal(response.status(),200);
    await page.waitForFunction(()=>!!window.__atlasPlaceStore?.save&&!!window.__atlasDemo?.openSaved&&!!window.FootprintMediaCore,null,{timeout:25000});
    const id='media-v2-gesture-'+width;
    await page.evaluate(({id,pixel})=>window.__atlasPlaceStore.save({
      id,lat:29.492,lng:121.905,title:'媒体动效验收地点',starred:true,stage:'visited',
      photos:[{id:'p1',name:'第一张',src:pixel},{id:'p2',name:'第二张',src:pixel},{id:'p3',name:'第三张',src:pixel}],
      videos:[],guides:[],note:'原始 Brief'
    }),{id,pixel});
    await page.evaluate(async id=>{
      await window.__atlasSetBookmarkStarred(id,false);
      await window.__atlasSetBookmarkStarred(id,true);
      window.__atlasDemo.openSaved(id);
    },id);
    try{await page.waitForSelector('#fpPlaceCard:not([hidden]) .fp-media-mosaic button',{timeout:16000})}
    catch(error){
      const snapshot=await page.evaluate(()=>({
        saved:window.__atlasDemo?.getSaved?.(),
        card:document.querySelector('#fpPlaceCard')?.outerHTML.slice(0,1200),
        bodyClass:document.body.className,
        feedback:document.querySelector('#fpCardFeedback')?.textContent
      }));
      console.error('Media card bootstrap diagnostic',JSON.stringify(snapshot));
      await page.screenshot({path:output+'/bootstrap-error-'+width+'.png'});
      throw error;
    }
    await page.locator('#fpPlaceCard .fp-media-mosaic button').first().click();
    await page.waitForSelector('#fpMediaViewer[data-media-motion="iphone-v2"] .fp-gallery-track',{timeout:12000});
    const initial=await page.evaluate(()=>{
      const e=document.querySelector('#fpMediaViewer');
      window.__mediaRef=e;
      return {index:e.dataset.itemIndex,slideCount:e.querySelectorAll('.fp-gallery-cell').length,
       close:e.querySelector('.fp-viewer-close').getBoundingClientRect().toJSON()};
    });
    assert.equal(initial.index,'0');assert.equal(initial.slideCount,3);
    assert.ok(initial.close.width>=43&&initial.close.height>=43,'44 px close missing');
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width-75,y:420}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width-145,y:420}]});
    await new Promise(resolve=>setTimeout(resolve,50));
    const during=await page.evaluate(()=>{
      const v=document.querySelector('#fpMediaViewer');
      return {state:v.dataset.gestureState,index:v.dataset.itemIndex,transform:v.querySelector('.fp-gallery-track').style.transform}
    });
    assert.equal(during.state,'horizontal','track does not follow swipe');
    assert.equal(during.index,'0','index should commit only after release');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width-245,y:421}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>document.querySelector('#fpMediaViewer')?.dataset.itemIndex==='1',null,{timeout:9000});
    assert.equal(await page.evaluate(()=>window.__mediaRef===document.querySelector('#fpMediaViewer')),true,'Gallery destroyed on horizontal swipe');
    await page.screenshot({path:output+'/iphone-media-swipe-'+width+'.png'});
    await gesture(cdp,[[width-70,430],[width-130,431],[width-220,431],[width-290,431]]);
    await page.waitForFunction(()=>document.querySelector('#fpMediaViewer')?.dataset.itemIndex==='2',null,{timeout:9000});
    assert.equal(await page.evaluate(()=>window.__mediaRef===document.querySelector('#fpMediaViewer')),true,'Gallery remounted on second swipe');
    // Drag downward: the image AND scrim should follow, not jump back before close.
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width/2,y:355}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width/2,y:490}]});
    await new Promise(resolve=>setTimeout(resolve,70));
    const down=await page.evaluate(()=>{
      const v=document.querySelector('#fpMediaViewer');
      return {state:v.dataset.gestureState,background:v.style.backgroundColor,
       transform:v.querySelector('.fp-gallery-track').style.transform};
    });
    assert.equal(down.state,'down','downward image drag not active');
    assert.ok(/rgba/.test(down.background),'backdrop not interactive');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>!document.querySelector('#fpMediaViewer'),null,{timeout:9000});
    assert.equal(await page.locator('#fpPlaceCard').isVisible(),true,'Place card disappears after gallery close');
    await page.screenshot({path:output+'/iphone-media-return-'+width+'.png'});
    await page.locator('#fpPlaceCard .fp-media-mosaic button').first().click();
    await page.waitForSelector('#fpMediaViewer .fp-viewer-close',{timeout:10000});
    await page.locator('#fpMediaViewer .fp-viewer-close').click();
    await page.waitForFunction(()=>!document.querySelector('#fpMediaViewer'),null,{timeout:9000});
    assert.deepEqual(errors,[],'Unexpected page errors '+JSON.stringify(errors));
    reports.push({width,firstDrag:during,secondIndex:2,down,modalStable:true,closeWorks:true,errors});
   }finally{await context.close()}
  }
  fs.writeFileSync(output+'/report.json',JSON.stringify(reports,null,2));
  console.log('PASS media motion iPhone gestures at 375/390/430:',JSON.stringify(reports));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
