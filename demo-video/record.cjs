const fs=require('fs'),{chromium}=require('playwright');
(async()=>{
 fs.mkdirSync('video-output',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block',recordVideo:{dir:'video-output',size:{width:780,height:1688}}});
 const page=await context.newPage(),video=page.video();
 const captions=[];let start=0;
 const hold=ms=>page.waitForTimeout(ms);
 const mark=async(text,name)=>{const t=Date.now();captions.push({time:t,text});await page.screenshot({path:'video-output/'+name+'.png'});};
 try{
 await page.goto('http://127.0.0.1:8765/v5-poi-zh-20261121/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__atlasPlaceStore&&window.FootprintUnifiedRoute,{timeout:30000});
 await page.evaluate(async()=>{
  await window.__atlasPlaceStore.readAll();
  const db=await new Promise((res,rej)=>{const q=indexedDB.open(window.__fpStorageNamespace,1);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
  const tx=db.transaction(['places','meta'],'readwrite'),s=tx.objectStore('places');
  const names=['山海咖啡','海岸步道','老街书店','观景平台','港口公园'];
  const coords=[[121.905,29.492],[121.909,29.494],[121.912,29.490],[121.916,29.493],[121.920,29.491]];
  for(let i=0;i<261;i++){
   const ll=coords[i]||(i<16?[121.9+(i%5)*.008,29.48+Math.floor(i/5)*.008]:[119.7+(i%16)*.18,30+Math.floor(i/16)*.08]);
   s.put({id:'demo-'+i,title:names[i]||'演示收藏 '+String(i+1).padStart(3,'0'),lat:ll[1],lng:ll[0],starred:true,stage:'plan',note:i===0?'午后喝咖啡，再沿着海边慢慢走。':'仅用于产品演示的模拟地点',address:'演示区域',photos:[],videos:[]});
  }
  const stops=names.map((_,i)=>({placeId:'demo-'+i,day:1,order:i+1}));
  tx.objectStore('meta').put({key:'journey/demo-route',value:{id:'demo-route',title:'沿海慢游 · 五站',startDate:'2026-11-23',endDate:'2026-11-23',updatedAt:'2026-11-23T00:00:00Z',placeIds:stops.map(x=>x.placeId),stops}});
  await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close();
 });
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__atlasDemo?.getSaved?.().length===261,null,{timeout:30000});
 await page.waitForFunction(()=>!!window.__atlasPOIBridge?.vector?.(),null,{timeout:45000});
 await page.evaluate(()=>window.__atlasPOIBridge.vector().jumpTo({center:[121.912,29.492],zoom:13.8}));
 await hold(10000);
 await page.getByRole('button',{name:'知道了',exact:true}).click({timeout:1500}).catch(()=>{});
 const map=await page.evaluate(()=>{const m=window.__atlasPOIBridge.vector();return {loaded:m.loaded(),tiles:m.areTilesLoaded(),features:m.queryRenderedFeatures().length}});
 fs.writeFileSync('video-output/map-check.json',JSON.stringify(map));console.log('MAP',map);
 if(map.features<20)throw Error('Map insufficient for recording');
 start=Date.now();await mark('把想去的地方，收进自己的地图','01-home');await hold(3500);
 await page.locator('#dockStars').click();await hold(1300);
 await mark('261 个演示收藏，也能快速找到','02-collection');await hold(3500);
 await page.locator('#fpSavedSearchInput').fill('咖啡');await hold(900);
 await mark('输入关键词，即时筛选收藏','03-search');await hold(4000);
 await page.locator('#spotList .spotrow:not(.fp-saved-search-miss)').first().click();await hold(1800);
 await mark('从搜索结果，直接打开地点卡片','04-place');await hold(4000);
 await page.evaluate(()=>window.__atlasClosePlace());await hold(1800);
 await page.locator('#dockRoute').click();await hold(1200);
 await page.screenshot({path:'video-output/route-menu.png'});
 const route=page.getByText('沿海慢游 · 五站',{exact:true});
 if(await route.count())await route.first().click();else await page.evaluate(()=>window.FootprintUnifiedRoute.open('demo-route'));
 await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.step==='view',null,{timeout:15000});
 await hold(2200);
 await mark('查看路线时，只显示这次要去的地方','05-route');await hold(4500);
 const header=page.locator('#fpUnifiedRoute .fp-route-heading');
 let box=await header.boundingBox();if(box){
  await page.mouse.move(box.x+70,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+70,box.y-150,{steps:25});await page.mouse.up();await hold(1800);
  await mark('拖动卡片，地图与路线同步呈现','06-card');await hold(2500);
  box=await header.boundingBox();await page.mouse.move(box.x+70,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+70,box.y+170,{steps:25});await page.mouse.up();await hold(1800);
 }
 await page.locator('#fpUnifiedRoute [data-command="saved"]').first().click();await hold(700);
 await page.locator('#fpUnifiedRoute [data-command="new"]').first().click();await hold(1200);
 await page.locator('#fpUnifiedRoute [data-command="toggle"][data-id="demo-0"]').click();
 await page.locator('#fpUnifiedRoute [data-command="toggle"][data-id="demo-1"]').click();await hold(1000);
 await mark('新建路线，先选择想去的地点','07-new');await hold(3500);
 await page.locator('#fpUnifiedRoute [data-command="pickmode"][data-value="map"]').click();await hold(1800);
 await mark('地图选点时，其他收藏重新出现','08-picker');await hold(4000);
 await page.evaluate(()=>window.FootprintUnifiedRoute.leaveMapFocus());await hold(800);
 await page.locator('#fpUnifiedRoute [data-command="exit"]').click();await hold(1800);
 await mark('退出路线，回到完整的收藏地图','09-end');await hold(4000);
 fs.writeFileSync('video-output/timeline.json',JSON.stringify({start,end:Date.now(),captions,baseline:'8e4c9dc139c09ae5cca5b0e1ee18c1cbd31ff7cd'}));
 }catch(e){await page.screenshot({path:'video-output/error.png'});fs.writeFileSync('video-output/error.txt',String(e)+'\n'+await page.locator('body').innerText());throw e}
 finally{await context.close();await video.saveAs('video-output/raw.webm');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});