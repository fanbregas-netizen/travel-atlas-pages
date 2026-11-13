'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../v4-stage137-approved-parity-20261113');
const source=fs.readFileSync(path.join(root,'journey.js'),'utf8');
const approved=fs.readFileSync(path.join(__dirname,'../interaction-b-v4-batch-c-v5-review/route-cards-v5.js'),'utf8');
const dateController=fs.readFileSync(path.join(root,'src/route/date-confirm.js'),'utf8');
function snippet(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Cannot extract real journey implementation '+start);
 return source.slice(a,b);
}

test('approved C V5: reordering a stop never changes its D or arrival time',()=>{
 const sample=[
  {id:'p1',day:1,time:'09:00'},
  {id:'p2',day:2,time:'11:00'},
  {id:'p3',day:1,time:'16:00'}
 ];
 const ctx={selected:sample,changed:false,clearProposal(){},renderChosen(){},renderRoute(){},report(){}};
 vm.runInNewContext(snippet('function moveSelected(from,to){','function enableDragHandle(')+';moveSelected(0,2);',ctx,{timeout:1000});
 assert.deepEqual(Array.from(ctx.selected).map(s=>s.id),['p2','p3','p1']);
 assert.deepEqual(Array.from(ctx.selected).map(s=>s.day),[2,1,1]);
 assert.deepEqual(Array.from(ctx.selected).map(s=>s.time),['11:00','16:00','09:00']);
 assert.equal(ctx.changed,true);
});

test('cross-day saved selected[] order honors explicit order, not day sorting',()=>{
 const impl=snippet('function normalizeStops(rec){','function fill(record){');
 const ctx={safe:(s,n=400)=>String(s??'').slice(0,n)};
 vm.runInNewContext(impl+';this.normalize=normalizeStops',ctx,{timeout:1000});
 const loaded=ctx.normalize({selected:[
  {id:'p3',day:2,order:3,time:'12:00'},
  {id:'p1',day:2,order:1,time:'09:00'},
  {id:'p2',day:1,order:2,time:'10:00'}
 ]});
 assert.deepEqual(Array.from(loaded).map(s=>s.placeId),['p1','p2','p3']);
 assert.deepEqual(Array.from(loaded).map(s=>s.day),[2,1,2]);
});

test('confirmed dates reflow D numbers without silently changing stop order',()=>{
 assert.doesNotMatch(source,/sortByDay\(/,'Hidden date-sort was reintroduced');
 assert.match(source,/selected\.forEach\(s=>\{s\.day=Math\.min\(currentDays\(\),Math\.max\(1,Number\(s\.day\)\|\|1\)\)\}\)/);
 assert.match(dateController,/id="atlasDateApply">完成/);
 assert.match(dateController,/id="atlasDateCancel">取消/);
 assert.match(dateController,/end\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/);
 assert.match(approved,/if\(cmd==='date-commit'\)/,'approved V5 owner must stay present');
});

test('route resizing only redraws geometry once per frame and never invents a new layout',()=>{
 assert.match(source,/let routeGeometryFrame=0/);
 assert.match(source,/if\(routeGeometryFrame\)return/);
 assert.match(source,/window\.visualViewport\?\.addEventListener\('resize',refreshRouteGeometry/);
 new Function(source);
});
