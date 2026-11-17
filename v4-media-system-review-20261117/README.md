# Footprint Map V4｜媒体系统独立验收 · 2026-11-17
产品： https://fanbregas-netizen.github.io/travel-atlas-pages/v4-media-system-review-20261117/
Safari 数据自检： https://fanbregas-netizen.github.io/travel-atlas-pages/v4-media-system-review-20261117/media-qa.html

基线：2026-11-16 已部署 V4 .19 真实完整产品文件夹 v4-review-20261116。部署时原样复制全部资源，再叠加独立媒体修复，仅修改 src/media/media-core.js 的“单地点 6 条视频”保护。
完整产品原有照片/视频缩略图切换、苹果照片式全屏展开和下滑关闭完全不改。
新目录使用 atlas-v4-media-system-review-20261117- 独立 IndexedDB/localStorage 前缀、独立 Service Worker 缓存；正式网站和既有验收目录不变。
用户 iPhone Safari 实机验收前不得标记通过；严禁合并到产品 integration/v4-current 或正式首页。
