# Qoder 图标替换 · 剩余项排查报告（remaining.report）

日期：2026-10-29
结论：**61/70**（原 58/70，本轮 +3）。9 个仍未替换（回退原生）。

---

## 1. 结果总览

| 状态 | 数量 |
| --- | --- |
| 唯一图标总数 | 70 |
| 替换成功（OK） | **61** |
| 仍 SKIP（回退原生） | **9** |

`node scripts/apply-icon-pack.mjs --dry-run` → `resolved 61/70`
（见同目录 `dryrun.report.txt`）。

本轮补齐的 3 个：
`IconBranchOutlineRegular`、`IconMicrophoneOutlineRegular`、`IconPinFillRegular`。

仍 SKIP 的 9 个：
`InlineSvg-arrow-up-icon-f39c92b9`、`InlineSvg-chevron-left-icon-920df716`、
`InlineSvg-chevron-right-icon-bd602b74`、`InlineSvg-close-icon-19eceaf2`、
`Local-SearchIcon`、`Local-ShareIcon`、`InlineSvg-key-icon-51615f15`、
`InlineSvg-link-icon-78f645ec`、`InlineSvg-lock-icon-6de5eefc`。

---

## 2. 补丁器如何定位锚点（apply-icon-pack.mjs）

对每个 build-map 条目：
1. 读取 `native.resource`（原生 SVG）与 `target/*.svg`（Qoder 目标）；
2. 从原生 SVG 解析子元素（`path` 的 `d`、`rect` / `circle` 的属性）；
3. 在 app.asar 的 JS 分块里找「包含这些子元素」的文件（先 `sourcePath`，再
   `dsh-web-frontend/dist/assets/index-*.js`，最后全量扫描）；
4. 用 `d`/属性定位 JSX 元素 span，把锚点子元素换成目标 `path`，其余兄弟子元素
   置空；`transform` 把目标 viewBox 映射到原生 viewBox；
5. 重算 asar 分块 SHA256 + `Info.plist` header 哈希 → 复制 `.app` → ad-hoc 重签 →
   `--verify`。

---

## 3. 本轮解决的 3 个（Group A：在 app.asar 内，匹配器缺陷）

这 3 个的**原生 path 数据其实就在 `index-BXV-oxvX.js` 里**（与导出的原生 SVG
逐字节一致），并非“渲染态 vs 源码态”不匹配。SKIP 的真正原因是补丁器的匹配逻辑
对手写 JSX 的几种写法不鲁棒：

| 图标 | 目标 | 之前的 SKIP 原因 | 场景 |
| --- | --- | --- | --- |
| `IconBranchOutlineRegular` | `svg/QoderGitBranchLine.svg` | `child not found in any bundle` | 圆用 `r:"1.56962"`（冒号后无空格），旧匹配串写死 `r: "…"`（带空格）→ `matchesKids` 失败 |
| `IconMicrophoneOutlineRegular` | `svg/QoderMicLine.svg` | `child not found in any bundle` | `rect` 是**参数化**的 `{x:4.5+r/2,y:1+r/2,width:7-r,height:10-r,rx:(7-r)/2}`，没有字面量属性值可精确匹配 |
| `IconPinFillRegular` | `svg/QoderPushpinFill.svg` | `no unique anchor child` | 同一字形同时存在于 outline / fill 两个组件里，各 path 都出现 2 次 → 无唯一锚点 |

### 修复（`scripts/apply-icon-pack.mjs`，纯匹配器改动，未改任何 mapping/几何）

1. `svgChildren` 额外保存 `path` 的属性（`fill`/`stroke` 等）。
2. 重写 `matchesKids`：**有 path 子元素时只按 path 的 `d` 匹配**（path 是最强的
   逐字节签名），非 path 兄弟元素改到“锚点所在的 children 数组”内再定位。这样
   参数化 `rect`、圆等不再阻断文件选择。
3. 新增 `circleElementIndices` / `hasCircle`（容忍冒号后空白），替换原来写死空格的
   `r: "…"` 判断。
4. 新增 `elementSpansInRange`：当某个非锚点兄弟（如参数化 rect）没有字面量属性可
   匹配时，在 `children:[…]` 范围内按元素类型定位并置空，保证不残留双图标。
5. `pathIndices`：仅当**多子元素**且该原生 path 本身是 `fill="currentColor"` 且出现
   多次时，优先选取 span 内真的带 `fill:"currentColor"` 的实例。用于 Pin：只替换
   fill 版 `u_`，**不动** stroke 版 `c_`（避免误改未映射的 outline 图标）。

### 产物验证（已落地到 `.app` 副本）

- `IconBranchOutlineRegular`：`Lv` 组件的锚点 path 已换为 QoderGitBranchLine，
  镜像 path 置空 `d:""`，两个 `circle` 置 `r:"0"`。
- `IconMicrophoneOutlineRegular`：参数化 `rect` 已置为 `width:0,height:0`，`path`
  换为 QoderMicLine，`transform:"translate(0 0) scale(0.666667)"`（24→16）。
