# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 与 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。

## [0.5.10] - 2026-11-08

### 修复 · 插件页顶部被裁剪（标题副文案拦腰切掉）
- **根因**：「页面顶部留白 78px」规则 `[class*="_page"]:has(> header[class*="_pageHead"])`
  在 0.2.2 误中插件管理器的新结构 `div.pageBody > div.pageBar[data-plugin-bar] > header.pageHead`
  ——`pageBar` 类名同样含 `_page` 子串且有直接子 header，于是 78px 打在了这条
  **JS 测高 + clip-path 裁剪的 sticky 条**上（`height:var(--plugin-header-rest-height)` +
  `clip-path:inset(…)`）：内容被推下去、裁剪几何不变 → 副标题被裁（用户截图）。
  且新版原生自带顶部留白（`--plugin-page-top-inset:28px + --dsh-frame-top-clearance`），
  78px 在这页本就多余；子页 `section.page[data-plugin-panel] > header.moreHead` 同理，
  再 +78px 会双倍留白。
- **修复**：两条规则分别用稳定 data 锚点排除 plugin-manager：
  `:not([data-plugin-bar])`（列表页测高条）、`:not([data-plugin-panel])`（子页容器），
  顶部留白交还原生机制；老结构设置页（无这两个锚点）不受影响。
- **验证**：`node --check` 通过；QuickLook 按 0.2.2 实测结构（sticky 条 + 测高 + clip-path）
  渲染旧/新规则对照（`research/shots/page-top-fix-test.png`）：旧规则头部被推离背景带、
  内容挤出可视区；新规则标题/副标题完整、留白正常。

## [0.5.9] - 2026-11-07

### 修复 · 会话行标题后的时间又出现了（挤占标题宽度）
- **根因**：「会话行时间 / 操作收进『更多』』开关（`workspaceRowCompact`，默认开）一直是开的，
  但隐藏规则用的是直接子选择器 `sessionRow > [class*="time"]`。0.2.2 的 workspace 重构给行里
  加了一层 `span.rowResting`（实测渲染：`sessionRow > rowResting > span.time(.timestamp)`），
  时间从行的直接子级变成孙级 → 规则落空 → 时间回显，还把标题截断挤成「…插化29 分钟」。
- **修复**：该条改后代选择器 `sessionRow [class*="time"]`。**不能**整壳隐藏 `rowResting`——
  里面还有图钉（PinnedIndicator）和 `sidebar.session.row.trailing` 插槽，只收 time 本体。
  时间信息仍可在每行「更多」菜单的「更新于 X」看到（0.5.8 起为 Remix time-line 图标）。
- **验证**：`node --check` 通过；QuickLook(WebKit) 按 0.2.2 实测行结构渲染旧/新规则对照
  （`research/shots/row-time-hide-test.png`）：旧规则时间回显，新规则时间消失、图钉保留、标题占满。

## [0.5.8] - 2026-11-07

### 修复 · 会话「更多」菜单：图标-标题间距过大 + 两项图标非 Remix
- **问题①（间距）**：0.2.2 菜单项结构为 `button._item > span._itemIcon(14×14) + span._itemLabel`，
  行内 `gap:6px`。图标覆盖只藏了原生 `svg`，但 `_itemIcon` 空壳仍占 14px，于是
  `::before`(14) + gap(6) + 空壳(14) + gap(6) + 文字 → 图标到文字被撑成双倍间距。
  **修复**：`iconOverrideCss` 的 `emit()` 隐藏列表追加 `[class*="_itemIcon"]`（与既有
  `[class*="_panelGlyph"]` 同一套路，按 CSS Module 类名尾缀收壳，哈希变也不坏）。
- **问题②（图标）**：「在 Finder 中显示」（open-in-app 包注入，icon key `open-in-app.reveal`
  → 原生 `IconFolderOpenOutlineRegular`）与「更新于 X」（本插件 `SessionTimeMenuItem`，
  原生 `IconClockOutlineRegular`）此前**没进 `MENU_ICON_TAGS`**，没打 `data-dsh-icon` 标 →
  图标覆盖选不到 → 一直是原生 Fluent 图标，和其余 Remix 项不一致。
  **修复**：`MENU_ICON_TAGS` 补两条正则（Finder 兼容「在 Finder 中显示/在 Finder 显示/Show in Finder」，
  时间行 `^更新于`）；`icons/manifest.json` 补 `menu.session-finder`（remixicon/folder-2-line，
  与工作区文件夹图标同款）、`menu.session-time`（remixicon/time-line），跑 `npm run icons:build` 内联进产物。
- **验证**：`node --check` 通过；`icons:check` 59 生效/2 停用；用 QuickLook(WebKit) 对「修复前/后」
  对照页实测渲染（`research/shots/menu-icon-fix-test.png`）——三项 Remix 图标（图钉/文件夹/时钟）
  均正常显示，收壳后图标-文字回到 6px 间距，且 `::before` 不受 `_itemIcon` 隐藏影响（无回归）。

## [0.5.7] - 2026-11-07

### 修复 · 升级 DSH 0.2.2-rc.1 后「会话卡片（HoverCard）内缩 / 跟随系统」失效
- **根因（两处同时变）**：插件原来写死旧构建的哈希类名 `_card_38jqx_9`。0.2.2-rc.1 里：
  1. 哈希变了：HoverCard 卡片类名变成 `_card_bgejw_9`（从新版 `app.asar` 的
     `dsh-web-frontend/dist/assets/index-lh_YM6sT.css` 逐字节提取确认）。
  2. DOM 结构变了：卡片不再直接挂在 `body` 下，而是被包进一层
     `span._portal_bgejw_96{display:contents}`（`createPortal(…, document.body)` 的根从
     `div` 改成了 `span`），所以原来的 `body > div[…]` 直接子选择器也落空。
- **修复**：改用**不依赖哈希**的语义锚点 `body div[class*="_card_"]:has([class*="hoverTitle"])`
  ——只要卡片里含 `hoverTitle`（会话/工作区悬浮卡稳定语义类）就命中，descendant 选择器
  兼容新的 portal 包裹层。内缩规则同时去掉 `>` 直接子组合符。共改 6 处选择器 + 1 处组合符。
- **验证**：新类名与 portal 结构均从新版 `app.asar` 实测提取；`node --check` 通过；HMR 热替换
  无崩溃日志。卡片为悬停触发的 portal，背景输入无法稳定触发 `pointerenter`，最终肉眼确认
  需在真机悬停会话行复核（内缩 15.5px / 浅色浅底）。
- **审计附带发现（本轮未改，待新版侧栏结构逆向）**：全量锚点审计另有 3 个失效锚点
  `_listArea` / `_listTop` / `sessionOverflowButton`——0.2.2 的 workspace 包整段重构，
  这些类已不存在（列表容器与「展开其余 n 个会话」按钮换了结构），属侧栏对齐微调，需单独一轮处理。

## [0.5.6] - 2026-11-02

### 修复 · 切到浏览器标签后「头像和新标签页之间一大段空白」
- **根因**：0.5.5 给 `.bt-ptab` 加了 `min-width:80px`（对齐原生 dockkit 标签）。但 Bot 的头像标签
  `.bt-ptab-bot` 在非详情态只显示 20px 头像、没有名字，被这条 min-width 撑到 80px，
  于是头像右侧空出 ~44px；切到浏览器标签时「新标签页」被推到很右边，看着像一大块空隙。
- **修复**：`.bt-ptab-bot{min-width:0}`，头像标签按内容宽收回；普通文字标签仍保留原生 min-width:80。
- 实测：浏览器态下头像右缘到标签左缘的间隙从 ~44px 收到 ~6px（padding 8 + gap 2 的正常间距）。

## [0.5.5] - 2026-11-02

