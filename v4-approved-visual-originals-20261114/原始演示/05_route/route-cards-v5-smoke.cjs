"use strict";
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const source=fs.readFileSync(path.join(__dirname,"route-cards-v5.js"),"utf8");
const insertion="window.__batchC.testRoute=ids=>";
assert.equal(source.split(insertion).length,2,"test exposure anchor should be unique");
const instrumented=source.replace(insertion,
  "window.__batchC.act=handleAction;window.__batchC.debug=()=>({...state,stops:state.stops.map(p=>({...p}))});window.__batchC.testRoute=ids=>");
class Node {
 constructor(name="fake"){this.name=name;this.children=[];this.nodes=new Map();this.style={};this.dataset={};this.scrollTop=0;this.innerHTML="";this.textContent="";this.clientHeight=844;
  this.classList={add(){},remove(){},toggle(){},contains(){return false}};}
 querySelector(q){if(!this.nodes.has(q))this.nodes.set(q,new Node(q));return this.nodes.get(q)}
 querySelectorAll(){return []}
 append(...items){this.children.push(...items)}
 prepend(...items){this.children.unshift(...items)}
 cloneNode(){return new Node("clone")}
 addEventListener(){}
 getBoundingClientRect(){return {height:60,top:100,left:0,width:320}}
 setAttribute(){}
 removeAttribute(){}
 focus(){}
 animate(){return {onfinish:null}}
 closest(){return null}
}
const screen=new Node("screen"),document={
 body:new Node("body"),querySelector:q=>q===".screen"?screen:null,
 querySelectorAll:()=>[],createElement:tag=>new Node(tag)
};
const window={addEventListener(){}};
vm.runInNewContext(instrumented,{
 document,window,matchMedia:()=>({matches:true}),
 localStorage:{getItem:()=>null,setItem(){}},
 performance:{now:()=>1},requestAnimationFrame:()=>0,cancelAnimationFrame(){},
 setTimeout:()=>0,clearTimeout(){},navigator:{clipboard:{writeText(){}}}
},{filename:"route-cards-v5.js",timeout:1000});
const api=window.__batchC;
const assertMsg=(name,condition)=>{assert.ok(condition,name);process.stdout.write("PASS "+name+"\n")};
assertMsg("V5 boot and review count",api.version.includes("V5")&&api.summary().ok===1);
api.open("C02");api.act("mini-date");
const original=api.dateState(),day=original.start;
api.act("date-pick-"+day);api.act("date-pick-"+day);
assertMsg("selection does not auto-commit",api.debug().mini==="date"&&api.dateState().end===original.end);
api.act("date-cancel");
assertMsg("cancel preserves original dates",api.dateState().end===original.end&&api.debug().mini===null);
api.act("mini-date");api.act("date-pick-"+day);api.act("date-pick-"+day);api.act("date-commit");
const changed=api.dateState();
assertMsg("complete applies new one-day interval",changed.end===day&&changed.days.every(p=>p.day===1));
assertMsg("shrinking dates reflows former D2 places",changed.feedback?.adjusted>=1);
api.act("date-undo");
assertMsg("date undo restores original D labels",api.dateState().end===original.end&&api.dateState().days.some(p=>p.day===2));
api.act("mini-date");api.act("date-weekend");
assertMsg("weekend preset waits for explicit 完成",api.debug().mini==="date");
api.act("date-cancel");
assertMsg("weekend preset cancel preserves original",api.dateState().end===original.end);
api.open("C01");api.act("pick-p4");
assertMsg("select place keeps other selected IDs",api.debug().stops.map(x=>x.id).join(",")==="p1,p2,p3,p4");
api.act("stage-order");api.act("mini-add");api.act("add-p5");
assertMsg("added stop remains in route and selected",api.debug().stops.some(x=>x.id==="p5")&&api.debug().selected.includes("p5"));
api.act("stage-select");api.act("pick-p6");
assertMsg("selecting another place does not drop added stop",api.debug().stops.some(x=>x.id==="p5")&&api.debug().stops.some(x=>x.id==="p6"));
api.testRoute(["p1","p2","p3","p4","p5"]);
assertMsg("intersecting demo route detected",api.crossings()>0);
api.act("route-suggest");api.act("route-accept");
assertMsg("confirmed opt-in suggestion clears geometry crosses",api.crossings()===0);
process.stdout.write("C V5 logic smoke suite passed\n");
