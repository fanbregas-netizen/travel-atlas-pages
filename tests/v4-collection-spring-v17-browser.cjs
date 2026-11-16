'use strict';
/* Isolated and deterministic real touch regression for approved B05 collection.
   This synthetic row lives only in the browser DOM; no user storage is modified. */
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const exe=['google-chrome','google-chrome-stable','chromium'].map(n=>{try{return cp.execFileSync('which',[n],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!exe)throw Error('Chromium unavailable');
const base='https://fanbregas-netizen.github.io/travel-atlas-pages/v4-review-20261116/';
const rest=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:exe,args:['--no-sandbox','--disable-dev-shm-usage']});
 const report=[];
 try{
  for(const width of [375,390,430]){
   const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2,serviceWorkers:'block'});
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.goto(base+'index.html?v17-gesture-'+width,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>!!window.__atlasCollectionSheet?.getState && !!document.getElementById('spotList'),null,{timeout:18000});
   await page.evaluate(()=>{
    const drawer=document.getElementById('drawer');
    const list=document.getElementById('spotList');
    drawer.classList.remove('fp30-hub');
    drawer.classList.add('fp30-detail','visible');
    list.hidden=false;
    list.style.display='block';
    const b=document.createElement('button');
    b.type='button';b.className='spotrow';b.textContent='手势测试地点';
    b.addEventListener('click',()=>window.__b05TapCount=(window.__b05TapCount||0)+1);
    list.replaceChildren(b);
    drawer.scrollTop=0;
   });
   await rest(1100);
   const first=await page.evaluate(()=>{
    const drawer=document.getElementById('drawer'),row=document.querySelector('#spotList .spotrow');
    const rect=row.getBoundingClientRect(),hdr=document.querySelector('#drawer .drawer-head').getBoundingClientRect();
    return {state:window.__atlasCollectionSheet.getState(),row:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},header:{x:hdr.x,y:hdr.y,width:hdr.width,height:hdr.height},viewport:innerHeight};
   });
   assert.ok(first.state.opened&&first.state.level==='half','B05 half detent did not initialize: '+JSON.stringify(first));
   const touch=await ctx.newCDPSession(page);
   const drag=async(x,y,delta)=>{
     const pts=[0,.20,.45,.70,1].map(t=>({x:Math.round(x),y:Math.round(y+delta*t),id:7}));
     await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pts[0]]});
     for(let i=1;i<pts.length;i++){await rest(34);await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[pts[i]]})}
     await rest(90);
     const moving=await page.evaluate(()=>window.__atlasCollectionSheet.getState());
     await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     await rest(1000);
     const settled=await page.evaluate(()=>window.__atlasCollectionSheet.getState());
     return {moving,settled};
   };
   const x=first.row.x+Math.min(55,first.row.width/4),y=first.row.y+first.row.height/2;
   assert.ok(y>0&&y<825,'synthetic row outside visible viewport: '+JSON.stringify(first));
   const up=await drag(x,y,-136);
   assert.ok(up.moving.height>first.state.height+30,'dragging a location row does not move the entire sheet: '+JSON.stringify({first,up}));
   assert.equal(up.settled.level,'full','upward swipe did not advance B05 detent');
   assert.ok(up.settled.height>first.state.height+75,'B05 full spring failed: '+JSON.stringify({first,up}));
   const grip=await page.locator('#drawer .drawer-head .sheet-grab').boundingBox();
   assert.ok(grip,'grip missing');
   const down=await drag(grip.x+grip.width/2,grip.y+grip.height/2,144);
   assert.ok(down.moving.height<up.settled.height-30,'header drag is not following the finger '+JSON.stringify({first,up,down}));
   assert.equal(down.settled.level,'half','header release did not return to approved B05 half detent');
   await page.locator('#spotList .spotrow').click({timeout:6000});
   assert.equal(await page.evaluate(()=>window.__b05TapCount),1,'row tap was broken by swipe restoration');
   const close=await page.evaluate(()=>{
    const b=document.querySelector('#viewer .viewer-top #closeViewer');
    const c=getComputedStyle(b),before=getComputedStyle(b,'::before');
    return {w:parseFloat(c.width),h:parseFloat(c.height),bg:c.backgroundColor,glyph:parseFloat(before.width),stroke:parseFloat(before.height)};
   });
   assert.ok(close.w>=44&&close.h>=44,'legacy viewer close target too small');
   assert.ok(close.glyph<=17&&close.stroke<=2,'legacy viewer X is visually oversized: '+JSON.stringify(close));
   assert.deepEqual(errors,[],'new JS runtime errors');
   fs.mkdirSync('v4-current-pages-evidence',{recursive:true});
   await page.screenshot({path:'v4-current-pages-evidence/collection-b05-restored-v17-'+width+'.png',fullPage:false});
   report.push({width,first,up,down,tapCount:1,close});
   await ctx.close();
  }
  fs.writeFileSync('v4-current-pages-evidence/collection-b05-restored-v17.json',JSON.stringify(report,null,2));
  console.log('PASS B05 real finger: row swipe tracks, full/half snap, grip drag, tap preserved, quiet viewer X, 375/390/430',JSON.stringify(report));
 }finally{await browser.close()}
})().catch(error=>{console.error('V4 .17 B05 REAL TOUCH FAILED: '+error.stack);process.exitCode=1});