### 调整 · Bot 详情面板标签的「选中状态」对齐 DSH 原生右侧栏
- **诉求**：Bot 面板顶部标签的**选中态宽/高/观感**要和 DSH 默认右侧栏（dockkit 标签）一套设计。
- **对照（读原生 CSS 实测）**：原生右侧栏 tab = 高 **28**、圆角 **8**、内距 **0 10**、字号 **13**、
  选中底色 `--dsw-alias-markdown-tag`（深色实心 **#2c2c2e**）；标签条 高 28 + 顶部 10 留白。
  ds-bot `.bt-ptab` 默认 = 高 **32**、圆角 **9**、内距 **0 8**、字号 **12.5**、选中底 `--bt-hover`
  （深色 rgba(160,160,160,.12) 淡白）→ 「不是一套设计」。
- **修复**：按原生数值归拢 `.bt-ptab`（28 / 8 / 0 10 / 13）、选中指示条 `.bt-ptab-ind` 底色换成
  `--dsw-alias-markdown-tag`、`.bt-ptab-new` 28×28/圆角 8。
- **踩坑**：只把 ind 设 `top:8/bottom:8` 时实测选中块仍是 **36** 高——因为 `.bt-ptabs-in`
  `height:100%` + `padding:4px` 是 content-box，盒子实际 52 高。给它 `box-sizing:border-box` 后
  盒子回到 44，ind 才真正等于 28。
- **实测**（截图 2x，像素测高）：改前选中块 ≈ **36** CSS px；改后 ≈ **28**，与原生右侧栏 **28** 一致。

## [0.5.4] - 2026-11-02

### 修复 · Bot 详情面板顶部标签条出现「肥胖白框」
- **现象**：Bot 详情面板顶部标签条（`许小穗 | 新标签页`）外面套着一圈又宽又高的
  白色圆角框，把标签包起来，观感比正常标签「肥胖」很多（用户截图）。
- **根因**：标签条内层 `.bt-ptabs-in` 是横向可滚动容器（`overflow-x:auto`），Chromium 把可滚动
  容器也当作可聚焦元素；键盘 Tab / 拖拽滚动时给它套上**默认的 `outline:auto` 焦点框**（深色下
  渲染成白色），于是整条容器外多了一圈白框。已用 `outline:auto` 在其上复现出与截图一致的白色圆角框确认。
- **修复**：`.bt-ptabs-in` 与 `.bt-ptab` 全部 `outline:none`；键盘聚焦改为只在具体标签本体上给
  2px 蓝色细描边（`:focus-visible`，`outline-offset:-2px`），保留可访问性。实测把 `outline:auto`
  强制加回也被覆盖（不再出现白框），选中态回到与「浏览器」标签同款的紧凑圆角底。
- 仅 `.bt-ptab*`（ds-bot 稳定类名），不影响其它 tab；经典布局下同样生效（纯焦点样式）。

## [0.5.3] - 2026-11-02

### 修复 · 「智能体」页 Bot 详情侧栏与主卡片割裂
- **根因**：Bot 详情侧栏不是原生 `[data-rightbar-col]`，而是 **ds-bot 插件** 用
  `createPortal(…, document.body)` 挂到 `<body>` 的固定浮层 `.bt-panel`：`position:fixed;
  top:var(--dsh-frame-chrome-top,0px); right:0; bottom:0;`，紧贴窗口右缘、方角、只画一条左描边。
  它不吃我们给右侧栏做的「合体大圆角卡」，所以展开后面板与主卡片是两种造型 → 观感割裂（用户截图）。
- **修复**：inset 布局下，让 `.bt-panel` 与右侧栏 `[data-rightbar-col]` 走同一套语言：
  向内让出 `--dsh-style-inset-gap`（4px）缝、右侧 20px 圆角、整圈 `--dsh-style-inset-border`
  描边、底色统一为 `--dsw-alias-bg-base`；并给 frame 打 `data-dsh-btpanel="open"`，同步把主卡片
  右侧圆角改 0、右边框透明，两张面拼成一张。关闭（portal 卸载）后属性消失，主卡片圆角平滑收回。
- **实测**（真机，窗口 1378×820 pt / 截图 2048×1219，DPR≈1.486）：面板右缘到窗口边 ≈7 物理 px
  ≈4.7 CSS px；上边框 y≈7 物理 px ≈4.7 CSS px；四边一致，右上/右下均为 20px 圆角（改前：0 边、方角）。
- 只用 `.bt-panel` 类名选择器（ds-bot 稳定公开的 DOM 类），不依赖 hash 类名，也不改 ds-bot 本体；
  仅作用于 `html[data-dsh-style-layout="inset"]`，经典布局与非插件页面完全不受影响。

## [0.5.2] - 2026-11-02

### 清理
- **探针代码已全部删除**（client.js 里已无 `TEMP` / `probe*` / `__p4x` 之类可搜到的东西）。
- 但 HMR 不会停掉**旧模块实例里的定时器**，那个 `setInterval` 仍在每 0.9s 重建调试浮标（`#p43`）。
  为此加了**临时清扫**：`startTagging()` 后每 400ms 按 id 移除 `p43/p41/p11/scano`，持续约 4 分钟
  （只管这几个 id，不碰任何其他元素）。
- **退出 App 重开**后旧定时器随进程消失，这段清扫代码就可以删掉了（届时我再清一次）。

## [0.5.1] - 2026-11-02

### 修复 · 设置子页（「实验性插件」）标题贴顶
- 0.1.x 那条「设置页顶部留白 78px」只匹配 `section._page > header._pageHead`（外页，如插件列表）。
- 实测「实验性插件」是**子页**，结构为 `section._page > header._moreHead > h1._pageTitle`，
  header 类名是 `_moreHead`，于是规则不命中 → 标题贴在 y=10。
- 追加一条 `:has(> header[class*="_moreHead"])` 的 78px 规则，两套 header 都覆盖。

### 顺带
- 清理调试遗留：`#p43/#p11/#scano` 浮标在启动时统一移除；`document.title` 加写保护，
  拦掉历史探针残留定时器写入的 `P|` / `D|` 调试串（业务标题照常写）。

## [0.5.0] - 2026-11-01

### 新增 · 这一轮改动全部开关化 + 分类
- **新增设置卡片「图标」**（外观组，排在输入框之后）：
  - `启用图标替换`（总开关，`iconOverrides`）
  - 分区开关：`侧边栏` / `会话区` / `标题栏` / `右侧栏`（`iconAreaSidebar|Conversation|Shell|Rightbar`）
  - 总开关关掉时四行自动置灰（`SwitchRow` 的 `disabled`）。
  - 实现：`iconOverrideCss(cfg)` 按 `item.area` 的**首段**分组过滤，关掉的分区一条规则都不输出。
- **零散改动补开关**（原先写死在 CSS 里）：
  - `sessionTitleGap` —— 会话标题直接截断 + 与「⋯」留 12px（侧边栏卡片）
  - `composerHideMore` —— 隐藏会话区顶部「更多操作」⋯
  - `composerToolbarAlign` —— 工具行 `+ / 附件 / 发送` 统一 28×28 / 圆角 8（含压掉原生 `transform:translateY(-2px)`）
  - `statsRowSplit` —— 底部统计行左组靠右贴（关闭时会自动清掉 `data-dsh-style-stats` 与内联宽度变量）
- 根节点新增 `data-dsh-style-session-title-gap` / `data-dsh-style-hide-more`，对应规则从 `[data-dsh-style-enabled="true"]` 迁到这两个属性上，做到「关掉即完全还原」。

## [0.4.11] - 2026-11-01

### 修复 · 上下文长条右端「凭空多一根亮线」
- 恢复 0.4.9 的描边观感，但把 `border:1px` 换成 **`box-shadow: inset 0 0 0 1px`**。
- 原因说清楚：`border` 方案里，左侧和上下的 1px 边被**蓝色填充压住**（填充贴着边缘），
  于是只剩右边那一条可见 —— 视觉上就像凭空多出一根高亮竖线。
  `box-shadow: inset` 画在背景**之上**，四条边均匀可见，观感才是"电池/刻度条"该有的样子。
- 宽度保持 40px、填充色 `--dsw-alias-button-info-fill`、斜纹 45°。

## [0.4.10] - 2026-11-01

### 调整
- 上下文长条**去掉 1px 描边**。那条描边在右端会读成「一根多余的竖线」（用户误以为是 bug）。
  改成 `border:none` + 淡底色 `--dsw-alias-bg-l3` + 斜纹表示未用量，圆角 3px。
  想要「电池/刻度」那种描边观感的话，把 border 那行加回去即可（一行）。

