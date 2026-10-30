# dsh-style 功能说明（Phase 1 / 0.1.1）

本文说明插件**负责改什么、改在哪、默认值是什么、哪些不属于插件**。  
适用版本：**macOS + DeepSeek Harness 0.2.1-rc.5**。

## 0. 总原则

- 纯客户端插件，不改官方 `app.asar`，不改 Bot/宿主业务数据。
- 样式通过 `html[data-dsh-style-*]` + 插件自有 `<style data-plugin="dsh-style">` 施加。
- 所有规则限定在插件启用态；关闭插件时移除属性与样式表。
- 设置存放在 `localStorage` 的 `dsh-style:settings`。
- 侧栏横向基准按 macOS 红绿灯按钮设计（关闭按钮中心 `22.75px`）。

## 1. 原生「外观」设置页

| 项 | 说明 |
|---|---|
| 注册 | `settings.section`，`id: style`，`order: 40`，label「外观」 |
| 控件 | 原生 `Switch` / `SegmentedControl` / `Button`，不自绘 |
| 持久化 | `dsh-style:settings` |
| 默认 | 见第 9 节 |

设置页包含：布局、效果、侧边栏、任务监控四块。

## 2. 布局模式

| 功能 | 修改什么 | 作用 |
|---|---|---|
| 内嵌（Inset） | `html[data-dsh-style-layout="inset"]`；主内容白色圆角卡片、浅灰底、上/右/下 4px、左侧 6px 间隔 | 默认外观 |
| 经典（Classic） | 移除 inset 布局规则，保留原生 AppFrame | 完整回退 |

内嵌布局只影响主内容外框和间距，不改会话/消息结构。

## 3. 侧栏 / 标题栏

| 功能 | 具体改动 | 目标 |
|---|---|---|
| 红绿灯基准列 | 关闭按钮中心 `22.75px`；16px 图标槽左缘 `14.75px` | 功能图标、文件夹图标、会话状态槽共列 |
| 内容左右内缩 | root pad 左 `4.75px`；右侧 `8.75px`；行左右外沿 `8.75 / 8.75` | 工作区头、行、选中框右缘统一 |
| 工作区行 | 文件夹/会话行 `padding: 6px`；会话标题 `margin-left: 8px`、`margin-right: 0` | 会话标题与文件夹标题同为 `38.75px`；标题填满行 |
| 行右缘 | 列表取消 scrollbar 5px + offset 2px 预留；`scrollbar-gutter: auto` | 行/选中框右缘 = 侧栏宽 - 8.75（264 时 255.25，280 时 271.25） |
| 工作区头图标 | 18px 标题行里 28px 的搜索/视图/添加按钮；`sectionHeader` / `headerActions` / `regionArea` 三处 `overflow: visible` | 28px hover / active 方块不再被裁成 18px |
| 底部账户卡 | `triggerRow` 原生左右 `-2px`；补 left `4px`、宽度扣 `4px` | 卡片左缘 `8.75`、右缘 `255.25`；底部间距不变 |
| 标题栏控件 | 插件自绘 `.dsh-style-tb`：折叠侧栏、后退、前进；macOS 红绿灯保留 | 自定义窗口 chrome |
| 隐藏项 | 见第 6 节 | 收紧侧栏 |

注意：`工作区` 标题文字左缘仍是 `14.75`（与图标槽同列），不是 `8.75`；`8.75` 是行盒子/选中框的外内缩。

## 4. 会话行 / HoverCard

| 功能 | 具体改动 | 目标 |
|---|---|---|
| 行内时间 | 隐藏行内 `time`，放进「更多」菜单 | 标题占满整行 |
| 行内操作 | 归档/置顶收进「更多」菜单，行内只留一个更多按钮 | 减少行内占位 |
| HoverCard 位置 | 默认 left = 行右缘 + 8；补 `margin-left: 15.5px` | 卡片左缘 = 主卡片左缘 + 8.75（随侧栏宽度变化；264 示例约 278.75） |
| HoverCard 宽度 | `width: fit-content`，上限 244，下限 200 | 标题左右 16/16，不再右侧空一大截 |
| 卡片内边距 | 标题左右 padding 16/16 | 与卡片宽度配合 |

HoverCard 的 `_bggy...` 是当前构建的 CSS module 类；DSH 升级后如类名变化需要重新适配。

## 5. 页面顶部 / 其他页面

