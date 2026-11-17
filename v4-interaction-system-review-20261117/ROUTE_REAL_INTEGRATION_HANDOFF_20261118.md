# Footprint Map V4｜路线规划真实数据整合 · Safari 独立验收

## 入口
- [真实路线规划](./journey-real-confirmed-20261118.html)
- [真实路线地图](./route-view-real-confirmed-20261118.html)（须由规划页保存后传入 `?saved=` 标识，直接访问无路线属正常空态）
- [先前极简交互与色彩审核版](./route-minimal-review-20261117.html)

## 代码
- 正式完整产品当前整合候选基线：`fanbregas-netizen/travel-atlas` 的 `integration/v4-product-candidate-20261117`，不使用旧 main。
- 私有草稿 PR: `https://github.com/fanbregas-netizen/travel-atlas/pull/39`。
- 此页只加载 `v4-interaction-system-review-20261117/` 的独立命名页面和真实产品模块。
- 与已有独立 V4 验收页相同的 `atlas-v4-interaction-20261117-` 存储隔离，绝不读取或覆盖正式根目录的 IndexedDB／localStorage。

## 已通过的自动化
2026-11-17 真实 iPhone 390×844 浏览器回归（短闭环，GitHub Actions run 44134513556）：
- 真实 IndexedDB 中四个收藏点添加到规划路线
- 同一天起终点未指定时，第一站和最后一站默认保持；系统只预览推荐，不自动改动
- 手动采用推荐后路线为 A → B → C → D，撤销恢复 A → C → B → D
- 指定起点 A、终点 D，设置主要交通方式为骑行
- 路线保存到现有 FootprintMediaCore 路线仓库，跳转真实路线地图
- 返回编辑时 routeId、交通方式与原有站点顺序正确恢复

纯算法和源码连线另外通过 11/11 个检查（锁定站点、跨天约束、时间原样保留、按 ID 关联交通方式）。全量旧模块回归及 iPhone Safari 真机仍需验收；这不是正式版合并完成的证明。

## 视觉规范
- 暖白：`#fffefa`
- 灰绿：`#27342f`、`#304b3b`、`#edf1e9`
- 柔和金：`#f3eddf`、`#665338`
- 黄色 SVG 星标使用 V4 既有素材
- 单套地图、单套物理三档卡片，逐步显示路线排序／收藏选点／设置，不复活旧路线规划和双 Dock

## 后续合并条件
- 在 iPhone Safari 真机检查三档手势、地图不变形、星标前后层级及路线连线保持；
- 检查与主页地图、真实照片视频、IndexedDB 存储的跨模块兼容；
- 私有 PR #39 保持草稿状态，待验收后由整合负责人按最新整合基线合并，不修改正式 GitHub Pages 首页。
