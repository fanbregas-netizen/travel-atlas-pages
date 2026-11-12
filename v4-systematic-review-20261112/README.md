# Footprint Map V4｜Stage 15 独立完整产品视觉候选

验收入口：https://fanbregas-netizen.github.io/travel-atlas-pages/v4-systematic-review-20261112/?v=stage15-visual

2026-11-12 在 Stage14 真实产品基础上，对地点详情、收藏、搜索、媒体、路线规划及详情做整体验证候选，**不是设计原型，也不是正式商用版**。

- 地点：真实地点名称全宽，星标／编辑／关闭位于独立操作排；Brief、照片视频、攻略、附近地点统一章节节奏。
- 收藏与搜索：统一字体、卡片比例、列表信息密度及 44px 触控目标。
- 路线：保持已通过的 C V5 逻辑与 B 三档上滑交互；视觉调整路线信息与站点详情。
- 单颗黄星、已有 V3 图标、真实媒体/IndexedDB、地图和数据命名空间全部保留；四向气泡已取消。
- 实际源码：`fanbregas-netizen/travel-atlas` PR #25，视觉 CSS SHA `525e43f8ad8c46d47fe8d203aa953b7230d20a78`。
- 用户验收未通过前维持 Draft，不更动正式根首页；独立预览的保存资料与正式站隔离。
- 技术测试包含 Node、Chromium/WebKit 全产品、在线地图及可用时的 390px 实际控件几何截图；**CI 成功不等于 iPhone Safari 实机和最终视觉批准**。

最后验收门槛：真机 Safari 与视觉对照、35项真实集成复核、商业高德权限和服务、隐私与容灾。