## [0.4.9] - 2026-11-01

### 调整
- 上下文长条：颜色 `--dsw-alias-brand-primary` → **`--dsw-alias-button-info-fill`**，宽度 34 → **40px**。
  坑：`--dsw-alias-brand-primary` 指向 `--dsw-static-neutral-bluish-*`（灰阶），深色下解析出来是**近白**，
  根本不是主色；发送按钮用的 `--dsw-alias-button-info-fill` 才是真正的蓝。
- **清理历史调试浮标**：旧探针的 `window.__scanT` 定时器一直在重建 `#scano` 那个绿色字浮标（用户屏幕上挂了很久）。
  `startTagging()` 里现在会 `clearInterval` 掉旧的定时器，并连扫 20 次（每 300ms）移除 z-index 2147483647 的残留浮标。

## [0.4.8] - 2026-11-01

### 新增 · 上下文用量改成条状
- 原本是个环形图标（我们用 `donut-chart-line` 盖过的那颗）。现在整条替换为
  **绿条 + 斜纹剩余 + 右侧百分比**，宽度 34×7、圆角 2，颜色跟随 `--dsw-alias-status-success`。
- 实现：`tagContextBar()` 每轮从按钮 aria-label（`上下文已用 42%`）里抠出百分比，
  写进 CSS 变量 `--dsh-style-ctx-w`；`::before` 用一层 `linear-gradient`（实心到百分比）
  叠一层 `repeating-linear-gradient`（45° 斜纹）。百分比变化自动跟随，无需刷新。
- 原来的 `composer.stat-context` 图标覆盖已停用（`enabled:false`），避免和长条打架。
- **开关**：设置 → 插件 → dsh-style → 输入框 →「上下文用量改成条状」。

## [0.4.7] - 2026-11-01

### 调整 · 统计行左组真正靠拢
- `space-between` 在 dock 有 3 个子元素时会把「步数」和「命中缓存」也拉开。
  改成 `justify-content:flex-start` + `> :last-child{margin-left:auto}` ——
  不管里面是 2 个还是 3 个子元素，前两个都挨在一起、只有最后一个贴右。
- 实测观感：`74 轮 760 步 · 196 tok/s` 与 `249M tok · 缓存命中 99%` 相邻，`41%` 独占最右。

## [0.4.6] - 2026-11-01

### 修复 · 统计行「左右分布」把输入框撑宽了（0.4.5 的回归）
- 0.4.5 给统计行容器强加 `display:flex + width:100%`，结果**标到了比输入框更宽的容器**上，把整列撑变形
  （用户截图）。已回退该做法。
- 正解：统计胶囊其实装在一个**居中窄 dock**（实测 449 宽，卡片 672）里，里面本来就分了左右两组。
  只把 dock 拉到与卡片同宽（`--dsh-style-stats-w` 由 JS 写入）+ `justify-content:space-between` ——
  不碰 display、不碰外层容器。实测：`dock 672@559`、`justify=space-between`，卡片仍是 672。
- **认 dock 只看结构**（包含三个胶囊的最小共同祖先、子元素 ≤6）。用宽度当判据会死锁：
  上一轮已把 dock 拉宽成 672，之后「必须比卡片窄 40px」的条件就再也认不出它（实测踩到）。
  另外清理时按 `[style*="dsh-style-stats-w"]` 一起清，避免内联变量残留导致卡在旧宽度。
- **MutationObserver 补 `characterData: true`**：统计行只改文本的重渲染不产生 childList 变化，
  打标会丢（实测首次之后属性消失）。

## [0.4.5] - 2026-11-01

### 调整 · 输入框底部统计行左右分布
- 三个胶囊（轮/步 · tok/s ｜ tok · 缓存命中 ｜ 上下文已用）改成：**前两个靠左成组、上下文甩到最右**。
  做法：给行容器打 `data-dsh-style-stats`，CSS `display:flex; gap:8px` + `> :last-child{margin-left:auto}`。
- **打标选法带约束**：只认「包含这三个胶囊、且子元素 ≤ 6」的最小祖先。第一版没约束，
  一路爬到整个内容行（实测打到 `287..1505` 的大容器上）—— 那会把整块内容强加 flex 布局，非常危险。
- 结构实测：`button[aria-label] ← span._anchor(flex) ← div(display:contents) ← 行容器`。

## [0.4.4] - 2026-11-01

### 调整 · 票根虚线可调化
- 上移量 `-4px → -12px`；虚线更密（实 4px / 空 4px，原来 5/10）；**左右各缩进 10px**（不再顶满卡片）。
- 三个量抽成 CSS 变量挂在 `[data-composer-card]` 上，改一个数即可：
  `--dsh-style-ticket-inset`（左右缩进）/ `--dsh-style-ticket-lift`（上移）/ `--dsh-style-ticket-dash` + `--dsh-style-ticket-gap`（密度）。
- 实测：卡片 / 工具行 / 输入区左缘都在同一列（x=560，横向无 padding），所以缩进只能是**我们自己的数**，
  取 10px（略宽于「+」按钮的 8px 行内距，看起来像内缩的票根线）。

## [0.4.3] - 2026-11-01

### 修复 · 输入框工具行三个按钮真正拉平
- 之前只统一了尺寸，实测仍有差异：加号 `padding 1px 6px`（原生）、部分 `display:grid`、**发送按钮比加号高 2px**。
  现在 `+ / 附件 / 发送` 统一：`28×28 / padding:0 / margin:0 / display:inline-flex / align-items:center /
  justify-content:center / align-self:center / border-radius:8px`。
- **2px 偏移的根因是 `transform`**：父容器 `.trailing` 与 `.tools` 都在 803–831，但发送按钮是 801–829，
  静态定位 + margin 0 不可能偏移 → 按钮自带一个上移的 transform。统一规则里加 `transform:none !important`，
  实测两边都回到 `803–831`。
- 票根虚线 `top: 0 → -4px`（按用户要求整体上移 4px）。

## [0.4.2] - 2026-11-01

### 调整
- **发送/停止按钮缩到和「+」一样大**：原生 34×34（圆角 10）→ **28×28 / 圆角 8**，图标 16 → **18px**。
  实测同一排现在完全对齐：`加号 28x28|r8|ico18`、`停止 28x28|r8|ico18`（发送是同一颗按钮的另一形态）。
- 踩坑：`squareActionButtons` 那条规则里发送/停止写的是 `border-radius:10px !important`，且比新规则晚生效，
  于是尺寸改了圆角没跟着变。已把它也改成 8px（注释说明「与 + 保持同一套圆角」）。

## [0.4.1] - 2026-11-01

### 新增 · 输入框「票根虚线」
- 在输入区和工具行（`+` 附件 模型 语音 发送 那一排）之间加一条**虚线分隔**：
  `repeating-linear-gradient(to right, currentColor 0 5px, transparent 5px 10px)`，`opacity:.16` ——
  颜色跟随文字色、只靠透明度收敛，深浅色都自然（用户要求「别那么白」）。
- 锚点：工具行结构实测 `button._add → div._tools → div._row（与卡片同宽 672）→ div._card`，
  运行时给 `div._row` 打 `data-dsh-style-toolbar`，CSS 挂在属性上（不依赖哈希类名）。
- **开关**：设置 → 插件 → dsh-style → 输入框 →「工具行上方虚线（票根分隔）」（`composerPerforation`，默认开）。

## [0.4.0] - 2026-11-01

### 新增 · 输入框「+」右侧的附件按钮
- 原生要两步（点「+」→ 点「文件」），这里在「+」后面直接插一个 28×28 的附件按钮，
  图标复用手册里的 `attachment-line`（mask + currentColor，深浅色自动跟随）。
- **不移动任何 React 节点**：只是在「+」的父容器里 `insertBefore` 自己的 `<button data-dsh-style-attach>`，
  每次打标复核一次位置（被 React 重渲染掉会自动补回）。
- 点击行为：优先用输入框里**已有的隐藏 `input[type=file]`**（实测 `accept` 为空、`multiple`，即「通用文件」），
  直接唤起系统文件选择器；找不到才退回「点 + → 点文件」的老路。
