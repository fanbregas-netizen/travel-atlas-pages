'use strict';
/* V5 PR54 integration smoke. Real published product POI renderer and CSS,
 * deterministic map projection only; not a real Safari/MapLibre tile test. */
const assert=require('node:assert/strict'),cp=require('node:child_process'),fs=require('node:fs');
const {chromium}=require('playwright-core');
const browserBin=['google-chrome','google-chrome-stable','chromium'].map(n=>{
 try{return cp.execFileSync('which',[n],{encoding:'utf8'}).trim()}catch{return null}
}).find(Boolean);
if(!browserBin)throw Error('No Chromium binary installed');
const base='https://fanbregas-netizen.github.io/travel-atlas-pages/v5-pr53-one-map-20261119/';
(async()=>{
 const browser=await chromium.launch({executablePath:browserBin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 fs.mkdirSync('v5-pr54-poi-evidence',{recursive:true});
 try{
  for(const width of [375,390,430]){
   const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const urls=['QA_BUILD.json','stage1-29-poi.js','stage1-29-ui.css','src/visual/v5-map-quality-pass.css','src/map/poi-identity-v5.js','v4-map-runtime.js'];
   const responses=await Promise.all(urls.map(p=>page.request.get(base+p)));
   for(let i=0;i<urls.length;i++)assert.equal(responses[i].status(),200,'live asset HTTP '+urls[i]);
   const strings=await Promise.all(responses.map(r=>r.text()));
   const manifest=JSON.parse(strings[0]);
   assert.equal(manifest.source_commit,'fc656a22872839deec6bbfc8c915f1b6a67b508e','published PR54 version mismatch');
   const blankTap=strings[5].split('function selectVectorTap(e){')[1]?.split('let fallbackScriptRequest=null;')[0]||'';
   assert.ok(blankTap&&!/queryRenderedFeatures|getPoiFromFeatures|showDestination/.test(blankTap),'hidden broad POI hit remains');
   await page.setContent('<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width,initial-scale=1"><base href="'+base+'"></head><body class="vector-active" style="margin:0;background:#dbe7df"><div id="atlasVectorMap" style="position:fixed;inset:0"></div><div id="atlasPoiOverlay" style="position:fixed;inset:0"></div><div id="atlasBookmarkOverlay"></div><div id="appDock" style="position:fixed;top:800px"></div></body></html>');
   await page.addStyleTag({content:strings[2]});
   await page.addStyleTag({content:strings[3]});
   await page.addScriptTag({content:strings[4]});
   await page.evaluate(()=>{
    const pts=[
     {id:7101,name:'静安寺',cat:'historic',lng:121.452,lat:31.240},
     {id:7102,name:'香气咖啡馆',cat:'cafe',lng:121.458,lat:31.238},
     {id:7103,name:'人民公园',cat:'park',lng:121.463,lat:31.235}
    ];
    window.__qaSelection=[];
    window.__qaCallbacks={};
    window.__qaSaved=[];
    window.__qaShift=0;
    window.__atlasSavedPOIAnchors=()=>window.__qaSaved;
    window.AtlasPOIMotion={popSelected:()=>{},play:()=>{}};
    const map={
     getZoom:()=>16.1,isStyleLoaded:()=>true,
     getStyle:()=>({layers:[{id:'poi_label',source:'demo',type:'symbol','source-layer':'poi',layout:{visibility:'visible'}}]}),
     querySourceFeatures:()=>pts.map(p=>({id:p.id,properties:{name:p.name,class:p.cat},geometry:{type:'Point',coordinates:[p.lng,p.lat]}})),
     project:([lng,lat])=>({x:120+(lng-121.452)*20000+window.__qaShift,y:300-(lat-31.240)*20000}),
     on:(event,fn)=>{(window.__qaCallbacks[event]??=[]).push(fn)},
     getPaintProperty:()=>1,setPaintProperty:()=>{}
    };
    window.__qaMap=map;
    window.__atlasPOIBridge={vector:()=>map,official:()=>null,select:p=>{
     window.__qaSelection.push(p);document.body.classList.add('destination-selected');
    }};
   });
   await page.addScriptTag({content:strings[1]});
   await page.waitForFunction(()=>document.querySelectorAll('#atlasPoiOverlay > .fp-poi').length===3,null,{timeout:10000});
   const icons=await page.locator('#atlasPoiOverlay .fp-poi-token').evaluateAll(nodes=>nodes.map(n=>({
     width:getComputedStyle(n).width,height:getComputedStyle(n).height,
     imgWidth:getComputedStyle(n.querySelector('img')).width
   })));
   assert.ok(icons.every(i=>i.width==='31px'&&i.height==='31px'&&i.imgWidth==='20px'),'POI icon size split '+JSON.stringify(icons));
   await page.locator('#atlasPoiOverlay > .fp-poi').nth(0).click();
   await page.locator('#atlasPoiOverlay > .fp-poi').nth(1).click();
   assert.equal(await page.evaluate(()=>window.__qaSelection.length),2,'two genuine taps should select exactly two visible POIs');
   assert.equal(await page.locator('#atlasPoiOverlay .fp-poi.is-selected').count(),1,'selected source must be single visible icon');
   await page.evaluate(()=>{
    window.__qaFirstRef=document.querySelector('#atlasPoiOverlay > .fp-poi');
    window.__atlasPOICentering=true;
    window.__qaShift=15;
    document.dispatchEvent(new Event('atlas:poi-source-updated'));
   });
   await page.waitForTimeout(210);
   assert.ok(await page.evaluate(()=>window.__qaFirstRef===document.querySelector('#atlasPoiOverlay > .fp-poi')),'centering detached/recreated DOM');
   await page.evaluate(()=>{
    window.__atlasPOICentering=false;
    window.__atlasPOICommitCurrent?.();
   });
   await page.waitForTimeout(170);
   assert.equal(await page.locator('#atlasPoiOverlay > .fp-poi').count(),3,'pan commit duplicated POI');
   const refKept=await page.evaluate(()=>window.__qaFirstRef===document.querySelector('#atlasPoiOverlay > .fp-poi'));
   assert.ok(refKept,'pan commit did not reuse original node');
   await page.evaluate(()=>{
    window.__qaSaved=[{id:'saved-01',poiId:'7101|121.45200,31.24000',lat:31.240,lng:121.452,title:'静安寺'}];
    document.dispatchEvent(new Event('atlas:saved-stars-changed'));
   });
   await page.waitForTimeout(250);
   assert.equal(await page.locator('#atlasPoiOverlay > .fp-poi').count(),2,'saved star must replace original POI instead of stacking');
   await page.evaluate(()=>{
    window.__qaSaved=[];
    document.dispatchEvent(new Event('atlas:saved-stars-changed'));
   });
   await page.waitForTimeout(250);
   assert.equal(await page.locator('#atlasPoiOverlay > .fp-poi').count(),3,'unsave must restore original POI');
   await page.screenshot({path:'v5-pr54-poi-evidence/'+width+'-restored.png'});
   assert.deepEqual(errors,[],'no JavaScript exceptions');
   console.log('PASS PR54 integrated POI DOM',width,{icons:icons.map(x=>x.width),taps:2,selected:1,reused:refKept,restored:3});
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
