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

### C04 路线加载竞态修复
地图矢量底图延迟加载时，不再强行调用全览关闭用户已选中的路线站点。真实地点、Brief、照片和视频继续绑定 placeId。Chromium/WebKit 验证以最新源码 Actions 和线上 smoke 为准。

### Safari 样式缓存保护
三个真实页面统一显式加载版本化 Stage15 CSS，避免浏览器沿用同名 Stage14 样式。此版本号不改变原本的数据存储隔离。

## Stage 16｜根据真实 WebKit 截图进一步修复
- 失败状态从永久“正在绘制城市肌理”转为单一、明确且可重试的提示，不会把空白瓦片报为加载成功；收藏、照片和路线仍然可用。
- Pages 上基础地图失败后允许用户主动重试 OpenFreeMap 矢量地图，不要求清空收藏或重新登录。
- 精修 iPhone 路线规划的页面层级和触控目标；保留原三档上滑、真实媒体与路线数据逻辑。
- 截图是 WebKit 自动化浏览器证据，不等于用户 iPhone Safari 真机视觉验收。

## Stage 17｜用户反馈 Stage 15/16 正常浏览无明显差别后的真正可见改动
本次修改不再把错误提示与内部测试归类为主要视觉成果。地图默认 Dock、地点卡片、媒体章节、收藏/搜索、真实路线规划站点卡和路线地图底部站点，均统一采用已确认墨绿／米白／哑金／V3 手绘 SVG 语言，重新安排密度、主次和触控目标。CSS-only presentation, B/C physical swipe handlers, IDB, POI state intact；PR 继续 Draft。

## Stage18 — 第一屏真实视觉成果
路线规划界面在物理底卡上方直接展示真实路线名称、天数、出发地、目的地及前三个已选地点；站点/日期/顺序更新时，概览与原 IndexedDB 路线同步更新，不虚构数据。编辑路线按钮直接调用已确认的 C V5 三档卡片。地图原有定位和缩放归并为一组 iPhone 工具栏，保留唯一黄星、V3 手绘 icon 和所有原数据处理。正式网站根目录无更改，Stage18 仍待用户视觉验收。

## Stage19｜普通使用第一屏进一步明显改进
地图首页展示墨绿色 FOOTPRINT 小型导览及现有收藏计数（从原 #sheetCount 同步，绝不创建第二份数据）；已保存地点的真实地址可出现在详情标题下；用户自己的照片/视频依旧用原媒体查看器，但由等宽图转为有主图的非对称 2–5 张拼贴；路线页去掉重复大标题，D1/站点概览提前且根据真实已选站点数调整比例。唯一黄星、V3 icon、三档物理上滑、原高德/地图/IndexedDB/分享/备份全保留。正式网站不更改，独立候选待用户审核。

### Stage19 矮屏避让校正
真实 WebKit（iPhone 13）截图发现首页导览与瓦片加载提示临近，本轮在较矮屏幕下上移避免策略改为向下留空；地图异常终态时导览自动隐去；两处均不修改实际地图加载逻辑。

## Stage20｜撤回未经确认的地图附加面板（2026-11-12）
验收入口：https://fanbregas-netizen.github.io/travel-atlas-pages/v4-systematic-review-20261112-stage20/

- 彻底移除 Stage19 新增的墨绿色「FOOTPRINT / MAP · 我的旅行地图」悬浮面板（JS 创建逻辑及全部专用 CSS），不以隐藏方式保留。
- 不添加新的地图视觉/图标/装饰，继续沿用原黄星、V3 手绘图标、三档上滑卡片、地图加载/搜索、照片视频/Brief/攻略/附近、收藏及路线逻辑。
- 此目录独立于 Stage19，并保留相同的隔离数据命名空间，供原已有个人数据检视；正式根目录不变。旧 Stage19 验收页也不变。
- HTML base 路径及资源版本戳独立更新，防止 Safari 新旧预览资源串用。
- 注意：Stage19 的其他视觉改版仍属于候选，不能因为删除面板就宣称视觉已由用户最终确认。实际 iPhone Safari/商用上线尚未验收。


## Stage21｜真实搜索、内容草稿和媒体浏览（2026-11-12）

