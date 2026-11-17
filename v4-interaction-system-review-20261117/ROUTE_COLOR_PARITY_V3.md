# Footprint Map V4｜路线规划色彩统一交接

独立验收：`/v4-interaction-system-review-20261117/route-minimal-review-20261117.html`

## 基准

与真实 V4 视觉系统已确认配色保持一致，不重做 UI，不改手绘星标资源。

| Token | HEX | 用途 |
|---|---|---|
| paper | `#fffefa` | 卡片、Dock |
| surface | `#f8f9f5` | 次级容器、输入 |
| sage | `#edf1e9` | 轻按钮、序号 |
| ink | `#27342f` | 标题、主要文字 |
| secondary | `#4b5750` | 正文、普通操作 |
| muted | `#69746e` | 次级文案 |
| line | `#e5e7df` | 分隔线 |
| green | `#304b3b` | 主确认按钮 |
| gold wash | `#f3eddf` | 推荐/选中 |
| gold text | `#665338` | 推荐/选中文字 |
| map route | `#536659` | 地图参考线 |

## 修改范围

- `route-color-parity-v3.css` 覆盖确认版 V4 的控件色系并统一交通方式图标的继承色彩。
- `route-minimal-review-20261117.html` 在原有极简样式后加载颜色层，保留原有几何、交互、路线顺序、日期和地图图标。
- 未修改正式产品仓库、正式 Pages 根目录和已有用户数据。
- 375px、390px iPhone 尺寸的 Chromium 真 DOM 测试通过；不代表已完成真实 iPhone Safari 手势验收。

## 验收重点

1. 主地图只强化黄色星标；路线线条使用克制的灰绿色。
2. Dock 与卡片维持暖白；主确认深绿色；推荐与选中才使用柔和金色。
3. 交通模式图标使用细线条 currentColor，不产生黑色块状图标。
4. 所有卡片、交通模式与排序表单保持现有已确认动作，不引入第二个 Dock。
5. 验收通过后由整合负责人将样式移植到 `integration/v4-current` 最新完整产品，不使用旧 main 基线。