- **开关**：设置 → 插件 → dsh-style → 输入框 →「+」右侧加附件按钮（`composerAttachButton`，默认开）。

实测：`fileInputs=any+multi`（可直接唤起）、`btn=28x28 aria=添加附件（直接选文件）`、`mask=set`、`visible=flex`。

## [0.3.4] - 2026-11-01

### 修复
- **「+」弹层图标在 hover 后变回原生**。原因两条：
  1. 打标器原来「先清空所有 `data-dsh-icon^="plus-"`，再重新找弹层」——弹层重渲染那一刻若还没认出容器，
     属性就一直是空的，图标回落原生。改成**先找容器、找到才动，且只清本次没命中的旧标**（幂等，不清空不闪）。
  2. 弹层整块重渲染时 React 不一定会产生可观察的 childList 变化。补一层
     `pointerover / pointerdown / focusin`（捕获阶段）→ `scheduleTag()`（rAF 去重，开销可忽略），
     指针/焦点一动就补标。

实测：点击「+」后 8 项图标全部替换；hover 移出再移回不再回落（待用户复验）。

## [0.3.3] - 2026-11-01

### 调整
- 输入框：**加号 14 → 18px、选择模型 16 → 18px**（与语音输入 18px 对齐，之前比语音小一号，视觉不齐）。

## [0.3.2] - 2026-11-01

### 新增 · 会话页第三批（输入框 + 「+」弹层）
- **输入框内**：加号 `add-line` @14、选择模型 `brain-line` @16、语音输入 `mic-2-line` @18、
  发送 `arrow-up-line` @16、停止生成 `stop-circle-line` @16；
- **底部三个统计胶囊**：轮/步 `route-line`、token/缓存 `database-2-line`、上下文用量 `donut-chart-line`（均 14，
  锚点 `[data-slot="conversation.composer"] button[aria-label*="轮"][aria-label*="步"]` /
  `*="tok"` / `*="上下文已用"` —— 注意它们在 `conversation.composer` 里，**不在** `conversation.input.dock`）；
- **「+」弹层 8 项**：文件 `attachment-line`、目标 `flag-line`、计划 `list-check`、反馈 `feedback-line`、
  压缩 `collapse-diagonal-line`、权限 `shield-check-line`、模型 `brain-line`、下载日志 `file-download-line`（均 14）。
  该弹层是**自定义 popover，没有 `role="menuitem"` 也没有 aria**，只能按首行文案打标：
  新增 `tagPlusMenu()`（从每个 svg 往上找最近命中文案的祖先，打 `data-dsh-icon="plus-*"`），文案变了自动退回原生。

实测（真机）：加号 `none/b14px`、模型 `none/b16px`、语音 `none/b18px`、停止 `none/b16px`、
轮步/token/上下文 三处均 `none/b14px`。发送按钮在生成中不存在（同一位置显示「停止生成」），未单独验证。

## [0.3.1] - 2026-10-31

### 修复
- **右侧栏折叠的展开/收起图形用反了**：改为 展开态 `layout-right-fill`、收起态 `layout-right-line`
  （与左侧栏一致：当前状态用实心）。实测收起后那颗按钮 aria 确认为 `打开右侧边栏`，已覆盖。
- 「打开任务监控」14px → **16px**（用户觉得偏小）。

### 新增 · 会话页第二批（消息功能）
- 复制 `file-copy-line` @15；
- 好的回答 `thumb-up-line` → **选中态 `aria-pressed="true"` 切 `thumb-up-fill`** @15；
- 有问题的回答 `thumb-down-line` → 选中态 `thumb-down-fill` @15；
- 在新对话中分支 `git-branch-line` @16；
- 自动换行 `text-wrap` @14；
- 代码块「查看 … 的改动」`code-box-line` @20（选择器 `button[aria-label^="查看"][aria-label$="的改动"]`）；
- 消息「更多」`more-fill` @15（按钮悬停才渲染，本次未实测到，命中不了会退回原生）。

实测：复制/两个回答/分支/自动换行/查看改动 六处均 `svg display:none` + `::before 15/16/14/20px` 生效。

## [0.3.0] - 2026-10-31

### 新增 · 会话区顶部 + 右侧栏折叠（第一批·顶部）
- 「更多打开方式」小箭头 → `arrow-down-s-line`，**12px**（原 10px 太糊，已放大）；
- 「打开任务监控」→ `list-check-3`（14px）；
- **隐藏「更多操作」（⋯）**：用户判定无用，CSS `display:none`（一行注释标明位置，删掉即恢复）；
- 「用访达打开」**不动**（读的是系统 Finder 应用，图标是应用图标不是 svg）；
- 右侧栏折叠按钮与左侧栏统一语言：**展开态** `layout-right-line`、**收起态** `layout-right-fill`
  （15px，选择器覆盖 `收起/展开/打开右侧边栏` 三种 aria）。**注意**：收起后的按钮文案未能实测确认，
  若 DSH 用的是别的措辞（如「显示右侧边栏」），补一个选择器即可。

实测：`chevron none/b12px` `taskMon none/b14px` `more w0`（已隐藏）`collapseNow none/b15px`。

## [0.2.9] - 2026-10-31

### 调整
- 会话行标题**改回直接截断、不出省略号**（按用户选择：悬停有详情卡片兜底，`…` 是视觉噪音）。
  0.2.8 的 `padding-right:12px` 空隙保留，所以标题和「⋯」仍然不贴。

## [0.2.8] - 2026-10-31

### 修复
- **会话行标题贴着右侧「⋯」按钮**。原因：DSH 给 `[class*="_sessionRow"] [class*="_title"]` 用的是
  `text-overflow:clip`（直接切掉、没有省略号），且标题是 `flex:1`、行 `gap:0`，长标题就顶到按钮下面。
  改成 `text-overflow:ellipsis` + `padding-right:12px`（标题 `min-width:0`，padding 会真的从宽度里扣，
  不撑行），另把 `[class*="_rowActions"]` 固定 `flex:none`。
  实测：`titleRight 249 / actsLeft 249`，文字实际在 237 处截断 → 与按钮有 12px 空隙；
  `getComputedStyle(title).textOverflow === 'ellipsis'`。

## [0.2.7] - 2026-10-31

### 新增
- **工作区行右侧两个悬停按钮的图标**（用户选型 ① ①）：
  - 「…」更多操作 → `more-line`（14px）
  - 「新建会话」→ `chat-new-line`（与顶部新会话同款，14px）
  锚点用 `[data-slot="sidebar.workspaces"] button[aria-label^="工作区"][aria-label$="的操作"]`
  与 `… button[aria-label^="在“"][aria-label$="中新建会话"]`（含中文书名号/引号，均来自 DSH 自身 aria）。
  实测：两个按钮原生 svg `display:none`、我们的 `::before` 均 `14px` 生效（按钮平时悬停才显示，故宽度读作 0）。

## [0.2.6] - 2026-10-31

### 新增
- **图标来源改为 RemixIcon + 状态态扩展**。发现：Qoder 那套图标集 **89%（3190/3546）与 RemixIcon 4.9.1 路径逐字相同**
  （`QoderArrowLeftSLine` = `arrow-left-s-line`，命名只是 camel→kebab）。已把 RemixIcon 拉到本地
  （`../remixicon-4.9.1/`，3229 个），并对用户那套做了去重：删 3190、留 356（28 个改过 + 328 个自研），
  报告在 `qoder-icons-20261029/CLEANUP-REPORT.md`，整包备份 `/tmp/qoder-icons-BACKUP-20261031-222524.tgz`。
- **variants 支持 `selector`**（原来只有 `when` 拼接在原目标上）：状态落在**祖先**时，
  例如工作区行的 `aria-expanded`、文件夹槽的 `_folderActive`，可以给完整选择器。
