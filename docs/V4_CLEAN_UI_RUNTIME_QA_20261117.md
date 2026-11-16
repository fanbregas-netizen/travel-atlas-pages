# Footprint Map V4｜真实运行时清理与交互回归

日期：2026-11-17。分支：`refactor/v4-clean-ui-20261116`（Draft PR #8）。
**正式 GitHub Pages 主站及 main 不变；不发布未验收版本。**

## 真实修改（不是只改版本号）

1. 从原 `v4-review-20261116/index.html` 保序提取 32 段 CSS 到 `legacy-inline-cascade.css`；32/32 代码一致，已保护加载顺序。
2. 五段经过逐字核对的同内容内嵌 JS（`atlas-services`、`atlas-constellation-core`、`atlas-route-buildings`、`stage1-polish`、`stage1-finish`）改为同级独立文件同步加载。首页 158,316 → 141,090 字符。
3. 收藏真实 `#drawer`：移除单一路线模式下多余的分段栏和二次标题；B05 控制器只在真正打开/关闭时启动动效，不因子视图 class 变化反复吸附；抓手和地点行上下拖动均跟手。
4. 解决 WebKit 地图繁忙时 rAF 推迟导致的“移动时高度保持 608px，松手才跳至 729px”：touchmove 任务队列超过 32ms 则同步绘制最后高度。开闭动画保持单一 C V5 弹簧，使用 rAF 与 32ms 定时兜底**驱动同一计算器**，两者互相取消，不构建重复 CSS 动画。
5. 地图普通 POI 的 `#destinationCard` 先下沉，低点替换地点文字，再回弹；快速点位取消上次 SVG 缩放/回弹；搜索显示时回收旧 POI 卡片。
6. 地点详情 `#fpPlaceCard` 移除与 `atlas-card-grip` 重叠的第二条抓手，长标题允许自然换行，Brief／影像／攻略在三档卡片内部滚动。
7. 唯一 C V5 路线 `journey.html` 复用 `FootprintV5Spring.step` 时间补偿，保持已确认的 .105/.75（60 Hz）参数，适配 120Hz/丢帧。

## 运行时证据（与当前候选产品直接对应）

- WebKit + Chromium 完整运行时检查：<https://github.com/fanbregas-netizen/travel-atlas-pages/actions/runs/43914513875> —— **两浏览器通过**。测试在隔离的 `v4-review-20261116` 本地 HTTP 路径执行，而不是另一个旧版预览。
- 源代码 CSS 保序与交互合同：<https://github.com/fanbregas-netizen/travel-atlas-pages/actions/runs/43914524493> —— **通过**。
- 兼容性旧预览检查：<https://github.com/fanbregas-netizen/travel-atlas-pages/actions/runs/43914524425> —— **通过**（仅补充，不能替代本轮产品 E2E）。
- 证据保存在上述运行记录的 `clean-ui-webkit-evidence` 和 `clean-ui-chromium-evidence`：原始截图、逐帧轨迹、布局几何、错误日志。
- 两浏览器均完成：收藏开闭／三档拖动、非空收藏行手势、POI 连续换点、搜索历史真实弹簧、保存地点、照片上传→全屏→关闭、刷新后真实详情重新读到照片，以及 C V5 路线打开与 375／390／430px 检查。无未捕获 JS 异常。
- `getSaved()` 对外 QA 接口按设计只返回 `id/title/starred`，不返回照片；不能用它推断媒体丢失。刷新后重新打开 **真实地点详情**且影像显示，才是有效持久化证据。

## 保留边界／仍需完成

- 历史 `legacy-inline-cascade.css` 仍保留原 32 段，尚未完成基于运行时 CSS 计算结果的逐规则去重，**不能宣称 CSS 冲突清理全部完成**；直接删除旧规则可能破坏已经验收的 C/B/A/D 子系统。
- 新增自动化覆盖不代表原交互清单全部 35/35 在本轮重测；异常地图服务、视频编解码、备份还原以及真实路线保存等仍需更广泛回归。
- Headless WebKit 并非真实 iPhone Safari 60/120 Hz 触摸体验；最终仍需真机连续操作、截图与录屏验收。
- 因此本 PR 保持 Draft，**不合并 main，不替换正式 Pages，也不对用户宣称 100% 达标。**

## 不变合同

保持原 PR #15 视觉语言、B V3/B05 三档卡片与橡皮筋、唯一地理黄星、V3 手绘 Icon、原地图实例、媒体与 IndexedDB、C V5 唯一路线、简体中文 UI，不重新设计。
