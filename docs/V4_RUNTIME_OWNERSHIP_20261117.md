# Footprint Map V4｜运行时所有权与冲突边界

适用分支：`refactor/v4-clean-ui-20261116`（PR #8，禁止向正式 Pages 合并或发布）。

## 实际 UI 所有权

| 实际 DOM | 创建者 | 状态/内容 | 手势/运动 | 视觉基准 |
|---|---|---|---|---|
| `#drawer` 我的收藏 | 预览首页静态 HTML | `v4-map-runtime.js` 开/关；首页 `showSection` 显示列表 | `v4-approved-collection-sheet.js` B05 三档和开闭弹簧 | `accepted-four-screen-v18.css` |
| `#fpPlaceCard` 已收藏地点详情 | `footprint-home.js` 动态创建 | `footprint-home.js`、`real-product-bridge.js`、单一地点 ID | `physical-sheet.js`、`sheet-controller.js` 三档 | PR #15 + V18 |
| `#destinationCard` 普通地图 POI | 首页静态 HTML | `v4-map-runtime.js` 唯一目的地选择 | `poi-card-handoff-v19.js` 对原卡片下沉、切换内容、回弹 | PR #15 兼容映射 + V19 |
| `#fpSearchSheet` 搜索历史和结果 | `footprint-home.js` 动态创建 | 原搜索 DOM/表单；定位为顶部锚定下拉 | `anchored-history-spring-v18.js` | PR #15 + V18 |
| `#rc-main` 路线卡片 | `journey.html` 里的 `route-cards-v5-live.js` | 唯一 C V5 路线状态/站点，独立存储 | 本轮改用同一 `FootprintV5Spring.step`，按实际帧间隔驱动 | C V5 + PR #15 路线桥接 |

## 已去掉的实际冲突

- 单一路线模式收藏页不再出现单项分段栏和重复「收藏地点」标题。
- 收藏内部子视图切换不再通过 `class` MutationObserver 重启动画。
- POI 文字更新不再抢在整卡过渡之前；快速切点取消上一条过渡；过渡期间旧卡按键禁用。
- POI 图标快速重复点击时，新的缩放弹簧会取消旧缩放及回位，避免同一 SVG 被多个动画写入 scale。
- 路线 C V5 弹簧在 60Hz 保留确认参数 `.105 / .75`，120Hz 和丢帧采用共享时间补偿。
- 原有单黄星、V3 图标、地图相机、存储 IndexedDB、媒体文件及路线数据仍由原模块负责。

## 尚未授权删除的历史代码

`legacy-inline-cascade.css` 保留 32 段历史规则；它们并非都可无损删除，需在真实场景检查计算后的样式及 @media 作用。首页旧路线 `trip-picker.js` 包含了收藏列表的公共操作，不能仅因旧路线退役就删除整个脚本；当前 C V5 唯一入口由 `one-route-entry.js` 拦截。后续拆分必须单独验证收藏与备份功能。

## 验收边界

静态检查、GitHub Actions 成功、WebKit 自动化成功都不等于用户 iPhone Safari 的操作手感验收；正式网站保持原样。必须逐项取得真实帧/截图、375/390/430px 和媒体/路线回归，再决定是否可以交付。
