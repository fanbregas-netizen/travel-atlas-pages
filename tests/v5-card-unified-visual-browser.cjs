'use strict';
/* Product card CSS acceptance with Chromium at iPhone widths.
 * The actual published stylesheet stack drives these existing DOM selectors.
 * The fixture is deterministic; this is NOT real iPhone Safari or map QA.
 */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const base='v5-card-unified-20261119',index=fs.readFileSync(base+'/index.html','utf8');
const files=[...index.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\.\/([^"?#]+)/g)].map(m=>m[1]);
assert.ok(files.at(-1)==='src/visual/v5-card-system-unified-20261119.css');
const css=files.map(p=>fs.readFileSync(path.join(base,p),'utf8')).join('\n');
const chrome=['google-chrome','google-chrome-stable','chromium'].map(n=>{try{return cp.execFileSync('which',[n],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
assert.ok(chrome,'Chromium browser unavailable');
const html='<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;background:#78928a}</style></head><body>'
+'<section id="fpPlaceCard" style="height:354px"><header class="fp-card-header"><button class="atlas-card-grip"></button><h2 class="fp-card-name">长寿路</h2><button class="fp-card-close">×</button><span class="fp-place-stage">想去</span><div class="fp-card-head-actions"><button>☆</button></div></header><div class="fp-card-scroll"><section class="fp-block"><div class="fp-subheading"><span class="fp-section-index">01</span><strong class="fp-section-label">Brief</strong><button class="fp-subaction">编辑</button></div><p class="fp-brief-text">旅行记录与想法。</p></section></div></section>'
+'<section id="destinationCard" class="destination-card visible"><button id="destinationClose" class="destination-close">×</button><div class="destination-title">美平路罗智路</div><div class="destination-category">目的地</div><div class="destination-actions"><button class="destination-star">收藏并记录</button><button class="destination-route">导航</button></div></section>'
+'<section id="drawer" class="drawer fp30-hub visible"><div class="drawer-head"><div class="sheet-grab"></div><h2><span class="drawer-cn">我的收藏</span><span id="sheetCount"></span></h2><button id="closeDrawer" class="iconclose">×</button></div><div class="fp30-hub-grid"><button class="fp30-entry"><strong>收藏地点</strong><small>查看收藏</small></button><button class="fp30-entry"><strong>已保存路线</strong><small>行程</small></button></div></section>'
+'<div id="navigationChooser"><div class="nav-panel" style="height:260px"><header class="fp-nav-header"><button class="fp-nav-grip"></button><div class="fp-nav-title-row"><h2>选择导航软件</h2><button id="closeNavigationChooser">×</button></div></header><div class="fp-nav-content"><p class="nav-target">目的地 · 长寿路</p><div id="navLinks"><a>苹果地图</a><a>高德地图</a></div></div></div></div>'
+'<div id="fpUnifiedRoute"><div class="fp-route-sheet" style="height:354px"><div class="fp-route-grip"></div><div class="fp-route-heading"><h2>规划路线</h2><button class="fp-route-close">×</button></div><div class="fp-route-status"><span class="fp-route-step">选点</span></div><div class="fp-route-body"><section class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">01</span><strong>选择地点</strong></div><p class="fp-route-caption">在地图上选择起终点</p></section></div><div class="fp-route-footer"><button class="fp-route-btn fp-route-primary">下一步</button></div></div></div>'
+'<div id="fpSearchSheet" style="position:fixed;top:80px;left:12px;right:12px;bottom:auto;height:200px"><div class="fp-search-top"><h2 class="fp-search-title">搜索</h2></div><div class="fp-search-body"><div class="fp-search-row"><strong>长寿路</strong></div></div></div></body></html>';
const selectors={place:['#fpPlaceCard','.fp-card-name'],destination:['#destinationCard','.destination-title'],collection:['#drawer','.drawer-head h2'],route:['#fpUnifiedRoute .fp-route-sheet','.fp-route-heading h2'],navigation:['#navigationChooser .nav-panel','.fp-nav-title-row h2']};
const parents={place:'#fpPlaceCard',destination:'#destinationCard',collection:'#drawer',route:'#fpUnifiedRoute',navigation:'#navigationChooser'};
const folder='v5-card-unified-visual-evidence';fs.mkdirSync(folder,{recursive:true});
const issues=[];const verify=(condition,msg)=>{if(!condition){issues.push(msg);console.error('LAYOUT_MISMATCH',msg)}};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{for(const width of [375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
  const page=await context.newPage();await page.setContent(html);await page.addStyleTag({content:css});
  for(const [name,[selector,title]] of Object.entries(selectors)){
   await page.evaluate((o)=>{for(const [n,p] of Object.entries(o.parents)){const el=document.querySelector(p);el.style.setProperty('display',n===o.name?(n==='navigation'?'flex':'block'):'none','important')}document.querySelector('#fpSearchSheet').style.setProperty('display','none','important')},{parents,name});
   const measure=await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.left,right:innerWidth-r.right,bottom:innerHeight-r.bottom,corner:s.borderTopLeftRadius,paper:s.backgroundColor}});
   verify(Math.abs(measure.x-12)<2.5,name+' left '+width+' '+JSON.stringify(measure));
   verify(Math.abs(measure.right-12)<2.5,name+' right '+width+' '+JSON.stringify(measure));
   verify(Math.abs(measure.bottom-16)<3,name+' bottom '+width+' '+JSON.stringify(measure));
   verify(measure.corner==='24px',name+' corner '+width+' '+measure.corner);
   verify(measure.paper==='rgb(255, 254, 250)',name+' paper '+width+' '+measure.paper);
   const font=await page.locator(selector+' '+title).evaluate(e=>getComputedStyle(e).fontSize);
   verify(font==='24px'||font==='23px',name+' title '+width+' '+font);
   await page.screenshot({path:folder+'/'+width+'-'+name+'.png'});
  }
  await page.evaluate(o=>{for(const p of Object.values(o))document.querySelector(p).style.setProperty('display','none','important');document.querySelector('#fpSearchSheet').style.setProperty('display','block','important')},parents);
  const search=await page.locator('#fpSearchSheet').evaluate(e=>({corner:getComputedStyle(e).borderTopLeftRadius,paper:getComputedStyle(e).backgroundColor}));
  verify(search.corner==='24px','search radius '+width+' '+search.corner);verify(search.paper==='rgb(255, 254, 250)','search paper '+width+' '+search.paper);
  console.log('PASS V5 six visual surfaces',width);
  await context.close();
 }
 if(issues.length)throw Error('Card visual mismatches: '+issues.join(' | '));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
