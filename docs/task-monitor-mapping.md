# 任务监控（Task Monitor）· 真实数据源映射表

> 本文是第三阶段「任务监控」的开发依据。原则：**只接真实数据，不猜测、不伪造**。
> 审计对象：当前安装的 DeepSeek Harness `0.2.1-rc.3`（`app.asar/dsh`）客户端包与其暴露的服务。

## 一、审计方法

- 逐个读取 `@deepseek-ai/dsh-client-ui-*` / `dsh-api-*` 客户端包的 `lib/client.js`，提取其
  `exports.inject` 依赖服务、`ctx.get(...)` 取用的服务，确认哪些 UI 已在消费真实数据。
- 用 ds-bot（`DeepSeek-Bot/ds-bot`，成熟的 DSH 客户端插件）作为“如何读会话/工具数据”的样板交叉验证。
- 不依据函数名臆测语义；下表每项都注明「数据来源 / 接入方式 / 支持程度」。

## 二、结论总览

| # | 监控区块 | 真实数据来源 | 接入方式（客户端插件） | 支持程度 |
|---|---|---|---|---|
| 1 | 执行进度 / 计划 | 会话时间线里的 `todo_write`（TodoWrite 工具）调用与结果 | `uiConversation` 读当前会话 chat 快照，解析工具调用 | 中（取决于模型是否用 todo_write；无则显示“暂无任务计划”） |
| 2 | 子智能体 | 会话时间线里的 `subagent*` 工具调用；宿主 `remote.subagents`（api-session-controller）；子会话 | `uiConversation` 工具调用 + `sessions` 子会话；`remote.subagents` 提供父子信息 | 中（工具调用可实时；父子层级需额外关联 `parentSessionId`） |
| 3 | Skills / MCP / 内置工具 | 真实工具调用（`name`/`argsRaw`/`content`/`isError`/`kind`）；Skills 元信息 `remote.skills` | `uiConversation` 聚合工具调用；分类按工具名（skill / mcp / 内置） | 强（名称为真实调用）；分类为启发式 |
| 4 | 后台任务 Jobs | 客户端 `jobs` 服务（`ctx.jobs`），数据来自宿主 `remote.job`；`dsh-client-ui-jobs` 已在消费 | 注入/`ctx.get('jobs')` 读 `getSnapshot().rows[sessionId]`（字段：`id,title,status,startedAt,finishedAt,output.total`） | 强（官方 Jobs UI 同源） |
| 5 | 文件产出 Artifacts | `remote.workspaceFiles`（dsh-api-workspace-files）；或 `write`/`edit` 工具调用参数中的路径 | `remote.workspaceFiles` 取权威文件列表；退级：解析 `write/edit` 调用 | 中（需确认 workspaceFiles 是否暴露“变更类型”；否则用工具调用为真实来源） |
| 6 | 网页查阅 Web Sources | `web_search` / `web_fetch` 工具调用的参数与结果（URL/标题/状态） | `uiConversation` 工具调用，仅取这两个工具，避免把任意网络请求当来源 | 中（需从结果中解析 URL，限定工具范围） |

## 三、关键数据模型（已确认）

- **会话/时间线**：客户端服务 `uiConversation`（配合 `sessions` 绑定）。
  - `binding = ctx.sessions.binding(sessionId)`；`conversation = ctx.uiConversation.binding(binding)`；
  - `chat = conversation.target('chat').getSnapshot()`；`chat.timeline.turns`；`conversation.openTurn.getSnapshot()`。
  - 工具节点形态（ds-bot 已消费）：`kind`（`'tool-call'` / `'tool-result'`）、`name`、`argsRaw`（JSON 字符串）、
    `content`、`isError`、`callId`。`toolName = root.name`，`toolArgs = JSON.parse(root.argsRaw)`。
- **Jobs**：`ctx.jobs.getSnapshot()` → `{ rows: { [sessionId]: Job[] }, observed }`；
  `Job = { id, title, status('running'|'stopping'|…), startedAt, finishedAt?, output:{ total } }`；
  观察流通过 `ctx.jobs.watchRows(sessionId)` / `observe(...)` 开启（仅在有观察者时流动）。
- **子智能体**：宿主 `remote.subagents`（`dsh-api-session-controller` 注入），涉及
  `parentSessionId` / `childSessionId`；同时子智能体也表现为 `subagent*` 工具调用。
- **文件**：`remote.workspaceFiles`（`dsh-api-workspace-files` 注入）；`dsh-client-ui-sidebar-files` 已在消费。
- **Skills**：`remote.skills`（`dsh-client-ui-skill` 注入）。
- **列表插槽**：工具栏右上角按钮可注册到 `conversation.session.header.actions`（ds-bot 的 Bot 详情按钮即挂此处，组件可拿到 `sessionId`）。
- **右侧停靠**：`sidebarRight` + `sidebarRightTabs` 服务存在（ds-bot 的终端标签即用它）；停靠需注册一个 panel 类型，v1 先做浮层，停靠作为后续。

## 四、是否需要改宿主（Host Adapter）

- 上述 1–4、6 项**客户端即可读取**（`uiConversation` / `jobs` / `remote.*`），**不需要改 DSH 宿主**。
- 第 5 项「文件变更类型（新建/修改）」若 `remote.workspaceFiles` 只给文件列表、不给变更事件，
  则以 `write`/`edit` 工具调用作为真实来源（仍可追溯），不额外改宿主。
- 第 2 项「子智能体父子层级」若 `remote.subagents` 暴露不足，再评估**最小 Host Adapter**；不侵入执行逻辑。

## 五、实现顺序（对照任务书第十节）

1. ✅（本文）审计 + 映射表。
2. 设置模块：独立开关「任务监控」+ 展示方式 + 6 个区块显隐，持久化，默认关闭。**已完成第一版开关**。
3. Task Monitor Event Adapter：`collectToolCalls(snapshot)` 深度遍历时间线收集工具调用（按 `callId` 去重合并），
   归一化为 `{eventId, sessionId, category, status, title, source, metadata}`；Jobs 走 `ctx.jobs`。
4. UI：工具栏按钮（`conversation.session.header.actions`）+ 浮层面板（portal 到 body，360–420px，主题令牌）+ Header/各区块。
5. 订阅：`conversation.target('chat').subscribe` + `openTurn.subscribe` + `jobs.subscribe`；rAF 节流；限流事件数；面板关闭/切会话/禁用即释放。
6. 停靠（可选）、主题与布局兼容、无数据降级文案。
7. 测试（smoke/layout 扩展 + 实机事件验证）。

## 六、诚实降级约定

- 无 `todo_write` → 「暂无任务计划」（不编造步骤/百分比）。
- 无 jobs → 「暂无后台任务」。
- 无 `remote.workspaceFiles` 变更信息 → 仅列 `write/edit` 触达的文件，标注来源为工具调用。
- 无子智能体调用 → 「暂无子智能体」。
- 任何区块数据为空一律显示「暂无数据」，绝不用模型补全。
