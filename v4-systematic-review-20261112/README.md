# Travel Atlas V4｜跨模块真实功能 iPhone 试验版（2026-11-11）

源码来自私有仓库 `integration/v4-real-e2e-20261111`（PR #20），以已通过 35/35 交互设计验收的 PR #19 完整产品为底，不是单独的演示原型。

## 数据隔离规则
- 所有保存的 Places/Meta IndexedDB 使用 `private-travel-footprints-v1-v4-real-e2e-review`。
- 路线 IndexedDB 使用 `travel-atlas-journeys-v1-v4-real-e2e-review`。
- 浏览器 localStorage 与 sessionStorage 通过预览入口 HTML 中最早的脚本按 `atlas-e2e-preview-20261111:` 自动隔离。
- URL 及页面相对资源、手绘 SVG 图标均限定在 `/travel-atlas-pages/integration-v4-real-e2e-review/`。
- 用户正式版收藏、媒体和路线 **不会被此预览读到或修改**；新预览打开时是空白收藏，需要创建测试数据，勿将其当作真实数据丢失。

## 已验证
- 私有仓库 Github Actions: 41/41 Node module tests, 7/7 真实 Chrome cross-module E2E。
- 真实地点：保存/刷新；照片、视频二进制、Brief、链接同 PlaceId，ZIP 备份可完整解码；真实路线导入/保存/添加停靠点和日期 D 标签适配；损坏 ZIP 拒绝。
- 35/35 交互审核已确认，不再重复视觉设计。

## 尚待 Safari 真机
- 实际地图 POI/API 质量、弱网、前后台恢复、Safari 视频解码、照片选择、拖动 3 档卡片、路线道路服务偶发失败及原生日期操作。

本目录为独立验收副本，**不修改根目录的正式 `index.html`**。