- **新增 18 个位置**（全部实测接线）：
  新会话 `chat-new-line`；工作区箭头 `arrow-right-s-line`（收起）/`arrow-down-s-line`（展开）；
  工作区文件夹 `folder-2-line` / 展开 `folder-open-line` / 选中 `folder-open-fill`；
  会话菜单 置顶 `pushpin-2-line`/取消置顶 `pushpin-line`、重命名 `edit-line`、分叉 `git-branch-line`、
  归档 `archive-line`、复制 ID `file-copy-line`；视图菜单 按工作区 `layout-line`、工作区树 `node-tree`、
  单列表 `list-unordered`、手动排序 `drag-move-line`、最近更新 `time-line`、
  隐藏已归档/仅显示已归档 `archive-line`、全部对话 `chat-3-line`。
  菜单项无 aria-label，靠 `tagMenuItems()` 按文案打 `data-dsh-icon`（文案变了自动退回原生）。
- **实测**：工作区行 `aria-expanded=true` 且文件夹槽带 `_folderActive` → 原生 svg `display:none`、
  我们的 `::before` 16px 生效；两个菜单 13 项打标全部命中（`menu-session-* / menu-view-* / menu-sort-* / menu-filter-*`）。
- **踩坑**：面板行图标壳 `<span class="_panelGlyph">` 固定 16px，只藏 svg 会留空壳把文字顶开
  （文字从 x=61 变 x=37 才对）；已按类名尾缀一起收掉。

## [0.2.5] - 2026-10-31

### 新增
- **第一批图标覆盖（左侧栏 · 工作区行右侧三颗）**，走 `icons/manifest.json` 声明式登记：
  | 位置 | 官方图标（反查所得） | 尺寸 | 取自 |
  |---|---|---|---|
  | 搜索会话 | `IconSearchOutlineRegular` | 14 | QoderSearchLine |
  | 视图选项 | `IconSlidersTwoOutlineRegular` | 16 | QoderSettingsLine（库里暂无滑杆图标，暂用齿轮） |
  | 添加工作区（新文件夹） | `IconProjectAddOutlineRegular` | 16 | QoderFolderAddLine |
  选择器统一用 `[data-slot="sidebar.workspaces"] button[aria-label="…"]`（槽出口 + 中文 aria，均稳定；
  哈希类名 `Kjh-qa_*` 不参与）。实测：三颗均正常渲染（放大镜 / 齿轮 / 文件夹+），原生 svg `display:none`
  后由 `::before` 贴图，按钮 28×28 点击行为不变。
- **官方图标名反查方法**（可复用）：真机取 DOM 里 svg 的 `path d` 前缀 → 在
  `research/extracted/pkgs/dsh-web-frontend/dist/assets/index-*.js` 里定位该路径 → 找到包住它的
  局部常量（如 `$v=({size…})`）→ 顺着 wrapper（`NT=e=>jsx($v,{strokeWidth:1})`）到导出表
  `IconXxxOutlineRegular:NT`。因为图标是「base + Regular/Medium wrapper」两层包装，直接搜路径会停在 base 上。
- 一条 `IconDataOutlineRegular`（composer 模型按钮）仍是停用模板，等选定图形再启用。

## [0.2.4] - 2026-10-31

### 新增
- **图标覆盖支持状态态（`variants`）**：一条记录里可以挂多个「状态一键换形」——
  `file` 放常态（Line 线框），`variants: [{ when, file }]` 放状态态（Fill 实心），
  `when` 是拼在目标选择器后的状态限定（`[aria-pressed="true"]` / `[aria-expanded]` / `[data-active]` / `:hover` …）。
  生成后的规则特异性高于基础规则，同一元素按状态自动覆盖。
  背景：项目图标集与 DSH 原生一致，分 **Line（常态）/ Fill（状态态）** 两种形态，不是深浅色两套；
  DSH 导出 180 个图标名里 Outline 160 / Fill 20，成对仅 10 组 —— 线框是常态，实心只给有状态的图标。
  **深浅色不需要两套图**：单色图形走 mask，颜色由 `currentColor` 决定，一份自动适配明暗。
  实测：拿 Qoder 的 `CameraSwitchLine/Fill` 做冒烟条目，构建正确产出 base + variant 两条规则、
  真机 16px 位置正常渲染；验证后已撤回，manifest 只留停用模板。

## [0.2.3] - 2026-10-31

### 新增
- **图标覆盖表（`icons/` + `tools/icons/build.mjs`）**：把「换某个原生图标」变成声明式配置，不再手写 base64。
  1. svg 按**被替换的官方图标名**命名（如 `IconDataOutlineRegular.svg`），放进 `icons/`；
  2. 在 `icons/manifest.json` 记一条：`native`（换了谁）、`where`（界面上哪个位置，人话）、
     `selector`（稳定锚点：`data-*` / `aria-label` / `data-slot`，**不用哈希类名**）、`size`、`tint`、`enabled`；
  3. `npm run icons:build` 把 svg 压成 data URL 写进 `client.js` 的 `<icons:auto>` 块；
     `npm run icons:check` 只校验不写盘（提交前防「改了表忘构建」）。
  运行时 `iconOverrideCss()` 把表翻成两条 CSS：隐藏该位置原生 svg + `::before` 贴我们的图标。
  `tint: currentColor` 走 mask（跟随深浅主题），`tint: color` 保留原图配色。
  换电脑 clone 即生效（svg 已内联，运行时零文件依赖）；**官方改名/改 aria-label 时选择器不再命中，
  自动退回原生图标，不会报错也不会坏**。
- **踩坑记录**：`selector` 是逗号列表（中/英两个分支）时，伪元素必须拼到**每一段**上；
  第一版写成 `selector + '::before'` 只挂到最后一段，中文那颗出现「原生图标被藏掉、新图标没贴」的空白，
  真机截图确认后改成逐段拼接，复测图标正常显示。
- 当前 manifest 里只有一条**停用**记录（`composer-model ← IconDataOutlineRegular`，留着当模板）。

## [0.2.2] - 2026-10-31

### 新增
- **设置页新增「输入框」分组（外观 → 输入框）**：原来散落在「外观细节」里的 composer 项
  （附件栅格 / 外观微调 / 圆角 / 默认行数 /「+」和发送按钮改圆角矩形）全部并到这一组，
  方便一处调完；「外观细节」只留外壳与标题栏相关开关。
- **隐藏「权限」按钮**（默认开）：composer 左下角那个 100×28 的「完全权限 / 需要确认」按钮可以关掉了
  —— 已经设成完全权限时它只是常驻噪音。锚点用 DSH 原生槽出口
  `[data-slot="conversation.input.permission"]`（不是构建哈希类名），只 `display:none`，不改任何行为：
  真正改动权限仍走设置页 / 原生菜单。
  实测：`getComputedStyle(slot).display === "none"`、宽 0；工具行里 ＋ 按钮照旧在其位置。
- **模型选择只显示图标**（默认开）：把 264px 宽的「DeepSeek V4.1 Flash · OpenCode High ⌄」文字按钮
  收成 **28×28 的 deepseek 品牌图标按钮**，点击仍然弹原生「模型与推理等级」菜单（不重画菜单、不碰模型状态）。
  实现复用 DSH **原生紧凑态**的两个变量——`--dsh-composer-model-text-display`（文字）与
  `--dsh-composer-model-icon-display`（16px 品牌图标）；原生本来就是用它们切换
  `data-model-compact`，插件只是把这两个变量抬到 `[data-composer-card]` 上让它常驻图标态，
  再补一条 `svg:last-of-type` 隐藏下拉箭头、按钮 28×28 圆角 8。
  **为什么不按类名写**：真机 bundle 里这两组类是 `fofTgQ_*` / `htuFrW_*`（源码里是另一套哈希），
  类名会随构建变；变量名与 `aria-label` 前缀是稳定的。
  实测：按钮 `28×28`、`triggerIcon svg 16px display:block`、label/effort/chevron 全部 `width 0 / display:none`、
  两个变量读出 `none` / `block`；点击后 AX 出现 `AXMenu（模型与推理等级）` + 菜单项，可正常切换。

## [0.2.1] - 2026-10-31

