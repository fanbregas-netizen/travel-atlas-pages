# Footprint Map V4｜系统整合候选验收（2026-11-12）
独立真实产品验收入口：https://fanbregas-netizen.github.io/travel-atlas-pages/v4-systematic-review-20261112/
源码：私有仓库 fanbregas-netizen/travel-atlas PR #24, integration/v4-systematic-rebuild-20261111, commit a00a15805935f1384ffae8365a56e2ed71a63bbc.
本目录以最新真实 source/ 为基线，使用统一真实地图、单颗收藏星标、B 三档实体卡片、D 影像/Brief/攻略、C V5 路线日期与详情。

## 数据隔离
网页 IndexedDB/localStorage 使用 atlas-v4-systematic-20261112- 前缀，与正式版隔离。此预览首次访问收藏为空正常；不要在正式站与预览站之间期待实时同步。

## 已验证
GitHub Actions https://github.com/fanbregas-netizen/travel-atlas/actions/runs/43144227561：Chromium 与 WebKit 双通过；各 42/42 Node 模块测试、4/4 runtime 接线检查，以及 16 组真实浏览器流程，包括地点/媒体/路线/备份和 iPhone 路线页控件几何回归。
本版还修复了 WebKit 图片全屏窗口关闭时动画 Promise 可能悬挂、遮罩无法消失的问题。

## 尚待真实设备/商用发布验收
此前独立批准的 UI/UX 35/35 不等于真实整合页面视觉全通过。实际 iPhone Safari、网络地图/授权、数据配额/清除、隐私安全与商用服务仍需验收。正式根目录未修改。
