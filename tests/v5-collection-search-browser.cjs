'use strict';
/* Full isolated V5 + real persisted 261 bookmarks. Browser context is ephemeral;
 * do not access any user's personal Safari profile or production IndexedDB.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const base='http://127.0.0.1:8765/v5-poi-zh-20261121/';
const evidence=path.resolve(__dirname,'../v5-collection-search-evidence');
fs.mkdirSync(evidence,{recursive:true});
async function scenario(kind,engine,width){
 const browser=await engine.launch({headless:true,args:kind==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,
  deviceScaleFactor:2,serviceWorkers:'block'});
 const page=await context.newPage();
 try{
  let response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:35000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>typeof window.__atlasPlaceStore?.readAll==='function'&&
   typeof window.__fpSavedSearchQA?.getState==='function',null,{timeout:20000});
  await page.waitForFunction(async()=>{
   try{return Array.isArray(await window.__atlasPlaceStore.readAll())}catch{return false}
  },null,{timeout:12000});
  await page.evaluate(async()=>{
   // Browser storage is a fresh QA namespace, never a real user's collection.
   const named=[
    {title:'24氪·油馬咖啡',note:'想找时间和朋友喝咖啡'},
    {title:'1876新视觉',note:'设计展览'},
    {title:'江郎山·廿八都旅游区廿八都古镇',note:'旅途中想慢慢走走。'.repeat(12)+'特别的红色长椅'},
    {title:'一只花园(大零号湾店)',note:'下午茶',address:'上海市闵行区大零号湾'}
   ];
   const records=Array.from({length:261},(_,i)=>({
    id:'qa-search-'+String(i).padStart(3,'0'),
    title:named[i]?.title||'普通收藏地点 '+String(i).padStart(3,'0'),
    note:named[i]?.note||'待安排的旅行计划',
    address:named[i]?.address||'',starred:true,stage:'plan',
    date:'2026-11-21',photos:[],videos:[],
    lat:30.2+i*.001,lng:120.3+i*.001
   }));
   const db=await new Promise((resolve,reject)=>{
    const q=indexedDB.open(window.__fpStorageNamespace||'private-travel-footprints-v1',1);
    q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
   });
   await new Promise((resolve,reject)=>{
    const tx=db.transaction('places','readwrite'),store=tx.objectStore('places');
    records.forEach(p=>store.put(p));
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
   });db.close();
  });
  await page.reload({waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>window.__atlasDemo?.getSaved?.().filter(p=>p.starred!==false).length===261,null,{timeout:20000});
  await page.locator('#dockStars').click();
  await page.waitForFunction(()=>document.getElementById('drawer')?.classList.contains('visible')&&
   document.getElementById('drawer')?.classList.contains('fp30-detail')&&
   window.__fpSavedSearchQA?.getState().total===261&&window.__fpSavedSearchQA?.getState().open,null,{timeout:10000});
  const input=page.locator('#fpSavedSearchInput');
  assert(await input.isVisible(),kind+' search missing in collection');
  const geometry=await input.evaluate(el=>({
   font:getComputedStyle(el).fontSize,rect:el.getBoundingClientRect().toJSON(),bodyWidth:innerWidth
  }));
  assert.equal(geometry.font,'16px',kind+' Safari focus zoom on small font');
  assert(geometry.rect.left>=15&&geometry.rect.right<=width-16,kind+' input overflows card');
  assert.equal(await page.locator('#spotList .spotrow').count(),261);
  await page.screenshot({path:path.join(evidence,kind+'-'+width+'-all-261.png')});
  async function expectQuery(q,n){
   await input.fill(q);
   await page.waitForFunction(expected=>window.__fpSavedSearchQA?.getState().shown===expected,n,{timeout:3500});
   assert.equal(await page.locator('#spotList .spotrow:not(.fp-saved-search-miss)').count(),n,
    kind+' search count for '+q);
   assert.equal(await page.locator('#fpSavedSearchEmpty').isVisible(),!!q&&n===0,
    kind+' no-results mismatch');
  }
  await expectQuery('油馬',1);
  const coffee=await page.locator('#spotList .spotrow:not(.fp-saved-search-miss) strong').textContent();
  assert(coffee.includes('油馬'));
  await expectQuery('特别的红色长椅',1); // beyond displayed note preview
  await expectQuery('闵行',1); // address field (not shown in list)
  await expectQuery('江郎山 古镇',1); // multi-keyword AND
  await expectQuery('查无此地XYZ',0);
  await page.screenshot({path:path.join(evidence,kind+'-'+width+'-empty-search.png')});
  await page.locator('#fpSavedSearchClear').click();
  await page.waitForFunction(()=>window.__fpSavedSearchQA?.getState().shown===261);
  assert.equal(await input.inputValue(),'');
  assert.equal(await page.locator('#fpSavedSearchMeta').isVisible(),false);
  await expectQuery('普通收藏地点',257);
  await page.screenshot({path:path.join(evidence,kind+'-'+width+'-filtered.png')});
  await expectQuery('油馬',1);
  await page.locator('#spotList .spotrow:not(.fp-saved-search-miss)').click();
  await page.waitForFunction(()=>document.body.classList.contains('fp-place-open')||
   !document.querySelector('#fpPlaceCard')?.hidden,null,{timeout:8000});
  const count=await page.evaluate(async()=>((await window.__atlasPlaceStore.readAll()).filter(x=>x.starred!==false).length));
  assert.equal(count,261,'Search must never alter saved data');
  console.log(JSON.stringify({kind,width,status:'PASS',saved:count,filter:'title+full note+address',multiTerm:true,openPlace:true}));
 }finally{await context.close();await browser.close()}
}
(async()=>{
 for(const [kind,engine] of [['chromium',chromium],['webkit',webkit]])
  for(const width of [390,430])await scenario(kind,engine,width);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
