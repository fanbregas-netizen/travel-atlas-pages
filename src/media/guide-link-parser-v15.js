/* Footprint Map V4 · platform-neutral, privacy-first share text import.
   This parser never fetches a third-party link or claims that a private post is readable.
   It extracts a usable HTTP(S) URL and retains the unmodified original text locally. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FootprintGuideLinks=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const providers=[
  ['微信公众号',/(^|\.)mp\.weixin\.qq\.com$/i],
  ['小红书',/(^|\.)(xiaohongshu\.com|xhslink\.com)$/i],
  ['抖音',/(^|\.)(douyin\.com|iesdouyin\.com)$/i],
  ['Bilibili',/(^|\.)(bilibili\.com|b23\.tv)$/i],
  ['微博',/(^|\.)(weibo\.com|weibo\.cn|weibo\.com\.cn)$/i],
  ['视频号',/(^|\.)(channels\.weixin\.qq\.com)$/i],
  ['YouTube',/(^|\.)(youtube\.com|youtu\.be)$/i],
  ['TikTok',/(^|\.)(tiktok\.com)$/i],
  ['Instagram',/(^|\.)(instagram\.com)$/i],
  ['X',/(^|\.)(x\.com|twitter\.com)$/i],
  ['腾讯视频',/(^|\.)(v\.qq\.com)$/i]
 ];
 const clean=x=>String(x||'').replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
 function provider(url){
  try{
   const host=new URL(url).hostname.toLowerCase().replace(/^www\./,'');
   return providers.find(([,regex])=>regex.test(host))?.[0]||'网页';
  }catch{return '网页'}
 }
 function firstURL(text){
  const normalized=clean(text).replace(/&amp;/gi,'&').replace(/&#38;/g,'&');
  const list=normalized.match(/https?:\/\/[^\s<>\x22'“”‘’。，、！？；;（）【】]+/giu)||[];
  for(let candidate of list){
   candidate=candidate.replace(/[),.!?;\]}]+$/g,'');
   try{
    const u=new URL(candidate);
    if(['http:','https:'].includes(u.protocol)&&u.hostname&&u.username===''&&u.password===''&&u.href.length<=2048)return {url:u.href,match:candidate};
   }catch{}
  }
  return null;
 }
 function parse(text,manualTitle=''){
  const raw=String(text||'').trim();
  const found=firstURL(raw);
  if(!found)return {ok:false,error:'未识别到完整的网页链接，请复制包含 https:// 的分享内容。'};
  const source=provider(found.url);
  let intro=raw.slice(0,Math.max(0,raw.indexOf(found.match))).replace(/^\s*(?:\d+[.)、]\s*)?/,'').trim();
  intro=intro.replace(/[：:，,！!\s]+$/g,'').replace(/^(?:复制口令|复制链接|打开链接)\s*/,'').trim();
  const title=clean(manualTitle)||((intro&&intro.length<=100)?intro:(source==='网页'?'网页攻略':source+'攻略'));
  return {ok:true,url:found.url,source,title:title.slice(0,150),originalText:raw.slice(0,4000),isShortLink:/^(?:xhslink\.com|b23\.tv|v\.douyin\.com)$/i.test(new URL(found.url).hostname)};
 }
 return Object.freeze({parse,provider,firstURL,version:'v15'});
});
