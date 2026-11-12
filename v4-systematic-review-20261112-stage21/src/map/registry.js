/* Integration module registry. Read-only adapters until full migration. */
(function(g){
  'use strict';
  if(g.TravelAtlasModules)return;
  const modules=new Map();
  const api=Object.freeze({
    version:'2026-11-10-candidate',
    register(name,service){
      if(typeof name!=='string'||!name||modules.has(name))throw new Error('Invalid or duplicated module: '+name);
      if(!service||typeof service!=='object')throw new Error('Module service required');
      modules.set(name,Object.freeze(service));
      document.dispatchEvent(new CustomEvent('atlas:module-ready',{detail:{name}}));
    },
    get(name){return modules.get(name)||null},
    names(){return Array.from(modules.keys())}
  });
  Object.defineProperty(g,'TravelAtlasModules',{value:api,writable:false,configurable:false});
})(window);