| 功能 | 具体改动 | 目标 |
|---|---|---|
| 插件页顶部 | `page:has(> header._pageHead)` 补 `padding-top: 78px` | 插件页 H1 与自动化任务页 H1 都在 y=83 |
| 页面标题 | 不重写页面标题/说明，只补空白 | 页面结构不变 |
| 自动化任务页 | 保持原生 `pageHeading` 76px 顶部 padding | 基准 |

## 6. 隐藏开关 / 入口整理

| 设置 | 效果 |
|---|---|
| `hideScrollbars` | 隐藏滚动条 |
| `hideTabs` | 隐藏会话标签栏（对话/轨迹），主 header 压到 38px |
| `hideBrand` | 隐藏品牌区 |
| `hideNewSession` | 隐藏新会话按钮 |
| 智能体/通用入口 | 把 ds-bot 原生行改名并挪到「插件」下面；点击仍走原生切换逻辑 |

## 7. 任务监控（Task Monitor）

| 项 | 说明 |
|---|---|
| 默认 | `monitorEnabled: true`，`monitorMode: floating` |
| 入口 | 标题栏「打开任务监控」按钮（28px，`aria-label` 同文案） |
| 面板 | 浮动/固定面板，显示当前会话的工具、子智能体、后台任务、进度、产物、网页等区块 |
| 头部收纳 | 开启监控时，原头部的团队/子智能体/后台任务入口隐藏，统一从监控面板进 |
| 状态 | `monitorAlwaysShow`、区块折叠状态保存在 `localStorage` |
| 数据 | 只读当前会话运行数据，不改任务/子智能体逻辑 |

实测：0.2.1-rc.5 上点击按钮可打开面板，工具条目（如 bash / read_image / present）正常显示。

## 8. 设置持久化 / 可逆

- 键：`dsh-style:settings`。
- 默认值不会覆盖已有设置；卸载/禁用时清理 `data-dsh-style-*` 和 `<style data-plugin="dsh-style">`。
- 关闭「启用样式插件」后恢复原生外观。

## 9. 默认值（0.1.1）

```json
{
  "enabled": true,
  "layout": "inset",
  "reduceMotion": false,
  "hideScrollbars": true,
  "hideBrand": true,
  "hideNewSession": true,
  "hideTabs": true,
  "monitorEnabled": true,
  "monitorMode": "floating",
  "monitorAlwaysShow": { "team": false }
}
```

## 10. 代码/规则地图

`client.js` 内按顺序注入：

| 规则块 | 负责 |
|---|---|
| `BASE_CSS` | 基础变量、内嵌布局、可逆标记 |
| `IMMERSIVE_CSS` | 沉浸式侧栏、边框、间距 |
| `TITLEBAR_CSS` | 自定义标题栏控件、窗口 chrome |
| `SIDEBAR_VIS_CSS` | 侧栏紧凑行高、分区标题、列表、footer、隐藏项 |
| `HIDE_HEADER_CSS` | 监控开启时头部入口收纳 |
| `WORKSPACE_CSS` | 会话行时间/操作收纳 |
| `ALIGN_CSS` | 红绿灯基准列、左右内缩、会话标题同列、HoverCard、页顶、底栏账户卡 |
| `MONITOR_CSS` | 任务监控面板/按钮/状态样式 |

## 11. 不属于插件运行时

| 内容 | 位置 | 说明 |
|---|---|---|
| Qoder 图标 | `icon-packs/qoder` + `scripts/apply-icon-pack.mjs` | 改 app 副本的图标几何；不是插件 UI；新版本要重打 |
| App 原生中文本地化 | `scripts/apply-app-locale.mjs` | 给 `.app` 补 zh-Hans.lproj/Info.plist 并 ad-hoc 重签；只影响 macOS 原生面板；DSH 更新会覆盖；不随插件安装包分发 |
| 主题/字号/侧栏宽度 | DSH 原生设置 | 插件跟随；要和作者完全一致需浅色、侧栏约 280、字号 14、缩放 100% |

## 12. 兼容性 / 已知限制

- 只在 **0.2.1-rc.5** 实测；DSH 升级后类名/结构可能变化，侧栏选择器和 HoverCard 可能需要适配。
- 右侧内缩 8.75px 随侧栏宽度自适应；264 / 280 两种宽度都按同一内缩。
- 插件依赖 `@deepseek-ai/dsh-client-ui-*` 的类名后缀和语义锚点；不是 DSH 的公开稳定 API。
- 原生打开面板语言属于 app 本地化，不是 dsh-style 的功能；已单独提供 `apply-app-locale.mjs`。
