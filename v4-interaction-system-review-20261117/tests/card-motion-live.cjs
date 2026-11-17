'use strict';
/* 2026-11-17 isolated iPhone-size regression: REAL V4 review DOM, not a mock.
   Changes no user data. Test against independent published Pages path only. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const {chromium}=require('playwright-core');
const base=process.env.INTERACTION_REVIEW_BASE_URL||'https://fanbregas-netizen.github.io/travel-atlas-pages/v4-interaction-system-review-20261117/';
const executablePath=['google-chrome','google-chrome-stable','chromium'].map(n=>{try{return cp.execFileSync('which',[n],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!executablePath)throw Error('Chromium missing');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out='interaction-motion-evidence';
fs.mkdirSync(out,{recursive:true});
async function drag(page,ctx,x,y,distance,sample){
 const session=await ctx.newCDPSession(page),id=9,points=[];
 const point=(y0)=>[{x:Math.round(x),y:Math.round(y0),id}];
 try{
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(y)});
  for(let i=1;i<=9;i++){
   await sleep(27);
   await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(y+distance*i/9)});
   points.push(await page.evaluate(sample));
  }
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await sleep(1030);
  return {points,rest:await page.evaluate(sample)};
 }finally{await session.detach().catch(()=>{})}
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
 const report=[];
 try{
  for(const width of [375,390,430]){
   const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2,serviceWorkers:'block'});
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'index.html?interaction-qa='+width,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!!window.__atlasCollectionSheet?.getState&&!!document.querySelector('#drawer .drawer-head'),null,{timeout:25000});
   await page.evaluate(()=>{
    const drawer=document.querySelector('#drawer');
    drawer.classList.remove('fp30-hub');
    drawer.classList.add('fp30-detail','visible');
    const list=document.querySelector('#spotList');
    list.hidden=false;list.style.display='block';
    const row=document.createElement('button');
    row.className='spotrow';row.textContent='触控自检地点';row.type='button';
    list.replaceChildren(row);drawer.scrollTop=0;
   });
   await sleep(1000);
   const sample=()=>window.__atlasCollectionSheet.getState();
   const start=await page.evaluate(sample);
   assert.equal(start.level,'half','collection did not start at approved half');
   const grip=await page.locator('#drawer .drawer-head .sheet-grab').boundingBox();
   assert.ok(grip&&grip.height>2,'missing drag grip');
   const x=grip.x+grip.width/2,y=grip.y+grip.height/2;
   const up=await drag(page,ctx,x,y,-128,sample);
   assert.ok(Math.max(...up.points.map(p=>p.height))>start.height+40,'collection not following upward touch');
   assert.equal(up.rest.level,'full','collection did not snap to full');
   const grip2=await page.locator('#drawer .drawer-head .sheet-grab').boundingBox();
   const down=await drag(page,ctx,grip2.x+grip2.width/2,grip2.y+grip2.height/2,145,sample);
   assert.ok(Math.min(...down.points.map(p=>p.height))<up.rest.height-40,'collection not following downward touch');
   assert.equal(down.rest.level,'half','collection did not spring back to half');
   const collection={start,up:{during:up.points.map(p=>p.height),rest:up.rest},down:{during:down.points.map(p=>p.height),rest:down.rest}};
   await page.screenshot({path:out+'/collection-'+width+'.png'});
   // Closing geometry must not jump when the visible class is removed.
   await page.evaluate(()=>document.querySelector('#closeDrawer')?.click());
   await sleep(80);
   const closing=await page.evaluate(()=>({visible:document.querySelector('#drawer').classList.contains('visible'),
     inlineHeight:document.querySelector('#drawer').style.height}));
   assert.equal(closing.visible,false,'collection close control did not dismiss sheet');
   assert.ok(closing.inlineHeight,'collection height was cleared before dismissal animation completed');
   await sleep(480);
   const afterClose=await page.evaluate(()=>document.querySelector('#drawer').style.height);
   assert.equal(afterClose,'','collection retained stale height after close animation');
   collection.close={closing,cleaned:true};
   await page.goto(base+'journey.html?interaction-qa='+width,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!!window.__atlasRouteV5Live?.ready&&!!window.__batchC?.state&&!!document.querySelector('#rc-main'),null,{timeout:25000});
   // Record the REAL entrance every frame. CSS/JS double motion previously produced
   // a large plunge and reverse before the C V5 sheet settled.
   const entrance=await page.evaluate(async()=>{
    const frames=[],card=document.querySelector('#rc-main'),map=document.querySelector('#rc-map');
    for(let i=0;i<53;i++){
     await new Promise(resolve=>requestAnimationFrame(resolve));
     frames.push({t:performance.now(),h:card.getBoundingClientRect().height,
       y:card.getBoundingClientRect().top,transform:getComputedStyle(card).transform,
       mapBottom:parseFloat(getComputedStyle(map).bottom)});
    }
    return frames;
   });
   fs.writeFileSync(out+'/route-entry-'+width+'.json',JSON.stringify(entrance,null,2));
   const restHeight=entrance[entrance.length-1].h;
   assert.ok(entrance.every(f=>f.transform==='none'),'route sheet still has a conflicting CSS transform');
   assert.ok(Math.max(...entrance.map(f=>f.h))-restHeight<38,
     'route sheet entry overshoot is too large: '+JSON.stringify(entrance));
   assert.ok(entrance.every(f=>Math.abs(f.h-f.mapBottom)<4),'map boundary lags entry sheet height');
   await sleep(250);
   const measure=()=>{
    const card=document.querySelector('#rc-main'),map=document.querySelector('#rc-map');
    return {h:card.getBoundingClientRect().height,bottom:parseFloat(getComputedStyle(map).bottom),
            transition:getComputedStyle(map).transitionDuration,stage:window.__batchC?.state()?.stage};
   };
   const routeStart=await page.evaluate(measure);
   assert.equal(parseFloat(routeStart.transition),0,'route map boundary still has delayed CSS transition');
   const handle=await page.locator('#rc-grab .rc-handle').boundingBox();
   assert.ok(handle,'missing C V5 route card grip');
   await page.screenshot({path:out+'/route-before-'+width+'.png'});
   const routeUp=await drag(page,ctx,handle.x+handle.width/2,handle.y+handle.height/2,-133,measure);
   fs.writeFileSync(out+'/route-drag-'+width+'.json',JSON.stringify({start:routeStart,handle,drag:routeUp},null,2));
   assert.ok(Math.max(...routeUp.points.map(p=>p.h))>routeStart.h+40,'route card not following upward finger: '+JSON.stringify({routeStart,handle,points:routeUp.points,rest:routeUp.rest}));
   // Map edge and sheet edge must remain synchronized WHILE dragging.
   assert.ok(routeUp.points.every(p=>Math.abs(p.h-p.bottom)<4),'route map boundary visually lags the sheet');
   assert.ok(routeUp.rest.h>routeStart.h+35,'route card did not advance detent');
   await page.screenshot({path:out+'/route-'+width+'.png'});
   assert.deepEqual(errors,[],'runtime script failures');
   report.push({width,collection,route:{entrance, start:routeStart,up:routeUp}});
   await ctx.close();
  }
  fs.writeFileSync(out+'/card-motion-report.json',JSON.stringify(report,null,2));
  console.log('PASS interaction review real-card 375/390/430: collection drag+animated close, bounded route entry, drag and map edge synchrony');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL isolated interaction motion: '+e.stack);process.exitCode=1});
