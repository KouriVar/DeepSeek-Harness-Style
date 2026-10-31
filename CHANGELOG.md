# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 与 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。

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
