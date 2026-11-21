'use strict';
/* Real Chromium/WebKit engines, cross-engine synthetic touch-structure events on the FULL
 * isolated V5 product. No user browser profile, account, or data is touched. */
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base='http://127.0.0.1:8765/v5-poi-zh-20261121/';
const dir=path.resolve(__dirname,'../v5-photo-zoom-evidence');
fs.mkdirSync(dir,{recursive:true});
async function test(kind,engine,width){
 const browser=await engine.launch({headless:true,args:kind==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
 const page=await context.newPage();
 try{
  const r=await page.goto(base,{waitUntil:'domcontentloaded',timeout:35000});
  assert.equal(r.status(),200);
  await page.waitForFunction(()=>typeof window.__footprintHome?.openSaved==='function'&&
   typeof window.__fpPhotoZoomV5?.getState==='function',null,{timeout:18000});
  await page.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=800;c.height=600;
   const x=c.getContext('2d');x.fillStyle='#cadad1';x.fillRect(0,0,800,600);
   x.fillStyle='#405f59';x.fillRect(100,80,500,400);
   const src=c.toDataURL('image/png');
   const p={id:'qa-photo-zoom',title:'图片缩放验收点',lat:31.052,lng:121.507,
    starred:true,stage:'plan',note:'',photos:[{name:'测试照片',src}],
    videos:[],references:[]};
   window.__atlasPlaceStore={readAll:async()=>[p]};
   await window.__footprintHome.openSaved(p.id);
  });
  await page.waitForFunction(()=>!!document.querySelector('#fpPlaceCard [data-fp-media-index="0"]'),null,{timeout:8000});
  await page.locator('#fpPlaceCard [data-fp-media-index="0"]').click();
  await page.waitForFunction(()=>!!document.querySelector('#fpMediaViewer .fp-gallery-cell:nth-child(2) > img'),null,{timeout:9000});
  // The real V5 modal must render a single SVG close icon (no text × and
  // no legacy pseudo X), and hide the originating mosaic tile during motion.
  await page.waitForTimeout(80);
  const during=await page.evaluate(()=>{
   const viewer=document.getElementById('fpMediaViewer');
   const photo=viewer?.querySelector('.fp-gallery-cell:nth-child(2) > img');
   return {state:viewer?.dataset.gestureState,activeMotion:photo?.getAnimations().some(a=>a.playState==='running')||false};
  });
  await page.waitForTimeout(430); // accepted slower iOS image expansion
  const closeIcon=await page.evaluate(()=>{
   const b=document.querySelector('#fpMediaViewer .fp-viewer-close');
   const origin=document.querySelector('#fpPlaceCard [data-fp-media-index="0"]');
   const css=getComputedStyle(b),before=getComputedStyle(b,'::before'),after=getComputedStyle(b,'::after');
   return {label:b?.getAttribute('aria-label'),text:b?.textContent?.trim(),svg:b?.querySelectorAll('svg.fp-close-svg').length,
    strokes:b?.querySelectorAll('svg.fp-close-svg path').length,pseudoBefore:before.content,pseudoAfter:after.content,
    width:css.width,height:css.height,display:css.display,font:css.fontSize,originHidden:origin?.style.visibility==='hidden'};
  });
  assert.equal(closeIcon.text,'',kind+' duplicate text close glyph');
  assert.equal(closeIcon.svg,1,kind+' close SVG count');
  assert.equal(closeIcon.strokes,2,kind+' close SVG must contain exactly two strokes');
  assert.equal(closeIcon.pseudoBefore,'none',kind+' legacy ::before phantom X');
  assert.equal(closeIcon.pseudoAfter,'none',kind+' legacy ::after phantom X');
  assert.equal(closeIcon.font,'0px',kind+' legacy [open] restored X text');
  assert.equal(closeIcon.width,'44px',kind+' photo close wrong hit target');
  assert.equal(closeIcon.originHidden,true,kind+' original photo tile ghost during gallery open');
  await page.screenshot({path:path.join(dir,kind+'-'+width+'-single-svg-close.png')});
  await page.evaluate(()=>{
   const img=document.querySelector('#fpMediaViewer .fp-gallery-cell:nth-child(2) > img');
   const p=(id,x,y)=>({identifier:id,target:img,clientX:x,clientY:y});
   const fire=(type,touches,changed=touches)=>{
    const event=new Event(type,{bubbles:true,cancelable:true,composed:true});
    Object.defineProperties(event,{
     touches:{value:touches},targetTouches:{value:touches},changedTouches:{value:changed}
    });
    img.dispatchEvent(event);
   };
   const dispatch=fire;
   const a=p(0,140,310),b=p(1,250,310);
   dispatch('touchstart',[a,b]);
   const c=p(0,75,310),d=p(1,315,310);
   dispatch('touchmove',[c,d],[c,d]);dispatch('touchend',[],[c,d]);
  });
  let status=await page.evaluate(()=>window.__fpPhotoZoomV5.getState());
  assert(status.zoom>1.6,kind+' pinch did not zoom: '+JSON.stringify(status));
  assert.equal(await page.locator('#fpMediaViewer').count(),1);
  const item=await page.locator('#fpMediaViewer').getAttribute('data-item-index');
  assert.equal(item,'0',kind+' pinch switched the slide');
  await page.evaluate(()=>{
   const img=document.querySelector('#fpMediaViewer .fp-gallery-cell:nth-child(2) > img');
   const p=(x,y)=>({identifier:0,target:img,clientX:x,clientY:y});
   const fire=(type,touches,changed=touches)=>{
    const event=new Event(type,{bubbles:true,cancelable:true,composed:true});
    Object.defineProperties(event,{
     touches:{value:touches},targetTouches:{value:touches},changedTouches:{value:changed}
    });
    img.dispatchEvent(event);
   };
   const send=fire;
   send('touchstart',[p(195,320)]);send('touchmove',[p(250,350)]);
   send('touchend',[],[p(250,350)]);
  });
  const panned=await page.evaluate(()=>window.__fpPhotoZoomV5.getState());
  assert.equal(panned.zoom,status.zoom,kind+' pan changed zoom');
  await page.screenshot({path:path.join(dir,kind+'-'+width+'-photo-zoom.png')});
  await page.locator('#fpMediaViewer .fp-viewer-close').click();
  await page.waitForFunction(()=>!document.getElementById('fpMediaViewer'),null,{timeout:6000});
  assert(await page.locator('#fpPlaceCard').isVisible(),kind+' photo close lost location card');
  assert.equal(await page.locator('#fpPlaceCard [data-fp-media-index="0"]').evaluate(el=>el.style.visibility),'',kind+' photo tile not restored after closing');
  await page.goto(base+'amap-import.html',{waitUntil:'domcontentloaded'});
  const isolation=await page.evaluate(()=>({
   ns:window.__atlasPreviewNamespace,db:window.__fpStorageNamespace,blocked:window.__atlasImportPreviewBlocked===true
  }));
  assert.equal(isolation.ns,'fp-v5-poi-zh-qa-20261121-');
  assert.equal(isolation.db,'private-travel-footprints-v5-poi-zh-qa-20261121');
  assert.equal(isolation.blocked,false);
  console.log(JSON.stringify({engine:kind,width,status:'PASS',pinch:status.zoom,pan:panned.panX,closeIcon:'single SVG',photoOpenAnimation:during.activeMotion,import:isolation.ns}));
 }finally{await context.close();await browser.close()}
}
(async()=>{for(const [name,engine] of [['chromium',chromium],['webkit',webkit]])
 for(const width of [390,430])await test(name,engine,width)})()
 .catch(e=>{console.error(e.stack||e);process.exitCode=1});
