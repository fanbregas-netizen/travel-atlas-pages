# Footprint Map V5 — 正式发布检查与回退（2026-11-22）

## 当前阶段

**这是一份预备发布 PR，不代表已正式上线。** 私有候选 `fanbregas-netizen/travel-atlas@07fd36679a4a3dfdc7cd14d7ab12f6a9edb6c60f`，公开旧站固定为 `fanbregas-netizen/travel-atlas-pages@190c648f45346f96f7243d643f15eb8ea37cae75`。

不可变旧版本回退分支：`backup/v4-before-v5-final-20261122`，指向上述公开旧站 commit。待正式合并时必须再次检查当前 main 是否前移。

## 发布包规则

- `.github/V5_PRODUCTION_FILES_20261122.txt` 列出完整 V5 根站资源清单。此次共 **174 项**（来自私有完整产品 173 项，另加安全路由配置；不包含演示用 `index-preview.html`）。
- 171 项内容与已通过 Chromium、WebKit 的独立完整 V5 QA 一致。正式首页使用**未注入隔离命名空间**的私有候选；新的生产 SW、版本号、安全道路适配器和 `routing-config.js` 单独替换。
- 公共 Pages 的 `deploy-pages.yml` 将在复制现有 V4 refined 回退目录后，再按清单覆盖根目录；独立 `v5-poi-zh-20261121` 等历史验收目录不在改动范围。
- 旧正式网站的私有数据采用 `private-travel-footprints-v1` IndexedDB；V5 沿用相同名称，`places` 和 `meta` 对象结构未变。**绝不删除 IndexedDB、localStorage、照片或缓存之外的数据**。
- 正式 SW 标记 `footprint-v5-production-20261122-v1`，使用相对路径缓存；升级时只清理已知旧静态 shell 缓存，不触及用户本地数据。
- 为安全起见，浏览器路由适配器禁用公开 OSRM 演示服务器。尚无经授权的自有道路代理，因此路线道路 ETA / 网络几何会明确不可用；地图收藏、站点顺序、保存路线与外部导航不受影响。真正提供驾车/步行/骑行道路时间，仍需要采购或授权并部署带限流的服务网关。

## 上线前 **必须** 的真实设备核对

1. 使用当前真实正式站同一台 iPhone Safari，导出一份完整 ZIP 备份，检查 ZIP 中地点、路线、照片、视频和 Brief 数据。**没有收到确认前不要合并此 PR 到 main**。
2. 在独立 QA 验收地图、星标、三档卡片、收藏搜索、照片/视频、路线选点和外部导航，记录差异，禁止写入正式测试数据。
3. 验证浏览器升级前后本地收藏数量和路线数量一致；任一真实媒体不可打开、已保存路线错位或者数据被覆盖，立即回退根站代码，但**不要清空用户数据库**。
4. 需明确接受“道路服务尚未签约，暂时不显示 ETA”，或提供合法运营的服务接口和所需账号授权。没有商用运营服务时不可声称“道路导航完整上线”。

## 实际发布（必须完成上方阻塞）

1. 验证 `main` 未被其他人推进；新建正式 PR 从 `release/v5-production-public-20261122` 到 `main`。
2. PR 的 GitHub Actions **实际通过**后，最终合并需得到当前对话的明确授权（用户已经要求继续，但数据备份仍属无法代办的现实前提）。
3. `Publish Travel Atlas V4 to GitHub Pages` 会被 main push 触发（工作流名称保留历史名，不代表根站仍是 V4）。
4. 查看 Pages run 部署步骤和公网 `https://fanbregas-netizen.github.io/travel-atlas-pages/` 版本标识、完整脚本 HTTP 200，再用原 iPhone Safari 核对旧数据。

## 全包回退

- 快照分支：`backup/v4-before-v5-final-20261122`。这与旧站 SHA 的对应关系必须先核对，无需删除任何数据。
- 快速回退：对本次根目录发布合并 commit 建立受控 `git revert <V5_MERGE_SHA>` PR，然后合并、等待 Pages 发布完成；它将恢复旧 `index.html`、`sw.js`、`manifest.webmanifest`、路线入口、脚本和 V4 root 的静态文件。**不是只切换首页**。
- 不能运行 `indexedDB.deleteDatabase`、`localStorage.clear` 或批量 `caches.clear` 来回退；若缓存不一致，优先让旧版 SW 自行接管，临时关闭网站写入，保留设备数据。
- 回退前后记录真实 iPhone 收藏、路线、Brief 与媒体数量，用户自己保留 ZIP 恢复包。Git 无法回滚 iPhone 私人媒体数据库。

**状态区分：**代码提交 / CI 静态检查 / 浏览器自动化 / 真实 Safari 备份 / 正式 Pages 部署分别记录，不互相替代。
