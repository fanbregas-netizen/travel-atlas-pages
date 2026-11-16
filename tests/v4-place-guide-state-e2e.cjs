'use strict';
/* Browser-level V4 Brief, guide, saved-state and media integrity.
   Fresh namespaced storage only. Never writes to the published website. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const which=process.env.BROWSER||'chromium';
const root=path.resolve(__dirname,'..'),out=path.resolve('v4-system-evidence',which);
fs.mkdirSync(out,{recursive:true});
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
const srv=http.createServer((req,res)=>{
 const url=decodeURIComponent(req.url.split('?')[0]),file=path.resolve(root,url.replace(/^\/travel-atlas-pages\//,'').replace(/^\//,''));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.readFile(file,(err,data)=>{
  if(err){res.writeHead(404).end();return}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.writeHead(200).end(data);
 });
});
const target='http://127.0.0.1:8767/travel-atlas-pages/v4-review-20261116/index.html';
(async()=>{
 await new Promise(ok=>srv.listen(8767,'127.0.0.1',ok));
 const browser=await ({chromium,webkit})[which].launch({headless:true,...(which==='chromium'?{args:['--no-sandbox']}:{})});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',async d=>d.accept());
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__atlasPlaceStore?.save && !!window.__atlasDemo?.openSaved && !!window.FootprintGuideLinks,null,{timeout:30000});
  const id='qa-real-brief-guide';
  await page.evaluate(async id=>{
   const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5pbiQAAAAASUVORK5CYII=';
   await window.__atlasPlaceStore.save({
    id,title:'测试手记与攻略',lat:31.228,lng:121.47,starred:true,stage:'plan',
    rank:2,note:'原始说明',photos:[{src:pixel,name:'orig.png'}],
    videos:[],guides:[],references:[]
   });
  },id);
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(id=>window.__atlasDemo?.getSaved()?.some(p=>p.id===id),id,{timeout:30000});
  await page.evaluate(id=>window.__atlasDemo.openSaved(id),id);
  await page.waitForSelector('#fpPlaceCard:not([hidden]) .fp-card-name',{timeout:12000});
  const sections=page.locator('#fpPlaceCard .fp-block');
  assert.ok(await sections.count()>=4,'Brief/Media/Guides/Nearby not all present');
  await sections.nth(0).locator('.fp-subheading button').click();
  const area=sections.nth(0).locator('.fp-inline-editor textarea');
  await area.fill('旅行手记自动化验收文本');
  await sections.nth(0).getByRole('button',{name:'保存记录'}).click();
  await page.waitForFunction(()=>document.querySelector('#fpPlaceCard .fp-brief-text')?.textContent==='旅行手记自动化验收文本',null,{timeout:13000});
  const storedNote=await page.evaluate(id=>window.FootprintMediaCore.createRepository(indexedDB).read(id).then(p=>p.note),id);
  assert.equal(storedNote,'旅行手记自动化验收文本');
  await sections.nth(0).locator('.fp-subheading button').click();
  await sections.nth(0).locator('.fp-inline-editor textarea').fill('临时草稿不应提交');
  await sections.nth(0).getByRole('button',{name:'取消'}).click();
  assert.equal(await page.evaluate(id=>window.FootprintMediaCore.createRepository(indexedDB).read(id).then(p=>p.note),id),storedNote);
  await sections.nth(2).locator('.fp-subheading button').click();
  await sections.nth(2).locator('.fp-guide-editor textarea').fill('城市旅行笔记 https://xhslink.com/qaV4guide 复制这段信息');
  await sections.nth(2).getByRole('button',{name:'保存链接'}).click();
  await page.waitForSelector('#fpPlaceCard .fp-guide-open[href*="xhslink.com/qaV4guide"]',{timeout:12000});
  const guide=await page.evaluate(async id=>{
   const p=await window.FootprintMediaCore.createRepository(indexedDB).read(id);
   return p.guides?.find(g=>g.url.includes('qaV4guide'));
  },id);
  assert.equal(guide?.source,'小红书');
  await page.locator('#fpPlaceCard .fp-place-stage').click({timeout:10000});
  await page.waitForFunction(id=>window.FootprintMediaCore.createRepository(indexedDB).read(id).then(p=>p.stage==='visited'),id,{timeout:10000});
  await page.locator('#fpPlaceCard .fp-star-toggle').click();
  await page.waitForFunction(id=>window.FootprintMediaCore.createRepository(indexedDB).read(id).then(p=>p.starred===false),id,{timeout:10000});
  const retained=await page.evaluate(async id=>{
   const p=await window.FootprintMediaCore.createRepository(indexedDB).read(id);
   return {photos:p.photos?.length,notes:p.note,guides:p.guides?.length};
  },id);
  assert.equal(retained.photos,1,'unstar discarded photo');
  assert.equal(retained.notes,storedNote,'unstar discarded Brief');
  assert.equal(retained.guides,1,'unstar discarded guide');
  await page.locator('#fpPlaceCard .fp-star-toggle').click();
  await page.waitForFunction(id=>window.FootprintMediaCore.createRepository(indexedDB).read(id).then(p=>p.starred===true),id,{timeout:10000});
  await page.locator('#fpPlaceCard .fp-place-navigation').click({timeout:12000});
  await page.waitForSelector('#navigationChooser.visible #navLinks a',{timeout:12000});
  assert.ok(await page.locator('#navigationChooser #navLinks a').count()>=3,'navigator chooser missing services');
  await page.locator('#closeNavigationChooser').click();
  await page.waitForFunction(()=>!document.querySelector('#navigationChooser')?.classList.contains('visible'));
  const freshPhoto=await page.screenshot({type:'png'});
  await sections.nth(1).locator('input[type=file]').setInputFiles({name:'extra.png',mimeType:'image/png',buffer:freshPhoto});
  await page.waitForFunction(id=>window.FootprintMediaCore.createRepository(indexedDB).read(id).then(p=>p.photos.length===2),id,{timeout:18000});
  await page.waitForSelector('#fpPlaceCard .fp-media-mosaic img',{timeout:14000});
  await sections.nth(1).locator('.fp-media-mosaic button').first().click();
  await page.waitForSelector('#fpMediaViewer',{state:'visible',timeout:10000});
  await page.locator('#fpMediaViewer .fp-viewer-close').click();
  await page.waitForFunction(()=>!document.getElementById('fpMediaViewer'),null,{timeout:12000});
  // Unlike a synthetic 8-byte storage sentinel this is a genuine, original
  // 0.625-second H264/MP4 clip (32×32 cyan frame, generated locally).
  // Exercise the product's video INPUT, video tile, fullscreen viewer, close,
  // then IndexedDB after-reload persistence without needing an external URL.
  const clip=fs.readFileSync(path.join(__dirname,'fixtures/qa-original-0.625s-h264.mp4'));
  await sections.nth(1).locator('input[type=file]').setInputFiles({
    name:'本地视频.mp4',mimeType:'video/mp4',buffer:clip
  });
  await page.waitForFunction(id=>window.FootprintMediaCore.createRepository(indexedDB).read(id).then(p=>p.videos?.length===1),
    id,{timeout:17000});
  await page.waitForSelector('#fpPlaceCard .fp-media-mosaic .fp-video-tile video',{timeout:13000});
  await page.locator('#fpPlaceCard .fp-media-mosaic .fp-video-tile').first().click();
  await page.waitForSelector('#fpMediaViewer video[controls]',{state:'visible',timeout:12000});
  const mediaState=await page.evaluate(async()=>{
    const video=document.querySelector('#fpMediaViewer video');
    await Promise.race([
      new Promise(done=>{video.addEventListener('loadedmetadata',done,{once:true});
        video.addEventListener('error',done,{once:true});}),
      new Promise(done=>setTimeout(done,3000))
    ]);
    return {duration:video.duration,readyState:video.readyState,
      canDecode:video.canPlayType('video/mp4; codecs="avc1.42E01E"'),
      errorCode:video.error?.code||null};
  });
  assert.ok(mediaState.readyState>=1 || mediaState.canDecode==='' ||
    mediaState.canDecode===null,
    'browser claimed H264 support but failed to decode original sample '+JSON.stringify(mediaState));
  await page.locator('#fpMediaViewer .fp-viewer-close').click();
  await page.waitForFunction(()=>!document.getElementById('fpMediaViewer'),null,{timeout:12000});
  await page.screenshot({path:path.join(out,'06-place-guide-state.png')});
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>!!window.__atlasDemo?.openSaved,null,{timeout:20000});
  await page.evaluate(id=>window.__atlasDemo.openSaved(id),id);
  await page.waitForSelector('#fpPlaceCard .fp-guide-open[href*="qaV4guide"]',{timeout:15000});
  const final=await page.evaluate(async id=>{
   const p=await window.FootprintMediaCore.createRepository(indexedDB).read(id);
   return {stage:p.stage,starred:p.starred,note:p.note,photoCount:p.photos.length,guideCount:p.guides.length,
    videoCount:p.videos?.length||0,
    visiblePhotos:document.querySelectorAll('#fpPlaceCard .fp-media-mosaic img').length,
    visibleVideos:document.querySelectorAll('#fpPlaceCard .fp-video-tile video').length};
  },id);
  assert.deepEqual(final,{stage:'visited',starred:true,note:storedNote,photoCount:2,guideCount:1,videoCount:1,visiblePhotos:2,visibleVideos:1});
  assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError|SyntaxError/.test(x)),[],'uncaught browser errors');
  fs.writeFileSync(path.join(out,'place-guide-state.json'),JSON.stringify({browser:which,retained,guide,final,errors},null,2));
  console.log('PASS V4 PLACE BRIEF GUIDE MEDIA STATE '+which+' '+JSON.stringify(final));
  await ctx.close();
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL V4 PLACE GUIDE '+which+' '+e.stack);process.exit(1)}).finally(()=>srv.close());
