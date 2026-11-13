'use strict';
const {chromium}=require('playwright');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
async function run(label,url){
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
const page=await ctx.newPage(),cdp=await ctx.newCDPSession(page),errs=[],responses=[];
page.on('pageerror',e=>errs.push(e.message));
page.on('response',r=>{if(r.status()>=400)responses.push({status:r.status(),url:r.url().slice(0,150)})});
await cdp.send('Performance.enable');
await page.addInitScript(()=>{window.__l=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.__l.push({start:e.startTime,d:e.duration})}).observe({entryTypes:['longtask']})});
const start=Date.now();await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000});
await wait(5000);
let before=(await cdp.send('Performance.getMetrics')).metrics;
let init=await page.evaluate(()=>({htmlLen:document.documentElement.outerHTML.length,tags:document.querySelectorAll('*').length,
  styleSheets:document.styleSheets.length,
  canvas:document.querySelectorAll('canvas').length, videos:document.querySelectorAll('video').length,
  resources:performance.getEntriesByType('resource').length,
  long:window.__l,
  scripts:document.querySelectorAll('script').length,
  map:document.querySelector('#map')?.childElementCount||0,
  search:document.querySelector('#fpSearchSheet')?.childElementCount||0,
  ready:document.readyState
}));
function metrics(z){return Object.fromEntries(z.filter(x=>/LayoutCount|RecalcStyleCount|ScriptDuration|TaskDuration|Nodes|JSHeapUsedSize|LayoutDuration|RecalcStyleDuration|Frames/.test(x.name)).map(x=>[x.name,+x.value.toFixed(3)]))}
let frame=async(ms=2200)=>page.evaluate(async(ms)=>{
 let times=[],t=performance.now(),stop=t+ms;
 await new Promise(r=>{function tick(now){times.push(now);if(now<stop)requestAnimationFrame(tick);else r()}requestAnimationFrame(tick)});
 const ds=times.slice(1).map((t,i)=>t-times[i]);
 return {count:ds.length,p50:ds.toSorted((a,b)=>a-b)[Math.floor(ds.length*.5)]?.toFixed(2),
 p95:ds.toSorted((a,b)=>a-b)[Math.floor(ds.length*.95)]?.toFixed(2),
 over32:ds.filter(d=>d>32).length,max:Math.max(0,...ds).toFixed(1)}},ms);
let idle=await frame();
let after=(await cdp.send('Performance.getMetrics')).metrics;
console.log(label+' BASE '+JSON.stringify({startupMs:Date.now()-start,init:{...init,long:init.long.slice(0,15)},before:metrics(before),after:metrics(after),idle,errs,failed:responses.slice(0,9)}));
if(label==='REAL'){
  const click=Date.now();await page.locator('#dockSearch').click({timeout:15000});await wait(250);
  let transition=await frame(1800);let s=(await cdp.send('Performance.getMetrics')).metrics;
  let l=await page.evaluate(()=>window.__l);
  console.log(label+' SEARCH '+JSON.stringify({startToFrameMs:Date.now()-click,frame:transition,metrics:metrics(s),longTasks:l.slice(-20)}));
  const {Input}=await cdp.send('Schema.getDomains').catch(()=>({Input:{}}));
  const box=await page.locator('#fpSearchSheet .fp-search-top').boundingBox();
  if(box){
   let x=box.x+box.width*.45,y=box.y+25;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
   for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+130*i/12,id:1}]});await wait(17)}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(700);
  }
  console.log(label+' CARD '+JSON.stringify(await page.evaluate(()=>({state:window.__atlasSheetIntegration?.search?.getState()?.sheet,height:document.getElementById('fpSearchSheet')?.getBoundingClientRect().height,longTasks:window.__l.slice(-20)}))));
}
await ctx.close();
}
await run('STATIC','https://fanbregas-netizen.github.io/travel-atlas-pages/v4-visual-motion-acceptance-20261113/');
await run('REAL','https://fanbregas-netizen.github.io/travel-atlas-pages/v4-approved-ux-real-review-20261113/');
await browser.close();
})().catch(e=>{console.error('PERFORMANCE DIAGNOSTIC FAILED',e.stack);process.exit(1)});
