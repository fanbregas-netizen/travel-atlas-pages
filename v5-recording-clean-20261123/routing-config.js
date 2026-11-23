/* V5 release config. Set ROAD_PROXY_ORIGIN only after the owned/signed service is verified.
 * Empty means fail closed: no demo service, no fabricated road geometry or ETA.
 * This file contains no secret. A Worker stores upstream credentials server-side.
 */
(function(){
 'use strict';
 const ROAD_PROXY_ORIGIN = '';
 let origin = '';
 if(ROAD_PROXY_ORIGIN){
  try{
   const u=new URL(ROAD_PROXY_ORIGIN);
   if(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&
      u.pathname==='/'&&!['routing.openstreetmap.de','router.project-osrm.org'].includes(u.hostname))
    origin=u.origin;
  }catch(_){}
 }
 window.__fpRoutingEndpoints=origin?Object.freeze({
  car:origin+'/api/car/route/v1/driving/',
  walk:origin+'/api/walk/route/v1/driving/',
  bike:origin+'/api/bike/route/v1/driving/'
 }):Object.freeze({});
})();
