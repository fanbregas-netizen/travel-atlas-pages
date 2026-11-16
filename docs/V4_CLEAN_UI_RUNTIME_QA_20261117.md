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

## 2026-11-17 后续实施（本次继续，不是旧版摘要）

**隔离分支代码 HEAD（测试前）：** `7ed03b8c3ad948a85af209e6fe8c8c2f3b8a953a`。正式网站和 main 均未写入。

### 实际删除/修复
- 从首页直接移除已退出正式路线流程的 `trip-picker.js` **内嵌执行脚本**及隐藏的旧路线/收藏下拉菜单；清掉 `sw.js` 对旧路线选择脚本/CSS 的离线预取。首页由 141,090 进一步减为 **116,087 字符**（削减 25,003）。备份按钮、真实收藏行与原独立地点详情保持原有模块，不重建界面。历史独立脚本文件暂保留供 Git 历史审计，不再运行。
- `showSection('routes')` 的残留入口直达 `journey.html`，而不是重新启用两套旧路线页面。
- 将 C V5 路线与新选的非收藏地图途经点由**两次**写入改成 Media D **同一笔 IndexedDB 事务**。路线保存失败、地图点 ID 与已有收藏冲突、储存中止时不留下孤立站点，不覆盖原收藏的 Brief/照片。成功写入后才释放内存中的未保存临时点。
- 保留旧 C V5 卡片、路线排序/日期/地图数据结构，保留 Media D 的 ZIP 二进制/CRC 和原始收藏数据键名。

### 新增、已验证的场景
- [路线真实保存、重新打开、已保存路线载入、ZIP 完整备份和恢复；WebKit + Chromium 双通过](https://github.com/fanbregas-netizen/travel-atlas-pages/actions/runs/43971895580)；包含失败时的路线/地图途经点原子回滚和「既有照片不被新点覆盖」。
- [移除旧路线执行入口后，主地图/收藏/POI/媒体真实浏览器回归；WebKit + Chromium 双通过](https://github.com/fanbregas-netizen/travel-atlas-pages/actions/runs/43972681926)。
- [去除旧路线后，真实 C V5、媒体 ZIP 备份/恢复与按钮导出/导入；WebKit + Chromium 双通过](https://github.com/fanbregas-netizen/travel-atlas-pages/actions/runs/43973189377)。
- [Brief 编辑/保存/取消、攻略链接、想去/已到访、取消收藏保留原内容、导航选择、后续加照片及刷新恢复；WebKit + Chromium 双通过](https://github.com/fanbregas-netizen/travel-atlas-pages/actions/runs/43973740074)。
- [旧样式源序与模块合同（未更改正式 main）](https://github.com/fanbregas-netizen/travel-atlas-pages/actions/runs/43972693919)。

### 保守 CSS 审计
- `legacy-inline-cascade.css`：314,944 字符；32 组原样历史样式；约 2,093 个顶层规则/块、2,243 次 `!important`。精确重复的顶层样式仅有 6 组、约 476 字符，**不能因为文件很大便推断删除大部分规则无风险**。
- 已定位退役路线选择器（`.tp-*`、`.route-bar-pop`、`.fav-tray`、`.route-pick-active` 等）仍留在旧 CSS 中。正式删规则必须逐个确认选择器不被已确认子系统复用，并验证 iPhone 多档卡片和地图渲染。基于当前证据，不对剩余历史 CSS 宣称“完全清理”。
- 页面源代码、隐藏控制器和路由数据的可确认冲突已经减少；后续 CSS 清理优先按真实 CSSOM / 动态页面覆盖率审计，而非全局覆盖或再加 v20 样式表。

### 正式交付尚待
- 仍未按完整 35/35 全链路逐屏覆盖真实 iPhone Safari、极端地图缩放和 WebGL 恢复、视频实际解码（不等于仅保留二进制）、全部异常/权限以及多个跨设备恢复场景。
- 没有把 Draft PR #8 合并到 main，也没有创建并冒称已通过 iPhone Safari 的独立正式验收 URL。**本轮的 Headless WebKit 通过，只是模拟 Safari 内核，不等于真实 Safari 上手体验通过。**
## 2026-11-17 后续专项：退役样式、日期与视频

### 已实际完成并保留的代码

1. 在实际加载的 `legacy-inline-cascade.css` 删除 **84 条仅由已退出首页的 Stage1 路线控制器使用的顶层样式规则**，合计 10,316 字符。目标仅限 `.tp-*`、`.rb-*`、`.route-bar-pop`、`.fav-tray`、`.savebox`、`body.route-pick-active` 等独立旧路线选择器；**不碰**活跃 C V5/B05、地图、地点详情与已确认设计。
2. 新增 `tests/v4-retired-route-css-filter.cjs`，结构合同现在把 GitHub `origin/main` 原始 32 段 CSS 逐段应用同一个白名单过滤器，确认当前 CSS 的所有其他声明与排序**逐字相同**。删除旧规则不等于所有旧 CSS 都已完成去重。
3. 更新独立分支首页对旧 CSS 的资源查询版本，避免今后单独部署验收时 Safari 从旧 URL 缓存读取未清理样式。
4. C V5 路线实际产品中把“演示最多选 30 天”的旧演示文案调整为“单次行程最长支持30天”，没有改日历和交互视觉；保留原有日期草稿、取消、自动 D 标签调整与撤销。
5. 新增纯本地原创 0.625 秒 H.264/MP4 视频（32×32 色块）作为可解码测试资产，测试真实文件上传、缩略图生成、全屏视频容器、关闭与刷新后数据恢复，不再以 8 字节假视频冒充播放测试；可播放性仍取决于测试内核上的解码器。

### 最新真实证据

- [CSS 32/32 段逐字限定过滤；结构及旧新版合同全部通过](https://github.com/fanbregas-netizen/travel-atlas-pages/actions/runs/43980059085)
- [清理 84 条旧规则后地图、三档卡片、POI 切换、搜索、媒体 WebKit + Chromium 双通过](https://github.com/fanbregas-netizen/travel-atlas-pages/actions/runs/43979646833)
- [C V5 站点键盘排序、日期草稿取消、D3 缩短至 D2、撤销、重新打开，以及真实 MP4 上传/浏览与媒体/路线备份恢复；双浏览器通过](https://github.com/fanbregas-netizen/travel-atlas-pages/actions/runs/43980051017)
- [旧独立预览测试复测通过](https://github.com/fanbregas-netizen/travel-atlas-pages/actions/runs/43980059051)（此项检查的是 `integration-v4-real-e2e-review`，不能替代当前候选产品专项 E2E）。

**发布门槛仍未解除**：暂未完成原全量 35/35 的所有例外场景、iPhone Safari 真机视觉和 60/120Hz 连续手势、视频在真实设备上的长时间播放/音频/系统全屏，以及全部 CSS 计算样式审计。本轮没有修改正式 `main` 或生产 Pages，也没有发布最终验收入口。
