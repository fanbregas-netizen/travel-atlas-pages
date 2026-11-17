/* Footprint Map V4 · per-system iPhone acceptance, 2026-11-17.
   Read-only with respect to product logic. Review answers live ONLY in this
   preview's local browser storage until manually copied by the reviewer. */
(()=>{'use strict';
const script=document.currentScript;
const scope=String(script?.dataset?.scope||'map');
const systems={
 map:{name:'地图系统',intro:'只验地图渲染、点位和地图手势。收藏、路线、媒体逻辑保持原样。',items:[
 '首次进入地图、重新打开与返回首页的加载表现',
 '连续快速切换 POI，卡片衔接无跳变',
 '移动、放大和缩小地图，没有底图重影或卡顿',
 '唯一黄色星标、选中点动画及定位稳定',
 '地图选点放大居中、标记准确，不跳到其他点',
 'iPhone Safari 实机连续操作的流畅度']},
 interaction:{name:'交互系统',intro:'只验卡片、搜索、Dock 与唯一 C V5 路线交互。滑移手感以 iPhone Safari 为准。',items:[
 'POI 卡片：上滑、下拉跟手、松手回弹与关闭',
 '我的收藏：列表拖动、预览／半屏／全屏三档',
 '收藏地点详情：半屏内容滚动、三档收合',
 'Dock 与顶部搜索：打开、取消、结果选择和返回',
 'C V5 路线：选点、日期确认、站点排序及保存',
 '连续页面切换、返回和异常状态无突跳']},
 visual:{name:'视觉系统',intro:'以现款收藏地点卡片为唯一基准。可在左上方切换现款／统一后，按真实页面逐项核对。',items:[
 '收藏地点卡片：眉头、44px 抓手与关闭按钮对齐',
 'POI 与地点详情：标题字号、圆角和留白一致',
 '收藏列表与总览：内容紧凑，无无意义空白',
 '搜索结果：输入框居中、展开后排版清晰',
 '路线子页：沿用 C V5，标题、按钮、节奏统一',
 '375／390／430px 屏宽及安全区、仅中文界面']},
 media:{name:'媒体系统',intro:'只验真实地点关联的文字、照片、视频、攻略与数据恢复。不改变当前产品媒体仓库。',items:[
 'Brief 阅读、编辑和保存，返回后内容正确',
 '在现有收藏地点添加照片与视频，关联准确',
 '缩略图进入全屏、滑动切换与返回动作自然',
 '视频播放停止、媒体布局切换及空状态',
 '攻略链接和附近地点与当前地点对应',
 '刷新后数据保留；导出、导入和恢复可用']}
};
const s=systems[scope]||systems.map;
const key='fp-v4-system-approval-'+scope;
const states=['待验收','通过','需调整'];
const mount=()=>{
 if(document.querySelector('.fp-system-switch'))return;
 let saved={};
 try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch(_){}
 if(!Array.isArray(saved.answers)||saved.answers.length!==s.items.length)saved.answers=s.items.map(()=>states[0]);
 const veil=document.createElement('div');veil.className='fp-system-veil';veil.hidden=true;
 const panel=document.createElement('aside');panel.className='fp-system-panel';panel.hidden=true;panel.setAttribute('aria-label',s.name+'验收清单');
 const trigger=document.createElement('div');trigger.className='fp-system-switch';
 const pill=document.createElement('button');pill.type='button';pill.className='fp-system-pill';pill.textContent=s.name+' · 验收';trigger.append(pill);
 const head=document.createElement('header'),intro=document.createElement('div');
 const kicker=document.createElement('p');kicker.className='fp-system-kicker';kicker.textContent='完整 V4 产品 · 独立子系统';
 const title=document.createElement('h2');title.textContent=s.name;
 intro.append(kicker,title);
 const exit=document.createElement('button');exit.type='button';exit.className='fp-system-exit';exit.textContent='×';exit.setAttribute('aria-label','关闭验收清单');head.append(intro,exit);
 const desc=document.createElement('p');desc.className='fp-system-intro';desc.textContent=s.intro;
 const list=document.createElement('div');
 const selects=s.items.map((name,i)=>{
  const row=document.createElement('label');row.className='fp-system-check';
  const label=document.createElement('span');label.textContent=(i+1)+'. '+name;
  const sel=document.createElement('select');sel.setAttribute('aria-label',name);
  states.forEach(v=>{const opt=document.createElement('option');opt.value=v;opt.textContent=v;sel.append(opt)});
  sel.value=states.includes(saved.answers[i])?saved.answers[i]:states[0];
  sel.addEventListener('change',()=>{saved.answers[i]=sel.value;save()});
  row.append(label,sel);list.append(row);return sel;
 });
 const actions=document.createElement('div');actions.className='fp-system-actions';
 const copy=document.createElement('button');copy.type='button';copy.textContent='复制本系统验收结果';
 const hub=document.createElement('a');hub.href='../v4-system-review-20261117/';hub.textContent='返回四系统总览';
 actions.append(copy,hub);
 const foot=document.createElement('p');foot.className='fp-system-foot';foot.textContent='每个系统独立记录；复制后发到聊天确认。未通过的项目不会自动进入汇总版。';
 panel.append(head,desc,list,actions,foot);
 document.body.append(veil,trigger,panel);
 const save=()=>{try{localStorage.setItem(key,JSON.stringify(saved))}catch(_){}};
 const open=on=>{panel.hidden=!on;veil.hidden=!on;pill.setAttribute('aria-expanded',String(on));if(on)exit.focus()};
 pill.addEventListener('click',()=>open(panel.hidden));
 exit.addEventListener('click',()=>open(false));
 veil.addEventListener('click',()=>open(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)open(false)});
 const summary=()=>{
  const n=saved.answers.filter(x=>x==='通过').length;
  return 'Footprint Map V4｜'+s.name+'独立验收\n通过 '+n+'/'+s.items.length+'；需调整 '+saved.answers.filter(x=>x==='需调整').length+'；待验收 '+saved.answers.filter(x=>x==='待验收').length+'\n'+s.items.map((name,i)=>(i+1)+'. '+name+'：'+saved.answers[i]).join('\n')+'\n说明：只针对 '+s.name+'，其他系统尚未因此验收。';
 };
 copy.addEventListener('click',async()=>{
  const str=summary();
  try{
   if(!navigator.clipboard?.writeText)throw Error('clipboard');
   await navigator.clipboard.writeText(str);
   copy.textContent='已复制，可发回聊天';
  }catch(_){
   const ta=document.createElement('textarea');ta.value=str;ta.style.position='fixed';ta.style.opacity='0';
   document.body.append(ta);ta.select();
   const ok=document.execCommand?.('copy');ta.remove();
   copy.textContent=ok?'已复制，可发回聊天':'请逐项发回聊天';
  }
 });
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();