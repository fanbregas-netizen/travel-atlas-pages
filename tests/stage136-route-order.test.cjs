"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../v4-stage136-approved-real-20261113/route-view.html'),'utf8');
const cut=(start,end)=>{
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>0&&b>a,'Missing actual route implementation: '+start);
 return html.slice(a,b);
};
const resolveCode=cut('async function resolveRoute(){','function openSave(){');
const saveCode=cut('async function saveRoute(e){','function setSnap(state){');
const normalizeCode=cut('function validCalendarDays(start,end) {','const routeRepository=');
const testSaved={id:'route-123',createdAt:'2026-11-10',selected:[
 {id:'p3',day:2,order:3},{id:'p1',day:2,order:1},{id:'p2',day:1,order:2}
],startDate:'2026-11-20',endDate:'2026-11-21',title:'Approved V5'};

test('saved V5 drag order survives reload even if D labels differ',async()=>{
 const source='let savedId=null,createdAt=null;'+resolveCode+'resolveRoute()';
 const result=await vm.runInNewContext(source,{
   URLSearchParams,location:{search:'?saved=route-123'},
   readSavedPlan:async()=>testSaved,readSelection:()=>null,
   KEY:'footprint-to-travel-atlas-selection-v1',notice:()=>{},
   Date,console
 },{timeout:1000});
 assert.deepEqual(Array.from(result.placeIds),['p1','p2','p3']);
 assert.deepEqual(Array.from(result.stops).map(s=>s.day),[2,1,2]);
 assert.deepEqual(Array.from(result.stops).map(s=>s.order),[1,2,3]);
});

test('date shrink updates the saved route and live D labels by confirmed save only',async()=>{
 const fields={
  routeSaveName:{value:'浙江沿海'},routeSaveStart:{value:'2026-11-20'},
  routeSaveEnd:{value:'2026-11-20'},routeSaveOrigin:{value:'上海'},
  routeSaveDest:{value:'温州'},saveRouteError:{textContent:''},
  routeSaveConfirm:{disabled:false},tripName:{textContent:''},
  travelDates:{textContent:''},saveRoute:{textContent:''},
  routeSaveDialog:{close(){}}
 };
 const written=[];
 const context={
  Date,console,crypto:require('node:crypto').webcrypto,
  document:{getElementById:id=>fields[id],dispatchEvent(){}},
  history:{replaceState(){}},CustomEvent:class CustomEvent{constructor(name){this.type=name}},
  places:[{id:'p1'},{id:'p2'},{id:'p3'}],
  stopDays:[1,2,2],
  routePayload:{title:'原路线',startDate:'2026-11-20',endDate:'2026-11-21',stops:[]},
  savedId:'route-123',createdAt:'2026-11-10',saveBusy:false,
  $:id=>fields[id],writeSavedPlan:async x=>{written.push(x)},showStopRail(){},
  buildRouteLayers(){},notice(){},showStopRailCallCount:0
 };
 const source=normalizeCode+saveCode;
 vm.runInNewContext('this.saveRoute=(()=>{'+source+'return saveRoute})()',context,{timeout:1500});
 await context.saveRoute({preventDefault(){}});
 assert.equal(written.length,1);
 assert.deepEqual(Array.from(written[0].selected).map(s=>s.day),[1,1,1]);
 assert.deepEqual(Array.from(written[0].placeIds),['p1','p2','p3']);
 assert.equal(context.routePayload.startDate,'2026-11-20');
 assert.equal(context.routePayload.endDate,'2026-11-20');
 assert.deepEqual(Array.from(context.routePayload.stops).map(s=>s.day),[1,1,1]);
});
test('the approved V5 route screen is included without rewriting its files',()=>{
 const approved=path.join(__dirname,'../interaction-b-v4-batch-c-v5-review');
 for(const name of ['index.html','route-cards-v5.css','route-cards-v5.js'])
   assert.ok(fs.existsSync(path.join(approved,name)),name+' missing');
});
