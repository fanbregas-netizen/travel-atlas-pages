'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error.message)));
 await page.goto(pathToFileURL(path.resolve(__dirname,'../v4-visual-motion-acceptance-20261113/index.html')).href,{waitUntil:'domcontentloaded'});
 await page.locator('#mapStar').waitFor({state:'visible'});
 assert.equal(await page.locator('#dock .dock-glider').count(),1,'Dock sliding elastic selection pill missing');
 assert.equal(await page.locator('.dock button').count(),4,'Four original Dock actions remain');
 const cdp=await ctx.newCDPSession(page);
 async function touchDrag(selector,dy,options={}){
  const box=await page.locator(selector).first().boundingBox();
  assert.ok(box,'missing touch source '+selector);
  const x=box.x+(options.xRatio||.5)*box.width;
  const y=box.y+(options.yRatio||.5)*box.height;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,radiusX:5,radiusY:5,force:1,id:0}]});
  for(let i=1;i<=13;i++){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+dy*i/13,radiusX:5,radiusY:5,force:1,id:0}]});
   await sleep(15);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await sleep(1000);
 }
 const sheetHeight=async id=>+((await page.locator(id).evaluate(el=>parseFloat(el.style.height)))||0);
 async function scene(index){
  await page.locator('#tocOpen').click();await page.locator('.toc-item').nth(index).click();
  await sleep(1050);
 }
 await page.locator('#dockSearch').tap();
 await page.locator('#searchSheet.show').waitFor();
 await sleep(950);
 const searchBefore=await sheetHeight('#searchSheet');
 await touchDrag('#searchGrip',140);
 const searchHalf=await sheetHeight('#searchSheet');
 assert.ok(searchHalf<searchBefore-70,'Search cannot drag down from full to half: '+JSON.stringify({searchBefore,searchHalf}));
 await touchDrag('#searchSheet .hint',-130);
 const searchFull=await sheetHeight('#searchSheet');
 assert.ok(searchFull>searchHalf+70,'Search content does not drag upward: '+JSON.stringify({searchHalf,searchFull}));
 console.log('PASS search title and content vertical dragging',JSON.stringify({searchBefore,searchHalf,searchFull}));
 await scene(2);
 const peek=await sheetHeight('#placeSheet');
 await touchDrag('#placeGrip',-110);
 const half=await sheetHeight('#placeSheet');
 assert.ok(half>peek+90,'Place grab motion did not expand: '+JSON.stringify({peek,half}));
 await touchDrag('#placeSheet .sect p',-110);
 const full=await sheetHeight('#placeSheet');
 assert.ok(full>half+80,'Place content does not expand to full: '+JSON.stringify({peek,half,full}));
 console.log('PASS place from peek through half to full via header/content',JSON.stringify({peek,half,full}));
 await page.locator('#heroPhoto').click();
 await page.locator('#viewer.show').waitFor();
 await page.locator('#viewerX').click();
 await page.locator('#viewer:not(.show)').waitFor();
 console.log('PASS media can open and close above real sheet');
 await scene(6);
 const savedHalf=await sheetHeight('#savedSheet');
 await touchDrag('#savedGrip',-110);
 const savedFull=await sheetHeight('#savedSheet');
 assert.ok(savedFull>savedHalf+70,'Saved card cannot move upward: '+JSON.stringify({savedHalf,savedFull}));
 // After full expansion, drag from its content top back down.
 await touchDrag('#savedSheet .group-label',115);
 const savedAfter=await sheetHeight('#savedSheet');
 assert.ok(savedAfter<savedFull-70,'Saved card content cannot drag downward: '+JSON.stringify({savedFull,savedAfter}));
 console.log('PASS saved card vertical dragging and content preservation',JSON.stringify({savedHalf,savedFull,savedAfter}));
 await scene(7);
 const routeBefore=await sheetHeight('#routeSheet');
 await touchDrag('#routeGrip',-105);
 const routeFull=await sheetHeight('#routeSheet');
 assert.ok(routeFull>routeBefore+80,'Route cannot expand: '+JSON.stringify({routeBefore,routeFull}));
 await touchDrag('#routeSheet .group-label',125);
 const routeHalf=await sheetHeight('#routeSheet');
 assert.ok(routeHalf<routeFull-75,'Route content cannot drag down: '+JSON.stringify({routeFull,routeHalf}));
 await page.locator('#dateChange').click();
 await page.locator('#dateModal.show').waitFor();
 await page.locator('#dateCancel').click();
 await page.locator('#dateModal:not(.show)').waitFor();
 assert.deepEqual(errors,[],'Browser runtime errors');
 console.log('PASS route header/content drag, date cancel and zero runtime errors');
 console.log('PASS tactile Dock preview and all four sheet categories');
 await browser.close();
})().catch(err=>{console.error('FAIL V4 VISUAL MOTION: '+err.stack);process.exit(1)});
