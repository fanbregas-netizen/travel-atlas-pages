'use strict';
const {chromium}=require('playwright');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const urls={
 demo:'https://fanbregas-netizen.github.io/travel-atlas-pages/v4-visual-motion-acceptance-20261113/',
 real:'https://fanbregas-netizen.github.io/travel-atlas-pages/v4-approved-ux-real-review-20261113/',
 perf:'https://fanbregas-netizen.github.io/travel-atlas-pages/v4-iphone-fluidity-20261113/',
 cacheable:'https://fanbregas-netizen.github.io/travel-atlas-pages/v4-iphone-cacheable-20261113/'
};
function summarizeCPU(profile,limit=28){
 const byId=new Map(profile.nodes.map(n=>[n.id,n]));
 const totals=new Map();let total=0;
 (profile.samples||[]).forEach((id,i)=>{
  const n=byId.get(id);if(!n)return;
  const k=n.callFrame.functionName+' | '+n.callFrame.url.slice(0,140)+' :'+n.callFrame.lineNumber;
  const dt=(profile.timeDeltas?.[i]||1000)/1000;total+=dt;
  totals.set(k,(totals.get(k)||0)+dt);
 });
 return {sampleMs:Math.round(total),top:[...totals].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([func,ms])=>({func,ms:Math.round(ms),sharePct:+(ms/Math.max(total,1)*100).toFixed(1)}))};
}
function frames(p){if(!p?.length)return null;const a=p.slice(1).map((x,i)=>x-p[i]),s=a.slice().sort((x,y)=>x-y);return {frames:a.length,p50:+s[Math.floor(s.length*.5)].toFixed(1),p95:+s[Math.floor(s.length*.95)].toFixed(1),over32:a.filter(x=>x>32).length,over50:a.filter(x=>x>50).length,longest:+s.at(-1).toFixed(1)}}
async function profile(label,url,rate=4){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1'});
 const page=await ctx.newPage(),cdp=await ctx.newCDPSession(page),errs=[];
 page.on('pageerror',e=>errs.push(e.message));
 await cdp.send('Emulation.setCPUThrottlingRate',{rate});
 await cdp.send('Profiler.enable');
 await cdp.send('Profiler.setSamplingInterval',{interval:250});
 await page.addInitScript(()=>{
   window.__perf={tasks:[],frames:[]};
   try{new PerformanceObserver(list=>{for(const x of list.getEntries())window.__perf.tasks.push({start:Math.round(x.startTime),ms:Math.round(x.duration)})}).observe({entryTypes:['longtask']})}catch(e){}
   const start=performance.now();
   const track=t=>{if(t-start<7500){window.__perf.frames.push(t);requestAnimationFrame(track)}};
   requestAnimationFrame(track);
 });
 await cdp.send('Profiler.start');
 let gotoStatus='ok',start=Date.now();
 try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:75000})}catch(e){gotoStatus=String(e).slice(0,200)}
 await wait(7000);
 const startup=(await cdp.send('Profiler.stop')).profile;
 const init=await page.evaluate(()=>({ready:document.readyState,scripts:document.querySelectorAll('script').length,styles:document.styleSheets.length,canvas:document.querySelectorAll('canvas').length,bodyClass:document.body.className,
  long:window.__perf.tasks,frame:window.__perf.frames.length?window.__perf.frames:[],
  stableMap:window.__atlasStableMapEnabled,
  sheetState:window.__atlasSheetIntegration?.card?.getState().sheet}));
 console.log('PROFILE_STARTUP '+label+' '+JSON.stringify({gotoStatus,elapsedMs:Date.now()-start,
  cpu:summarizeCPU(startup,25),
  tasks:init.long.slice(0,70),frame:frames(init.frame),
  scripts:init.scripts,styles:init.styles,canvas:init.canvas,bodyClass:init.bodyClass.slice(0,180),stableMap:init.stableMap,errs}));
 if(label!=='demo'){
   await cdp.send('Profiler.start');
   const start=Date.now();
   await page.locator('#dockSearch').click({timeout:18000});
   await wait(1500);
   const s=(await cdp.send('Profiler.stop')).profile;
   console.log('PROFILE_SEARCH '+JSON.stringify({elapsed:Date.now()-start,cpu:summarizeCPU(s,22),state:await page.evaluate(()=>window.__atlasSheetIntegration?.search?.getState()?.sheet),errors:errs}));
 }
 if(label==='perf'||label==='cacheable'){
   await cdp.send('Profiler.start');
   await page.reload({waitUntil:'domcontentloaded',timeout:75000});
   await wait(4000);
   const repeat=(await cdp.send('Profiler.stop')).profile;
   const nav=await page.evaluate(()=>{
    const n=performance.getEntriesByType('navigation')[0];
    return {dcl:n?.domContentLoadedEventEnd,load:n?.loadEventEnd,transfer:n?.transferSize,resources:performance.getEntriesByType('resource').length,
      mapLoaded:document.body.classList.contains('atlas-remote-ready'),bridge:!!window.__atlasSheetIntegration};
   });
   console.log('PROFILE_REPEAT '+label+' '+JSON.stringify({cpu:summarizeCPU(repeat,12),navigation:nav}));
 }
 await browser.close();
}
(async()=>{
 await profile('demo',urls.demo,4);
 await profile('real',urls.real,4);
 await profile('perf',urls.perf,4);
 await profile('cacheable',urls.cacheable,4);
})().catch(e=>{console.error('PROFILE_FAILED',e.stack);process.exit(1)});
