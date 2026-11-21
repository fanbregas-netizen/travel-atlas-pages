'use strict';
const {chromium,webkit}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=__dirname,out=path.join(root,'evidence');fs.mkdirSync(out,{recursive:true});
let active=path.resolve('__v4_backup');
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');let base=path.join(root,'product'),p=u.pathname;
 if(p.startsWith('/travel-atlas-pages/')){base=active;p=p.slice('/travel-atlas-pages'.length)}
 else if(p.startsWith('/preview/')){base=path.join(root,'preview');p=p.slice('/preview'.length)}
 let file=path.resolve(base,'.'+decodeURIComponent(p));if(!file.startsWith(base+path.sep)&&file!==base){res.writeHead(403);return res.end()}
 if(p.endsWith('/'))file=path.join(file,'index.html');
 if(!fs.existsSync(file)){res.writeHead(404);return res.end('missing')}
 const ext=path.extname(file),mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
 res.setHeader('Content-Type',mime[ext]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);
});
const reports=[];
async function suite(name,engine,base){
 const browser=await engine.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
 const report={engine:name,checks:[]};const check=(name,ok)=>{report.checks.push({name,passed:!!ok});assert(ok,name)};
 try{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.FootprintMediaCore,{timeout:30000});
  await page.addScriptTag({path:path.join(root,'v5-browser-data.js')});
  const data=await page.evaluate(()=>runFootprintDataQA(FootprintMediaCore,indexedDB));report.data=data;check('19 synthetic data assertions',data.status==='PASS');
  await page.locator('#dockStars').click();check('collection opens',await page.locator('#drawer').isVisible());
  await page.locator('#closeDrawer').click();await page.locator('#dockRoute').click();
  await page.screenshot({path:path.join(out,name+'-route.png')});
  check('route interface exists',await page.locator('#fpRouteRoot').count()>0||await page.getByText('我的路线',{exact:true}).count()>0);
  await page.goto(base,{waitUntil:'load'});await page.evaluate(async()=>{const r=await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;return r.scope});
  await page.reload({waitUntil:'load'});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);
  const offline=await page.evaluate(async()=>{const r=await fetch('./v4-map-runtime.js?v=nav-safe-bubble-20261120');return {status:r.status,length:(await r.text()).length}});
  check('real SW serves versioned map script offline',offline.status===200&&offline.length>200000);
  await context.setOffline(false);
  // Real service worker lifecycle on an isolated localhost origin, exact old path.
  const upgrade=await context.newPage();active=path.resolve('__v4_backup');
  await upgrade.goto(base+'travel-atlas-pages/',{waitUntil:'load'});
  await upgrade.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});await navigator.serviceWorker.ready});
  await upgrade.waitForFunction(()=>!!navigator.serviceWorker.controller);
  active=path.join(root,'product');await upgrade.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});
  await upgrade.waitForFunction(async()=> (await caches.keys()).includes('footprint-v5-production-candidate-20261121-r2'),null,{timeout:45000});
  await upgrade.waitForFunction(async()=>!(await caches.keys()).includes('atlas-v4-shell-stage6-integrated-v51'),null,{timeout:45000});
  await upgrade.reload({waitUntil:'load'});
  check('real V4 to V5 SW update',await upgrade.locator('meta[name="atlas-release"]').getAttribute('content')==='V5.RC2.20261121.1');
  active=path.resolve('__v4_backup');await upgrade.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});
  await upgrade.waitForFunction(async()=> (await caches.keys()).includes('atlas-v4-shell-stage6-integrated-v51'),null,{timeout:45000});
  await upgrade.reload({waitUntil:'load'});check('full V4 root rollback',/V4/.test(await upgrade.locator('meta[name="atlas-release"]').getAttribute('content')));
  // Preview isolation: seed a synthetic production-name sentinel only in this fresh test context.
  await page.goto(base+'preview/',{waitUntil:'load'});
  const isolation=await page.evaluate(async()=>({active:window.__fpWorkIsolation,dbs:(await indexedDB.databases()).map(x=>x.name)}));report.isolation=isolation;
  check('preview bootstrap active',isolation.active==='fp-v5-rc2-work-20261121-');
  check('preview uses isolated IndexedDB',isolation.dbs.some(x=>x.startsWith(isolation.active)));
  report.status='PASS';
 }catch(e){report.status='FAIL';report.error=String(e.stack||e);await page.screenshot({path:path.join(out,name+'-failure.png')}).catch(()=>{})}
 finally{reports.push(report);fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(report,null,2));await browser.close()}
}
server.listen(0,'127.0.0.1',async()=>{try{const base='http://localhost:'+server.address().port+'/';await suite('chromium',chromium,base);await suite('webkit',webkit,base)}finally{server.close();console.log(JSON.stringify(reports,null,2));if(reports.some(r=>r.status!=='PASS'))process.exitCode=1}});
