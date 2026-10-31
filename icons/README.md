# 图标覆盖表（icons/）

把 DSH 某个位置的原生图标换成自己的 SVG。**换电脑 / 重新 clone 后，只要 `client.js` 在，图标就跟着在** ——
因为 svg 已经在构建时内联进去了，运行时不需要任何额外文件或网络。

## 为什么是「内联」而不是「放文件夹里就行」

这个插件是**单文件 CJS**（`window.__ModuleLoader__.load`），没有资源管线，也没有静态资源目录可被 DSH 加载。
所以任何图片/SVG 都必须以 data URL 的形式写进 `client.js`。`icons/` 只是**源文件 + 映射表**，
真正生效的是 `client.js` 里 `// <icons:auto>` 到 `// </icons:auto>` 之间那段（由脚本生成，别手改）。

## 按区域分类（area）

目录与 `manifest.json` 的 `area` 一一对应（area 用点分层，目录用斜杠）：

| area | 目录 | 区域 | 稳定锚点（定位时用这些，不用视觉位置） |
|---|---|---|---|
| `shell` | `icons/shell/` | 窗口外壳 / 标题栏 | `.dsh-style-tb`、`[data-shell-leading]`、红绿灯 |
| `sidebar` | `icons/sidebar/` | 左侧栏 | `[data-dsh-style-sidebar]`、`[data-sidebar-collapsed]` |
| `conversation.top` | `icons/conversation/top/` | 会话区 · 顶部 | 页头 `header[data-window-drag]`、`[class*="_titleRow"]` |
| `conversation.main` | `icons/conversation/main/` | 会话区 · 中间 | `[data-conversation-scroll]`、`[data-conversation-content]` |
| `conversation.composer` | `icons/conversation/composer/` | 会话区 · 底部 | `[data-composer-card]`、`[data-composer-input]` |
| `rightbar` | `icons/rightbar/` | 右侧栏 | `[data-rightbar-col]`、`data-dockkit-*` |
| `overlay` | `icons/overlay/` | 浮层 | `[data-slot="shell.overlay"]` |
| `settings` | `icons/settings/` | 设置页 | `settings.section` 槽 |
| `hero` | `icons/hero/` | 首页 hero（新会话空白页） | `[data-phase="hero"]` |

两条归属规则（踩过的歧义）：

1. **跨区域元素归 `shell`**：标题栏那 4 颗按钮虽然画在侧栏上方（`left:88px` 固定），本质是窗口 chrome，
   归 `shell`；否则侧栏一折叠，分类就自相矛盾。
2. **`hero` 单独算**：新会话空白页是会话区的 `hero` 相位，布局与正常对话完全不同，混进会话区会乱。

构建会强制 `area` 与目录一致（不齐直接报错），所以不存在「记了区域但文件乱放」。

## 命名规则

`file` 用**被替换的那个官方图标名**（例如 `IconDataOutlineRegular.svg`），这样一眼就知道换了谁。
同一个官方图标被用在多处时，加 `--<id>` 后缀区分，例如 `IconDataOutlineRegular--composer-model.svg`。

官方图标名怎么查：见 `research/extracted/` 里的客户端源码（`IconXxxOutlineRegular` 这类导出名），
或者 `tools/icon-studio/` 索引出来的 254 个原生图标清单。

## 改一个图标（三步）

1. 把 svg 放进 `icons/<area 对应目录>/`，文件名按上面的规则；
2. 在 `icons/manifest.json` 里加/改一条记录（字段见下），`"enabled": true`；
3. 跑 `npm run icons:build` —— 它会把 svg 压成 base64 写进 `client.js`，保存即 HMR 生效。

提交前建议跑 `npm run icons:check`：它只校验不写盘，`client.js` 和 manifest 不一致就报错，
避免「改了表忘了构建」提交上去。

