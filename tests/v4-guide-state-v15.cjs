'use strict';
/* V4 .15: deterministic, network-free share import & real UI state contract.
 * Run alongside the browser checks. Never touches user storage. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../v4-review-20261116');
const guide=require(path.join(root,'src/media/guide-link-parser-v15.js'));
const cases=[
 ['微信公众号','上海公园散步 https://mp.weixin.qq.com/s/abc123','微信公众号'],
 ['小红书','3.88 打开小红书，查看这篇路线 https://xhslink.com/abcD12 复制此条信息','小红书'],
 ['抖音','夜景散步 http://v.douyin.com/xxAb1/ 复制此链接','抖音'],
 ['Bilibili','周末探店 https://b23.tv/AbC12','Bilibili'],
 ['微博','街区笔记 https://weibo.com/12345/abc','微博'],
 ['YouTube','Tokyo notes https://youtu.be/abcd123','YouTube'],
 ['普通网页','https://example.com/guide?a=1&b=2','网页']
];
for(const [label,input,source] of cases){
 const parsed=guide.parse(input);
 assert.equal(parsed.ok,true,label+' URL not extracted: '+JSON.stringify(parsed));
 assert.equal(parsed.source,source,label+' source mislabeled');
 assert.match(parsed.url,/^https?:\/\//);
 assert.equal(parsed.originalText,input,label+' original share text not retained');
}
const decorated=guide.parse('一本攻略（https://xhslink.com/foo）');
assert.ok(decorated.ok&&decorated.isShortLink,'punctuated short link not accepted');
assert.equal(guide.parse('javascript:alert(1)').ok,false,'unsafe scheme accepted');
assert.equal(guide.parse('只是普通文字，不含链接').ok,false,'bad link accepted');
assert.equal(guide.parse('https://example.com/a','自定义标题').title,'自定义标题');
const home=fs.readFileSync(path.join(root,'footprint-home.js'),'utf8');
const runtime=fs.readFileSync(path.join(root,'v4-map-runtime.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src/visual/visual-system-v15.css'),'utf8');
const saved=fs.readFileSync(path.join(root,'icons/04_star_saved.svg'),'utf8');
const empty=fs.readFileSync(path.join(root,'icons/03_star.svg'),'utf8');
assert.ok(home.includes('head.append(titlewrap,headActions,closeButton)'),'missing approved header layout');
assert.ok(home.includes('headActions.append(starButton,navButton)'),'star and navigation not adjacent');
assert.ok(!home.includes('const editToggle=btn('),'obsolete master edit toggle remains');
assert.ok(home.includes("starImage.src=isStarred?'./icons/04_star_saved.svg':'./icons/03_star.svg'"),'star state missing');
assert.ok(runtime.includes('window.__atlasSetBookmarkStarred=async'),'reversible bookmark store missing');
assert.ok(runtime.includes('window.__atlasSetPlaceStage=async'),'optional stage store missing');
assert.ok(home.includes("x.source||sourceName(x.url)"),'link source not retained');
assert.ok(home.includes('originalText:parsed.originalText'),'original share not saved');
assert.ok(css.includes('.fp-guide-list')&&css.includes('.fp-guide-editor'),'guide visual grammar missing');
assert.ok(saved.includes('#D7B36E'),'saved star does not match geographic yellow');
assert.ok(!empty.includes('#D7B36E'),'empty star accidentally filled');
console.log('PASS V4 .15: 7 source families, safe extraction, reversible star, stage, guide data, and visual contract');
