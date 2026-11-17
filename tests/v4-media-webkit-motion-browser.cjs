'use strict';
/* Real V4 product, WebKit engine (Safari rendering path), synthetic touch sequences.
 * This is NOT a physical iPhone and does not claim to measure its frame rate. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {webkit}=require('playwright-core');
const root=process.env.MEDIA_QA_ROOT||'http://127.0.0.1:8765/v4-media-system-review-20261117/';
const out='v4-media-webkit-evidence';fs.mkdirSync(out,{recursive:true});
async function touch(page,type,x,y){
 await page.evaluate(({type,x,y})=>{
  const stage=document.querySelector('#fpMediaViewer .fp-gallery-stage');
  if(!stage)throw Error('Gallery missing while dispatching '+type);
  const point={clientX:x,clientY:y};
  const event=new Event(type,{bubbles:true,cancelable:true});
  Object.defineProperty(event,'touches',{value:type==='touchend'?[]:[point]});
  Object.defineProperty(event,'changedTouches',{value:[point]});
  stage.dispatchEvent(event);
 },{type,x,y});
}
async function swipe(page,from,to){
 await touch(page,'touchstart',from[0],from[1]);
 for(let i=1;i<=6;i++){
  await touch(page,'touchmove',from[0]+(to[0]-from[0])*i/6,from[1]+(to[1]-from[1])*i/6);
  await page.waitForTimeout(18);
 }
 await touch(page,'touchend',to[0],to[1]);
}
(async()=>{
 const browser=await webkit.launch({headless:true});
 const reports=[];
 try{
  for(const width of [375,390,430]){
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   try{
    const response=await page.goto(root+'index.html?media-webkit='+width,{waitUntil:'domcontentloaded',timeout:60000});
    assert.equal(response.status(),200);
    await page.waitForFunction(()=>!!window.__atlasPlaceStore?.save&&!!window.__atlasDemo?.openSaved,null,{timeout:30000});
    const payload=await page.evaluate(()=>{
     const sizes=[[1320,2380],[1600,2200],[2048,1536]];
     return sizes.map(([w,h],i)=>{
      const c=document.createElement('canvas');c.width=w;c.height=h;
      const ctx=c.getContext('2d');
      ctx.fillStyle=['#b2a48e','#536d83','#9cae98'][i];ctx.fillRect(0,0,w,h);
      for(let j=0;j<120;j++){ctx.fillStyle='hsl('+((i*90+j*17)%360)+' 32% 38%)';ctx.fillRect((j*97)%w,(j*173)%h,33,67);}
      return c.toDataURL('image/jpeg',.8);
     });
    });
    const id='webkit-media-v5-'+width;
    await page.evaluate(async({id,payload})=>{
     await window.__atlasPlaceStore.save({
       id,lat:28.171,lng:121.311,title:'WebKit 媒体验收',starred:true,stage:'visited',
       photos:payload.map((src,i)=>({id:'p'+i,name:'照片'+i,src})),videos:[],guides:[],note:'WebKit'}
     );
     await window.__atlasSetBookmarkStarred(id,false);
     await window.__atlasSetBookmarkStarred(id,true);
     window.__atlasDemo.openSaved(id);
    },{id,payload});
    await page.waitForSelector('#fpPlaceCard:not([hidden]) .fp-media-mosaic button',{timeout:25000});
    for(let repeat=0;repeat<5;repeat++){
     await page.locator('#fpPlaceCard .fp-media-mosaic button').first().click();
     await page.waitForSelector('#fpMediaViewer[data-media-motion="iphone-v5"] .fp-gallery-track',{timeout:12000});
     const s0=await page.evaluate(()=>document.querySelector('#fpMediaViewer'));
     assert.ok(s0);
     await page.waitForTimeout(350);
     await swipe(page,[width-65,440],[width-260,440]);
     await page.waitForFunction(()=>document.querySelector('#fpMediaViewer')?.dataset.itemIndex==='1',null,{timeout:12000});
     await swipe(page,[width-65,440],[width-260,440]);
     await page.waitForFunction(()=>document.querySelector('#fpMediaViewer')?.dataset.itemIndex==='2',null,{timeout:12000});
     const stillOne=await page.evaluate(()=>document.querySelectorAll('#fpMediaViewer').length===1);
     assert.ok(stillOne,'Fullscreen remounted');
     await swipe(page,[width/2,355],[width/2,545]);
     await page.waitForFunction(()=>!document.querySelector('#fpMediaViewer'),null,{timeout:12000});
     assert.ok(await page.locator('#fpPlaceCard').isVisible(),'Place card not restored');
     if(repeat===0)await page.screenshot({path:out+'/webkit-return-'+width+'.png'});
    }
    assert.deepEqual(errors,[],'WebKit JS errors: '+JSON.stringify(errors));
    reports.push({width,rounds:5,photos:3,swipes:10,downDismissals:5,errors});
   }finally{await context.close()}
  }
  fs.writeFileSync(out+'/report.json',JSON.stringify(reports,null,2));
  console.log('PASS WebKit Safari-engine media gallery gestures:',JSON.stringify(reports));
 }finally{await browser.close()}
})().catch(e=>{console.error('WebKit media QA failure:',e.stack);process.exitCode=1});