## manifest 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | 唯一标识（kebab-case），重复直接构建失败 |
| `area` | ✅ | 区域键，必须是 `manifest.areas` 里的键，且与文件所在目录一致 |
| `native` | 记录用 | 被替换的官方图标名，官方改名时靠它对照 |
| `where` | 记录用 | 这个图标在界面上的位置（人话描述，方便以后定位） |
| `selector` | ✅ | 目标元素选择器。**只用稳定锚点**：`data-*`、`aria-label`、`data-slot`；**不要用哈希类名**（`JZLxKW_*` 这类每次构建都变） |
| `file` | ✅ | svg 文件名（相对 `icons/`，必须落在 `icons/<area>/` 下） |
| `size` | | 图标像素尺寸，默认 16 |
| `tint` | | `currentColor`（默认，mask 着色，跟随深浅主题）或 `color`（保留原图配色，直接当背景图） |
| `hide` | | 要隐藏的子元素选择器，默认 `svg`；`false` / `"none"` 表示不隐藏 |
| `enabled` | | `false` 时只保留记录、不写进产物 |

## Line / Fill 两种形态（variants）

你的图标集和 DSH 一样分两种**形态**（不是深浅色）：`Line`（线框，默认态）与 `Fill`（实心，状态态）。
DSH 自己导出 180 个图标名里 Outline 160 / Fill 20，成对的只有 10 组 —— 也就是**线框是常态，实心只给「有状态」的图标**。

- **深浅色不用两套**：图形是单色（`fill="currentColor"`）时我当 mask 用，颜色由 CSS 的 `currentColor` 决定，
  一份图自动适配浅色/深色。
- **有状态的位置给一对**：`file` 放常态（Line），`variants` 里写状态态（Fill）：

```json
{
  "id": "sidebar.workspace-search",
  "area": "sidebar",
  "native": "IconSearchOutlineRegular",
  "where": "左侧栏工作区行右侧：搜索（悬停/激活时实心）",
  "selector": "...",
  "file": "sidebar/QoderSearchLine.svg",
  "variants": [
    { "when": "[aria-pressed=\"true\"]", "file": "sidebar/QoderSearchFill.svg" }
  ]
}
```

`when` 是拼在目标选择器**后面**的状态限定，常用取值：
`[aria-pressed="true"]`、`[aria-expanded="true"]`、`[aria-selected="true"]`、`[data-active="true"]`、`:hover`、`:focus-visible`。
生成后的 CSS 特异性高于基础规则，所以同一元素按状态自动覆盖。

> 拿不准目标元素有哪些状态属性时，先只给 Line，我用探针把它的状态属性摸出来再补 `variants`。

## 生成出来的 CSS 长什么样

对每条生效项，脚本阶段只负责内联 svg；运行时 `iconOverrideCss()`（`client.js`）把表翻成两条规则：

```css
<selector> > svg { display: none !important; }          /* 藏掉原生图标 */
<selector>::before{ content:""; display:block; width:16px; height:16px;
                    background-color:currentColor;       /* tint=currentColor 时 */
                    mask-image:url("data:image/svg+xml;base64,…");
                    mask-size:contain; mask-position:center; }
```

> ⚠️ 踩过的坑：`selector` 如果是逗号列表（中英文两个分支），伪元素必须拼到**每一段**上。
> 直接 `selector + '::before'` 只会挂在最后一段，其余分支就变成「原生图标被藏掉、新图标又没贴」的空洞。

## 官方改名了会怎样

不会坏，只会**静默退回原生图标**：选择器不命中 → 我们的规则不生效 → DSH 自己的图标照常显示。
`native` + `where` 就是给这种事留的线索；要恢复覆盖，更新 `selector` 即可。

## 相关脚本

| 命令 | 作用 |
|---|---|
| `npm run icons:build` | manifest → `client.js`（写盘） |
| `npm run icons:check` | 只校验一致性，不写盘（提交前跑） |
| `npm run icons:studio` | 本机图标审核工具（**只读**，不参与运行时） |
| `npm run icons:index` | 重新索引 DSH 原生图标 |
