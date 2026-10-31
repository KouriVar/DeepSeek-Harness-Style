# 图标覆盖表（icons/）

把 DSH 某个位置的原生图标换成自己的 SVG。**换电脑 / 重新 clone 后，只要 `client.js` 在，图标就跟着在** ——
因为 svg 已经在构建时内联进去了，运行时不需要任何额外文件或网络。

## 为什么是「内联」而不是「放文件夹里就行」

这个插件是**单文件 CJS**（`window.__ModuleLoader__.load`），没有资源管线，也没有静态资源目录可被 DSH 加载。
所以任何图片/SVG 都必须以 data URL 的形式写进 `client.js`。`icons/` 只是**源文件 + 映射表**，
真正生效的是 `client.js` 里 `// <icons:auto>` 到 `// </icons:auto>` 之间那段（由脚本生成，别手改）。

## 命名规则

`file` 用**被替换的那个官方图标名**（例如 `IconDataOutlineRegular.svg`），这样一眼就知道换了谁。
同一个官方图标被用在多处时，加 `--<id>` 后缀区分，例如 `IconDataOutlineRegular--composer-model.svg`。

官方图标名怎么查：见 `research/extracted/` 里的客户端源码（`IconXxxOutlineRegular` 这类导出名），
或者 `tools/icon-studio/` 索引出来的 254 个原生图标清单。

## 改一个图标（三步）

1. 把 svg 放进 `icons/`，文件名按上面的规则；
2. 在 `icons/manifest.json` 里加/改一条记录（字段见下），`"enabled": true`；
3. 跑 `npm run icons:build` —— 它会把 svg 压成 base64 写进 `client.js`，保存即 HMR 生效。

提交前建议跑 `npm run icons:check`：它只校验不写盘，`client.js` 和 manifest 不一致就报错，
避免「改了表忘了构建」提交上去。

## manifest 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | 唯一标识（kebab-case），出现重复直接构建失败 |
| `native` | 记录用 | 被替换的官方图标名，**只做记录**，官方改名时靠它对照 |
| `where` | 记录用 | 这个图标在界面上的位置（人话描述，方便以后定位） |
| `selector` | ✅ | 目标元素的 CSS 选择器。**只用稳定锚点**：`data-*`、`aria-label`、`data-slot`；**不要用哈希类名**（`JZLxKW_*` 这类每次构建都变） |
| `file` | ✅ | svg 文件名（相对 `icons/`） |
| `size` | | 图标像素尺寸，默认 16 |
| `tint` | | `currentColor`（默认，mask 着色，跟随深浅主题）或 `color`（保留原图配色，直接当背景图） |
| `hide` | | 要隐藏的子元素选择器，默认 `svg`；`false` / `"none"` 表示不隐藏 |
| `enabled` | | `false` 时只保留记录、不写进产物 |

## 生成出来的 CSS 长什么样

对每条生效项，脚本阶段只负责内联 svg；运行时 `iconOverrideCss()`（`client.js`）把表翻成两条规则：

```css
<selector> > svg { display: none !important; }          /* 藏掉原生图标 */
<selector>::before{ content:""; display:block; width:16px; height:16px;
                    background-color:currentColor;       /* tint=currentColor 时 */
                    mask-image:url("data:image/svg+xml;base64,…");
                    mask-size:contain; mask-position:center; }
```

> ⚠️ 一个踩过的坑：`selector` 如果是逗号列表（中英文两个分支），伪元素必须拼到**每一段**上。
> 直接 `selector + '::before'` 只会挂在最后一段，其余分支就变成「原生图标被藏掉、新图标又没贴」的空洞。

## 官方改名了会怎样

不会坏，只会**静默退回原生图标**：选择器不命中 → 我们的规则不生效 → DSH 自己的图标照常显示。
构建脚本也会在 `native` 对不上时靠人肉发现（`where` 字段就是给这个用的）。要恢复覆盖，
按报错/现象更新 `selector` 即可。

## 相关脚本

| 命令 | 作用 |
|---|---|
| `npm run icons:build` | manifest → `client.js`（写盘） |
| `npm run icons:check` | 只校验一致性，不写盘（提交前跑） |
| `npm run icons:studio` | 本机图标审核工具（**只读**，不参与运行时） |
| `npm run icons:index` | 重新索引 DSH 原生图标 |
