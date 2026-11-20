/* Footprint Map V5 RC1 smoke: live isolated Pages snapshot, ephemeral profiles only.
 * Never touches a user's real IndexedDB or the frozen release branch.
 * WebKit ≠ a physical iPhone; gesture smoothness still needs real-device review. */
const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const URL=process.env.RC_URL||'https://fanbregas-netizen.github.io/travel-atlas-pages/v5-route-touch-elastic-20261120/';
const OUT='qa/v5-rc1/evidence';
fs.mkdirSync(OUT,{recursive:true});
const checks=[];
const note=(engine,test,status,detail='')=>{
 checks.push({engine,test,status,detail:String(detail).slice(0,750)});
 process.stdout.write('['+engine+'] '+status+' '+test+(detail?' — '+String(detail).slice(0,200):'')+'\n');
};
const tested=async(engine,name,fn)=>{
 try{let detail=await fn();note(engine,name,'PASS',detail===undefined?'':detail);return true}
 catch(e){note(engine,name,'FAIL',e.message||e);return false}
};
async function publicAssets(){
 for(const file of ['index.html','QA_BUILD.json','src/route/route-single-map-v1.js','src/visual/v5-card-system-unified-20261119.css']){
  await tested('HTTP',file,async()=>{
   const response=await fetch(new globalThis.URL(file+'?rc1-smoke='+Date.now(),URL),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});
   assert.equal(response.status,200,'HTTP status '+response.status);
   const text=await response.text();assert(text.length>300,file+' unexpectedly small');
   if(file==='QA_BUILD.json'){const j=JSON.parse(text);assert.equal(j.source_commit,'4de6a6bb04c7dfdffa6ae6f6fe3f799375b7d634');}
   if(file==='index.html'){assert(text.includes('fp-map-credits-menu-v2'));assert(text.includes('v=route-tap-elastic-20261120b'));}
   if(file.endsWith('.js')){assert(text.includes('fp-single-hit'));assert(text.includes('fp-single-selected-halo'));}
   return text.length+' bytes, no-cache HTTP 200';
  });
 }
}
async function browserRun(engine,type,width){
 const tag=engine+'-'+width;
 let browser;
 try{browser=await type.launch({headless:true,args:engine==='chromium'?['--no-sandbox']:[]})}
 catch(e){note(tag,'launch','BLOCKED',e.message);return}
 const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
 const page=await context.newPage();
 const pageErrors=[],rejected=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 page.on('requestfailed',r=>{if(/openfreemap|openmaptiles|maplibre|amap|osrm/.test(r.url()))rejected.push(r.url().split('?')[0])});
 const shot=async(name)=>{try{await page.screenshot({path:OUT+'/'+tag+'-'+name+'.png',fullPage:false,timeout:10000})}catch(e){note(tag,'screenshot '+name,'BLOCKED',e.message)}};
 try{
  const loaded=await tested(tag,'cold start and visible page',async()=>{
    const response=await page.goto(URL,{waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(response?.status(),200);
    await page.waitForSelector('#appDock #dockRoute',{state:'attached',timeout:14000});
    assert(await page.locator('body').isVisible());
    return page.url();
  });
  if(!loaded)return;
  await page.waitForTimeout(2500);
  await shot('01-home');
  await tested(tag,'Dock exact order, 3 unique controls',async()=>{
    const arr=await page.locator('#appDock > button').evaluateAll(nodes=>nodes.map(n=>n.id));
    assert.deepEqual(arr,['dockStars','dockRoute','dockMap']);return arr.join(' / ');
  });
  await tested(tag,'Map attribution removed from overlay and credits retained',async()=>{
    const result=await page.evaluate(()=>{
      const p=document.querySelector('#fpMapDataCredits');
      const over=document.querySelector('#atlasVectorMap .maplibregl-ctrl-attrib');
      return {credits:!!p,links:[...p?.querySelectorAll('a')||[]].map(a=>a.href),overVisible:!!over&&getComputedStyle(over).display!=='none'};
    });
    assert(result.credits);
    assert(result.links.some(x=>x.includes('openfreemap.org')));
    assert(result.links.some(x=>x.includes('openmaptiles.org')));
    assert(result.links.some(x=>x.includes('openstreetmap.org/copyright')));
    assert(!result.overVisible);
    return 'Menu links '+result.links.length+', on-map copyright strip hidden';
  });
  await tested(tag,'Collection entry and credits expand',async()=>{
    await page.locator('#dockStars').click({force:true,timeout:12000});
    await page.waitForTimeout(450);
    const drawer=await page.locator('#drawer').evaluate(n=>({className:n.className,hidden:n.hidden,display:getComputedStyle(n).display,rect:n.getBoundingClientRect().height}));
    assert(!drawer.hidden && drawer.display!=='none');
    const details=page.locator('#fpMapDataCredits');
    const initiallyOpen=await details.evaluate(n=>n.open);
    if(!initiallyOpen)await page.locator('#fpMapDataCredits summary').click({force:true,timeout:6000});
    assert(await details.evaluate(n=>n.open),'Credits details could not be expanded');
    return drawer.className;
  });
  await shot('02-collection');
  await tested(tag,'Close collection safely',async()=>{
    await page.locator('#closeDrawer').click({force:true,timeout:6000});
    await page.waitForTimeout(250);
  });
  const routeOpened=await tested(tag,'Route opens on SAME shared map',async()=>{
    await page.waitForFunction(()=>!!window.FootprintUnifiedRoute,{timeout:18000});
    const state=await page.evaluate(async()=>({result:await window.FootprintUnifiedRoute.open(),state:window.FootprintUnifiedRoute.state,canvas:window.FootprintUnifiedRoute.canvasCount}));
    assert(state.result!==false,'shared MapLibre renderer unavailable');
    assert(state.state.open,'route controller stayed closed');
    assert(state.canvas<=1,'duplicate map canvas');
    return JSON.stringify(state);
  });
  if(routeOpened){
    await page.waitForTimeout(450);
    await shot('03-route-list');
    await tested(tag,'Route list / empty-state is readable',async()=>{
      const t=await page.locator('#fpUnifiedRoute').innerText();
      assert(t.includes('我的路线'),'missing heading 我的路线');
      return t.slice(0,140).replace(/\s+/g,' ');
    });
    await tested(tag,'Start planning without touching user data',async()=>{
      await page.locator('#fpUnifiedRoute [data-command="new"]').first().click({force:true,timeout:7000});
      const state=await page.evaluate(()=>window.FootprintUnifiedRoute.state);
      assert.equal(state.step,'pick');assert.equal(state.order.length,0);
      return JSON.stringify(state);
    });
    await shot('04-new-route');
    await tested(tag,'Sheet 3-detent simulated pointer gesture',async()=>{
      const grip=page.locator('#fpUnifiedRoute .fp-route-grip');
      const box=await grip.boundingBox();assert(box,'sheet grip missing');
      const x=box.x+box.width/2,y=box.y+box.height/2;
      const before=await page.evaluate(()=>window.FootprintUnifiedRoute.state);
      await page.mouse.move(x,y);await page.mouse.down();
      for(let i=1;i<=8;i++){await page.mouse.move(x,y-i*16,{steps:1});await page.waitForTimeout(22)}
      await page.mouse.up();await page.waitForTimeout(950);
      const after=await page.evaluate(()=>window.FootprintUnifiedRoute.state);
      assert(after.cardHeight>0);
      assert(after.panel!==undefined);
      return before.panel+'→'+after.panel+'; height '+before.cardHeight+'→'+after.cardHeight;
    });
    await shot('05-sheet-drag');
    await tested(tag,'Exit route and restore home state',async()=>{
      await page.locator('#fpUnifiedRoute [data-command="exit"]').first().click({force:true,timeout:7000});
      await page.waitForTimeout(700);
      const s=await page.evaluate(()=>({
       state:window.FootprintUnifiedRoute.state,
       labels:document.querySelectorAll('#atlasBookmarkOverlay .fp-route-stop-order').length,
       popup:document.querySelectorAll('.fp-route-segment-popup:not(.is-closing)').length,
       dock:!!document.querySelector('#appDock')
      }));
      assert(!s.state.open,'route still open after close');
      assert.equal(s.labels,0);assert.equal(s.popup,0);assert(s.dock);
      return JSON.stringify(s);
    });
    await shot('06-after-close');
    await tested(tag,'Reopen then close without freezing',async()=>{
      const response=await page.evaluate(async()=>await window.FootprintUnifiedRoute.open());
      assert(response!==false,'failed reopening');
      assert((await page.evaluate(()=>window.FootprintUnifiedRoute.state)).open);
      await page.evaluate(()=>window.FootprintUnifiedRoute.close());
      await page.waitForTimeout(650);
      assert(!(await page.evaluate(()=>window.FootprintUnifiedRoute.state)).open);
    });
  }else note(tag,'Saved-route geometry, road tap and real spring','NOT_TESTED','route unable to open in browser environment');
  await tested(tag,'Reload maintains independent product shell',async()=>{
    await page.reload({waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForSelector('#appDock #dockRoute',{timeout:12000});
    assert.deepEqual(await page.locator('#appDock > button').evaluateAll(nodes=>nodes.map(n=>n.id)),['dockStars','dockRoute','dockMap']);
  });
  note(tag,'Real iPhone Safari gestures','NOT_TESTED','WebKit simulation is not device hardware; needs manual acceptance.');
  note(tag,'Road tapping and saved-route full geometry','NOT_TESTED','No fixture routes inserted; do not count as passed.');
  if(pageErrors.length)note(tag,'uncaught page errors','FAIL',pageErrors.join(' | '));else note(tag,'uncaught page errors','PASS','none');
  if(rejected.length)note(tag,'external map/network requests','INFO',rejected.slice(0,6).join(' | '));
 }catch(e){note(tag,'unexpected test failure','FAIL',e.stack||String(e))}
 finally{await context.close();await browser.close()}
}
(async()=>{
 await publicAssets();
 await browserRun('chromium',chromium,390);
 await browserRun('webkit',webkit,390);
 await browserRun('chromium',chromium,375);
 const summary={
  generated_at:new Date().toISOString(),
  rc1_source:'4de6a6bb04c7dfdffa6ae6f6fe3f799375b7d634',
  checked_url:URL,
  note:'Automated WebKit/Chromium only. Physical Safari and real saved-route gesture QA remains unverified.',
  checks
 };
 fs.writeFileSync(OUT+'/summary.json',JSON.stringify(summary,null,2));
 const counts={};for(const x of checks)counts[x.status]=(counts[x.status]||0)+1;
 process.stdout.write('\nRC1 RESULTS '+JSON.stringify(counts)+'\n');
 if((counts.FAIL||0)>0)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2});