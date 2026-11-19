'use strict';
/* Product card CSS acceptance with Chromium at iPhone widths.
 * The actual published stylesheet stack drives these existing DOM selectors.
 * The fixture is deterministic; this is NOT real iPhone Safari or map QA.
 */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const base='v5-card-rhythm-20261119',index=fs.readFileSync(base+'/index.html','utf8');
const files=[...index.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\.\/([^"?#]+)/g)].map(m=>m[1]);
assert.ok(files.at(-1)==='src/visual/v5-card-system-unified-20261119.css');
const css=files.map(p=>fs.readFileSync(path.join(base,p),'utf8')).join('\n');
const chrome=['google-chrome','google-chrome-stable','chromium'].map(n=>{try{return cp.execFileSync('which',[n],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
assert.ok(chrome,'Chromium browser unavailable');
const html='<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;background:#78928a}</style></head><body>'
+'<section id="fpPlaceCard" style="height:354px"><header class="fp-card-header"><button class="atlas-card-grip" aria-label="拖拽"></button><div class="fp-card-title-wrap"><h2 class="fp-card-name">南翔</h2></div><div class="fp-card-head-actions"><button class="fp-star-toggle" aria-label="收藏">☆</button><button class="fp-place-navigation" aria-label="导航">◇</button></div><button class="fp-card-close">×</button></header><div class="fp-card-scroll"><section class="fp-block"><div class="fp-subheading"><span class="fp-section-index">01</span><strong class="fp-section-label">为什么想去</strong><button class="fp-subaction">编辑</button></div><p class="fp-brief-text">旅行记录与想法。</p><button class="fp-place-stage">想去</button></section></div></section>'
+'<section id="destinationCard" class="destination-card visible"><button id="destinationClose" class="destination-close">×</button><div class="destination-title">美平路罗智路</div><div class="destination-category">目的地</div><div class="destination-actions"><button class="destination-star">收藏并记录</button><button class="destination-route">导航</button></div></section>'
+'<section id="drawer" class="drawer fp30-detail visible"><div class="drawer-head"><div class="sheet-grab"></div><h2><span class="drawer-cn">我的收藏</span><span id="sheetCount">1 处收藏</span></h2><button id="closeDrawer" class="iconclose">×</button></div><div id="spotList"><button class="spotrow"><span class="spotempty">☆</span><span><strong>南翔</strong><small>想去 · 还没有备注</small></span></button></div><div class="backuprow"><button>导出收藏备份</button><button>导入收藏备份</button></div><p class="footnote">资料保存在当前浏览器，请定期导出备份。</p></section>'
+'<div id="navigationChooser"><div class="nav-panel" style="height:260px"><header class="fp-nav-header"><button class="fp-nav-grip"></button><div class="fp-nav-title-row"><h2>选择导航软件</h2><button id="closeNavigationChooser">×</button></div></header><div class="fp-nav-content"><p class="nav-target">目的地 · 长寿路</p><div id="navLinks"><a>苹果地图</a><a>高德地图</a></div></div></div></div>'
+'<div id="fpUnifiedRoute"><div class="fp-route-sheet" style="height:354px"><div class="fp-route-grip"></div><div class="fp-route-heading"><h2>我的路线</h2><button class="fp-route-close">×</button></div><div class="fp-route-status"><span class="fp-route-step">0 条</span><span class="fp-route-gesture-hint">上滑查看更多</span></div><div class="fp-route-body"><section class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">01</span><strong>最近路线</strong></div><p class="fp-route-caption">还没有保存路线</p></section></div><div class="fp-route-footer"><button class="fp-route-btn fp-route-primary">新建路线</button></div></div></div>'
+'<div id="fpSearchSheet" style="position:fixed;top:80px;left:12px;right:12px;bottom:auto;height:200px"><div class="fp-search-top"><h2 class="fp-search-title">搜索</h2></div><div class="fp-search-body"><div class="fp-search-row"><strong>长寿路</strong></div></div></div></body></html>';
const placeJS=fs.readFileSync(base+'/src/interaction/physical-sheet.js','utf8');
const collectionJS=fs.readFileSync(base+'/src/interaction/v4-approved-collection-sheet-v2.js','utf8');
assert.ok(placeJS.includes("sheet.id==='fpPlaceCard'")&&placeJS.includes('viewport*.42'),'place peek not linked to route geometry');
assert.ok(collectionJS.includes("if(count<=1&&level!=='peek')snap('peek',0)"),'single-item collection compact gesture missing');
const selectors={place:['#fpPlaceCard','.fp-card-name'],destination:['#destinationCard','.destination-title'],collection:['#drawer','.drawer-head h2'],route:['#fpUnifiedRoute .fp-route-sheet','.fp-route-heading h2'],navigation:['#navigationChooser .nav-panel','.fp-nav-title-row h2']};
const parents={place:'#fpPlaceCard',destination:'#destinationCard',collection:'#drawer',route:'#fpUnifiedRoute',navigation:'#navigationChooser'};
const folder='v5-card-redline-visual-evidence';fs.mkdirSync(folder,{recursive:true});
const issues=[];const verify=(condition,msg)=>{if(!condition){issues.push(msg);console.error('LAYOUT_MISMATCH',msg)}};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{for(const width of [375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
  const page=await context.newPage();await page.setContent(html);await page.addStyleTag({content:css});
  for(const [name,[selector,title]] of Object.entries(selectors)){
   await page.evaluate((o)=>{
    document.querySelector('#drawer').classList.toggle('visible',o.name==='collection');
    document.body.classList.toggle('destination-selected',o.name==='destination');
    document.body.classList.toggle('fp-place-open',o.name==='place');
    document.body.classList.toggle('fp-unified-route',o.name==='route');
    for(const [n,p] of Object.entries(o.parents)){
      const el=document.querySelector(p);el.style.setProperty('display',n===o.name?(n==='navigation'?'flex':'block'):'none','important');
    }
    document.querySelector('#fpSearchSheet').style.setProperty('display','none','important');
   },{parents,name});
   const measure=await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.left,right:innerWidth-r.right,bottom:innerHeight-r.bottom,corner:s.borderTopLeftRadius,paper:s.backgroundColor,visibility:s.visibility,opacity:s.opacity}});
   verify(Math.abs(measure.x-12)<2.5,name+' left '+width+' '+JSON.stringify(measure));
   verify(Math.abs(measure.right-12)<2.5,name+' right '+width+' '+JSON.stringify(measure));
   verify(Math.abs(measure.bottom-16)<3,name+' bottom '+width+' '+JSON.stringify(measure));
   verify(measure.corner==='24px',name+' corner '+width+' '+measure.corner);
   verify(measure.paper==='rgb(255, 254, 250)',name+' paper '+width+' '+measure.paper);verify(measure.visibility==='visible'&&Number(measure.opacity)>.95,name+' rendered '+width+' '+JSON.stringify(measure));
   const font=await page.locator(selector+' '+title).evaluate(e=>getComputedStyle(e).fontSize);
   verify(font==='24px'||font==='23px',name+' title '+width+' '+font);

   /* Screenshot red-line acceptance: all three dividers are exactly as wide
      as their outer sheets, and first real content cards share one inset. */
   if(['place','collection','route'].includes(name)){
    const geometry=await page.evaluate(name=>{
     const cardSel={place:'#fpPlaceCard',collection:'#drawer',route:'#fpUnifiedRoute .fp-route-sheet'}[name];
     const headerSel={place:'#fpPlaceCard .fp-card-header',collection:'#drawer .drawer-head',route:'#fpUnifiedRoute .fp-route-heading'}[name];
     const blockSel={place:'#fpPlaceCard .fp-card-scroll>.fp-block',collection:'#drawer #spotList .spotrow',route:'#fpUnifiedRoute .fp-route-body>.fp-route-card'}[name];
     const get=sel=>{const e=document.querySelector(sel),r=e.getBoundingClientRect();return {x:r.left,right:r.right,y:r.top,bottom:r.bottom,w:r.width,display:getComputedStyle(e).display,border:getComputedStyle(e).borderBottomWidth}};
     return {card:get(cardSel),header:get(headerSel),first:get(blockSel)};
    },name);
    const inset=width<=380?16:18;
    const T=2.5;
    verify(Math.abs(geometry.header.x-geometry.card.x)<T,name+' divider starts at left card edge '+width+' '+JSON.stringify(geometry));
    verify(Math.abs(geometry.header.right-geometry.card.right)<T,name+' divider ends at right card edge '+width+' '+JSON.stringify(geometry));
    verify(geometry.header.border==='1px',name+' divider visible '+width+' '+JSON.stringify(geometry));
    verify(Math.abs(geometry.first.x-geometry.card.x-inset)<T,name+' first content x='+inset+' '+width+' '+JSON.stringify(geometry));
    verify(Math.abs(geometry.card.right-geometry.first.right-inset)<T,name+' first content right='+inset+' '+width+' '+JSON.stringify(geometry));
    verify(Math.abs(geometry.first.y-geometry.header.bottom)<45,name+' first content immediately under divider '+width+' '+JSON.stringify(geometry));
    console.log('GEOMETRY',width,name,JSON.stringify(geometry));
   }
   if(name==='place'){
    const g=await page.evaluate(()=>{
      const target=sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {y:r.top+r.height/2,x:r.left+r.width/2}};
      return {title:target('.fp-card-name'),star:target('.fp-star-toggle'),nav:target('.fp-place-navigation'),close:target('.fp-card-close'),status:getComputedStyle(document.querySelector('.fp-card-scroll .fp-place-stage')).display,headerHeight:document.querySelector('.fp-card-header').getBoundingClientRect().height};
    });
    verify(Math.max(g.title.y,g.star.y,g.nav.y,g.close.y)-Math.min(g.title.y,g.star.y,g.nav.y,g.close.y)<7,'place single row y aligned '+width+' '+JSON.stringify(g));
    verify(g.status!=='none','stage toggle retained below header '+width+' '+JSON.stringify(g));
    verify(Math.abs(g.headerHeight-80)<2,'place header same 80px height '+width+' '+JSON.stringify(g));
   }
   if(name==='route'){
    const s=await page.locator('.fp-route-status').evaluate(e=>getComputedStyle(e).display);
    verify(s==='none','route redundant status stripe gone '+width);
   }

   if(name==='route'){
    const chroma=await page.evaluate(()=>({
      grip:getComputedStyle(document.querySelector('.fp-route-grip')).minHeight,
      title:getComputedStyle(document.querySelector('.fp-route-heading')).minHeight,
      status:getComputedStyle(document.querySelector('.fp-route-status')).minHeight,
      footer:getComputedStyle(document.querySelector('.fp-route-footer')).paddingTop
    }));
    verify(chroma.grip==='25px','route grip 25px '+width+' '+JSON.stringify(chroma));
    verify(chroma.title==='54px','route heading 54px '+width+' '+JSON.stringify(chroma));
    verify(chroma.status==='40px','route status 40px '+width+' '+JSON.stringify(chroma));
    verify(chroma.footer==='10px','route footer 10px '+width+' '+JSON.stringify(chroma));
   }
   if(name==='place'){
    const rh=await page.locator('.fp-card-header').evaluate(e=>({paddingTop:getComputedStyle(e).paddingTop,paddingBottom:getComputedStyle(e).paddingBottom}));
    verify(rh.paddingTop==='0px','place one-row header top 0px '+width+' '+JSON.stringify(rh));
    verify(rh.paddingBottom==='0px','place one-row header bottom 0px '+width+' '+JSON.stringify(rh));
   }
   if(name==='navigation'){
    const grip=await page.locator('#navigationChooser .fp-nav-grip').evaluate(e=>getComputedStyle(e).backgroundColor);
    verify(grip==='rgba(0, 0, 0, 0)','navigation transparent grip '+width+' '+grip);
   }
   if(name==='collection'){
    const glyph=await page.locator('#closeDrawer').evaluate(e=>({font:getComputedStyle(e).fontSize,pseudo:getComputedStyle(e,'::before').content}));
    verify(glyph.font==='25px','collection close glyph size '+width+' '+JSON.stringify(glyph));
   }
   await page.screenshot({path:folder+'/'+width+'-'+name+'.png'});
  }
  await page.evaluate(o=>{for(const p of Object.values(o))document.querySelector(p).style.setProperty('display','none','important');document.querySelector('#fpSearchSheet').style.setProperty('display','block','important')},parents);
  const search=await page.locator('#fpSearchSheet').evaluate(e=>({corner:getComputedStyle(e).borderTopLeftRadius,paper:getComputedStyle(e).backgroundColor}));
  verify(search.corner==='24px','search radius '+width+' '+search.corner);verify(search.paper==='rgb(255, 254, 250)','search paper '+width+' '+search.paper);
  // Execute the REAL B05 collection controller, not just its CSS. One
  // saved place should open at peek, while manual 3-stage gesture remains.
  if(width===375){
    const live=await context.newPage();
    await live.setContent(html);
    await live.addStyleTag({content:css});
    await live.evaluate(()=>{
      const el=document.getElementById('drawer');
      el.className='drawer fp30-detail visible';
    });
    await live.addScriptTag({content:collectionJS});
    await live.waitForTimeout(900);
    const state=await live.evaluate(()=>window.__atlasCollectionSheet?.getState?.());
    verify(!!state&&state.level==='peek','one saved-place collection auto-peek '+JSON.stringify(state));
    verify(state?.height>=290&&state?.height<=385,'compact collection usable height '+JSON.stringify(state));
    await live.screenshot({path:folder+'/375-collection-compact-real-motor.png'});
    console.log('CHECK real B05 single-item motor',state);
    await live.close();
  }
  console.log('PASS V5 user-redline card geometry',width);
  await context.close();
 }
 if(issues.length)throw Error('Card visual mismatches: '+issues.join(' | '));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
