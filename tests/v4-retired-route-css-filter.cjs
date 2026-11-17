'use strict';
/* Conservative legacy CSS cleanup: CSS rule blocks whose EVERY selector
 * belongs to a controller removed from the V4 homepage. Never touch @rules,
 * mixed selectors, media queries, custom properties, or shared B05/C V5 UI.
 * Use on the ORIGINAL baseline CSS to verify a cleanup candidate exactly. */
const retired=s=>/^(?:body\.route-pick-active(?=[\s.#[,:]|$)|\.tp-[\w-]+|\.rb-[\w-]+|\.route-bar-pop(?=[\s.#[,:]|$)|\.fav-tray(?:\b|-)|#favTray(?:\b|-)|\.savebox(?:\b|-)|#(?:drawerSaveBox|saveBoxMain|saveBoxMenu)(?=[\s.#[,:]|$))/.test(s);
function stripRetiredRouteRules(text){
 let spans=[],headStart=0,depth=0,pending=false,start=0,comment=false,quote='';
 for(let i=0;i<text.length;i++){
  const c=text[i],n=text[i+1];
  if(comment){if(c==='*'&&n==='/'){comment=false;i++}continue}
  if(quote){if(c==='\\'){i++;continue}if(c===quote)quote='';continue}
  if(c==='/'&&n==='*'){comment=true;i++;continue}
  if(c==="'"||c==='"'){quote=c;continue}
  if(c==='{'){
   if(depth===0){
    const header=text.slice(headStart,i),selector=header.replace(/\/\*[\s\S]*?\*\//g,'').trim();
    pending=!!selector&&!selector.startsWith('@')&&selector.split(',').every(s=>retired(s.trim()));
    if(pending){
     const last=header.lastIndexOf('*/');
     start=last>=0?headStart+last+2:headStart;
     while(/\s/.test(text[start]))start++;
    }
   }
   depth++;continue;
  }
  if(c==='}'){
   depth--;
   if(depth<0)throw Error('CSS has unbalanced braces');
   if(depth===0){if(pending)spans.push({start,end:i+1});headStart=i+1;pending=false}
  }
 }
 if(depth!==0||quote||comment)throw Error('CSS parser reached incomplete content');
 let css=text;
 for(let i=spans.length-1;i>=0;i--){
  const {start,end}=spans[i];css=css.slice(0,start)+css.slice(end);
 }
 return {css,removed:spans.length,bytes:text.length-css.length};
}
module.exports={stripRetiredRouteRules};