### 修复
- **折叠左侧栏后，会话区标题被顶栏按钮压住（刷新图标正好盖在标题开头几个字上）**。
  根因：DSH 原生用 `--dsh-frame-leading-clearance` 给左上角 chrome 让位——侧栏折叠时（`[data-sidebar-collapsed]`）
  设 `160px`（全屏 `84px`），会话标题行的 `padding-inline-start` 是 `calc(清变量 - 20px)`，
  即「标题左缘 = 清变量 + 6px」。这个 160px 是按**原生 3 颗按钮**量的；插件多加了第 4 颗「刷新页面」，
  按钮条固定在 `left:88px`、宽 118px（88→**206px**），于是标题从 **166px** 起，重叠 40px。
  修法：沿用原生同一套让位机制，把清变量抬到「按钮条右缘 + 4px」——
  `calc(88px + var(--dsh-style-tb-width) + 4px)`，宽度由 JS 实测后写进 `--dsh-style-tb-width`
  （4 颗 118px / 关掉刷新时 3 颗 88px），展开态不生效。全屏时按钮条跟随原生 leadingSeat 左移到 12px，
  清变量同步按 `calc(12px + 宽度 + 4px)` 重算（原生全屏只给 84px，原来叠得更狠）。
  实测（1512 宽、macOS、非全屏）：折叠态清变量 `calc(88px + 118px + 4px)` = 210px、
  标题行 `padding-inline-start 190px`、标题左缘 **166 → 216px**、按钮右缘 206px，间隙 10px；
  命中测试（标题左缘 +3px 处 `elementFromPoint`）从「刷新按钮」变为「标题文字本身」。
  展开态清变量为空、标题在 307px，无回退。
- **顶栏按钮盒在 HMR 后重复叠份（真机实测 body 上 11 个，AX 树里 11 个「收起侧边栏」）**。
  根因与当年引用卡片叠行同源：`dsh-client-hmr` 重跑整个插件模块、但不回收上一代实例，
  旧实例的 `MutationObserver` 还在跑，每次 `tagOnce()` 都会再 `append` 一个按钮盒（位置完全相同，
  所以肉眼看不出来，但命中层与无障碍树各自多出 N 份）。
  修法：模块执行时用一个自增代次认主（`globalThis.__dshStyleTitlebarGen`），
  只有「代次不落后于当前主」的实例能挂按钮；挂载前先扫掉 body 上任何遗留的 `[data-dsh-style-titlebar]`，
  保证最多一个。实测：修复后连续 HMR 数次，`document.querySelectorAll('[data-dsh-style-titlebar]').length`
  恒为 **1**，AX 树从 11 个按钮回到 1 个。

## [0.2.0] - 2026-10-31

### 新增
- **输入框引用卡片（S1：正文 @文件引用的只读镜像）**：composer 里每出现一个文件引用（`span[data-composer-chip]`，
  有扩展名的才算），就在**输入框卡片内部最上方**参与统一附件栅格（`[data-composer-card]` 的第一个子节点，
  占正常文档流，输入框随之长高）：序号圆标 + 类型色块（扩展名前 4 位）+ 文件名 + 类别
  （图片/视频/PDF/文档/表格/演示/安装包/压缩包/代码）；与官方附件（图片/上传文件）合并成 wrap 栅格——
  图片在前、卡片 164×64、`gap 12`、左右内距 14，自动换行、不横向滚动。
  点击卡片 → 定位并高亮正文里的对应引用（`scrollIntoView` + 2px 蓝色描边，1.4s 后消失）；
  点击正文引用 → 高亮对应卡片。卡片是**从正文 DOM 派生**的，不存独立状态：引用被删除时卡片同一帧内消失，
  序号按当下顺序自动重排。
  - 只读：不碰 Lexical 模型、不改引用语义，模型收到的仍是 `@相对路径`。
  - 实现：`refCards` 控制器 + `REFCARD_CSS`（`client.js` 顶部），`MutationObserver(body: childList/subtree/characterData)`
    → rAF 节流重扫；行节点插在 composer 卡片内部（React 重渲染后由下一轮 mutation 自动重挂），
    不再使用浮层定位。
  - 实测（本机 0.2.1-rc.5）：探针在空输入框里渲染 3 张卡（`AGENTS.md` / `ENTITY_DETAIL_LAY…` / `package.json`），
    卡片位于输入卡片内部顶部、第 3 张在右缘被裁切（可横向滚动），composer 高度随之增加；真实引用插入时
    序号 `1 / 2` 与正文顺序一致，图标 `MD`、类别「文档」。
  - 开关：「外观 → 外观细节 → 输入框引用卡片（正文 @文件镜像到输入框顶部）」，默认开；关掉立即拆掉卡片行与监听。
  - 已知限制：只镜像「有扩展名的文件引用」（目录、命令 chip、会话引用不画卡片）；
    卡片 × 不回删正文引用（无编辑器 API）。
  - **修复叠行**：HMR 热替换时旧插件实例可能没被回收，每个实例都会插一行（用户实测出现 5 行、
    每行一张卡且序号都是 1）。修法：`start()` 通过 `globalThis.__dshStyleRefCards` 单例把手先 `stop()`
    上一个活着的实例；`ensureRow()` 再对同一张 composer 卡片做 `:scope > [data-dsh-refcards]` 去重，
    保证「一张卡片最多一行」。验证：探针渲染 3 张卡后连续触发 3 次 HMR，始终只有 1 行 3 卡（不再叠 3 行）。
  - **间距与裁切**：行内左右各留 `10px`（`padding: 2px 10px` + `scroll-padding`，与顶部 8px 卡片内距 + 2px 行内距对齐），内容变化时 `scrollLeft` 复位，
    避免第一张卡被上次的滚动位置截掉；卡片改 `flex: 0 1 220px; min-width: 150px`，三张卡在 712px 宽的
    composer 里自动压缩到约 204px 正好排满（文件名超出用省略号），更多卡才横向滚动；行头/行尾加 10px
    渐隐遮罩（`mask-image`），滚动裁切不再生硬。实测：探针 3 张卡（MOV / EXE / DMG）左右各有内边距、
    三张完整并排，文件名以 `…` 截断。
### 新增（本轮续）
- **输入框外观微调 + 设置项**：外观页新增「输入框外观微调（圆角 / 高度 / 内距）」开关，
  以及「输入框圆角」分段（12 / 16 / 20 / 原生 28）、「输入区默认行数」分段（2 / 3 / 4 行，对应
  `min-height` 36 / 60 / 84，随字号增量缩放）、「「+」和发送按钮改圆角矩形」开关。
  CSS 由 `composerChromeCss(cfg)` 按配置拼装（`client.js`），默认 16px / 3 行 / 圆角矩形。
  实测：默认 `card=16px padT=14px minH=60px plus=8px send=10px`；把圆角 12 + 4 行时
  `card=12px minH=84px`（与映射一致）。


- **Figma 变量板（设计变量参考页）**：Figma「DSH」文件新增页面 `dsh-style · 变量板`（背景 `#F5F5F5`），三块画板：
  `01 · 官方 Token（Light）`（nodeId `43:446`，98 别名色 + 77 静态色 + 6 圆角的色块/圆角块）、
  `02 · 输入框 Composer 标注`（nodeId `43:1249`，672 宽 mock + 8 条编号标注，蓝色 = 插件改过）、
  `03 · 改动对照`（nodeId `43:1346`，原生值 ↔ 当前值表格）。
  - 变量集合：`DSH · 官方 Token` 181 个（alias/static/radius），`dsh-style · 改动值` 31 个
    （composer/editor/toolbar/grid/各按钮数值），画板节点已绑定，改变量 → 画板同步。
  - 数据源：`dsh-client-ui-theme` 的 `--dsw-*` 定义（Light）+ 真机探针实测值；说明见 `docs/figma-token-board.md`。


- **默认输入区加高一行**：DSH 原生 `[data-composer-input]` `min-height:36px`（正文行高 24px），
  这里改成 `min-height: calc(60px + var(--dsh-content-font-delta, 0px))`，即 36 + 24 = 60px；
  composer 整卡高度随之 104 → 128px。实测：`edH 36→60`、`cardH 104→128`、`line-height 24px / font-size 14px`。
  （顺带说明：用户猜的“文字高度 16px”不对，DSH 正文行高是 24px，所以加一行是 +24 而不是 +16。）


