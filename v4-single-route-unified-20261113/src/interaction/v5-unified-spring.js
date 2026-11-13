/* 与已确认 C V5 相同的弹簧计算，以 60 帧为时间基准，
 * 允许 Safari 中途掉帧但不会无限重启动画。 */
(function(root){'use strict';
 function step(current,target,velocity,elapsedMs=16.67){
  const frames=Math.max(.45,Math.min(2,Number(elapsedMs)/16.67||1));
  const stiffness=.105*frames,damping=Math.pow(.75,frames);
  const v=(velocity+(target-current)*stiffness)*damping;
  return Object.freeze({value:current+v*frames,velocity:v});
 }
 root.FootprintV5Spring=Object.freeze({version:'C V5 统一弹簧',step,closeEnough:(x,target,v)=>Math.abs(x-target)<.65&&Math.abs(v)<.4});
})(window);