- 搜索页新增从原 IndexedDB 地点仓库读取的真实收藏快捷入口；无收藏时显示可操作的空状态，异步查询不会覆盖用户正在输入的内容。
- Brief、攻略链接按稳定 placeId 保留未保存草稿，切换地点或关闭卡片后仍可继续；主动取消先确认。草稿仅保留在当前浏览器页面内存，只有明确点击保存才写入 IndexedDB，刷新/关闭标签页前应保存。
- 原 B01 全屏照片视频横滑、下拖回弹/退出保留；换片增加轻量过渡与键盘方向键导航，无第二个查看器。
- 地图、唯一黄星、V3 手绘 icon、三档卡片和原路线逻辑不变；Stage19 违规地图浮层和四向气泡不再恢复。
- iPhone Safari 真机和商业地图服务未最终验收。


## Stage22｜系统级 iPhone 视觉和交互层级（2026-11-13）
真实产品各页面集中改进：首页 Dock、地点卡片标题/Brief/媒体、搜索、收藏、路线规划及路线地图，统一字号、留白、触控反馈和内容密度。媒体全屏占满 iPhone 视口，保留既定 B01 横滑与下拖手势。不是一两个按钮的修补，不加入新地图装饰；唯一黄星、V3 icon、三档上滑、原地理/收藏/媒体/路线数据与正式根站不变。CI 与 Safari 真机验收独立判定。

## Stage23｜真实地图清晰度 + 媒体与卡片连续体验（2026-11-13）
- 已移除旧 memory-open 样式在真实地图、POI、星标上的模糊滤镜，保留原底图、建筑、唯一黄星、V3 SVG Icon 和 B 三档卡片。
- 地点卡片中多段视频只在进入可视区域时自动静音播放，后台/全屏/离开可视区立即暂停；卡片卸载释放临时视频 URL，减少 iPhone Safari 压力。
- 全屏照片点按可隐藏／恢复关闭键和底部说明；原横滑切片、下拉回弹与视频原生控件不变。
- 三档卡片关闭的浏览器动效有超时兜底，不再无限占用地图触控层。
- 搜索／地点内容／收藏／路线滚动阅读节奏统一，无新的地图装饰和虚构数据。
- 此独立预览不替换 Stage22 或正式首页；真实 iPhone Safari 最终验收与商用高德服务仍未完成。


## Final-approved V4 restoration candidate (2026-11-13)
This independent review restores actual saved-photo location recognition in the original three-level B sheet and stops misleading road-route success messages. No fake media, no extra geographic star, no four bubbles. Real editing and saved content stay reachable even while the card is at peek. Original root deployment and Stage23 remain intact. Based on private source c988bb8945755c850d554fa6c54e16b7901eeba3. User Safari visual approval and commercial AMap remain separate gates.


## Approved V4 Recovery · Phase 2 · 2026-11-13
Actual product: shared saved-photo identity between search results and the one B V3 place card; saved status/media count are read from persisted places; same four original Dock icons with balanced layout; one visual typography/spacing scale across collection and C route; figure-ground map black architecture/white roofs at zoom levels, with the historical real-map blur removed from the source. No new map surface, no stock pictures, no fake POIs, no four-direction bubbles. Production root and Phase 1 preview unchanged. Safari physical approval/commercial AMap remain pending. Source adea89e77447f135d47b6fd6a2f2869beeefaf73.


### Search layout QA correction
The first Phase2 browser screenshot exposed an old reversed Dock layout that placed the search header below results. The actual source now removes that obsolete behavior in-place (Stage1.30 / Stage1.32) and uses a full-width header-first sheet with real photo results beneath it; updated e2e checks actual visual geometry. Source commit 37e2724a5646410322dc9e603b8be412645a8b90.


### Native search header controls
The old Stage1.30 JavaScript incorrectly took the original search close button from the header into the input and renamed it “取消”; the bottom popup visual was cancelled. Phase2 removes that reparenting and returns a 44px close action to the title row. B sheet search grip is now an invisible full touch region with a single 44×5 visible handle. Real WebKit and Chromium E2E checks include the header parent and visual layout.