- `IconPinFillRegular`：只替换 fill 版 `u_`（QoderPushpinFill），outline 版 `c_` 原样保留。
- 全量校验：构建后的副本里 **61/61** 个 OK 条目的目标 path 数据均存在。

---

## 4. 仍 SKIP 的 9 个（Group B：不在 app.asar 内）

**根因：这 9 个图标不属于 app.asar 的任何 bundle，而属于本机 profile 的插件
`ds-bot`（`dsh.plugin-ui.ds-bot.*`）。补丁器只读写 app.asar，因此永远找不到它们。**

证据：
- `native-index.json` 里这 9 个 `sourcePaths` 全部只有 `"client.js"`（即 profile
  插件入口，不是 `app.asar!…`）。全库共 21 个原生资源是这种“仅指向 profile
  client.js”的资源。
- Studio 配置 `tools/icon-studio/config.local.json` 的 `profile` =
  `/Users/halfsignal/.dsh/profiles/desktop`；该 profile 的
  `node_modules/ds-bot` 是指向
  `/Users/halfsignal/Documents/配置目录/软件目录/默认文件-DeepSeek/DeepSeek-Bot/ds-bot`
  的软链。
- 这 9 个**渲染态 path 在 ds-bot/client.js 中逐字节存在**（已逐条核对 9/9 命中），
  与导出的原生 SVG 完全一致 —— 也就是说，问题不是“渲染态/源码态几何不符”，而是
  这些图标**根本不在 app.asar**。
- 在 `app.asar` 内全量搜索这 9 个 path 字符串均为 0 命中；搜索 `Halfsignal`、
  `ds-bot` 等标识同样 0 命中（`ds-bot` 未被包进安装版 app.asar /
  `Contents/Resources`）。

为什么不能在本任务内补齐：
- `apply-icon-pack.mjs` 只处理 `app.asar`；`ds-bot` 是运行时从 `~/.dsh` 共享
  profile 加载的外部插件，**不在 `.app` 副本里**。把它编进副本不会改变加载路径。
- 直接改 `DeepSeek-Bot/ds-bot/client.js` 属于本任务写入范围之外（且该 profile 被
  官方 App 与副本共享，改了会同时改动官方 App 的行为，违反“不改官方 App”约束）。
- 因此按硬约束「无法解析则回退原生」，这 9 个保持 SKIP（原生），未伪造几何。

**后续若要补齐这 9 个：** 需要把 `ds-bot/client.js` 纳入补丁范围（例如给补丁器加
“额外目标文件”支持，并对只影响副本的独立 profile 生效），这超出本任务写入范围，
需 Lead/用户决定。它们的真实 path 已确认可从 `DeepSeek-Bot/ds-bot/client.js` 直接
反查，映射目标 SVG 也已就绪，技术上仅差“落到正确的 bundle”。

---

## 5. 改动文件

- `scripts/apply-icon-pack.mjs`：匹配器增强（path 优先匹配、圆空白容忍、参数化
  rect 兄弟定位并置空、多实例 fill 变体筛选）。未改动任何 mapping / 目标几何。
- `icon-packs/qoder/dryrun.report.txt`：重新生成，58/70 → 61/70。
- `icon-packs/qoder/remaining.report.md`：本报告。

未改：`design/`、`docs/STATUS.md`、仓库根 `client.js`/`index.js`、`DeepSeek-Bot/`、
官方 `/Applications/DeepSeek Harness.app`、以及任何 Qoder/native SVG 几何。

映射（`mapping.build.json` / `dsh-icon-mapping.json`）本轮无需修改 —— 3 个图标的
原生 SVG 数据本来就是正确的源码态，失败在 bundle 匹配而非映射。

## 6. 复现 / 验证

```sh
cd /Users/halfsignal/Documents/配置目录/软件目录/默认文件-DeepSeek/dsh-style
node scripts/apply-icon-pack.mjs --dry-run                       # 61/70
node scripts/apply-icon-pack.mjs --apply --force --out "/Applications/DeepSeek Harness (Qoder Icons).app"
node scripts/apply-icon-pack.mjs --verify --out "/Applications/DeepSeek Harness (Qoder Icons).app"
```

`--verify` 实测：

```
verify: /Applications/DeepSeek Harness (Qoder Icons).app
  header hash == plist hash : true
  file integrity            : 16615/16615 ok
  codesign --verify --strict: true
  RESULT: PASS
```

官方 App 未被修改（原始 branch/mic/pin path 仍在原 asar 中）。
构建日志中 `re-apply failed for IconPlusOutlineRegular / …Medium` 等警告是
Regular/Medium 共用同一基础 path、共享同一目标的既有去重现象（首个条目已全局替换，
第二个条目重放时找不到原字形），非竞态、不影响结果：61/61 目标 path 均已在副本中，
构建前后 OK 集合零回退。

> 备注：本轮不 git commit（由 Lead 提交）。
