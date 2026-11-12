# Footprint Map V4｜系统整合候选验收（2026-11-12）
源码：私有仓库 fanbregas-netizen/travel-atlas PR #24 integration/v4-systematic-rebuild-20261111 commit 124289617fa0975eed2239ce67cc2a94048594fd。
本目录从真实 source/ 构建，不使用旧 main、独立 B/C 演示页面，维持原 V4 地图、黄星、交互、媒体、路线。
预览只用于验收，不是商用正式站，也不替换公开 Pages 根首页。

## 隔离
浏览器 IndexedDB 与 Storage 使用 atlas-v4-systematic-20261112- 前缀；与旧验收页、正式网站完全分离。新打开时收藏为空是正常的，请用测试地点。
## 自动化依据
Github Actions run 43141592142：Chromium 和 WebKit 成功；42/42 Node 模块测试，4/4 接线检查，15 组真实浏览器流程（含地点→媒体/Brief→路线→备份）。
自动化不等于真实 iPhone Safari 或最终视觉确认。
## 仍需真机与发布门禁
地图/provider 商业授权、Safari 真实设备、存储配额与清理风险、隐私安全、监控等未全部通过。