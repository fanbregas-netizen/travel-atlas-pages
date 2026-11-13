'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const origin='https://fanbregas-netizen.github.io/travel-atlas-pages/';
const cases=[['baseline','v4-approved-ux-real-review-20261113/'],['fluidity','v4-iphone-fluidity-20261113/'],['cacheable','v4-iphone-cacheable-20261113/']];
async function check(label,path){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1'});
 const page=await ctx.newPage(),cdp=await ctx.newCDPSession(page),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.goto(origin+path,{waitUntil:'domcontentloaded',timeout:75000});
 await page.waitForFunction(()=>!!window.__atlasFlowRefresh&&!!window.__atlasPlaceStore&&!!window.__atlasPOIBridge?.vector?.(),null,{timeout:40000});
 await page.evaluate(async()=>{
  // New ephemeral Playwright browser + isolated Pages namespace, never user data.
  const entries=Array.from({length:22},(_,i)=>({
    id:'perf-star-'+i,title:'性能回归收藏'+i,lat:29.47+(i%6)*.006,lng:121.85+Math.floor(i/6)*.012,
    starred:true,rank:2,note:'性能测试地点',date:'2026-11-13',photos:[],videos:[],references:[],guides:[],
    address:'测试占位'
  }));
  for(const rec of entries)await window.__atlasPlaceStore.save(rec);
  await window.__atlasFlowRefresh();
  const map=window.__atlasPOIBridge.vector();
  map.jumpTo({center:[121.865,29.485],zoom:13.8,bearing:0,pitch:0});
 });
 await sleep(1700);
 const result=await page.evaluate(async()=>{
  const map=window.__atlasPOIBridge.vector();
  const pane=document.getElementById('atlasBookmarkOverlay');
  let added=0,removed=0,calls=0;
  const original=Map.prototype.set;
  const observer=new MutationObserver(changes=>{
   for(const c of changes){
    if(c.type!=='childList')continue;
    added+=c.addedNodes.length;removed+=c.removedNodes.length;
   }
  });
  observer.observe(pane,{childList:true,subtree:false});
  let frames=[],now=performance.now(),deadline=now+2250;
  let done=false;
  const capture=t=>{if(!done){frames.push(t);requestAnimationFrame(capture)}};
  requestAnimationFrame(capture);
  // Animated map movement, same map style and saved-star count for every case.
  map.panBy([140,55],{duration:1300,easing:t=>t});
  await new Promise(resolve=>setTimeout(resolve,2300));
  done=true;observer.disconnect();
  let ds=frames.slice(1).map((x,i)=>x-frames[i]).sort((a,b)=>a-b);
  const ids=[...pane.querySelectorAll('.atlas-bookmark-hit')].map(e=>e.dataset.placeId);
  return {
    frames:ds.length,p95:+(ds[Math.floor(ds.length*.95)]||0).toFixed(1),
    p50:+(ds[Math.floor(ds.length*.5)]||0).toFixed(1),
    over50:ds.filter(x=>x>50).length,longest:+(ds.at(-1)||0).toFixed(1),
    childAdds:added,childRemoves:removed,visibleStars:ids.length,uniqueStars:new Set(ids).size,
    starsInStorage:window.__atlasDemo.getSaved().filter(x=>x.starred!==false).length,
    mapZoom:map.getZoom(),provider:window.__atlasMapHealth?.().provider,
    allClickTargets:[...pane.querySelectorAll('.atlas-bookmark-hit')].every(x=>x.tagName==='BUTTON')
  };
 });
 console.log('PAN_STRESS '+label+' '+JSON.stringify({result,errors}));
 assert.equal(result.starsInStorage,22,'seeded data did not load');
 assert.ok(result.uniqueStars===result.visibleStars,'duplicate saved star nodes');
 assert.ok(result.allClickTargets,'lost click targets');
 assert.ok(!errors.some(x=>/TypeError|ReferenceError|SyntaxError/.test(x)),'page runtime error');
 await ctx.close();await browser.close();
}
(async()=>{for(const [name,p] of cases)await check(name,p)})().catch(e=>{console.error('PAN_STRESS_FAILED',e.stack);process.exit(1)});