- **输入框圆角收小 + 两个圆形按钮改圆角矩形**：`[data-composer-card]` 圆角 `28px → 16px`；
  左下角「添加文件或调用指令」28×28 圆钮 `999px → 8px`；右下角「发送/停止」34×34 圆钮 `999px → 10px`
  （停止态与发送态共用一条规则，中英文 aria-label 都覆盖）。实测 computed：`card=16px / plus=8px / send=10px`。


- **附件区改为「图片在前 + 引用卡片在后」的统一换行栅格（对齐 Figma `DSH / Frame 12`）**：
  不再「文件一行、图片一行、横向滚动」，改为一个 `display:flex; flex-wrap:wrap; gap:12px` 的容器：
  先把官方附件栏（图片 64×64、上传型文件卡）逐项 **克隆** 进栅格，再追加正文引用卡片；官方 rail 被
  `display:none` 收起，避免两套并排。点击/删除通过「克隆按钮 → 官方原件按钮」代理，官方灯箱、
  移除、上传态都仍是原件的行为；克隆只是展示层，不移动任何 React 节点。
  - 尺寸按 Figma：图片 64×64（高度=文件卡高），文件卡 164×64、圆角 12、间距 12，行内左右内距 10（与顶部对齐）。
  - 实测（探针 6 条引用）：栅格按 3 列 × 2 行自动换行，卡片 164 宽、间距 12，不再横向滚动；探针已删除。
  - **四边内距统一 14px**：`[data-composer-card]` 顶部内距 8→14（与编辑器文字左内距 `padding-left:14`
    对齐），栅格左右内距同为 14。同时修掉空集合判断 bug：`sig` 之前空集时是 `'##'`（真值），
    导致空栅格残留 4px 高 + 12px gap，空输入框顶部看起来多出 16px。
    实测：空输入框 `padT=14 / edTop=14 / phLeft=14`；有卡片时 `cardTop=14 / cardLeft=14`。
  - 待真机确认：图片镜像依赖官方 rail 的 `[class*="_rail"][role="group"]` 锚点；找不到时会退回官方 rail（不会坏）。

- **标题栏「刷新页面」按钮（真刷新，不是占位）**：在左箭头 / 右箭头右侧补第 4 个 28px 按钮
  （`aria-label` / `title` = 刷新页面，`data-act="reload"`），图标为 16px、`stroke-width:1.4` 的环形箭头，
  与同组三个按钮同一套 `dsh-style-tb-btn` hover/active 样式。点击走 `location.reload()`：
  重载渲染进程里的整个 Web 应用（页面、WebSocket 连接、插件状态全部重来），而不是只重跑 `apply()`；
  `reload()` 万一被拦下（页面没有 unload）则 1200ms 后补一次整页导航并恢复按钮。
  实测：AX 树四个按钮 `@88 / 118 / 148 / 178, 11`，各 `28×28`。
  开关：「外观 → 外观细节 → 标题栏刷新按钮（真正重新加载页面）」，默认开；整组仍受「标题栏窗口按钮」总开关控制。

### 规划（未实现，仅记录需求）
- **输入框引用卡片 · 剩余部分（v0.2）**：外观页底部保留「规划中（未实现）」一行占位——`v0.2` 徽标 + 禁用开关 +
  说明文案（不写 localStorage、不接任何设置，纯记录）。剩余需求：正文引用显示为「附件 N」短链接；
  卡片上的 × 回删正文引用（插件没有编辑器 API，目前只能点卡片定位）。
  可行性研究见 `research/findings/04-attachments.md`（§9）。

### 修复
- **刷新按钮撞上桌面壳的启动注入缓存 → 启动阶段 `dsh-style: import failed` 弹窗，已加刷新前校验**。
  根因在桌面壳，插件只能兜底（不改内核）：
  1. `app.asar/lib/main.js` 在 Host 启动时把 `ready.injections` 存进主进程内存
     （`injections = ready.injections`），之后 IPC `dsh-desktop:boot` 每次启动都返回这份**缓存**；
     `__DSH_BOOT__` 里每个插件条目的 `url` 带 `rev`（`/plugins/??<id>/client.js&rev=…`）。
  2. `client-hmr` 每 500ms stat 插件 bundle，文件一变就 `clientModules.rebuilt(id)`，
     `rev = hash(mtimeMs, ctimeMs, size)` 随之变化；Host 的 `/plugins` 路由对旧 `rev` 直接 404
     （只保留当前一代 + 上一代 batch）。
  3. 于是「插件被热更新过 + 页面 reload」= 用旧 rev 拉脚本 404 → boot 审计报 `<id>: import failed`
     → 桌面壳 `reportFatal` 弹「应用无法启动或已意外停止」。
  实测两次崩溃（`crash-2026-10-31T03-56-50Z` / `04-03-31Z-web-boot.log`，均为 `dsh-style: import failed`）；
  第 2 次的 shell 11:56 启动、`client.js` 11:57:49 被 HMR 改过 → 注入 rev 与磁盘 rev 不一致，对得上。
  兜底：点击刷新前先 GET 一遍 `__DSH_BOOT__.entries[].url`，任一非 200 就只弹提示
  「插件刚热更新过，整页刷新会在启动时报错。请退出 App 后重新打开。」，不做 reload；
  全新启动（没有热更新）时按钮照常真刷新。
- **右侧栏开合改为真正逐帧插值的双向布局动画**。真机逐帧采样定位到两个原因：
  1. DSH 把 `grid-template-columns` 过渡写在 `[data-animating]` 里，而该属性与列宽变化**同一帧**才被加上；
     浏览器只在「变化前已存在过渡声明」时启动插值 → 该过渡从未启动，列宽一帧到位（硬切）。
     对照证据：dsh-style 常驻声明的 `border-*` / `background` 过渡全部正常触发 `transitionrun`。
  2. 内联轨道 `\${sidebar}px minmax(0|400px,1fr) minmax(0px,\${rightbar}px)` 在开关时中间轨道 min 变化，
     轨道列表整体不可插值。
  修复：frame **常驻声明**布局过渡（沿用 300ms / `cubic-bezier(.4,0,.2,1)`，`[data-dragging]`、
  `[data-rightbar-instant]` 时关闭以保证拖拽与全屏手感）；`normalizeGridColumns()` 把内联值规范成
  「固定长度 + 1fr + 固定长度」，并用 `style` 的 MutationObserver 在 React 写入的**同帧内**（绘制前）纠正。
  配套 `data-dsh-rb`（closed/opening/open/closing）保证边框与圆角不在首帧跳变，`closing` 期间右栏
  `overflow:hidden` 避免面板悬浮叠层。实测：主区 428→422→415→414、右栏 562→568→575→576，逐帧变化。

### 新增
- **首页苹果树邮戳插画（Qoder 新对话动效）**：首页标题上方 174×100 的邮票小卡片，按交接文档 1:1 还原——
  底板 140×72、树框 64×64、`1666`、`The Apple / Gravity · 1666`、邮戳 52×52 溢出右缘。
  三张 WebP 素材内联为 data URL（单文件插件无法取相对路径），启动预加载避免首帧闪图。
  交互：热区整体 `scale(1.03)`／500ms；树区单独 200ms 交叉淡入彩色；说明卡 288px、portal 到 body、
  `pointer-events:none`、随鼠标 `rotateZ ±8°` + `translateX ±12px` 弹簧跟随（stiffness 120 / damping 16，
  rAF 积分，`pointermove` 不 setState）；苹果光标由 canvas 画 🍎 生成 dataURL cursor，仅作用于热区。
  键盘：Tab 聚焦显示说明与彩色树、Esc / blur 关闭；`prefers-reduced-motion` 关闭缩放与摇摆；触屏点击切换。
  设置新增「首页苹果树邮戳插画」开关，关掉即完全移除。

### 新增
- **Qoder 风格首页（仅新会话 hero 相位）**：把首页重排成 Qoder 的版式——欢迎块在上、活跃度卡片居中、
  输入卡片沉到页面下部，中间留白由 flex 吸收（`margin-top:auto`），随窗口高度自适应。
  开关：「外观 → Qoder 首页」里的「首页上下分离布局 + 动态欢迎语」「首页活跃度热力图」。
