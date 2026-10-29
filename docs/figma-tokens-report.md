# Figma 写入报告 · DSH Tokens / Static / Text Styles

> 目标文件：**DeepSeek Desktop App** · fileKey `3RSG2PjWlV5KTTlhPSY9dC`
> 执行方式：Figma Desktop Bridge 插件（本机已连接）+ `figma_execute` / 变量 API
> 数据源：`design/tokens/dsh-tokens.json`（由 `scripts/extract-tokens.mjs` 从安装版 `dsh-client-ui-theme@0.2.1-rc.3` 提取）

## 1. DSH Tokens 集合的真实 mode（经 figma_get_variables + 插件 API 双重复核）

| 集合 | mode 名称 | modeId | 说明 |
|---|---|---|---|
| **DSH Tokens**（`VariableCollectionId:1:4`） | `Light` | `1:2` | default mode，= 浅色 |
| **DSH Tokens** | `Dark` | `1:3` | = 深色 |

> ⚠️ 与用户说明的「mode 1 = 浅色 / mode 2 = 深色」不完全一致：DSH Tokens 的 mode **实际仍叫 `Light` / `Dark`**（modeId `1:2` / `1:3`）。
> 文件里另有一个默认集合 **`Collection`**（`VariableCollectionId:1:2`，仅 1 个变量 `Color`），它的 mode 才是 `Mode 1` / `Mode 2`。用户看到的「mode 1 / mode 2」很可能是这个集合，而不是 DSH Tokens。
> 语义映射无歧义：**浅色 → `1:2`(Light)，深色 → `1:3`(Dark)**。

## 2. 100 颜色 + 6 radius（106 变量）逐项比对结果

- 集合内变量数：**106**（100 个 `alias/*` 语义色 + 6 个 `radius/*`）
- 逐项按 mode 比对 `dsh-tokens.json` 的 light/dark 值与 Figma 现值：
  - **mismatch = 0，missing = 0，extra = 0**
- 结论：**Figma 现值已与 JSON 完全一致**（浅色写入 `1:2`、深色写入 `1:3`），无需改写、无需新建，避免产生重复变量。

## 3. 新增：`DSH Static` 集合（可选 static 色板 77）

- 新建集合 **`DSH Static`**（`VariableCollectionId:1:171`，单 mode `Mode 1` = `1:4`）
- 导入 **77 个** `static/*` 颜色变量，0 失败（如 `static/blue-500 #3b82f6`、`static/neutral-bluish-950 #151517` …）
- 这些色板为固定值（light=dark），故单 mode 存储。

## 4. 新增：Figma Text Styles（30 个）

从 `dsh-tokens.skipped.json` 的 31 组 `--dsw-font-*`（181 个字体变量）归一为 **30 条文本样式**（`family` 组仅为字体族别名，不生成样式），命名 `DSH/<token>`：

| 样式 | 字号/行高 | 字重 |
|---|---|---|
| base-16 | 16/24 | 400 |
| base-strong-16 | 16/24 | 500 |
| l-20 | 20/28 | 500 |
| m-18 | 16/28 | 500 |
| s-14 / s-strong-14 | 14/22 | 400 / 500 |
| xs-13 / xs-strong-13 | 13/20 | 400 / 500 |
| xxs-12 / xxs-strong-12 | 12/18 | 400 / 500 |
| xxxs-11 / xxxs-strong-11 | 11/14 | 400 / 500 |
| xl-24 | 24/32 | 600 |
| markdown-base / -italic / -strong / -strong-italic | 14/24 | 400/400i/600/600i |
| markdown-small / -italic / -strong / -strong-italic | 12/20 | 400/400i/600/600i |
| markdown-h1 / h2 / h3 / h4 | 21/30 · 19/28 · 18/26 · 14/24 | 700/700/700/600 |
| markdown-code / -code-block / -code-block-small | 12/19 · 11/19 · 11/16 | 400 |
| markdown-table / -table-head | 13/22 | 400 / 500 |

字体族：
- 文本样式 → **SF Pro**（DSH 主题默认字体栈 `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", …` 在 macOS 上的实际落点）
- 代码样式 → **Menlo**（DSH 代码字体栈 `"SF Mono", "JetBrains Mono", "Fira Code", Consolas, …`；本机 Figma 无 SF Mono，取 Menlo）

`markdown-*` 的 `calc()` 号按默认 `--dsh-content-font-size:14px` / `--dsh-code-font-size:11px` 解析后取像素值。

## 5. 复核快照

- 集合：`Collection`(1) / `DSH Tokens`(106) / `DSH Static`(77)
- 文本样式：30
- 全程未触碰官方 `/Applications/DeepSeek Harness.app`。
