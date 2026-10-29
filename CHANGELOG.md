# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 与 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。

## [Unreleased]

### 变更
- **移除「通用 / 协作」胶囊切换器**，还原 ds-bot 原生 panellist 行的交互：点击即在「对话（通用）」与
  「智能体（bot 页）」两面间切换。该行文案改为「智能体 / 通用」，并挪到侧栏「插件」下面一行
  （纯 DOM 改名 + 归位，点击仍走 ds-bot 原生逻辑，底层路由 / 注册 / 数据不动）。

### 计划
- 主题：强调色、字号、界面密度、动效强度（原生控件）。
- 组件级开关：导航栏 / 输入框 / 消息布局的显隐与形态。
- 预设主题：一键整套。
- 宿主设置后端：值写进 DSH settings 命名空间（跨设备、可恢复默认）。

## [0.1.0] - 2026-10-29

首个可发布版本。

### 新增
- 在 Harness **原生「设置」**里新增「外观」页（注册到 `settings.section`，`order: 40`），
  使用原生 `Switch` / `SegmentedControl` / `Button`，界面全中文，不重绘任何 DSH 组件。
- **布局模式**：
  - `经典（Classic）`：完全保持原生 AppFrame（默认，完整原生回退）。
  - `内嵌（Inset）`：外层浅灰底板 + 右侧主内容为白色圆角卡片，支持即时切换。
- **效果开关**：启用样式插件 / 减少动效 / 隐藏滚动条。
- 内嵌布局下隐藏主会话区滚动条（仍可滚动，仅不显示滚动条）。
- 设置持久化到浏览器 `localStorage`（键 `dsh-style:settings`），重启后恢复。
- 禁用 / 卸载时彻底清理：移除全部 `data-dsh-style-*` 属性并清空样式表，无全局残留。
- 支持客户端热重载：修改 `client.js` 后由 `dsh-client-hmr` 自动生效，无需重启。

### 说明
- 内嵌布局通过**语义锚点**（`[data-shell-bottom]` / `[data-rightbar-col]`）+ 浅层兄弟关系定位
  三栏并打自有 `data-dsh-style-*` 属性，不依赖构建产物的 hash 类名，不对整页做脆弱的深层选择器覆盖。
- 布局数值集中在 CSS 变量：上/右/下间距 `4px`、左侧间距 `6px`、圆角 `20px`、底板色与描边随亮/暗主题。
- 内嵌布局主要面向 macOS；Windows 保留标题栏高度并叠加留白。
- 与 Bot / Halfsignal 无关，纯客户端 UI，不改 DSH 本体、不复制原生 Sidebar / Main Content。
