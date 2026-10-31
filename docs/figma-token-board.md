# Figma 变量板（DSH 设计变量参考）

**文件**：Figma「DSH」（fileKey `wRPZTjoTXKoazbnzaiFPsI`）
**页面**：`dsh-style · 变量板`（新建，背景与画板统一 `#F5F5F5`）

## 三块画板

| 画板 | nodeId | 内容 |
|---|---|---|
| `01 · 官方 Token（Light）` | `43:446` | 6 个圆角 + 98 个别名色 alias + 77 个静态色 static，全部是**绑定了 Figma 变量的色块/圆角块** |
| `02 · 输入框 Composer 标注` | `43:1249` | composer mock（672 宽）+ 8 条编号标注；**蓝色 = dsh-style 改过**，黑色 = 原生；mock 的圆角/内距/间距/尺寸都绑定变量 |
| `03 · 改动对照` | `43:1346` | 原生值 ↔ 插件当前值 的表格（右侧蓝字） |

## 变量集合（Figma Variables）

| 集合 | 数量 | 命名 |
|---|---|---|
| `DSH · 官方 Token` | 181 | `alias/*`（98 语义色）、`static/*`（77 基础色）、`radius/*`（6 圆角：xs 4 / sm 8 / md 12 / lg 16 / xl 20 / panel 28） |
| `dsh-style · 改动值` | 31 | `composer/radius` 16、`composer/padding-top` 14、`composer/gap` 12、`grid/*`（卡 164×64、图 64、gap 12、内距 14、圆角 20）、`editor/*`（min-height 60、行高 24、字号 14）、`toolbar/*`（高 42、内距 2/8/6、gap 12）、`plus/send/perm/model/mic` 的尺寸与圆角 |

> 文件里原有的 `DSH / Color`（15）与 `DSH / Spacing`（19）是早先手动建的，没有动。

## 用法

1. 右侧「变量」面板（Variables）里选集合，直接改数值 / 颜色；
2. 画板 01 的色块、画板 02 的 mock 都会跟着变（因为节点绑定了变量）；
3. 选中任一色块/卡片，右侧「颜色」/「自动布局」处会显示它绑定的变量名，一眼看出用的哪个 token。

## 数据来源

- 颜色 / 圆角 / 字体：`research/extracted/pkgs/dsh-client-ui-theme/lib/client.js` 里的 `--dsw-*` 定义（Light 主题，alias 递归解析为 hex）；
- 组件实测数值：真机探针（`getComputedStyle` / `getBoundingClientRect`），见 [composer-spec.md](composer-spec.md)。

## 备注

- 变量名里的 `alias/brand-primary-new-colorprimary-new-color` 是上游 token 名本身的重复后缀，照抄未改。
- 画板 02 的标注文字是静态文本（写的是当前值）；**数值以变量为准**，改了变量后 mock 会变、文字不会自动改，需要时再更新文案。
