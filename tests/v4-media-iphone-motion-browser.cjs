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
// Test with three different realistic 3–4 MP images rather than a 1px placeholder.
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
    const sources=await page.evaluate(()=>{
      const dims=[[1460,2580],[2048,1536],[1536,2732]];
      return dims.map(([w,h],idx)=>{
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext('2d'),g=ctx.createLinearGradient(0,0,w,h);
        g.addColorStop(0,['#e4a25f','#578ab2','#2f6a69'][idx]);
        g.addColorStop(1,['#243a51','#cfad80','#d6b298'][idx]);
        ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
        for(let j=0;j<600;j++){
          ctx.globalAlpha=.18;ctx.fillStyle='hsl('+((idx*73+j*17)%360)+' 50% 50%)';
          ctx.fillRect((j*137)%w,(j*273)%h,26+(j%47),35+(j%67));
        }
        return canvas.toDataURL('image/jpeg',.86);
      });
    });
    const videoFixture=await page.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
      const context=canvas.getContext('2d');
      const stream=canvas.captureStream(15),chunks=[];
      const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
      const result=new Promise(resolve=>recorder.addEventListener('stop',async()=>{
        const blob=new Blob(chunks,{type:'video/webm'});
        resolve({type:blob.type,data:Array.from(new Uint8Array(await blob.arrayBuffer()))});
      },{once:true}));
      recorder.addEventListener('dataavailable',e=>{if(e.data.size)chunks.push(e.data)});
      recorder.start();
      for(let frame=0;frame<7;frame++){
        context.fillStyle='hsl('+(frame*35)+' 55% 58%)';
        context.fillRect(0,0,320,180);
        await new Promise(resolve=>setTimeout(resolve,62));
      }
      recorder.stop();const fixture=await result;stream.getTracks().forEach(track=>track.stop());
      return fixture;
    });
    await page.evaluate(({id,sources,videoFixture})=>window.__atlasPlaceStore.save({
      id,lat:29.492,lng:121.905,title:'媒体动效验收地点',starred:true,stage:'visited',
      photos:[{id:'p1',name:'第一张',src:sources[0]},{id:'p2',name:'第二张',src:sources[1]},{id:'p3',name:'第三张',src:sources[2]}],
      videos:[1,2,3].map(n=>({id:'vid-'+n,name:'旅行视频'+n,type:videoFixture.type,bytes:new Uint8Array(videoFixture.data).buffer})),guides:[],note:'原始 Brief'
    }),{id,sources,videoFixture});
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
    await page.waitForSelector('#fpMediaViewer[data-media-motion="iphone-v5"] .fp-gallery-track',{timeout:12000});
    const initial=await page.evaluate(()=>{
      const e=document.querySelector('#fpMediaViewer');
      window.__mediaRef=e;
      return {index:e.dataset.itemIndex,slideCount:e.querySelectorAll('.fp-gallery-cell').length,
       close:e.querySelector('.fp-viewer-close').getBoundingClientRect().toJSON()};
    });
    assert.equal(initial.index,'0');assert.equal(initial.slideCount,3);
    assert.equal(await page.locator('#fpPlaceCard .fp-media-mosaic video[autoplay]').count(),0,'Tile videos must never autoplay');
    await page.waitForFunction(()=>document.querySelector('#fpMediaViewer .fp-gallery-cell[data-item-index="0"] img')?.naturalWidth>=1000,null,{timeout:10000});
    assert.ok((await page.locator('#fpMediaViewer .fp-gallery-cell img').count())<=2,'Unexpected full-resolution image duplicates');
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
      return {state:v.dataset.gestureState,backgroundOpacity:Number(v.querySelector('.fp-gallery-scrim')?.style.opacity),
       imageTransform:v.querySelector('.fp-gallery-cell[data-item-index="2"] img')?.style.transform,
       transform:v.querySelector('.fp-gallery-track').style.transform,
       copies:v.querySelectorAll('.fp-gallery-ghost').length};
    });
    assert.equal(down.state,'down','downward image drag not active');
    assert.ok(down.backgroundOpacity<.93&&down.backgroundOpacity>.1,'Backdrop opacity did not follow drag');
    assert.ok(down.imageTransform?.includes('scale('),'Current image was not individually scaled');
    assert.equal(down.copies,0,'Drag created extra image copies');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>!document.querySelector('#fpMediaViewer'),null,{timeout:9000});
    assert.equal(await page.locator('#fpPlaceCard').isVisible(),true,'Place card disappears after gallery close');
    await page.screenshot({path:output+'/iphone-media-return-'+width+'.png'});
    await page.locator('#fpPlaceCard .fp-media-mosaic button').first().click();
    await page.waitForSelector('#fpMediaViewer .fp-viewer-close',{timeout:10000});
    await page.locator('#fpMediaViewer .fp-viewer-close').click();
    await page.waitForFunction(()=>!document.querySelector('#fpMediaViewer'),null,{timeout:9000});
    // Current video retains native playback controls; swiping the image area still works.
    await page.locator('#fpPlaceCard .fp-media-mosaic button').nth(3).click();
    await page.waitForFunction(()=>document.querySelector('#fpMediaViewer')?.dataset.itemIndex==='3',null,{timeout:9000});
    const vid=page.locator('#fpMediaViewer .fp-gallery-cell[data-item-index="3"] video');
    assert.equal(await vid.evaluate(v=>v.controls),true,'Native video controls removed');
    const liveVideoCount=await page.locator('#fpMediaViewer video[src]').count();
    assert.equal(liveVideoCount,1,'Full-screen viewer should have only one decoding video element');
    assert.ok(await page.locator('#fpMediaViewer .fp-gallery-cell').count()===3,'Gallery context cells missing');
    await page.waitForFunction(()=>{
      const v=document.querySelector('#fpMediaViewer .fp-gallery-cell[data-item-index="3"] video');
      if(!v||v.videoWidth<300)return false;
      const r=v.getBoundingClientRect();
      return r.width>250&&r.height>130; // wait for iPhone-style thumbnail -> fullscreen zoom to finish
    },null,{timeout:10000});
    const vr=await vid.boundingBox();
    if(!vr||vr.width<=80||vr.height<=80){
      const videoDetail=await vid.evaluate(v=>({
        videoWidth:v.videoWidth,videoHeight:v.videoHeight,
        naturalRect:v.getBoundingClientRect().toJSON(),
        parentRect:v.parentElement?.getBoundingClientRect().toJSON(),
        style:{display:getComputedStyle(v).display,width:getComputedStyle(v).width,
          height:getComputedStyle(v).height,visibility:getComputedStyle(v).visibility,
          opacity:getComputedStyle(v).opacity,position:getComputedStyle(v).position}
      }));
      console.error('Fullscreen video viewport diagnostic',JSON.stringify(videoDetail));
      await page.screenshot({path:output+'/video-viewport-'+width+'.png'});
    }
    assert.ok(vr&&vr.width>80&&vr.height>80,'Fullscreen video has no display area');
    const sx=Math.round(vr.x+vr.width*.46),sy=Math.round(vr.y+Math.min(25,vr.height*.15));
    // Match the user's 3-photo + 3-video card; only one video can decode at a time.
    for(const next of [4,5]){
      await gesture(cdp,[[width-65,420],[width-125,420],[width-230,420]]);
      await page.waitForFunction(index=>document.querySelector('#fpMediaViewer')?.dataset.itemIndex===String(index),next,{timeout:10000});
      await page.waitForFunction(()=>document.querySelector('#fpMediaViewer video[src]')?.videoWidth>=300,null,{timeout:12000});
      const count=await page.locator('#fpMediaViewer video[src]').count();
      assert.equal(count,1,'Video decoding overlap after video-to-video swipe');
      const old=await page.evaluate(()=>Array.from(document.querySelectorAll('#fpMediaViewer .fp-gallery-cell video[src]')).map(v=>v.closest('.fp-gallery-cell')?.dataset.itemIndex));
      assert.deepEqual(old,[String(next)],'Stale video still decoding '+JSON.stringify(old));
    }
    for(const previous of [4,3,2]){
      await gesture(cdp,[[width-270,420],[width-205,420],[width-90,420]]);
      await page.waitForFunction(index=>document.querySelector('#fpMediaViewer')?.dataset.itemIndex===String(index),previous,{timeout:10000});
    }
    await gesture(cdp,[[sx,sy],[sx+35,sy],[Math.min(width-16,sx+110),sy]]);
    await page.waitForFunction(()=>document.querySelector('#fpMediaViewer')?.dataset.itemIndex==='2',null,{timeout:9000});
    await page.locator('#fpMediaViewer .fp-viewer-close').click();
    await page.waitForFunction(()=>!document.querySelector('#fpMediaViewer'),null,{timeout:9000});
    // Rapid close/reopen under 3-4MP photo pressure must not strand a modal.
    for(let repeat=0;repeat<9;repeat++){
      await page.locator('#fpPlaceCard .fp-media-mosaic button').first().click();
      await page.waitForSelector('#fpMediaViewer .fp-gallery-stage',{timeout:9000});
      const stats=await page.evaluate(()=>{
        const v=document.querySelector('#fpMediaViewer');
        return {photos:v.querySelectorAll('.fp-gallery-cell>img').length,
         videos:v.querySelectorAll('video[src]').length,
         scrims:v.querySelectorAll('.fp-gallery-scrim').length};
      });
      assert.ok(stats.photos<=2&&stats.videos<=1&&stats.scrims===1,'Media resource cap exceeded '+JSON.stringify(stats));
      await page.locator('#fpMediaViewer .fp-viewer-close').click();
      await page.waitForFunction(()=>!document.querySelector('#fpMediaViewer'),null,{timeout:7000});
    }
    assert.equal(await page.locator('#fpPlaceCard .fp-media-mosaic video').evaluateAll(vs=>vs.filter(v=>!v.paused).length),0,'Background video decoder resumed on close');
    assert.deepEqual(errors,[],'Unexpected page errors '+JSON.stringify(errors));
    reports.push({width,firstDrag:during,secondIndex:2,down,modalStable:true,closeWorks:true,errors});
   }finally{await context.close()}
  }
  fs.writeFileSync(output+'/report.json',JSON.stringify(reports,null,2));
  console.log('PASS media motion iPhone gestures at 375/390/430:',JSON.stringify(reports));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