- **动态欢迎语**：工作区与运行模式两个**原生选择器**留在原位（不搬 DOM、不重画、不遮蔽），
  用 CSS 把所在行改写成「在 [工作区] 用 [模式] 创造了不起的事物」。连接词挂在行与选择器锚点容器上，
  不进入任何原生按钮内部；两个选择器的点击、切换、失败回滚与原逻辑完全一致。
- **年度活跃度热力图**：通过官方 `conversation.input.dock`（list / scope=session / replaceOthers 无占用）
  注册一个真实 React 组件，渲染在欢迎语与输入卡片之间。53 列 × 7 行（最近 53 周）、月份标签按「每月第一周所在列」
  定位、格子 4 档绿色、悬停浮卡显示日期与数量（`createPortal` 到 body，避免被内嵌布局裁切）、
  空状态显示「还没有可以统计的会话」，维度可切「会话 / 工作区」。
  数据读 `ctx.sessions`（与侧栏同一份客户端快照），**口径为每个会话的 `updatedAt`（最近活动日）**，
  卡片右上角显式标注「按最近活动日」，不伪装成逐日事件史；`blank` 会话与子智能体会话不计入。

### 修复
- **品牌行左缘**：开启「隐藏品牌」后品牌会贴左边缘；给 `_logoRow` 补 6px 左内距（原生 4px → 10px），
  与侧栏其它内容的左缘（root 4.75 + region 4 + 标题 6 = 14.75）对齐。
- **外观设置页重排 + 补开关**：页面分为「外观」「功能」两大类——外观 = 布局 / 效果 / 侧边栏 / 外观细节，
  功能 = 任务监控 / 交互。「恢复默认」改为原生 secondary 小按钮（自适应宽度、左对齐，不再整行拉伸）。
  把原先「常开」的 7 项补成可开关（默认开）：沉浸式外壳、侧栏对齐/紧凑、会话 HoverCard 内缩、
  页面顶部留白对齐、标题栏窗口按钮、会话行时间/操作收纳、智能体/通用入口改名归位。
- **插件别名详情标题**：改为在原标题位置「二选一」——有别名时把 `detailTitle` 文本原位替换为别名（隐藏原名），
  没有别名时显示原名；版本号与标题同排保留，包名/模块名行保留用于辨认原版。不再新增独立别名行，避免
  「别名 / 原名 / 包名」三行并存。
- **编辑别名按钮**：改为直接沿用紧邻「卸载」按钮的原生尺寸规则（`primitives.Button` `variant="outline"` `size="sm"` =
  `_button` + `_sm` + `_outline`）：`height:28px`、`padding:0 10px`、`font-size:12px`、`line-height:18px`、
  `border-radius:var(--dsw-radius-sm)`、`border:.5px`；仅颜色/边框色/hover 色保持中性（卸载为 danger，只覆盖这三项）。
- **别名弹窗**：复用原生 `Modal` 外壳（宽度 `min(480px,100%)`），输入框复刻设置页 `input` 规则
  （32px 高、`.5px` `--dsw-alias-border-l4`、`--dsw-radius-md`、聚焦 `--dsw-alias-state-business-primary`），
  取消用原生次级按钮、保存用原生主要按钮；说明文案改为「为当前插件设置自定义显示名称，不影响插件原始名称及运行。」。

### 新增
- **插件别名**：在侧栏「插件」的已安装插件详情页，原生「卸载」按钮左侧新增「添加别名 / 编辑别名」按钮，
  点击弹出原生 Modal（标题「设置插件别名」，单行输入，取消 / 保存）。保存后立即生效：详情页在插件图标下方、
  原始名称上方显示别名，列表卡片主标题改为别名；清空并保存即移除别名。别名按插件稳定 ID（包名）映射，
  存于 `localStorage` 的 `dsh-style:pluginAliases`，重启保留，不改插件 manifest / package.json / ID / 安装目录，
  卸载后也不会因同名显示文案错误关联其它插件。实现位于 `client.js`，复用 DSH 原生 `Modal` / `Input` / `Button`。

### 文档 / 工具
- 新增 [`docs/FEATURES.md`](./docs/FEATURES.md)：逐项说明布局、侧栏、行/HoverCard、页顶、隐藏项、
  智能体/通用入口、任务监控、设置持久化、可逆性、兼容性，以及哪些不属于插件运行时。
- 新增 [`scripts/apply-app-locale.mjs`](./scripts/apply-app-locale.mjs)：把 App 原生中文本地化
  （zh-Hans/zh_CN lproj + Info.plist + entitlements 保留 + ad-hoc 重签）固化成可重复脚本；
  非插件运行时、不随 `.tgz` 分发，DSH 更新会覆盖，需重跑。README 已加使用/备份/恢复说明。

### 计划
- 主题：强调色、字号、界面密度、动效强度（原生控件）。
- 组件级开关：导航栏 / 输入框 / 消息布局的显隐与形态。
- 预设主题：一键整套。
- 宿主设置后端：值写进 DSH settings 命名空间（跨设备、可恢复默认）。

## [0.1.1] - 2026-10-30

### 变更
- **同款外观默认值**：全新安装默认内嵌布局、隐藏滚动条 / 会话标签栏 / 品牌 / 新会话、任务监控浮动，
  与作者当前外观一致；已保存的 `dsh-style:settings` 不会被覆盖。
- **移除「通用 / 协作」胶囊切换器**，还原 ds-bot 原生 panellist 行的交互：点击即在「对话（通用）」与
  「智能体（bot 页）」两面间切换。该行文案改为「智能体 / 通用」，并挪到侧栏「插件」下面一行
  （纯 DOM 改名 + 归位，点击仍走 ds-bot 原生逻辑，底层路由 / 注册 / 数据不动）。
- **工作区会话行整理**：行内时间改为放进每行「更多」菜单（新增「更新于 X」菜单项，注册自
  `sidebar.workspaces.session.menu.item`）；行内悬停的「归档 / 置顶」按钮收进「更多」菜单（菜单本就有这两项），
  悬停只留一个「更多」按钮。时间移走后标题占满整行、左右对称，右侧不再空一大截。
- **侧栏横向对齐（红绿灯基准列）**：以窗口红色关闭按钮中心 `X=22.75px`（逻辑坐标）为基准，功能导航、
  顶层文件夹、会话状态槽统一到同一条 16px 图标槽（槽左缘 14.75、中心 22.75）；「工作区」标题左缘与
  槽左缘对齐；会话标题与文件夹标题同列（不再额外缩进），行内部左右 padding 统一 6px、标题填满行宽。
  侧栏内容区左右内缩统一为 **8.75px**：工作区头、添加工作区按钮、列表 / 选中行右缘对齐，移除滚动条
  预留的 7px，选中框不再右侧空一大截。会话 HoverCard 向主内容卡片内缩 **8.75px**（与侧栏内容内缩一致）；
  卡片宽度随内容收缩（上限 244），标题左右 16/16 不再右侧空一大截。展开箭头复用同一 16px 槽，
  悬停/展开不挤动图标和文字。规则用共享变量集中定义，并限定在侧栏展开态，折叠态 / 窄窗 rail 不受影响。

- **工作区头图标 hover 裁剪修复**：18px 分区标题里 28px 的搜索 / 视图 / 添加图标，其 hover / active
  方形背景被 `sectionHeader` / `headerActions` / `regionArea` 的 `overflow:hidden` 裁剪；三处改为
  `overflow:visible`，标题行高和右侧 8.75 内缩不变。
- **底部账户卡左内缩修复**：原生 `triggerRow` 左右各 -2px，头像/昵称卡片贴住侧栏左边缘；改为
  左侧补 4px（footArea 4.75 + 4 = 8.75），宽度扣 4px，右缘回到 255.25；卡片底部间距不变。
- **插件页顶部空白修复**：插件页有 `pageHead` 但 page 自身 `padding-top: 0`，标题贴在顶部；自动化任务页
  `pageHeading` 有 76px 顶部 padding。给带 `pageHead` 的 page 补 78px，两页标题都到 y=83。

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
