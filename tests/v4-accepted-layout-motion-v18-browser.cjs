'use strict';
/* V4.18 approved visual + actual motion acceptance, disposable browser only.
 * This is NOT a screenshot-only check and does not touch any user's data. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const {chromium}=require('playwright-core');
const bin=['google-chrome','google-chrome-stable','chromium'].map(x=>{try{return cp.execFileSync('which',[x],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!bin)throw Error('Chrome not installed');
const root='https://fanbregas-netizen.github.io/travel-atlas-pages/v4-review-20261116/';
const output='v4-current-pages-evidence';
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:bin,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results=[];
 try{
  for(const width of [375,390,430]){
   const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   try{
    const resp=await page.goto(root+'index.html?accept-approved-v18-'+width,{waitUntil:'domcontentloaded',timeout:60000});
    assert.equal(resp?.status(),200);
    await page.waitForFunction(()=>!!window.FootprintRubberSpring?.step&&!!window.__atlasSetBookmarkStarred&&!!window.__atlasPlaceStore?.save&&!!window.__atlasDemo?.openSaved&&!!window.FootprintV5Spring?.step,null,{timeout:22000});
    const motor=await page.evaluate(()=>{
      const ref=window.FootprintV5Spring.step(0,1,0,16.67);
      const shared=window.FootprintRubberSpring.step(0,1,0,16.67);
      return {ref,shared,version:window.FootprintRubberSpring.version}
    });
    assert.ok(Math.abs(motor.ref.value-motor.shared.value)<1e-8,'shared spring not identical to approved C-V5 motor');
    // On the home screen the real search bar remains available.
    await page.evaluate(()=>localStorage.setItem('fp-search-history-v1',JSON.stringify([{q:'中山公园',name:'中山公园'}])));
    await page.locator('#dockSearch').click({timeout:6000});
    await page.waitForSelector('#fpSearchSheet:not([hidden]) .fp-search-row',{timeout:6000});
    const historyEarly=await page.evaluate(()=>{
      const panel=document.querySelector('#fpSearchSheet');
      return {scale:panel.style.scale,translate:panel.style.translate,originalField:!!document.querySelector('#fpSearchActiveTop #fpSearchField'),historyRows:panel.querySelectorAll('.fp-search-row').length}
    });
    assert.ok(historyEarly.originalField&&historyEarly.historyRows>0,'search history not on original search DOM');
    assert.notEqual(historyEarly.scale,'','history is not animated by the physical motor');
    await page.waitForTimeout(1000);
    const historyRest=await page.evaluate(()=>({
     scale:document.querySelector('#fpSearchSheet').style.scale,
     visible:!document.querySelector('#fpSearchSheet').hidden
    }));
    assert.equal(historyRest.scale,'','history spring failed to settle/release compositor state');
    await page.locator('#fpSearchActiveTop .fp-search-cancel').click({timeout:6000});
    await page.waitForFunction(()=>!document.body.classList.contains('fp-search-open'),null,{timeout:6000});
    const id='v18-approved-place-'+width;
    await page.evaluate(async id=>{
     await window.__atlasPlaceStore.save({id,title:'古猗园',lat:31.224361,lng:121.456569,starred:true,stage:'plan',rank:2,note:'记录园林层次和日常散步',photos:[],videos:[],guides:[],references:[]});
     await window.__atlasSetBookmarkStarred(id,false);
     await window.__atlasSetBookmarkStarred(id,true);
     window.__atlasDemo.openSaved(id);
    },id);
    await page.waitForSelector('#fpPlaceCard:not([hidden]) .fp-card-head-actions .fp-star-toggle',{timeout:12000});
    const card=await page.evaluate(()=>{
      const el=document.querySelector('#fpPlaceCard'),head=el.querySelector('.fp-card-header');
      const n=head.querySelector('.fp-card-name').getBoundingClientRect(),
        stage=head.querySelector('.fp-place-stage').getBoundingClientRect(),
        close=head.querySelector('.fp-card-close').getBoundingClientRect(),
        star=head.querySelector('.fp-star-toggle').getBoundingClientRect(),
        nav=head.querySelector('.fp-place-navigation').getBoundingClientRect();
      const sections=[...el.querySelectorAll('.fp-block')];
      const media=sections[1];
      const top=document.querySelector('#fpTopSearch');
      return {
       headHeight:head.getBoundingClientRect().height,titleToStage:stage.top-n.top,
       closingTop:close.top,titleTop:n.top,
       starNavGap:Math.abs(star.top-nav.top),iconWidthDiff:Math.abs(star.width-nav.width),
       topSearchHidden:!top||getComputedStyle(top).visibility==='hidden',
       sectionCount:sections.length,mediaHeaderAdds:media?.querySelectorAll('.fp-subheading .fp-subaction').length,
       mediaEmptyExtraAdds:media?.querySelectorAll('.fp-media-empty button').length,
       sectionTitleFont:getComputedStyle(sections[0].querySelector('.fp-section-label')).fontSize,
       sectionPadding:getComputedStyle(sections[0]).paddingTop
      };
    });
    assert.ok(card.headHeight<132&&card.titleToStage<75,'approved compact two-row heading not applied: '+JSON.stringify(card));
    assert.ok(card.starNavGap<2&&card.iconWidthDiff<2,'saved star and navigation icons not aligned');
    assert.ok(card.topSearchHidden,'home search bar is still visible above a detail card');
    assert.equal(card.mediaHeaderAdds,1,'media heading must have exactly one add button');
    assert.equal(card.mediaEmptyExtraAdds,0,'duplicate empty-state media action remains');
    assert.ok(card.sectionCount>=3&&card.sectionTitleFont==='16px','accepted section hierarchy did not render');
    await page.screenshot({path:output+'/v18-approved-place-'+width+'.png',fullPage:false});
    // The same georeferenced POI target gets both animated inner SVG parts and
    // the approved spring envelope. No geographic marker is transformed.
    const initial=await page.evaluate(()=>{
      const probe=document.createElement('div');probe.id='v18PoiProbe';document.body.append(probe);
      window.AtlasPOIMotion.play(probe,'sea','海');
      return true;
    });
    await page.waitForFunction(()=>document.querySelector('#v18PoiProbe .fp-internal-poi-envelope svg'),null,{timeout:8000});
    await page.waitForTimeout(125);
    const during=await page.evaluate(()=>{
      const outer=document.querySelector('#v18PoiProbe'),shell=outer.querySelector('.fp-internal-poi-envelope');
      return {scale:Number(getComputedStyle(shell).scale||1),engine:shell.dataset.springEngine,
        seaMorphs:shell.querySelectorAll('animate[attributeName="d"]').length,
        outerTransform:getComputedStyle(outer).transform};
    });
    assert.ok(during.scale>1.01&&during.engine==='cv5','POI not physically scaling with shared C-V5 motor '+JSON.stringify(during));
    assert.ok(during.seaMorphs>=3,'SVG wave paths are not animated');
    assert.equal(during.outerTransform,'none','geographic marker transformed');
    await page.waitForTimeout(1000);
    const final=await page.evaluate(()=>Number(getComputedStyle(document.querySelector('#v18PoiProbe .fp-internal-poi-envelope')).scale||1));
    assert.ok(Math.abs(final-1)<.003,'POI did not return to original size: '+final);
    assert.deepEqual(errors,[],'runtime errors');
    results.push({width,motor,historyEarly,historyRest,card,during,final});
   }finally{await context.close()}
  }
  fs.writeFileSync(output+'/v18-accepted-layout-motion.json',JSON.stringify(results,null,2));
  console.log('PASS .18 approved header, no top search on cards, one media CTA, shared C-V5 search/POI spring, real SVG parts, 375/390/430',JSON.stringify(results));
 }finally{await browser.close()}
})().catch(err=>{console.error('FAIL V4.18 approved product: '+err.stack);process.exitCode=1});
