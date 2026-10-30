// dsh-style — 浏览器端（client half）。
//
// DeepSeek Harness 以 classic script 方式加载本文件（经 window.__ModuleLoader__），
// 与官方客户端包相同的包装：由 dsh 负责解析 react / react-dom /
// @deepseek-ai/dsh-client-ui-primitives 这些平台模块。
//
// 作用：往原生「设置」的 `settings.section` 插槽注册一个「外观」页，
// 并应用可逆的、纯客户端的样式设置。不重绘/不替换任何 DSH 组件；
// 设置页使用原生 Switch / SegmentedControl / Button 原语。
//
// 设置按设备保存在 localStorage。布局在启动时立即应用（不只在打开设置页时），
// 并在禁用/卸载时彻底清理。
//
// 布局模式：
//   classic — 完全保持原生 AppFrame 不变（默认；完整原生回退）
//   inset   — 把外壳改成「底板 + 白色圆角主内容卡片」结构
//
// AppFrame（内置 `root` 插槽）由 @deepseek-ai/dsh-client-ui-layout 独占。
// 没有公开插槽可以改它的类名，所以为不写死构建产物里的 hash 类名，
// 我们用稳定语义锚点（`[data-shell-bottom]` 是 frame 的子节点）+
// 浅层兄弟关系（右栏 `[data-rightbar-col]` 往前找两列）定位三栏，
// 再打上我们自己的 data 属性；样式表只针对这些属性。
window.__ModuleLoader__.load({
  id: 'dsh-style',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement
    let prim = {}
    try {
      prim = require('@deepseek-ai/dsh-client-ui-primitives') || {}
    } catch {
      prim = {}
    }
    let ReactDOM = {}
    try {
      ReactDOM = require('react-dom') || {}
    } catch {
      ReactDOM = {}
    }
    const createPortal = typeof ReactDOM.createPortal === 'function' ? ReactDOM.createPortal : null
    const IconChat = prim.IconNewChatOutlineRegular
    const IconAgent = prim.IconAgentPresetOutlineRegular
    const IconChecklist = prim.IconChecklistOutlineRegular
    const IconClose = prim.IconCloseOutlineRegular
    const IconChevronDown = prim.IconChevronDownOutlineRegular
    // 插件别名功能：复用 DSH 原生 Modal 原语（缺失时回退到自绘弹窗）。
    const PrimitivesModal = typeof prim.Modal === 'function' ? prim.Modal : null

    // ------------------------------------------------------------------ 配置
    const STORE_KEY = 'dsh-style:settings'
    // 0.1.1 起默认就是作者当前这套「同款外观」；老用户已有的 localStorage 不会被覆盖。
    const DEFAULTS = {
      enabled: true,
      layout: 'inset',
      reduceMotion: false,
      hideScrollbars: true,
      hideBrand: true,
      hideNewSession: true,
      hideTabs: true,
      monitorEnabled: true,
      monitorMode: 'floating',
      monitorAlwaysShow: { team: false },
      // 以前「常开」的功能，现补成可开关（默认开，保持原外观）。
      immersive: true,
      titlebarButtons: true,
      sidebarCompact: true,
      hovercardInset: true,
      pageTopSpacing: true,
      workspaceRowCompact: true,
      agentEntryMerge: true,
      // 会话悬浮详情卡背景：跟随系统（浅色浅底 / 深色深底）。
      hovercardFollowTheme: true,
      // Qoder 风格首页（hero 相位）：布局/欢迎语/热力图。
      qoderHome: true,
      homeHeatmap: true,
      homeDemoData: true,
    }
    const LAYOUT_OPTIONS = [
      { value: 'classic', label: '经典' },
      { value: 'inset', label: '内嵌' },
    ]

    function readSettings() {
      try {
        const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
        const merged = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) }
        if (merged.layout !== 'inset' && merged.layout !== 'classic') merged.layout = DEFAULTS.layout
        merged.monitorAlwaysShow = (merged.monitorAlwaysShow && typeof merged.monitorAlwaysShow === 'object') ? merged.monitorAlwaysShow : {}
        if (merged.monitorMode === 'docked') merged.monitorMode = 'pinned'
        if (merged.monitorMode !== 'pinned' && merged.monitorMode !== 'floating') merged.monitorMode = DEFAULTS.monitorMode
        merged.hideBrand = Boolean(merged.hideBrand)
        merged.hideNewSession = Boolean(merged.hideNewSession)
        merged.hideTabs = Boolean(merged.hideTabs)
        // 默认开的新开关：老配置里没有该键时保持 true（用 !== false 而非 Boolean）。
        merged.immersive = merged.immersive !== false
        merged.titlebarButtons = merged.titlebarButtons !== false
        merged.sidebarCompact = merged.sidebarCompact !== false
        merged.hovercardInset = merged.hovercardInset !== false
        merged.pageTopSpacing = merged.pageTopSpacing !== false
        merged.workspaceRowCompact = merged.workspaceRowCompact !== false
        merged.agentEntryMerge = merged.agentEntryMerge !== false
        merged.hovercardFollowTheme = merged.hovercardFollowTheme !== false
        merged.qoderHome = merged.qoderHome !== false
        merged.homeHeatmap = merged.homeHeatmap !== false
        merged.homeDemoData = merged.homeDemoData !== false
        return merged
      } catch {
        return { ...DEFAULTS }
      }
    }
    function writeSettings(value) {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(value))
      } catch {
        /* 存储不可用 */
      }
    }

    // 设置页与样式引擎共享的小 store。
    function createStore(initial) {
      let state = initial
      const listeners = new Set()
      return {
        get: () => state,
        set: (patch) => {
          const next = { ...state, ...patch }
          if (JSON.stringify(next) === JSON.stringify(state)) return
          state = next
          writeSettings(state)
          applyStyles(state)
          for (const listener of listeners) listener()
        },
        subscribe: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    }

    // ------------------------------------------------------------- 样式引擎
    const STYLE_TAG = 'style[data-plugin="dsh-style"]'
    const STYLE_ATTRS = [
      'data-dsh-style-enabled',
      'data-dsh-style-motion',
      'data-dsh-style-scrollbars',
      'data-dsh-style-layout',
      'data-dsh-style-dark',
      'data-dsh-style-hide-brand',
      'data-dsh-style-hide-newsession',
      'data-dsh-style-hide-tabs',
      'data-dsh-style-monitor',
      'data-dsh-style-qoderhome',
    ]

    // 侧栏展开态限定：侧栏根节点带 _collapsed 时是收起态（窄窗口 rail / 隐藏），
    // 横向对齐规则只作用于展开态，避免影响折叠布局。
    const SIDEBAR_EXPANDED = 'html[data-dsh-style-enabled="true"] [data-dsh-style-sidebar]:not(:has([class*="_collapsed"]))'

    // 静态规则。布局规则只在 html[data-dsh-style-layout="inset"] 下生效，
    // 因此经典模式下标签即使挂着也完全不影响原生外观。
    const BASE_CSS = [
      'html[data-dsh-style-layout="inset"]{',
      '--dsh-style-inset-bg:#e9eaec;',
      '--dsh-style-inset-radius:20px;',
      '--dsh-style-inset-gap:4px;',
      '--dsh-style-inset-gap-left:6px;',
      '--dsh-style-inset-border:rgba(0,0,0,.07);',
      '}',
      'html[data-dsh-style-layout="inset"][data-dsh-style-dark="true"]{',
      '--dsh-style-inset-bg:#0f1012;',
      '--dsh-style-inset-border:rgba(255,255,255,.08);',
      '}',
      // frame 变成底板；padding 在上/右/下留白，Sidebar 贴左侧（0 缝），贴合参考结构。
      'html[data-dsh-style-layout="inset"] [data-dsh-style-frame]{',
      'background:var(--dsh-style-inset-bg);',
      'box-sizing:border-box;',
      'padding:var(--dsh-style-inset-gap) var(--dsh-style-inset-gap) var(--dsh-style-inset-gap) 0;',
      '}',
      // Windows 保留标题栏高度，在它之上再加我们的顶部留白。
      'html[data-windows-titlebar][data-dsh-style-layout="inset"] [data-dsh-style-frame]{',
      'padding-top:calc(var(--dsh-windows-titlebar-height) + var(--dsh-style-inset-gap));',
      '}',
      // 主内容变成独立的白色圆角面。
      'html[data-dsh-style-layout="inset"] [data-dsh-style-main]{',
      'background:var(--dsw-alias-bg-base);',
      'border:1px solid var(--dsh-style-inset-border);',
      'border-radius:var(--dsh-style-inset-radius);',
      'margin-left:var(--dsh-style-inset-gap-left);',
      'overflow:hidden;',
      '}',
      // 打开右侧边栏时：内容区 + 右栏合成**一个大的描边整体**（同一个圆角外框）。
      //  - 内容区只留左/上/下边，右侧描边交给右栏，两块之间用右栏的左边框当 1px 分割线；
      //  - 右栏补上右/上/下边 + 右侧圆角，外沿与内容区一同构成一个大圆角框。
      'html[data-dsh-style-layout="inset"] [data-dsh-style-frame]:not([data-rightbar-collapsed]) [data-dsh-style-main]{',
      'border-radius:var(--dsh-style-inset-radius) 0 0 var(--dsh-style-inset-radius);',
      'border-right:0;',
      '}',
      'html[data-dsh-style-layout="inset"] [data-dsh-style-frame]:not([data-rightbar-collapsed]) [data-rightbar-col]{',
      'background:var(--dsw-alias-bg-base);',
      'border-top:1px solid var(--dsh-style-inset-border);',
      'border-right:1px solid var(--dsh-style-inset-border);',
      'border-bottom:1px solid var(--dsh-style-inset-border);',
      'border-left:1px solid var(--dsh-style-inset-border);',
      'border-radius:0 var(--dsh-style-inset-radius) var(--dsh-style-inset-radius) 0;',
      'overflow:hidden;',
      '}',
      // 让会话头（标题 / 快捷区 / 右侧工具）与窗口顶栏（红绿灯）垂直对齐：
      // 内嵌布局顶部多了 4px 间隙，把 header 的顶部内边距抵掉同样的量。
      'html[data-dsh-style-layout="inset"] [data-dsh-style-main] header[data-window-drag]:not([class*="headerBlank"]){padding-top:calc(10px - var(--dsh-style-inset-gap)) !important;}',
      // 会话区（主内容）不需要可见滚动条：仍可滚动，只是不显示滚动条。
      'html[data-dsh-style-layout="inset"] [data-dsh-style-main]{scrollbar-width:none;}',
      'html[data-dsh-style-layout="inset"] [data-dsh-style-main] *{scrollbar-width:none;}',
      'html[data-dsh-style-layout="inset"] [data-dsh-style-main]::-webkit-scrollbar{width:0;height:0;display:none;}',
      'html[data-dsh-style-layout="inset"] [data-dsh-style-main] *::-webkit-scrollbar{width:0;height:0;display:none;}',
      // Sidebar 留在底板上，不加外部卡片，内部导航不动。
      'html[data-dsh-style-layout="inset"] [data-dsh-style-sidebar]{',
      'background:transparent;',
      'border-right:none;',
      '}',
      // 底部状态行跟随内容面，不画成一条横带。
      'html[data-dsh-style-layout="inset"] [data-shell-bottom]{background:transparent;}',
    ].join('')

    // 沉浸式外壳（与布局无关）：
    //  - 左侧边栏去掉自身底色/渐变（macOS 的 sidebar 渐变一并抹掉），透出底板；
    //  - 最外层大底板统一成 sidebar-fill（暗色 = #1B1B1C 纯色，浅色 = #F9FAFB），
    //    让侧栏与底板连成一片、无分割感。
    const IMMERSIVE_CSS = [
      'html[data-dsh-style-enabled="true"] [data-dsh-style-frame]{background:var(--dsw-specific-sidebar-fill,#1B1B1C) !important;}',
      'html[data-dsh-style-enabled="true"] [data-dsh-style-sidebar]{background:transparent !important;background-image:none !important;border-right:0 !important;}',
    ].join('')

    // 顶部窗口控制：折叠 / 后退 / 前进。放在红绿灯右侧（沿用原生 leadingSeat 坐标 left:88 / top:11，
    // 相对红绿灯约 16px 间距）。原生折叠按钮与占位控制隐藏，统一由这套接管。
    const TITLEBAR_CSS = [
      '.dsh-style-tb{position:fixed;top:11px;left:88px;display:flex;align-items:center;gap:2px;z-index:2147483000;-webkit-app-region:no-drag;}',
      '.dsh-style-tb-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#9aa0a6);cursor:pointer;padding:0;transition:background .12s,color .12s;}',
      '.dsh-style-tb-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));color:var(--dsw-alias-label-primary,inherit);}',
      '.dsh-style-tb-btn:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active,rgba(128,128,128,.2));}',
      '.dsh-style-tb-btn:disabled{opacity:.3;cursor:default;}',
      '.dsh-style-tb-btn svg{display:block;}',
      'html[data-dsh-style-enabled="true"] [data-dsh-style-sidebar] [class*="_toggle"]{display:none !important;}',
      'html[data-dsh-style-enabled="true"] [data-shell-leading]{display:none !important;}',
    ].join('')

    // 侧边栏模块可见性（品牌 / 新会话）。用 html 属性驱动，纯 CSS 隐藏；隐藏后侧栏是
    // flex 自动布局，下方内容会自然上移。
    // 侧边栏基础可见性（品牌 / 新会话 / 会话标签栏）与头部无分割线（始终启用）。
    const SIDEBAR_BASE_CSS = [
      'html[data-dsh-style-hide-brand="true"] [data-dsh-style-sidebar] [class*="_logoRow"]{display:none !important;}',
      // 品牌行左缘对齐侧栏其它内容（root 4.75 + logoRow 原生 4 = 8.75，内容左缘 14.75，补 6px）。
      `${SIDEBAR_EXPANDED} [class*="_logoRow"]{padding-left:10px !important;}`,
      'html[data-dsh-style-hide-newsession="true"] [data-dsh-style-sidebar] [class*="_newSession"]{display:none !important;}',
      // 隐藏会话标签栏（对话 / 轨迹 / …）：连整行一起收掉，会话区自动变高。
      'html[data-dsh-style-hide-tabs="true"] div:has(> [data-conversation-tabs]){display:none !important;}',
      // 标签栏没了，把会话头压到和右栏头一致的高度（38px），标题/图标才能对齐、也不留空白。
      'html[data-dsh-style-hide-tabs="true"] [data-dsh-style-main] header[data-window-drag]:not([class*="headerBlank"]){min-height:38px !important;height:38px !important;padding-top:0 !important;padding-bottom:0 !important;align-items:center !important;}',
      // 去掉标题栏 / 右栏头部那条分割线（和 Qoder 一样，无分割线）。
      'html[data-dsh-style-enabled="true"] [data-dsh-style-main] header[data-window-drag]{border-bottom:0 !important;}',
      'html[data-dsh-style-enabled="true"] [data-rightbar-col] [class*="_header"]{border-bottom:0 !important;}',
    ].join('')

    // 侧栏紧凑（按 Qoder 实测规格收紧：行高/内距/分区标题/footer）——可开关 sidebarCompact。
    const SIDEBAR_COMPACT_CSS = [
      `${SIDEBAR_EXPANDED} [class*="_sectionHeader"]{height:18px !important;padding-left:6px !important;margin-bottom:6px !important;font-size:13px !important;font-weight:500 !important;line-height:16px !important;overflow:visible !important;}`,
      `${SIDEBAR_EXPANDED} [class*="_headerActions"]{overflow:visible !important;}`,
      `${SIDEBAR_EXPANDED} [class*="_regionArea"]:has([class*="_sectionHeader"]){overflow:visible !important;}`,
      // 底部账户卡：原生 triggerRow 左右各 -2px，补 left / 扣宽度到 8.75。
      `${SIDEBAR_EXPANDED} [class*="_triggerRow"]{margin-left:var(--dsh-align-footer-inset) !important;margin-right:0 !important;width:calc(100% - var(--dsh-align-footer-inset)) !important;}`,
      `${SIDEBAR_EXPANDED} [class*="_panelRow"]{min-height:28px !important;height:28px !important;padding:0 8px !important;gap:8px !important;font-size:13px !important;line-height:16px !important;}`,
      `${SIDEBAR_EXPANDED} [class*="_panelRow"] svg{width:14px !important;height:14px !important;}`,
      // regionArea 负边距归零，行高亮不再顶到右边缘。
      `${SIDEBAR_EXPANDED} [class*="_regionArea"]{margin-left:0 !important;margin-right:0 !important;}`,
      // 右栏 dock 标签栏比左/中低约 5px：top 偏移补齐（不用 transform）。
      'html[data-dsh-style-enabled="true"] [data-sidebar-right-panel]:not([data-sidebar-right-panel="fullscreen"]){top:-5px !important;}',
      // 账户区底部间距与左侧 12 同步。
      'html[data-dsh-style-enabled="true"] [data-dsh-style-sidebar] > [class*="_root"]{padding-bottom:12px !important;}',
      'html[data-dsh-style-enabled="true"] [data-dsh-style-sidebar] [class*="_footArea"]{padding-bottom:0 !important;margin-bottom:0 !important;}',
      'html[data-dsh-style-enabled="true"] [data-dsh-style-sidebar] [class*="_settingsArea"]{padding-bottom:0 !important;margin-bottom:0 !important;}',
      'html[data-dsh-style-enabled="true"] [data-dsh-style-sidebar] [class*="_triggerRow"]{padding-bottom:0 !important;margin-bottom:0 !important;}',
    ].join('')

    // 页面顶部留白（插件页标题和自动化页顶部空白一致）——可开关 pageTopSpacing。
    const PAGE_TOP_CSS = [
      'html[data-dsh-style-enabled="true"] [data-dsh-style-main] [class*="_page"]:has(> header[class*="_pageHead"]){padding-top:78px !important;}',
    ].join('')

    // 把「智能体团队 / 子智能体 / 后台任务」三个头部入口从顶栏移到「任务监控」后，
    // 头部这几处隐藏（仅当任务监控开启，保证信息仍可见）。
    const HIDE_HEADER_CSS = [
      'html[data-dsh-style-monitor="true"] [data-team-action]{display:none !important;}',
      'html[data-dsh-style-monitor="true"] [class*="_switcherRoot"]{display:none !important;}',
      'html[data-dsh-style-monitor="true"] [class*="_4iHfma_trigger"]{display:none !important;}',
      '[data-dsh-style-chip-hidden]{display:none !important;}',
    ].join('')

    // 原生工作区浏览器的会话行（dsh-client-ui-workspace）：
    //  - 行内「时间」移到每行「更多」菜单里，行内不再占位，标题占满整行、左右对称；
    //  - 行内悬停的「归档 / 置顶」按钮收进「更多」菜单（菜单里本来就有这两项），
    //    悬停时只留一个「更多」按钮。
    const WORKSPACE_CSS = [
      'html[data-dsh-style-enabled="true"] [data-dsh-style-sidebar] [class*="sessionRow"] > [class*="time"]{display:none !important;}',
      'html[data-dsh-style-enabled="true"] [data-dsh-style-sidebar] [class*="sessionRow"] > [class*="rowActions"] > *:nth-child(n+2){display:none !important;}',
    ].join('')

    // 标题栏/侧栏横向对齐（macOS 红绿灯基准列）。
    //
    // 以窗口左边缘为 0 的逻辑坐标里，红色关闭按钮中心 = 22.75px（截图实测 45.5 @2x）。
    // 展开态共享一条 16px 图标槽列：槽左缘 = 14.75px，中心 = 22.75px。
    //   功能导航：root pad 4.75 + 行 margin 2 + 行 padding 8 = 14.75
    //   工作区行：root pad 4.75 + region padding 4 + 行 padding 6 = 14.75
    // 功能图标、文件夹图标、会话状态槽都落在同一条中心线上；文字统一从槽右缘 + 8px 起排。
    // 会话行不再额外缩进：标题与文件夹标题同为 38.75，形成 Qoder 那种同列布局。
    const ALIGN_CSS = [
      'html[data-dsh-style-enabled="true"]{',
      '--dsh-align-icon-center:22.75px;',
      '--dsh-align-icon-slot:16px;',
      // 18 = 功能行自身 inset（margin 2 + padding 8）+ 半个图标槽 8。
      '--dsh-align-root-pad:calc(var(--dsh-align-icon-center) - 18px);',
      // 侧栏内容区左右统一内缩：左侧 4.75（root pad）+ 4（region pad）= 8.75。
      '--dsh-align-content-inset:8.75px;',
      // footArea 从 root content 左缘（4.75）开始；底部账户卡再补 4px 到 8.75。
      '--dsh-align-footer-inset:calc(var(--dsh-align-content-inset) - var(--dsh-align-root-pad));',
      '}',
      // 左右内缩对称：右侧从原生 12px 改成 8.75px，和工作区头 / 行盒子 / 选中框对齐。
      `${SIDEBAR_EXPANDED} > div > [class*="_root"]{padding-left:var(--dsh-align-root-pad) !important;padding-right:var(--dsh-align-content-inset) !important;}`,
      // 工作区 root 自己还有 12px 右 padding；交给外层 root 统一控制。
      `${SIDEBAR_EXPANDED} [class*="_root"]:has(> [class*="_sectionHeader"]){padding-right:0 !important;}`,
      // 列表容器原先把 edge inset 用负 margin 吃掉；改为 0，让树体填到内容右缘。
      `${SIDEBAR_EXPANDED} [class*="_listArea"]{margin-right:0 !important;}`,
      // 列表原先为 5px scrollbar + 2px offset 预留 7px；滚轮已隐藏，改为 auto 并取消预留，
      // 行/选中框右缘才能到 255.25（264 - 8.75），与左侧 8.75 对称。
      `${SIDEBAR_EXPANDED} [class*="_list"]:not([class*="_listArea"]):not([class*="_listTop"]){margin-right:0 !important;padding-right:0 !important;scrollbar-gutter:auto !important;}`,
      // 功能图标统一放进 16px 槽（SVG 仍是 14px），槽内居中。
      `${SIDEBAR_EXPANDED} [class*="_panelGlyph"]{width:var(--dsh-align-icon-slot) !important;height:var(--dsh-align-icon-slot) !important;}`,
      // 文件夹行 / 会话行：同一套 6px 左右内边距，文字分别从槽右缘 + 8px 起排。
      // 行内 time / 更多按钮不占位时，标题会填到 6px 内边距处，左右间距一致。
      `${SIDEBAR_EXPANDED} [class*="projectRow"]{gap:8px !important;padding-inline-start:calc(6px + var(--dsh-workspace-indent, 0px)) !important;padding-right:6px !important;}`,
      `${SIDEBAR_EXPANDED} [class*="sessionRow"]{padding-inline-start:calc(6px + var(--dsh-workspace-indent, 0px)) !important;padding-right:6px !important;}`,
      // 会话标题与文件夹标题同一文字列；右侧 margin 归零，让标题填满行宽。
      `${SIDEBAR_EXPANDED} [class*="sessionRow"] > [class*="title"]{margin-left:8px !important;margin-right:0 !important;}`,
      // 「展开其余 n 个会话 / 收起」跟随会话标题同一起点（6 + 16 + 8 = 30）。
      `${SIDEBAR_EXPANDED} [class*="sessionOverflowButton"]{padding-left:calc(30px + var(--dsh-workspace-indent, 0px)) !important;}`,
    ].join('')

    // 会话 HoverCard 内缩 —— 可开关 hovercardInset。
    // `_card_38jqx_9` 是当前构建 HoverCard 卡片的 CSS module 类；升级后如类名变化需重新确认。
    const HOVERCARD_CSS = [
      'html[data-dsh-style-layout="inset"] body > div[class*="_card_38jqx_9"]{margin-left:15.5px !important;width:fit-content !important;max-width:244px !important;min-width:200px !important;}',
    ].join('')

    // 会话悬浮详情卡背景「跟随系统」——可开关 hovercardFollowTheme。
    // 原生把卡片底色写死为 --dsw-hovercard-bg:#2C2C2E（固定深色），所以浅色模式也是黑卡。
    // 这里仅在浅色模式把它改成主题浅底，并把内部文字改成深色 label；深色模式保持原生。
    const HOVERCARD_THEME_CSS = [
      'html[data-dsh-style-enabled="true"][data-dsh-style-dark="false"] body div[class*="_card_38jqx_9"]{--dsw-hovercard-bg:var(--dsw-alias-bg-base) !important;border:.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1)) !important;}',
      'html[data-dsh-style-enabled="true"][data-dsh-style-dark="false"] body div[class*="_card_38jqx_9"] [class*="hoverTitle"]{color:var(--dsw-alias-label-primary) !important;}',
      'html[data-dsh-style-enabled="true"][data-dsh-style-dark="false"] body div[class*="_card_38jqx_9"] [class*="hoverPath"]{color:var(--dsw-alias-label-secondary) !important;}',
      'html[data-dsh-style-enabled="true"][data-dsh-style-dark="false"] body div[class*="_card_38jqx_9"] [class*="hoverTime"]{color:var(--dsw-alias-label-secondary) !important;}',
      'html[data-dsh-style-enabled="true"][data-dsh-style-dark="false"] body div[class*="_card_38jqx_9"] [class*="hoverStatus"]{color:var(--dsw-alias-label-tertiary) !important;}',
    ].join('')

    // 任务监控：工具栏按钮 + 浮层面板。
    const MONITOR_CSS = [
      '.dsh-style-monitor-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:7px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-tertiary,inherit);cursor:pointer;transition:background .15s,color .15s;}',
      '.dsh-style-monitor-btn:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12));color:var(--dsw-alias-label-primary,inherit);}',
      '.dsh-style-monitor-btn[data-active]{background:var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.16));color:var(--dsw-alias-label-primary,inherit);}',
      '.dsh-style-monitor-panel{position:fixed;z-index:9999;width:360px;max-width:calc(100vw - 24px);max-height:min(86vh,880px);display:flex;flex-direction:column;border-radius:16px;border:0.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.10));background:var(--dsw-alias-bg-base,#151517);box-shadow:0 16px 44px rgba(0,0,0,.36);color:var(--dsw-alias-label-primary,inherit);overflow:hidden;}',
      '.dsh-style-monitor-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 18px 8px;}',
      '.dsh-style-monitor-title{font-size:15px;font-weight:600;letter-spacing:.01em;}',
      '.dsh-style-monitor-headbtns{display:inline-flex;align-items:center;gap:2px;}',
      '.dsh-style-monitor-headbtn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,inherit);cursor:pointer;transition:background .15s,color .15s;}',
      '.dsh-style-monitor-headbtn:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12));color:var(--dsw-alias-label-primary,inherit);}',
      '.dsh-style-monitor-headbtn[data-pinned]{background:var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.16));color:var(--dsw-alias-state-business-primary,#4d93f8);}',
      '.dsh-style-monitor-body{overflow:auto;padding:0 18px 16px;}',
      '.dsh-style-monitor-sec{padding:16px 0 2px;}',
      '.dsh-style-monitor-sec:first-child{padding-top:6px;}',
      '.dsh-style-monitor-sec-head{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:2px 0 8px;cursor:pointer;user-select:none;color:var(--dsw-alias-label-secondary,inherit);}',
      '.dsh-style-monitor-sec-head:hover{color:var(--dsw-alias-label-primary,inherit);}',
      '.dsh-style-monitor-sec-title{font-size:12.5px;font-weight:500;letter-spacing:.02em;margin:0;}',
      '.dsh-style-monitor-sec-count{font-size:11.5px;color:var(--dsw-alias-label-tertiary,inherit);}',
      '.dsh-style-monitor-chev{display:inline-flex;transition:transform .15s ease;color:var(--dsw-alias-label-tertiary,inherit);}',
      '.dsh-style-monitor-sec[data-collapsed] .dsh-style-monitor-chev{transform:rotate(-90deg);}',
      '.dsh-style-monitor-empty{font-size:12px;color:var(--dsw-alias-label-tertiary,inherit);margin:0;padding:2px 0 4px;}',
      '.dsh-style-monitor-empty-all{display:flex;flex-direction:column;align-items:center;gap:6px;padding:28px 0;color:var(--dsw-alias-label-tertiary,inherit);font-size:12.5px;}',
      '.dsh-style-monitor-row{display:flex;align-items:center;gap:10px;min-height:38px;padding:6px 8px;margin:0 -8px;border-radius:10px;font-size:13.5px;min-width:0;transition:background .12s ease;}',
      '.dsh-style-monitor-row:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.08));}',
      '.dsh-style-monitor-main{display:flex;flex-direction:column;min-width:0;flex:1;gap:2px;}',
      '.dsh-style-monitor-row-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13.5px;line-height:19px;}',
      '.dsh-style-monitor-sub{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;line-height:15px;color:var(--dsw-alias-label-tertiary,inherit);}',
      '.dsh-style-monitor-meta{font-size:11.5px;color:var(--dsw-alias-label-tertiary,inherit);flex:none;white-space:nowrap;}',
      '.dsh-style-monitor-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsw-alias-label-tertiary,#999);}',
      '.dsh-style-monitor-dot[data-s="running"]{background:#1e86ff;}',
      '.dsh-style-monitor-dot[data-s="done"]{background:#00c972;}',
      '.dsh-style-monitor-dot[data-s="error"]{background:#e02135;}',
      '.dsh-style-monitor-dot[data-s="pending"]{background:#b0b0b0;}',
      '.dsh-style-monitor-dot[data-s="cancelled"]{background:#c9a227;}',
      '.dsh-style-monitor-dot[data-s="failed"]{background:#e02135;}',
      '.dsh-style-monitor-dot[data-s="inactive"]{background:#8a8f98;}',
      '.dsh-style-monitor-dot[data-s="provisioning"]{background:#c9a227;}',
      '.dsh-style-monitor-link{color:var(--dsw-alias-state-business-primary,#1e86ff);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;}',
      '.dsh-style-monitor-more{align-self:flex-start;margin:4px 0 0;padding:6px 0;border:0;background:none;color:var(--dsw-alias-label-tertiary,inherit);font:inherit;font-size:12px;cursor:pointer;}',
      '.dsh-style-monitor-more:hover{color:var(--dsw-alias-label-primary,inherit);}',
      '.dsh-style-monitor-foot{font-size:11px;color:var(--dsw-alias-label-tertiary,inherit);opacity:.7;padding:2px 0 2px;}',
    ].join('')

    const MOTION_CSS = [
      '[data-dsh-style-motion="reduced"] *,',
      '[data-dsh-style-motion="reduced"] *::before,',
      '[data-dsh-style-motion="reduced"] *::after{',
      'transition-duration:0.001ms !important;',
      'animation-duration:0.001ms !important;',
      'animation-iteration-count:1 !important;',
      'scroll-behavior:auto !important;',
      '}',
    ].join('')

    const SCROLL_CSS = [
      '[data-dsh-style-scrollbars="hidden"] *{scrollbar-width:none !important;}',
      '[data-dsh-style-scrollbars="hidden"] *::-webkit-scrollbar{width:0 !important;height:0 !important;}',
    ].join('')

    // ---------------------------------------------------------- Qoder 首页
    // 只在 hero 相位生效。数值来自 research/spec/qoder-home-spec.md（2× 截图实测，logical px）。
    // 选择器同时给出两条路：① 运行期打的 data-dsh-qoder 属性；② 用官方 data-slot 锚点 + :has()
    // 反查父元素。任一条命中即生效，避免某次打标没跑就整块样式失效。
    const QODER_HOME_CSS = [
      // ---- 版式参数 ----
      'html[data-dsh-style-qoderhome="true"]{',
      '--dsh-q-title-size:20px;',
      '--dsh-q-sentence-size:22px;',
      '--dsh-q-sentence-color:#717171;',
      '--dsh-q-card-gap:26px;',
      '--dsh-q-top:clamp(24px,17vh,150px);',
      '--dsh-q-bottom:clamp(16px,3vh,40px);',
      '--dsh-q-card-radius:12px;',
      '--dsh-q-card-border:#e7e7e7;',
      '--dsh-q-empty:#eeeeee;',
      '--dsh-q-l1:#ecf8f1;',
      '--dsh-q-l2:#b5ddc3;',
      '--dsh-q-l3:#7fc79b;',
      '--dsh-q-l4:#4ea876;',
      '--dsh-q-underline:#d7d7d7;',
      '--dsh-q-prefix:"在";',
      '--dsh-q-mid:"用";',
      '--dsh-q-suffix:"创造了不起的事物";',
      '}',

      // ① 上下分离：欢迎组贴顶、输入卡片贴底，中间留白由 flex 吸收
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-conversation-scroll]{justify-content:flex-start !important;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-composer-seat]{flex:1 1 auto !important;min-height:0 !important;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="stack"],',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] div:has(> [data-slot="conversation.composer.bar"]){',
      'height:100%;box-sizing:border-box;gap:0 !important;',
      'padding-top:var(--dsh-q-top);padding-bottom:var(--dsh-q-bottom);',
      '}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="input"],',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-slot="conversation.composer.bar"] > *{margin-top:auto !important;}',

      // 欢迎块自身不再吃满高度（原生 HeroShell.root 是 height:100%，会把句子行推远）
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="stack"] > :first-child{height:auto !important;flex:0 0 auto !important;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] div:has(> [data-slot="conversation.hero.brand.mark"]){gap:0 !important;height:auto !important;flex:0 0 auto !important;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="headline"] + div{display:none !important;}',

      // ② 欢迎区：标题与句子同字号，层级只靠字重与颜色
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="headline"],',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] div:has(> [data-slot="conversation.hero.brand.mark"]){',
      'font-size:var(--dsh-q-title-size) !important;',
      'line-height:1.4 !important;',
      'font-weight:700 !important;',
      'letter-spacing:0 !important;',
      'gap:8px 8px !important;',
      'color:var(--dsw-alias-label-primary,#000) !important;',
      '}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="previewbadge"]{display:none !important;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="headline"] svg,',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-slot="conversation.hero.brand.mark"] svg{width:22px !important;height:22px !important;}',

      // ③ 动态欢迎语：整行居中，两个原生选择器原地句化
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="sentence"],',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] div:has(> [data-slot="conversation.hero.agentPreset"]){',
      'display:flex !important;justify-content:center !important;align-items:baseline !important;flex-wrap:wrap !important;',
      'gap:0 !important;margin-top:6px !important;padding:0 !important;',
      'font-size:var(--dsh-q-sentence-size) !important;line-height:1.4 !important;',
      'color:var(--dsh-q-sentence-color) !important;',
      '}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="sentence"]::before{content:var(--dsh-q-prefix);margin-right:12px;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="sentence"]::after{content:var(--dsh-q-suffix);margin-left:15px;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="sentence"] [class*="heroOptions"]{display:none !important;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="sentence"] > [data-slot="conversation.hero.options"]{display:none !important;}',

      // 选择器本体：去掉胶囊底色与图标，变成带下划线的词
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="ws"],',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="mode"],',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] div:has(> [data-slot="conversation.hero.agentPreset"]) > div > button{',
      'background:transparent !important;border:none !important;box-shadow:none !important;',
      'padding:0 !important;margin:0 !important;min-height:0 !important;height:auto !important;',
      'font-size:inherit !important;font-weight:400 !important;line-height:inherit !important;',
      'color:var(--dsh-q-sentence-color) !important;',
      'text-decoration:underline;text-decoration-color:var(--dsh-q-underline);',
      'text-decoration-thickness:1px;text-underline-offset:3px;',
      '}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="ws"]:hover,',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="mode"]:hover{',
      'color:var(--dsw-alias-label-primary,#000) !important;background:transparent !important;',
      '}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="ws"] > svg:first-child{display:none !important;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="mode"] > svg:first-child{display:none !important;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="ws"] > svg,',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="mode"] > svg{width:8px;height:8px;opacity:.85;margin-left:6px;color:var(--dsh-q-sentence-color);}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="modeWrap"]{display:inline-flex !important;align-items:baseline !important;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="modeWrap"]::before{content:var(--dsh-q-mid);margin-left:17px;margin-right:13px;}',

      // ④ 热力图卡片
      '.dsh-qcard{',
      'box-sizing:border-box;width:min(calc(100% - 88px),864px);max-width:var(--dsh-composer-card-max-width);align-self:center;',
      'display:flex;flex-direction:column;',
      'margin-top:var(--dsh-q-card-gap);',
      'padding:19px 20px 20px;',
      'border:1px solid var(--dsh-q-card-border);',
      'border-radius:var(--dsh-q-card-radius);',
      'background:transparent;color:var(--dsw-alias-label-primary,#000);',
      'font-size:13px;line-height:1.4;',
      '}',
      '.dsh-qcard-head{display:flex;align-items:baseline;gap:13px;margin:0 0 12px -3px;font-size:13px;line-height:18px;}',
      '.dsh-qtab{border:none;background:transparent;padding:0;margin:0;cursor:pointer;font-family:inherit;font-size:13px;line-height:18px;font-weight:400;color:#969696;}',
      '.dsh-qtab[data-active="true"]{font-weight:500;color:#464646;}',
      '.dsh-qtab[data-active="false"]:hover{color:#6f6f6f;}',
      '.dsh-qgrid{display:grid;grid-template-columns:repeat(53,1fr);grid-auto-rows:1fr;gap:3px;}',
      '.dsh-qcell{position:relative;aspect-ratio:1/1;border-radius:2px;background:var(--dsh-q-empty);}',
      '.dsh-qcell[data-level="1"]{background:var(--dsh-q-l1);}',
      '.dsh-qcell[data-level="2"]{background:var(--dsh-q-l2);}',
      '.dsh-qcell[data-level="3"]{background:var(--dsh-q-l3);}',
      '.dsh-qcell[data-level="4"]{background:var(--dsh-q-l4);}',
      '.dsh-qcell[data-out="1"]{background:var(--dsh-q-empty);}',
      '.dsh-qmonths{display:grid;grid-template-columns:repeat(53,1fr);gap:3px;margin-top:7px;font-size:10px;line-height:14px;color:#8f8f8f;}',
      '.dsh-qmonths > span{white-space:nowrap;}',
      // 口径注记：贴在月份行右端的空白处，不占额外行，也不挤进表头
      '.dsh-qsum{margin-left:auto;font-size:11px;line-height:18px;font-weight:400;color:#bdbdbd;white-space:nowrap;pointer-events:none;}',
      '.dsh-qempty{margin:8px 0 0;font-size:11px;line-height:16px;color:#b0b0b0;}',
      '.dsh-qtip{position:fixed;z-index:2147483600;pointer-events:none;padding:4px 8px;border-radius:6px;font-size:12px;line-height:16px;white-space:nowrap;background:rgba(24,24,27,.9);color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.16);}',

      // 深色主题
      'html[data-dsh-style-dark="true"]{--dsh-q-sentence-color:#a0a0a4;--dsh-q-card-border:rgba(255,255,255,.12);--dsh-q-empty:rgba(255,255,255,.08);--dsh-q-l1:#1e3a29;--dsh-q-l2:#2b5c3c;--dsh-q-l3:#3f8a56;--dsh-q-l4:#63bd7f;--dsh-q-underline:rgba(255,255,255,.28);}',
      'html[data-dsh-style-dark="true"] .dsh-qtab{color:#8a8a8f;}',
      'html[data-dsh-style-dark="true"] .dsh-qtab[data-active="true"]{color:#e8e8ea;}',
      'html[data-dsh-style-dark="true"] .dsh-qmonths{color:#7c7c82;}',
      'html[data-dsh-style-dark="true"] .dsh-qsum{color:#5c5c62;}',
      'html[data-dsh-style-dark="true"] .dsh-qempty{color:#707076;}',
    ].join('')

    function styleTag() {
      if (typeof document === 'undefined') return null
      let el = document.querySelector(STYLE_TAG)
      if (!el) {
        el = document.createElement('style')
        el.setAttribute('data-plugin', 'dsh-style')
        document.head.appendChild(el)
      }
      return el
    }

    function isDark() {
      try {
        return Boolean(
          (document.body && document.body.hasAttribute('data-ds-dark-theme')) ||
          (document.documentElement && document.documentElement.hasAttribute('data-ds-dark-theme')),
        )
      } catch {
        return false
      }
    }

    // ---- 三栏打标（语义锚点，不用 hash 类名） ----
    let observer = null
    let rafPending = false

    function frameEl() {
      if (typeof document === 'undefined') return null
      const bottom = document.querySelector('[data-shell-bottom]')
      return bottom ? bottom.parentElement : null
    }

    function clearTags() {
      if (typeof document === 'undefined') return
      for (const sel of ['[data-dsh-style-frame]', '[data-dsh-style-main]', '[data-dsh-style-sidebar]']) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          el.removeAttribute('data-dsh-style-frame')
          el.removeAttribute('data-dsh-style-main')
          el.removeAttribute('data-dsh-style-sidebar')
        }
      }
    }

    // ---- 顶部窗口控制（折叠 / 后退 / 前进） ----
    let titlebarEl = null
    function tbIcon(kind) {
      if (kind === 'panel') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.2" y="3.2" width="11.6" height="9.6" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M6.4 3.4v9.2" stroke="currentColor" stroke-width="1.4"/></svg>'
      if (kind === 'back') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M9.8 3.6 5.4 8l4.4 4.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6.2 3.6 10.6 8l-4.4 4.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    }
    function nativeToggle() {
      if (typeof document === 'undefined') return null
      return document.querySelector('[data-dsh-style-sidebar] [class*="_toggle"]')
        || document.querySelector('[data-shell-leading] button')
        || document.querySelector('button[class*="_toggle"]')
    }
    function syncTitlebar() {
      if (!titlebarEl) return
      const collapsed = Boolean(document.querySelector('[data-sidebar-collapsed]'))
      const c = titlebarEl.querySelector('[data-act="toggle"]')
      if (c) c.setAttribute('aria-label', collapsed ? '展开侧边栏' : '收起侧边栏')
    }
    function mountTitlebar() {
      if (typeof document === 'undefined' || !document.body) return
      if (store.get().titlebarButtons === false) { unmountTitlebar(); return }
      if (titlebarEl && document.body.contains(titlebarEl)) { syncTitlebar(); return }
      const box = document.createElement('div')
      box.className = 'dsh-style-tb'
      box.setAttribute('data-dsh-style-titlebar', '')
      const mk = (act, kind, label) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'dsh-style-tb-btn'
        b.dataset.act = act
        b.setAttribute('aria-label', label)
        b.title = label
        b.innerHTML = tbIcon(kind)
        return b
      }
      const toggle = mk('toggle', 'panel', '收起侧边栏')
      const back = mk('back', 'back', '后退')
      const fwd = mk('forward', 'forward', '前进')
      toggle.addEventListener('click', (e) => {
        e.preventDefault()
        const t = nativeToggle()
        if (t) t.click()
        setTimeout(syncTitlebar, 80)
      })
      back.addEventListener('click', (e) => { e.preventDefault(); try { window.history.back() } catch {} })
      fwd.addEventListener('click', (e) => { e.preventDefault(); try { window.history.forward() } catch {} })
      box.append(toggle, back, fwd)
      document.body.appendChild(box)
      titlebarEl = box
      syncTitlebar()
    }
    function unmountTitlebar() {
      if (titlebarEl) { try { titlebarEl.remove() } catch {} titlebarEl = null }
    }

    // 按文案定位顶栏那几个状态入口（哈希类名会随构建变，文案更稳），标记隐藏。
    function applyChipHiding() {
      if (typeof document === 'undefined') return
      for (const el of Array.from(document.querySelectorAll('[data-dsh-style-chip-hidden]'))) el.removeAttribute('data-dsh-style-chip-hidden')
      if (document.documentElement.getAttribute('data-dsh-style-monitor') !== 'true') return
      const header = document.querySelector('[data-dsh-style-main] header[data-window-drag]') || document.querySelector('header[data-window-drag]')
      if (!header) return
      const patterns = [/^\s*\d+\s*个子智能体/, /^\s*\d+\s*个后台任务/, /^\s*智能体团队\s*$/, /^\s*标准模式\s*$/]
      const all = Array.from(header.querySelectorAll('*'))
      const matched = all.filter((el) => {
        const text = (el.textContent || '').trim()
        return patterns.some((re) => re.test(text))
      })
      const deepest = matched.filter((el) => !matched.some((other) => other !== el && el.contains(other)))
      for (const el of deepest) {
        const chip = el.closest('[data-team-action]')
          || el.closest('[class*="_3j1mRa_root"]')
          || el.closest('button')
          || el
        chip.setAttribute('data-dsh-style-chip-hidden', '')
      }
    }

    function tagOnce() {
      if (typeof document === 'undefined') return
      mountTitlebar()
      applyChipHiding()
      tagQoderHome()
      const frame = frameEl()
      if (!frame) return
      frame.setAttribute('data-dsh-style-frame', '')
      const rightbar = frame.querySelector(':scope > [data-rightbar-col]')
      const main = rightbar && rightbar.previousElementSibling
      const sidebar = main && main.previousElementSibling
      if (main) main.setAttribute('data-dsh-style-main', '')
      if (sidebar) sidebar.setAttribute('data-dsh-style-sidebar', '')
      const dark = isDark() ? 'true' : 'false'
      const root = document.documentElement
      if (root.getAttribute('data-dsh-style-dark') !== dark) root.setAttribute('data-dsh-style-dark', dark)
    }

    function scheduleTag() {
      if (rafPending) return
      rafPending = true
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 16)
      raf(() => {
        rafPending = false
        tagOnce()
      })
    }

    function startTagging() {
      tagOnce()
      if (observer || typeof MutationObserver === 'undefined' || typeof document === 'undefined') return
      observer = new MutationObserver(scheduleTag)
      // 外壳重挂时重新打标；跟随 body 上的暗色主题切换。
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-ds-dark-theme', 'data-sidebar-collapsed'],
      })
    }

    function stopTagging() {
      if (observer) {
        observer.disconnect()
        observer = null
      }
      clearTags()
    }

    function applyStyles(cfg) {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      if (!cfg.enabled) {
        for (const attr of STYLE_ATTRS) root.removeAttribute(attr)
        const el = document.querySelector(STYLE_TAG)
        if (el) el.textContent = ''
        unmountTitlebar()
        stopTagging()
        tagQoderHome()
        return
      }
      root.setAttribute('data-dsh-style-enabled', 'true')
      root.setAttribute('data-dsh-style-motion', cfg.reduceMotion ? 'reduced' : 'full')
      root.setAttribute('data-dsh-style-scrollbars', cfg.hideScrollbars ? 'hidden' : 'shown')
      root.setAttribute('data-dsh-style-layout', cfg.layout === 'inset' ? 'inset' : 'classic')
      root.setAttribute('data-dsh-style-dark', isDark() ? 'true' : 'false')
      root.setAttribute('data-dsh-style-hide-brand', cfg.hideBrand ? 'true' : 'false')
      root.setAttribute('data-dsh-style-hide-newsession', cfg.hideNewSession ? 'true' : 'false')
      root.setAttribute('data-dsh-style-hide-tabs', cfg.hideTabs ? 'true' : 'false')
      root.setAttribute('data-dsh-style-monitor', cfg.monitorEnabled ? 'true' : 'false')
      root.setAttribute('data-dsh-style-qoderhome', cfg.qoderHome !== false ? 'true' : 'false')
      const el = styleTag()
      if (el) {
        const rules = [BASE_CSS]
        if (cfg.immersive !== false) rules.push(IMMERSIVE_CSS)
        if (cfg.titlebarButtons !== false) rules.push(TITLEBAR_CSS)
        rules.push(SIDEBAR_BASE_CSS)
        if (cfg.sidebarCompact !== false) rules.push(ALIGN_CSS, SIDEBAR_COMPACT_CSS)
        if (cfg.pageTopSpacing !== false) rules.push(PAGE_TOP_CSS)
        if (cfg.hovercardInset !== false) rules.push(HOVERCARD_CSS)
        if (cfg.hovercardFollowTheme !== false) rules.push(HOVERCARD_THEME_CSS)
        rules.push(HIDE_HEADER_CSS)
        if (cfg.workspaceRowCompact !== false) rules.push(WORKSPACE_CSS)
        rules.push(MONITOR_CSS)
        if (cfg.qoderHome !== false) rules.push(QODER_HOME_CSS)
        if (cfg.reduceMotion) rules.push(MOTION_CSS)
        if (cfg.hideScrollbars) rules.push(SCROLL_CSS)
        el.textContent = rules.join('\n')
      }
      if (cfg.qoderHome === false) tagQoderHome()
      if (cfg.titlebarButtons === false) unmountTitlebar()
      // 沉浸式外壳在经典/内嵌两种布局下都生效，所以始终打标（经典模式下 BASE_CSS 的
      // inset 规则不匹配，不会影响原生布局）。
      startTagging()
    }

    function cleanup() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      for (const attr of STYLE_ATTRS) root.removeAttribute(attr)
      const el = document.querySelector(STYLE_TAG)
      if (el) el.textContent = ''
      unmountTitlebar()
      stopTagging()
      tagQoderHome()
    }

    // ------------------------------------------------------------------- store
    const store = createStore(readSettings())
    let appCtx = null

    // 仅在未来版本不再导出某原语时兜底。
    function fallbackSwitch(props) {
      return h('label', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '10px 0' },
      },
      h('span', { style: { fontSize: '14px' } }, props.label || ''),
      h('input', {
        type: 'checkbox',
        checked: Boolean(props.checked),
        disabled: Boolean(props.disabled),
        onChange: (event) => { if (props.onChange) props.onChange(event.target.checked) },
      }))
    }
    const Switch = typeof prim.Switch === 'function' ? prim.Switch : fallbackSwitch

    // 原生 Switch 原语在本版本不渲染 label 文案，这里自己包一行「文字 + 开关」。
    function SwitchRow({ label, checked, onChange, disabled }) {
      return h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '10px 0' } },
        h('span', { style: { fontSize: '14px', color: 'var(--dsw-alias-label-primary, inherit)' } }, label),
        h(Switch, { checked: Boolean(checked), disabled: Boolean(disabled), onChange }))
    }

    function fallbackSegmented(props) {
      return h('div', { style: { display: 'flex', gap: '8px' } },
        (props.options || []).map((option) => h('button', {
          key: option.value,
          type: 'button',
          'aria-pressed': props.value === option.value,
          onClick: () => { if (props.onChange && props.value !== option.value) props.onChange(option.value) },
        }, option.label)))
    }
    const SegmentedControl = typeof prim.SegmentedControl === 'function' ? prim.SegmentedControl : fallbackSegmented

    // 同上：原语不渲染 label 文案，这里补一行可见标题。
    function SegmentedRow({ label, ...props }) {
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        label ? h('span', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-secondary, inherit)' } }, label) : null,
        h(SegmentedControl, props))
    }
    const Button = typeof prim.Button === 'function' ? prim.Button : null

    // ---------------------------------------------------------------------- 界面
    const pageStyle = { display: 'flex', flexDirection: 'column', maxWidth: '640px', minWidth: 0, gap: '20px' }
    const headingStyle = { fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--dsw-alias-label-primary, inherit)' }
    const introStyle = { fontSize: '13px', margin: '4px 0 0', color: 'var(--dsw-alias-label-tertiary, inherit)', opacity: 0.75 }
    const sectionStyle = { display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '0.5px solid var(--dsw-alias-border-l2, rgba(128,128,128,.2))' }
    const sectionTitleStyle = { fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--dsw-alias-label-primary, inherit)' }
    const hintStyle = { fontSize: '12px', margin: 0, color: 'var(--dsw-alias-label-tertiary, inherit)', opacity: 0.75 }
    const rowStyle = { display: 'flex', flexDirection: 'column', gap: '8px' }

    function LayoutCard({ cfg, set }) {
      return h('section', { style: sectionStyle, 'aria-label': '布局' },
        h('h3', { style: sectionTitleStyle }, '布局'),
        h('div', { style: rowStyle },
          h(SegmentedRow, {
            id: 'dsh-style-layout-mode',
            label: '模式',
            value: cfg.layout,
            options: LAYOUT_OPTIONS,
            onChange: (value) => set({ layout: value }),
          }),
          h('p', { style: hintStyle }, cfg.layout === 'inset'
            ? '内嵌：把主内容变成柔和底色上的白色圆角卡片，立即生效。'
            : '经典：保持 DeepSeek Harness 原生布局不变。'),
          // 恢复默认：包一层 flex 行，避免被纵向容器拉伸成整行宽；仍是原生 secondary 按钮。
          h('div', { style: { display: 'flex', justifyContent: 'flex-start' } },
            Button
              ? h(Button, { variant: 'secondary', onClick: () => set({ layout: 'classic' }) }, '恢复默认')
              : h('button', { type: 'button', onClick: () => set({ layout: 'classic' }) }, '恢复默认'))))
    }

    function EffectsCard({ cfg, set }) {
      return h('section', { style: sectionStyle, 'aria-label': '效果' },
        h('h3', { style: sectionTitleStyle }, '效果'),
        h(SwitchRow, { label: '启用样式插件', checked: cfg.enabled, onChange: (value) => set({ enabled: value }) }),
        h(SwitchRow, { label: '减少动效', checked: cfg.reduceMotion, onChange: (value) => set({ reduceMotion: value }) }),
        h(SwitchRow, { label: '隐藏滚动条', checked: cfg.hideScrollbars, onChange: (value) => set({ hideScrollbars: value }) }),
        h(SwitchRow, { label: '隐藏会话标签栏（对话/轨迹）', checked: cfg.hideTabs, onChange: (value) => set({ hideTabs: value }) }))
    }

    function SidebarCard({ cfg, set }) {
      return h('section', { style: sectionStyle, 'aria-label': '侧边栏' },
        h('h3', { style: sectionTitleStyle }, '侧边栏'),
        h(SwitchRow, { label: '隐藏品牌', checked: cfg.hideBrand, onChange: (value) => set({ hideBrand: value }) }),
        h(SwitchRow, { label: '隐藏新会话', checked: cfg.hideNewSession, onChange: (value) => set({ hideNewSession: value }) }))
    }

    // 外观细节：这些以前是「常开」的视觉处理，现补成可开关（默认开）。
    function LookDetailCard({ cfg, set }) {
      return h('section', { style: sectionStyle, 'aria-label': '外观细节' },
        h('h3', { style: sectionTitleStyle }, '外观细节'),
        h(SwitchRow, { label: '沉浸式外壳（侧栏与底板连成一片）', checked: cfg.immersive !== false, onChange: (value) => set({ immersive: value }) }),
        h(SwitchRow, { label: '侧栏对齐 / 紧凑（红绿灯基准列、行高内距）', checked: cfg.sidebarCompact !== false, onChange: (value) => set({ sidebarCompact: value }) }),
        h(SwitchRow, { label: '会话卡片（HoverCard）内缩', checked: cfg.hovercardInset !== false, onChange: (value) => set({ hovercardInset: value }) }),
        h(SwitchRow, { label: '会话详情背景：跟随系统（浅色/深色）', checked: cfg.hovercardFollowTheme !== false, onChange: (value) => set({ hovercardFollowTheme: value }) }),
        h(SwitchRow, { label: '页面顶部留白对齐', checked: cfg.pageTopSpacing !== false, onChange: (value) => set({ pageTopSpacing: value }) }),
        h(SwitchRow, { label: '标题栏窗口按钮（折叠 / 后退 / 前进）', checked: cfg.titlebarButtons !== false, onChange: (value) => set({ titlebarButtons: value }) }))
    }

    // 交互：属于「功能」类的行为开关（默认开）。
    function InteractionCard({ cfg, set }) {
      return h('section', { style: sectionStyle, 'aria-label': '交互' },
        h('h3', { style: sectionTitleStyle }, '交互'),
        h(SwitchRow, { label: '会话行时间 / 操作收进「更多」', checked: cfg.workspaceRowCompact !== false, onChange: (value) => set({ workspaceRowCompact: value }) }),
        h(SwitchRow, { label: '「智能体 / 通用」入口改名并归位', checked: cfg.agentEntryMerge !== false, onChange: (value) => set({ agentEntryMerge: value }) }))
    }

    // -------------------------------------------------- 智能体入口（还原原生交互）
    // 不用自绘胶囊切换了：直接把 ds-bot 原生那一行 panellist 显示出来，只做两件事——
    //   1) 改文案：'Halfsignal Bot'（当前在对话面，点它去 bot 页）→「智能体」；
    //      'Halfsignal Chat'（当前在 bot 面，点它回对话）→「通用」。
    //   2) 把它挪到「插件」这一行下面（直接在 DOM 里挪，简单粗暴）。
    // 点击仍走 ds-bot 原生逻辑（切换 surface），底层路由 / 插件注册 / 会话数据都不动。
    function botEntryRow() {
      if (typeof document === 'undefined') return null
      const marked = document.querySelector('[data-dsh-style-botentry]')
      if (marked && marked.isConnected) return marked
      for (const el of Array.from(document.querySelectorAll('[class*="panelRow"]'))) {
        const txt = (el.textContent || '').trim()
        if (/Halfsignal\s+(Bot|Chat)/i.test(txt)) return el
        if (txt === '智能体' || txt === '通用') return el
      }
      return null
    }
    // 这一行的标签是「目标面」：'Halfsignal Chat' = 当前在 bot 面（点它去对话）；'Halfsignal Bot' = 当前在对话面（点它去 bot）。
    function botEntryState(row) {
      if (!row) return null
      const all = (row.getAttribute('aria-label') || '') + ' ' + (row.textContent || '')
      if (/Halfsignal\s+Chat/i.test(all)) return 'chat'
      if (/Halfsignal\s+Bot/i.test(all)) return 'bot'
      if (all.indexOf('通用') >= 0) return 'chat'
      if (all.indexOf('智能体') >= 0) return 'bot'
      return null
    }
    function pluginRowIn(list) {
      if (!list) return null
      for (const el of Array.from(list.querySelectorAll('[class*="panelRow"]'))) {
        const txt = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).trim()
        if (/插件|Plugins/i.test(txt)) return el
      }
      return null
    }
    function styleBotEntry(row) {
      if (!row) return null
      row.setAttribute('data-dsh-style-botentry', '')
      const state = botEntryState(row)
      const label = state === 'chat' ? '通用' : '智能体'
      const title = row.querySelector('[class*="panelTitle"]')
      if (title && (title.textContent || '') !== label) title.textContent = label
      if (row.getAttribute('aria-label') !== label) row.setAttribute('aria-label', label)
      const list = row.closest('[class*="panelList"]')
      const pluginRow = pluginRowIn(list)
      if (list && pluginRow && pluginRow !== row && pluginRow.nextElementSibling !== row) {
        list.insertBefore(row, pluginRow.nextElementSibling)
      }
      return label
    }
    function restoreBotEntry() {
      if (typeof document === 'undefined') return
      for (const el of Array.from(document.querySelectorAll('[data-dsh-style-botentry]'))) {
        const title = el.querySelector('[class*="panelTitle"]')
        const t = ((title && title.textContent) || '').trim()
        const native = t === '通用' ? 'Halfsignal Chat' : t === '智能体' ? 'Halfsignal Bot' : null
        if (title && native && title.textContent !== native) title.textContent = native
        if (native && el.getAttribute('aria-label') !== native) el.setAttribute('aria-label', native)
        el.removeAttribute('data-dsh-style-botentry')
      }
    }

    // 常驻组件：挂在 shell.overlay（list 插槽，始终渲染）。不自绘任何控件，只负责
    // 把原生入口行改名、归位；点击照旧交给 ds-bot。
    function BotEntryBridge() {
      const [cfg, setCfg] = React.useState(store.get())
      React.useEffect(() => store.subscribe(() => setCfg(store.get())), [])
      React.useEffect(() => {
        if (typeof document === 'undefined') return undefined
        let raf = 0
        const sync = () => {
          const current = store.get()
          if (!current.enabled || current.agentEntryMerge === false) { restoreBotEntry(); return }
          const row = botEntryRow()
          if (!row) return
          styleBotEntry(row)
        }
        const schedule = () => {
          if (raf) return
          const run = () => { raf = 0; sync() }
          raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : setTimeout(run, 16)
        }
        sync()
        const observer = new MutationObserver(schedule)
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-sidebar-collapsed'] })
        return () => {
          observer.disconnect()
          if (raf) { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf) }
          restoreBotEntry()
        }
      }, [cfg.enabled, cfg.agentEntryMerge])
      return null
    }

    // -------------------------------------------------- 会话行「更多」菜单里的时间
    // 原生会话行的时间挪进每行的「更多」菜单：注册一项只读的菜单行，显示相对时间。
    function relativeLabel(updatedAt) {
      let unit = 'now'
      let n = 0
      try {
        const r = prim.relativeTime ? prim.relativeTime(updatedAt, Date.now()) : null
        if (r) { unit = r.unit; n = r.n }
      } catch (e) {}
      const map = { minutes: '分钟', hours: '小时', days: '天', months: '个月', years: '年' }
      return unit === 'now' ? '刚刚' : (n + (map[unit] || '') + '前')
    }
    function SessionTimeMenuItem(props) {
      const useSessions = props.useSessions
      const useMenuOpenState = props.useMenuOpenState
      const updatedAt = (typeof useSessions === 'function')
        ? useSessions((list) => {
          const row = list && list.byId ? list.byId[props.sessionId] : null
          return (row && row.updatedAt) || 0
        })
        : 0
      if (store.get().workspaceRowCompact === false) return null
      if (!updatedAt) return null
      const MB = prim.MenuItemButton
      if (!MB) return null
      const Icon = prim.IconClockOutlineRegular
      const close = () => { try { const pair = useMenuOpenState && useMenuOpenState(); if (pair && typeof pair[1] === 'function') pair[1](false) } catch (e) {} }
      return h(MB, { icon: Icon ? h(Icon, { size: 14 }) : null, onSelect: close }, '更新于 ' + relativeLabel(updatedAt))
    }

    const SECTION_TOGGLES = [
      ['team', '团队成员'],
      ['progress', '执行进度'],
      ['subagents', '子智能体'],
      ['tools', 'Skills 与 MCP'],
      ['jobs', '后台任务'],
      ['artifacts', '文件产出'],
      ['web', '网页查阅'],
    ]
    function TaskMonitorCard({ cfg, set }) {
      const always = cfg.monitorAlwaysShow || {}
      return h('section', { style: sectionStyle, 'aria-label': '任务监控' },
        h('h3', { style: sectionTitleStyle }, '任务监控'),
        h(SwitchRow, { label: '启用任务监控', checked: Boolean(cfg.monitorEnabled), onChange: (value) => set({ monitorEnabled: value }) }),
        h('p', { style: hintStyle }, '开启后会在右上角工具栏出现「任务监控」按钮，实时查看当前会话的执行过程。默认关闭，独立于布局与模式切换。'),
        cfg.monitorEnabled
          ? h('div', { style: rowStyle },
            h(SegmentedRow, {
              id: 'dsh-style-monitor-mode',
              label: '展示方式',
              value: cfg.monitorMode,
              options: [{ value: 'floating', label: '悬浮' }, { value: 'pinned', label: '固定' }],
              onChange: (value) => set({ monitorMode: value }),
            }),
            h('p', { style: hintStyle }, cfg.monitorMode === 'pinned'
              ? '固定：面板常驻，点外部不会关闭；点工具栏按钮或面板上的图钉可收起。'
              : '悬浮：点面板外部自动收起。'),
            h('p', { style: hintStyle }, '默认自动隐藏没有数据的分组；下面可指定"始终显示"某些分组。'),
            h('div', { style: { display: 'flex', flexDirection: 'column' } },
              SECTION_TOGGLES.map(([key, label]) => h(SwitchRow, {
                key,
                label: '始终显示：' + label,
                checked: Boolean(always[key]),
                onChange: (value) => set({ monitorAlwaysShow: { ...always, [key]: value } }),
              }))))
          : null)
    }

    // ------------------------------------------------------- Qoder 首页 · 热力图
    // 数据来源：ctx.sessions.list（客户端 Cordis service，与侧栏同一份快照）。
    // 口径：每个会话按 updatedAt（最近一次活动）落到本地日期上计数；blank 会话与
    // 子智能体会话不计入。不是逐日事件史——卡片会显式标注这一点。
    const QODER_LEVELS = [1, 3, 6, 10]

    function qoderDayKey(date) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return y + '-' + m + '-' + d
    }

    function qoderLevelOf(value, thresholds) {
      if (!(value > 0)) return 0
      let level = 1
      for (let i = 0; i < thresholds.length; i += 1) if (value >= thresholds[i]) level = i + 1
      return Math.min(4, level)
    }

    // 演示数据：确定性哈希，供版式评审用（可在「外观 → Qoder 首页」关闭）。
    function qoderDemoValue(key) {
      let h = 2166136261
      for (let i = 0; i < key.length; i += 1) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) }
      const n = (h >>> 0) % 100
      if (n < 54) return 0
      if (n < 78) return 1
      if (n < 92) return 2
      return 3
    }

    function qoderBuildModel(list, mode, demo) {
      const columns = 53
      const today = new Date()
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const endWeekStart = new Date(end)
      endWeekStart.setDate(end.getDate() - end.getDay())
      const start = new Date(endWeekStart)
      start.setDate(start.getDate() - (columns - 1) * 7)

      const byDay = new Map()
      let rows = 0
      if (list && list.byId) {
        for (const id of Object.keys(list.byId)) {
          const row = list.byId[id]
          if (!row || row.blank === true) continue
          if (row.origin === 'subagent' || row.parentId !== undefined) continue
          const at = Number(row.updatedAt) || 0
          if (at <= 0) continue
          rows += 1
          const key = qoderDayKey(new Date(at))
          const entry = byDay.get(key) || { sessions: 0, workspaces: [] }
          entry.sessions += 1
          if (typeof row.cwd === 'string' && row.cwd !== '' && entry.workspaces.indexOf(row.cwd) === -1) entry.workspaces.push(row.cwd)
          byDay.set(key, entry)
        }
      }

      if (demo) {
        // 「8 月之后」起随机填充：约一半的日子有 1~3 个，形成三种深浅
        const demoStart = new Date(end.getFullYear(), 7, 1)
        const cursor = new Date(demoStart)
        while (cursor.getTime() <= end.getTime()) {
          const key = qoderDayKey(cursor)
          if (!byDay.has(key)) {
            const value = qoderDemoValue(key)
            if (value > 0) {
              const workspaces = []
              for (let i = 0; i < value; i += 1) workspaces.push('demo:' + i)
              byDay.set(key, { sessions: value, workspaces })
            }
          }
          cursor.setDate(cursor.getDate() + 1)
        }
      }

      const valueOf = (entry) => (mode === 'workspaces' ? entry.workspaces.length : entry.sessions)
      const weeks = []
      const months = []
      let total = 0
      let peak = 0
      for (let c = 0; c < columns; c += 1) {
        const week = []
        for (let r = 0; r < 7; r += 1) {
          const day = new Date(start)
          day.setDate(start.getDate() + c * 7 + r)
          const entry = byDay.get(qoderDayKey(day))
          const value = entry ? valueOf(entry) : 0
          const future = day.getTime() > end.getTime()
          if (!future) {
            total += value
            if (value > peak) peak = value
          }
          week.push({ date: day, value, future })
        }
        weeks.push(week)
        const firstOfMonth = week.find((cell) => cell.date.getDate() === 1)
        if (firstOfMonth && !firstOfMonth.future) months.push({ column: c, label: (firstOfMonth.date.getMonth() + 1) + '月' })
      }
      return { columns, weeks, months, total, peak, rows }
    }

    function QoderActivityCard(props) {
      const useSessions = props.useSessions
      const sessionId = props.sessionId
      const [settings, setSettings] = React.useState(store.get)
      const [mode, setMode] = React.useState('sessions')
      const [tip, setTip] = React.useState(null)
      React.useEffect(() => store.subscribe(() => setSettings(store.get())), [])
      const list = typeof useSessions === 'function' ? useSessions((value) => value) : undefined
      // 只在「空白会话」= hero 相位显示；进入正常对话后本组件返回 null，不占位。
      const blank = typeof useSessions === 'function'
        ? useSessions((value) => Boolean(value && value.byId && sessionId !== void 0 && value.byId[sessionId] && value.byId[sessionId].blank === true))
        : false
      const demo = settings.homeDemoData !== false
      const model = React.useMemo(() => qoderBuildModel(list, mode, demo), [list, mode, demo])
      if (!settings.enabled || settings.homeHeatmap === false || !blank) return null

      const thresholds = model.peak <= 4 ? [1, 2, 3, 4] : QODER_LEVELS
      const unit = mode === 'workspaces' ? '个工作区' : '个会话'
      const cells = []
      for (let r = 0; r < 7; r += 1) {
        for (let c = 0; c < model.columns; c += 1) {
          const cell = model.weeks[c][r]
          const level = qoderLevelOf(cell.value, thresholds)
          const label = qoderDayKey(cell.date) + ' · ' + cell.value + unit
          cells.push(h('div', {
            key: label + '-' + r + '-' + c,
            className: 'dsh-qcell',
            'data-level': String(level),
            'data-out': cell.future ? '1' : undefined,
            'aria-label': label,
            onMouseEnter: cell.future ? undefined : (event) => setTip({ x: event.clientX, y: event.clientY, text: label }),
            onMouseMove: cell.future ? undefined : (event) => setTip({ x: event.clientX, y: event.clientY, text: label }),
            onMouseLeave: cell.future ? undefined : () => setTip(null),
          }))
        }
      }
      const monthCells = []
      for (let c = 0; c < model.columns; c += 1) {
        const found = model.months.find((item) => item.column === c)
        monthCells.push(h('span', { key: 'm' + c, style: { gridColumn: String(c + 1) } }, found ? found.label : ''))
      }
      const portal = typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined'
      const tipNode = tip && portal ? ReactDOM.createPortal(
        h('div', { className: 'dsh-qtip', style: { left: tip.x + 12 + 'px', top: tip.y - 34 + 'px' } }, tip.text),
        document.body,
      ) : null

      return h('section', {
        className: 'dsh-qcard',
        'aria-label': '活跃度',
        title: '按会话「最近活动日」（updatedAt）统计，非逐日事件史',
      },
        h('div', { className: 'dsh-qcard-head' },
          h('button', { className: 'dsh-qtab', type: 'button', 'data-active': String(mode === 'sessions'), onClick: () => setMode('sessions') }, '会话'),
          h('button', { className: 'dsh-qtab', type: 'button', 'data-active': String(mode === 'workspaces'), onClick: () => setMode('workspaces') }, '工作区'),
          h('span', { className: 'dsh-qsum' }, demo ? '演示数据 · 非真实统计' : (model.total > 0 ? '共 ' + model.total + ' · 按最近活动日' : '按最近活动日'))),
        h('div', { className: 'dsh-qgrid' }, cells),
        h('div', { className: 'dsh-qmonths' }, monthCells),
        model.total === 0 ? h('p', { className: 'dsh-qempty' }, '还没有可以统计的会话。') : null,
        tipNode,
      )
    }

    // ------------------------------------------------- 首页打标（稳定锚点 → 自己的属性）
    const QODER_TAGS = ['stack', 'headline', 'previewbadge', 'sentence', 'ws', 'mode', 'modeWrap', 'options', 'input']

    function tagQoderHome() {
      if (typeof document === 'undefined') return
      const enabled = document.documentElement.getAttribute('data-dsh-style-qoderhome') === 'true'
      const scope = enabled ? document.querySelector('[data-phase="hero"]') : null
      const wanted = []
      const want = (el, name) => {
        if (!el) return
        wanted.push(el)
        if (el.getAttribute('data-dsh-qoder') !== name) el.setAttribute('data-dsh-qoder', name)
      }
      if (scope) {
        const stack = scope.querySelector('[class*="composerStack"]')
        const sentence = scope.querySelector('[class*="heroWorkspaceRow"]')
        const headline = scope.querySelector('[class*="headline"]')
        const brandSlot = scope.querySelector('[data-slot="conversation.hero.brand.mark"]')
        want(stack, 'stack')
        want(headline || (brandSlot && brandSlot.parentElement), 'headline')
        want(scope.querySelector('[class*="previewBadge"]'), 'previewbadge')
        want(sentence, 'sentence')
        if (sentence) {
          want(sentence.querySelector(':scope > button'), 'ws')
          want(sentence.querySelector('[data-slot="conversation.hero.agentPreset"] button'), 'mode')
          want(sentence.querySelector('[data-slot="conversation.hero.agentPreset"] > *'), 'modeWrap')
          want(sentence.querySelector('[data-slot="conversation.hero.options"]'), 'options')
        }
        if (stack) want(stack.querySelector('[data-slot="conversation.composer.bar"] > *'), 'input')
      }
      for (const el of Array.from(document.querySelectorAll('[data-dsh-qoder]'))) {
        if (wanted.indexOf(el) === -1) el.removeAttribute('data-dsh-qoder')
      }
      void QODER_TAGS
    }

    function QoderHomeCard({ cfg, set }) {
      return h('section', { style: sectionStyle, 'aria-label': 'Qoder 首页' },
        h('h3', { style: sectionTitleStyle }, 'Qoder 首页'),
        h(SwitchRow, { label: '首页上下分离布局 + 动态欢迎语', checked: cfg.qoderHome !== false, onChange: (value) => set({ qoderHome: value }) }),
        h(SwitchRow, { label: '首页活跃度热力图', checked: cfg.homeHeatmap !== false, onChange: (value) => set({ homeHeatmap: value }) }),
        h(SwitchRow, { label: '热力图演示数据（随机填充，非真实统计）', checked: cfg.homeDemoData !== false, onChange: (value) => set({ homeDemoData: value }) }),
        h('p', { style: hintStyle }, '只作用于新建会话首页（hero 相位）：欢迎区与热力图在上、输入框在下，进入正常对话后自动失效。热力图读真实会话数据，按每个会话的「最近活动日」（updatedAt）计数，不是逐日事件史。'))
    }

    function AppearanceSection() {
      const [cfg, setCfg] = React.useState(store.get)
      React.useEffect(() => store.subscribe(() => setCfg(store.get())), [])
      return h('div', { style: pageStyle },
        h('div', null,
          h('h2', { style: headingStyle }, '外观'),
          h('p', { style: introStyle }, '自定义 DeepSeek Harness 客户端的外观与行为。修改会立即生效，并保存在本机。')),
        // ── 外观 ──
        h(LayoutCard, { cfg, set: store.set }),
        h(EffectsCard, { cfg, set: store.set }),
        h(SidebarCard, { cfg, set: store.set }),
        h(LookDetailCard, { cfg, set: store.set }),
        h(QoderHomeCard, { cfg, set: store.set }),
        // ── 功能 ──
        h('div', { style: { paddingTop: '16px', borderTop: '0.5px solid var(--dsw-alias-border-l2, rgba(128,128,128,.2))' } },
          h('h2', { style: headingStyle }, '功能')),
        h(TaskMonitorCard, { cfg, set: store.set }),
        h(InteractionCard, { cfg, set: store.set }))
    }

    // -------------------------------------------------- 任务监控（Task Monitor）
    // 只读真实数据：会话时间线的工具调用 + ctx.jobs。默认关闭；启用后注册右上角按钮与浮层。
    const monitorUi = (() => {
      let state = { open: false, sessionId: null }
      const listeners = new Set()
      return {
        get: () => state,
        set: (patch) => { state = { ...state, ...patch }; for (const listener of listeners) listener() },
        subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
      }
    })()

    function monitorStatusLabel(status) {
      return { pending: '等待', running: '进行中', done: '已完成', error: '失败', cancelled: '已取消', inactive: '未运行', provisioning: '准备中', active: '运行中', failed: '失败' }[status] || status || ''
    }
    function normalizeTodoStatus(value) {
      if (value === 'completed' || value === 'done') return 'done'
      if (value === 'in_progress' || value === 'running') return 'running'
      if (value === 'cancelled' || value === 'canceled') return 'cancelled'
      return 'pending'
    }
    function jobDotStatus(status) {
      if (status === 'running' || status === 'stopping') return 'running'
      if (status === 'failed' || status === 'error' || status === 'killed') return 'error'
      return 'done'
    }
    function hostOf(url) {
      try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
    }
    function parseCallArgs(call) {
      try {
        const parsed = JSON.parse(call.argsRaw || '')
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
      } catch { return {} }
    }
    function callStatus(call) {
      if (call.kind === 'tool-result') return call.isError ? 'error' : 'done'
      return 'running'
    }
    // 深度遍历 chat 快照，按结构特征收集工具调用节点（对嵌套细节容错），按 callId 合并 call/result。
    function collectToolCalls(snapshot) {
      const found = new Map()
      const seen = new Set()
      const visit = (value, depth) => {
        if (value === null || typeof value !== 'object' || depth > 10) return
        if (seen.has(value)) return
        seen.add(value)
        if (typeof Map !== 'undefined' && value instanceof Map) { for (const child of value.values()) visit(child, depth + 1); return }
        if (Array.isArray(value)) { for (const child of value) visit(child, depth + 1); return }
        const looksLikeCall = typeof value.name === 'string' && (
          value.argsRaw !== undefined || value.content !== undefined || value.kind === 'tool-call' || value.kind === 'tool-result'
        )
        if (looksLikeCall) {
          const id = String(value.callId || value.id || value.key || '')
          if (id) found.set(id, { ...(found.get(id) || {}), ...value })
        }
        for (const key of Object.keys(value)) {
          if (key === 'parent' || key === 'ctx' || key === 'store' || key === 'state') continue
          visit(value[key], depth + 1)
        }
      }
      visit(snapshot, 0)
      return Array.from(found.values())
    }
    function buildMonitorData(ctx, sessionId) {
      const data = { progress: [], subagents: [], tools: [], jobs: [], artifacts: [], web: [], team: [] }
      if (!ctx) return data
      try {
        const sessions = ctx.get('sessions')
        const uiConversation = ctx.get('uiConversation')
        const binding = sessions && sessions.binding ? sessions.binding(sessionId) : undefined
        const conversation = binding !== undefined && uiConversation && uiConversation.binding ? uiConversation.binding(binding) : undefined
        const chat = conversation && conversation.target ? conversation.target('chat').getSnapshot() : undefined
        const calls = collectToolCalls(chat)
        const aggregate = new Map()
        for (const call of calls) {
          const name = String(call.name || '')
          if (!name) continue
          const status = callStatus(call)
          const args = parseCallArgs(call)
          if (name === 'todo_write' || name === 'todo') {
            const todos = Array.isArray(args.todos) ? args.todos : []
            for (const item of todos) {
              const title = String(item.content || item.text || item.title || '').trim()
              if (title) data.progress.push({ title: title.slice(0, 120), status: normalizeTodoStatus(item.status) })
            }
          } else if (/^subagent/i.test(name)) {
            const title = String(args.task || args.prompt || args.description || '').trim()
            data.subagents.push({ name, title: title.slice(0, 120), status })
          } else if (name === 'web_search' || name === 'web_fetch') {
            const urls = new Set()
            if (typeof args.url === 'string' && args.url) urls.add(args.url)
            const text = typeof call.content === 'string' ? call.content : (call.content ? JSON.stringify(call.content) : '')
            for (const match of (text.match(/https?:\/\/[^\s"'<>)]+/g) || []).slice(0, 6)) urls.add(match)
            for (const url of urls) data.web.push({ url, status })
          } else if (name === 'write' || name === 'edit') {
            const file = args.file_path || args.path || args.filename
            if (typeof file === 'string' && file) data.artifacts.push({ path: file, kind: name === 'write' ? 'created' : 'modified', status })
          }
          const category = name === 'skill' ? 'skill' : (/mcp/i.test(name) ? 'mcp' : 'builtin')
          const previous = aggregate.get(name) || { name, category, count: 0, status: 'done' }
          previous.count += 1
          if (status === 'running') previous.status = 'running'
          else if (status === 'error' && previous.status !== 'running') previous.status = 'error'
          aggregate.set(name, previous)
        }
        data.tools = Array.from(aggregate.values())
      } catch { /* 降级为空 */ }
      try {
        const jobs = ctx.get('jobs')
        const snapshot = jobs && jobs.getSnapshot ? jobs.getSnapshot() : undefined
        const rows = snapshot && snapshot.rows ? (snapshot.rows[sessionId] || snapshot.rows[String(sessionId)]) : undefined
        if (Array.isArray(rows)) data.jobs = rows
      } catch { /* 降级为空 */ }
      // 智能体团队成员：读 sessions 投影里的 agentTeam（与头部「智能体团队」同一数据源）。
      try {
        const sessions = ctx.get('sessions')
        const snap = sessions && (typeof sessions.getSnapshot === 'function' ? sessions.getSnapshot() : (sessions.state || sessions.snapshot))
        const proj = snap && snap.projectionsBySession
        if (proj) {
          const byId = snap.byId || {}
          let entry = proj[sessionId] || proj[String(sessionId)]
          let team = entry && entry.values && entry.values.agentTeam
          if (!team) {
            for (const key of Object.keys(proj)) {
              const t2 = proj[key] && proj[key].values && proj[key].values.agentTeam
              if (t2 && Array.isArray(t2.members)) { team = t2; break }
            }
          }
          if (team && Array.isArray(team.members)) {
            data.team = team.members.map((m) => {
              const running = byId[m.id] && byId[m.id].running
              const status = m.phase === 'active' ? (running === true ? 'running' : 'inactive') : (m.phase || 'inactive')
              return { name: m.name || m.id || '(成员)', status, current: Boolean(m.id === sessionId) }
            })
          }
        }
      } catch { /* 降级为空 */ }
      return data
    }

    function MonitorButton({ sessionId }) {
      const [open, setOpen] = React.useState(monitorUi.get().open && monitorUi.get().sessionId === sessionId)
      const [enabled, setEnabled] = React.useState(store.get().monitorEnabled)
      const buttonRef = React.useRef(null)
      React.useEffect(() => monitorUi.subscribe(() => setOpen(monitorUi.get().open && monitorUi.get().sessionId === sessionId)), [sessionId])
      React.useEffect(() => store.subscribe(() => setEnabled(store.get().monitorEnabled)), [])
      if (!enabled) return null
      return h('button', {
        ref: buttonRef,
        type: 'button',
        className: 'dsh-style-monitor-btn',
        'data-active': open || undefined,
        'aria-pressed': open,
        'aria-label': '打开任务监控',
        title: '打开任务监控',
        onClick: () => {
          const current = monitorUi.get()
          if (current.open && current.sessionId === sessionId) { monitorUi.set({ open: false }); return }
          const el = buttonRef.current
          let anchor = null
          if (el && typeof el.getBoundingClientRect === 'function' && typeof window !== 'undefined') {
            const rect = el.getBoundingClientRect()
            anchor = { top: rect.bottom, right: (window.innerWidth || 0) - rect.right }
          }
          monitorUi.set({ open: true, sessionId, anchor, buttonEl: el })
        },
      }, IconChecklist ? h(IconChecklist, { size: 16 }) : '☑')
    }

    function aggregateArtifacts(list) {
      const result = []
      for (const item of list || []) {
        const last = result[result.length - 1]
        if (last && last.path === item.path) { last.count += 1; last.kind = item.kind; last.status = item.status }
        else result.push({ ...item, count: 1 })
      }
      return result
    }
    function fileParts(path) {
      const parts = String(path || '').split(/[\\/]/).filter(Boolean)
      return { name: parts[parts.length - 1] || String(path || ''), dir: parts.slice(0, -1).join('/') }
    }

    function TaskMonitorPanel({ cfg, data, onClose, monitorMode, onTogglePin, panelRef, panelStyle }) {
      const always = cfg.monitorAlwaysShow || {}
      const [collapsed, setCollapsed] = React.useState({})
      const [showAllFiles, setShowAllFiles] = React.useState(false)
      const toggle = (key) => setCollapsed((previous) => ({ ...previous, [key]: !previous[key] }))
      const statusRow = (key, status, name, sub, meta) => h('div', { className: 'dsh-style-monitor-row', key },
        h('span', { className: 'dsh-style-monitor-dot', 'data-s': status }),
        h('div', { className: 'dsh-style-monitor-main' },
          h('span', { className: 'dsh-style-monitor-row-name', title: name }, name),
          sub ? h('span', { className: 'dsh-style-monitor-sub', title: sub }, sub) : null),
        meta ? h('span', { className: 'dsh-style-monitor-meta' }, meta) : null)
      const files = aggregateArtifacts(data.artifacts)
      const shownFiles = showAllFiles ? files : files.slice(0, 5)
      const groups = [
        { key: 'team', title: '团队成员', has: data.team.length > 0,
          body: () => (data.team.length === 0 ? h('p', { className: 'dsh-style-monitor-empty' }, '暂无团队成员')
            : data.team.map((item, index) => statusRow(index, item.status, item.name + (item.current ? '（当前会话）' : ''), null, monitorStatusLabel(item.status)))) },
        { key: 'progress', title: '执行进度', has: data.progress.length > 0,
          body: () => (data.progress.length === 0 ? h('p', { className: 'dsh-style-monitor-empty' }, '暂无任务计划')
            : data.progress.map((item, index) => statusRow(index, item.status, item.title || '(未命名)', null, monitorStatusLabel(item.status)))) },
        { key: 'subagents', title: '子智能体', has: data.subagents.length > 0,
          body: () => (data.subagents.length === 0 ? h('p', { className: 'dsh-style-monitor-empty' }, '暂无子智能体')
            : data.subagents.map((item, index) => statusRow(index, item.status, item.title || item.name, item.name, monitorStatusLabel(item.status)))) },
        { key: 'tools', title: '工具与技能', has: data.tools.length > 0,
          body: () => (data.tools.length === 0 ? h('p', { className: 'dsh-style-monitor-empty' }, '暂无工具调用')
            : data.tools.map((item, index) => statusRow(index, item.status, item.name, item.category === 'skill' ? 'Skills' : item.category === 'mcp' ? 'MCP' : '内置工具', item.count + ' 次 · ' + monitorStatusLabel(item.status)))) },
        { key: 'jobs', title: '后台任务', has: data.jobs.length > 0,
          body: () => (data.jobs.length === 0 ? h('p', { className: 'dsh-style-monitor-empty' }, '暂无后台任务')
            : data.jobs.map((job, index) => statusRow(index, jobDotStatus(job.status), job.title || job.id || '(任务)', null, monitorStatusLabel(jobDotStatus(job.status))))) },
        { key: 'artifacts', title: '文件产出', has: data.artifacts.length > 0,
          body: () => {
            if (files.length === 0) return h('p', { className: 'dsh-style-monitor-empty' }, '暂无文件产出')
            return h('div', null,
              shownFiles.map((item, index) => {
                const parts = fileParts(item.path)
                return h('div', { className: 'dsh-style-monitor-row', key: index, title: item.path },
                  h('span', { className: 'dsh-style-monitor-dot', 'data-s': item.status }),
                  h('div', { className: 'dsh-style-monitor-main' },
                    h('span', { className: 'dsh-style-monitor-row-name' }, parts.name),
                    parts.dir ? h('span', { className: 'dsh-style-monitor-sub' }, parts.dir) : null),
                  h('span', { className: 'dsh-style-monitor-meta' }, (item.kind === 'created' ? '新建' : '修改') + (item.count > 1 ? ' ×' + item.count : '')))
              }),
              files.length > 5 ? h('button', { type: 'button', className: 'dsh-style-monitor-more', onClick: () => setShowAllFiles((value) => !value) }, showAllFiles ? '收起' : '查看更多 (' + (files.length - 5) + ')') : null)
          } },
        { key: 'web', title: '网页查阅', has: data.web.length > 0,
          body: () => (data.web.length === 0 ? h('p', { className: 'dsh-style-monitor-empty' }, '暂无网页查阅')
            : data.web.map((item, index) => h('div', { className: 'dsh-style-monitor-row', key: index },
              h('span', { className: 'dsh-style-monitor-dot', 'data-s': item.status }),
              h('a', { className: 'dsh-style-monitor-link', href: item.url, target: '_blank', rel: 'noreferrer', title: item.url }, hostOf(item.url))))) },
      ]
      const visible = groups.filter((group) => group.has || always[group.key] === true)
      return h('div', { ref: panelRef, className: 'dsh-style-monitor-panel', role: 'dialog', 'aria-label': '任务监控', style: panelStyle },
        h('div', { className: 'dsh-style-monitor-head' },
          h('span', { className: 'dsh-style-monitor-title' }, '任务监控'),
          h('div', { className: 'dsh-style-monitor-headbtns' },
            h('button', {
              type: 'button',
              className: 'dsh-style-monitor-headbtn',
              'data-pinned': monitorMode === 'pinned' || undefined,
              title: monitorMode === 'pinned' ? '取消固定' : '固定面板',
              'aria-label': monitorMode === 'pinned' ? '取消固定' : '固定面板',
              'aria-pressed': monitorMode === 'pinned',
              onClick: onTogglePin,
            }, h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none' },
              h('path', {
                d: 'M10.1 1.9l4 4-1 .9-.9-.3-2 2 .4 2.3-1.1 1.1-2.5-2.5-3.3 3.3-.9-.9 3.3-3.3L3.6 6l1.1-1.1 2.3.4 2-2-.3-.9.9-1z',
                fill: 'currentColor', stroke: 'currentColor', strokeWidth: 0.5, strokeLinejoin: 'round',
              }))))),
        h('div', { className: 'dsh-style-monitor-body' },
          visible.length === 0
            ? h('div', { className: 'dsh-style-monitor-empty-all' },
              h('span', null, '暂无监控数据'),
              h('span', { style: { fontSize: '11.5px', opacity: 0.8 } }, '当前会话还没有可追踪的任务事件'))
            : visible.map((group) => h('div', { key: group.key, className: 'dsh-style-monitor-sec', 'data-collapsed': collapsed[group.key] || undefined },
              h('div', {
                className: 'dsh-style-monitor-sec-head',
                role: 'button',
                tabIndex: 0,
                'aria-expanded': !collapsed[group.key],
                onClick: () => toggle(group.key),
                onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(group.key) } },
              },
              h('h4', { className: 'dsh-style-monitor-sec-title' }, group.title),
              h('span', { className: 'dsh-style-monitor-chev' }, IconChevronDown ? h(IconChevronDown, { size: 12 }) : null)),
              collapsed[group.key] ? null : group.body()))))
    }

    function MonitorHost() {
      const [ui, setUi] = React.useState(monitorUi.get())
      const [cfg, setCfg] = React.useState(store.get)
      const [data, setData] = React.useState({ progress: [], subagents: [], tools: [], jobs: [], artifacts: [], web: [], team: [] })
      const panelRef = React.useRef(null)
      React.useEffect(() => monitorUi.subscribe(() => setUi(monitorUi.get())), [])
      React.useEffect(() => store.subscribe(() => setCfg(store.get())), [])
      const sessionId = ui.sessionId
      // 关闭开关时收起面板
      React.useEffect(() => {
        if (!cfg.monitorEnabled && monitorUi.get().open) monitorUi.set({ open: false })
      }, [cfg.monitorEnabled])
      // 点击外部关闭 + 窗口缩放重新锚定到按钮下方
      React.useEffect(() => {
        if (!ui.open || typeof document === 'undefined') return undefined
        const onPointerDown = (event) => {
          if (store.get().monitorMode === 'pinned') return
          const panel = panelRef.current
          const button = monitorUi.get().buttonEl
          const target = event.target
          if (panel && panel.contains(target)) return
          if (button && (button === target || (button.contains && button.contains(target)))) return
          monitorUi.set({ open: false })
        }
        const onResize = () => {
          const button = monitorUi.get().buttonEl
          if (button && typeof button.getBoundingClientRect === 'function' && typeof window !== 'undefined') {
            const rect = button.getBoundingClientRect()
            monitorUi.set({ anchor: { top: rect.bottom, right: (window.innerWidth || 0) - rect.right } })
          }
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        window.addEventListener('resize', onResize)
        return () => { document.removeEventListener('pointerdown', onPointerDown, true); window.removeEventListener('resize', onResize) }
      }, [ui.open])
      React.useEffect(() => {
        if (!ui.open || !cfg.monitorEnabled || !sessionId || typeof document === 'undefined') return undefined
        let raf = 0
        let lastKey = ''
        const refresh = () => {
          const next = buildMonitorData(appCtx, sessionId)
          const key = JSON.stringify(next)
          if (key !== lastKey) { lastKey = key; setData(next) }
        }
        const schedule = () => {
          if (raf) return
          raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => { raf = 0; refresh() }) : setTimeout(() => { raf = 0; refresh() }, 60)
        }
        refresh()
        let offChat = () => {}
        let offOpen = () => {}
        let offJobs = () => {}
        try {
          const sessions = appCtx.get('sessions')
          const uiConversation = appCtx.get('uiConversation')
          const binding = sessions.binding(sessionId)
          const conversation = uiConversation.binding(binding)
          offChat = conversation.target('chat').subscribe(schedule)
          offOpen = conversation.openTurn.subscribe(schedule)
        } catch { /* 订阅失败则仅定时刷新 */ }
        try {
          const jobs = appCtx.get('jobs')
          if (jobs && typeof jobs.subscribe === 'function') offJobs = jobs.subscribe(schedule)
        } catch { /* ignore */ }
        const timer = setInterval(refresh, 1500)
        return () => {
          offChat(); offOpen(); offJobs(); clearInterval(timer)
          if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf)
        }
      }, [ui.open, cfg.monitorEnabled, sessionId])
      if (!ui.open || !cfg.monitorEnabled || !sessionId || typeof document === 'undefined' || !createPortal) return null
      const anchor = ui.anchor
      const panelStyle = anchor
        ? { top: Math.round(Math.max(8, anchor.top + 8)) + 'px', right: Math.round(Math.max(8, anchor.right)) + 'px' }
        : { top: '56px', right: '24px' }
      return createPortal(h(TaskMonitorPanel, {
        cfg,
        data,
        monitorMode: cfg.monitorMode,
        onTogglePin: () => store.set({ monitorMode: store.get().monitorMode === 'pinned' ? 'floating' : 'pinned' }),
        onClose: () => monitorUi.set({ open: false }),
        panelRef,
        panelStyle,
      }), document.body)
    }

    // ============================================================ 插件别名
    // 通过插件「稳定 ID」（组合包的包名，如 dsh-context-awareness）建立别名映射，
    // 保存在 localStorage 的 dsh-style:pluginAliases 中。别名只改变展示标题，
    // 不触碰插件 manifest / package.json / 插件 ID / 安装目录，也不影响启停、更新、卸载。
    //
    // 未安装同名的其他插件不会错误继承别名：映射键是完整包名（唯一稳定 ID），
    // 不同包名即使显示文案相同也不会命中。
    const ALIAS_KEY = 'dsh-style:pluginAliases'

    function readAliases() {
      try {
        const raw = JSON.parse(localStorage.getItem(ALIAS_KEY) || '{}')
        const out = {}
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          for (const key of Object.keys(raw)) {
            const value = raw[key]
            if (typeof value === 'string' && value.trim()) out[key] = value
          }
        }
        return out
      } catch {
        return {}
      }
    }

    const aliasStore = (() => {
      let state = readAliases()
      const listeners = new Set()
      const commit = (next) => {
        if (JSON.stringify(next) === JSON.stringify(state)) return false
        state = next
        try {
          localStorage.setItem(ALIAS_KEY, JSON.stringify(next))
        } catch {
          /* 存储不可用 */
        }
        for (const listener of listeners) listener()
        applyAliasDom()
        return true
      }
      return {
        get: () => state,
        getAlias: (id) => state[id] || '',
        set: (id, value) => {
          const trimmed = String(value == null ? '' : value).trim()
          const next = { ...state }
          if (trimmed) next[id] = trimmed
          else delete next[id]
          return commit(next)
        },
        remove: (id) => {
          if (!(id in state)) return false
          const next = { ...state }
          delete next[id]
          return commit(next)
        },
        subscribe: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    })()

    // 别名相关样式（独立 style 标签，不受「启用样式插件」开关影响）。
    //
    // 说明：这里不是「新造视觉规范」，而是把 DSH 原生设置页里同一元素的样式规则
    // 用同一套设计 Token 复刻过来（等价样式引用）：
    //  - .dsh-style-native-button  ← 与紧邻「卸载」按钮相同的 primitives.Button（outline + sm）基础尺寸
    //  - .dsh-style-native-input   ← 设置→模型 各输入框的 input 规则
    // 详情页标题不做额外样式：直接把原 detailTitle 文本替换为别名，继承原标题字号字重。
    const ALIAS_CSS = [
      // 页头「编辑别名」按钮：直接沿用紧邻「卸载」按钮的原生尺寸规则
      // （primitives.Button variant="outline" size="sm" = _button + _sm + _outline）。
      // 「卸载」的 danger 类只覆盖了 color / border-color / hover 背景色，这三项此处保持中性，
      // 其余 font / padding / height / radius / border-width 与「卸载」完全一致。
      '.dsh-style-native-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);height:28px;padding:0 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);background:transparent;cursor:pointer;}',
      '.dsh-style-native-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);}',
      '.dsh-style-native-button:disabled{cursor:not-allowed;opacity:.4;}',
      // DSH 原生设置输入框（设置 → 模型）
      '.dsh-style-native-input{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);width:100%;height:32px;font:inherit;background:var(--dsw-specific-input-major,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);padding:0 10px;font-size:14px;line-height:22px;}',
      '.dsh-style-native-input::placeholder{color:var(--dsw-alias-label-dimmed);}',
      '.dsh-style-native-input:focus{border-color:var(--dsw-alias-state-business-primary);outline:none;}',
      // 原生 Modal 弹窗宽度（对齐设置页弹窗 width:min(480px,100%)）
      '.dsh-style-alias-dialog{width:min(480px,100%);}',
      // 仅在原生 Modal 原语缺失时的兜底弹窗（正常走原生 Modal，不会用到）
      '.dsh-style-alias-overlay{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-modal,rgba(0,0,0,.32));}',
      '.dsh-style-alias-card{width:min(440px,calc(100vw - 48px));border-radius:var(--dsw-radius-xl,14px);background:var(--dsw-alias-bg-base,#fff);box-shadow:var(--dsw-alias-shadow-modal,0 16px 44px rgba(0,0,0,.32));border:0.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));padding:20px;}',
      '.dsh-style-alias-title{margin:0 0 12px;font-size:16px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary,inherit);}',
      '.dsh-style-alias-desc{margin:0 0 16px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,inherit);}',
      '.dsh-style-alias-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:20px;}',
    ].join('')

    function ensureAliasStyle() {
      if (typeof document === 'undefined') return
      let el = document.querySelector('style[data-plugin="dsh-style-alias"]')
      if (!el) {
        el = document.createElement('style')
        el.setAttribute('data-plugin', 'dsh-style-alias')
        document.head.appendChild(el)
      }
      if (el.textContent !== ALIAS_CSS) el.textContent = ALIAS_CSS
    }

    function setBtnText(btn, text) {
      for (const node of btn.childNodes) {
        if (node.nodeType === 3) {
          if (node.nodeValue !== text) node.nodeValue = text
          return
        }
      }
      btn.textContent = text
    }

    // 已安装插件列表：有别名时把卡片主标题换成别名，无别名时恢复原值。
    // 只改文本，不动图标、描述、行高、选中态与点击行为。
    function applyCardTitles() {
      const aliases = aliasStore.get()
      for (const card of document.querySelectorAll('[data-plugin-package]')) {
        const id = card.getAttribute('data-plugin-package')
        const btn = card.querySelector('[class*="cardTitle"]') || card.querySelector('button')
        if (!btn) continue
        const alias = aliases[id]
        if (alias) {
          if (!btn.hasAttribute('data-dsh-style-alias-orig')) btn.setAttribute('data-dsh-style-alias-orig', btn.textContent)
          if (!btn.hasAttribute('data-dsh-style-alias-active')) btn.setAttribute('data-dsh-style-alias-active', '')
          setBtnText(btn, alias)
        } else if (btn.hasAttribute('data-dsh-style-alias-active')) {
          const original = btn.getAttribute('data-dsh-style-alias-orig')
          if (original != null) setBtnText(btn, original)
          btn.removeAttribute('data-dsh-style-alias-active')
          btn.removeAttribute('data-dsh-style-alias-orig')
        }
      }
    }

    // 详情页：在原标题位置「二选一」显示——有别名就替换原名为别名，没有就显示原名。
    // 不新增独立别名行，避免出现「别名 / 原名 / 包名」三行并存；
    // 包名/模块名（如 @deepseek-ai/dsh-experimental-auto-review）那行保持不动，仍可辨认原版身份。
    // 版本号与标题同排（titleRow），保留不变。
    function applyDetailTitle() {
      const aliases = aliasStore.get()
      for (const root of document.querySelectorAll('[data-plugin-detail]')) {
        // 清理旧版本可能残留在 .detailTop 里的独立别名行（升级兼容）。
        const legacy = root.querySelector('[data-dsh-style-alias-line]')
        if (legacy) legacy.remove()
        const id = root.getAttribute('data-plugin-detail')
        const titleEl = root.querySelector('[class*="detailTitle"]')
        if (!titleEl) continue
        const alias = aliases[id]
        if (alias) {
          if (!titleEl.hasAttribute('data-dsh-style-title-orig')) titleEl.setAttribute('data-dsh-style-title-orig', titleEl.textContent)
          if (!titleEl.hasAttribute('data-dsh-style-title-active')) titleEl.setAttribute('data-dsh-style-title-active', '')
          setBtnText(titleEl, alias)
        } else if (titleEl.hasAttribute('data-dsh-style-title-active')) {
          const original = titleEl.getAttribute('data-dsh-style-title-orig')
          if (original != null) setBtnText(titleEl, original)
          titleEl.removeAttribute('data-dsh-style-title-active')
          titleEl.removeAttribute('data-dsh-style-title-orig')
        }
      }
    }

    function applyAliasDom() {
      if (typeof document === 'undefined') return
      try {
        applyCardTitles()
        applyDetailTitle()
      } catch {
        /* 忽略瞬时 DOM 变化 */
      }
    }

    let aliasObserver = null
    let aliasTimer = 0

    function scheduleAlias() {
      if (aliasTimer) return
      aliasTimer = setTimeout(() => {
        aliasTimer = 0
        applyAliasDom()
      }, 60)
    }

    // 只在变更落在插件卡片 / 详情页内时才重排，避免聊天流式渲染时反复全量扫描。
    function aliasMutationsRelevant(mutations) {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement
          if (parent && parent.closest('[data-plugin-package],[data-plugin-detail]')) return true
          continue
        }
        const target = mutation.target
        if (target && target.closest && target.closest('[data-plugin-package],[data-plugin-detail]')) return true
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue
          if (node.matches && node.matches('[data-plugin-package],[data-plugin-detail]')) return true
          if (node.querySelector && node.querySelector('[data-plugin-package],[data-plugin-detail]')) return true
        }
      }
      return false
    }

    function startAliasObserver() {
      if (typeof document === 'undefined') return
      ensureAliasStyle()
      applyAliasDom()
      if (aliasObserver || typeof MutationObserver === 'undefined') return
      aliasObserver = new MutationObserver((mutations) => {
        if (aliasMutationsRelevant(mutations)) scheduleAlias()
      })
      // 只观察结构变化（插件页挂载 / 卡片与详情切换 / 列表刷新）；不观察 characterData，
      // 避免聊天流式输出时对每个 token 做无谓的 ancestor 检查。
      aliasObserver.observe(document.body, { childList: true, subtree: true })
    }

    function stopAliasObserver() {
      if (aliasObserver) {
        aliasObserver.disconnect()
        aliasObserver = null
      }
      if (aliasTimer) {
        clearTimeout(aliasTimer)
        aliasTimer = 0
      }
      clearAliasDom()
    }

    function clearAliasDom() {
      if (typeof document === 'undefined') return
      for (const line of document.querySelectorAll('[data-dsh-style-alias-line]')) line.remove()
      for (const btn of document.querySelectorAll('[data-dsh-style-alias-active]')) {
        const original = btn.getAttribute('data-dsh-style-alias-orig')
        if (original != null) setBtnText(btn, original)
        btn.removeAttribute('data-dsh-style-alias-active')
        btn.removeAttribute('data-dsh-style-alias-orig')
      }
      // 恢复被别名替换的详情页原标题。
      for (const titleEl of document.querySelectorAll('[data-dsh-style-title-active]')) {
        const original = titleEl.getAttribute('data-dsh-style-title-orig')
        if (original != null) setBtnText(titleEl, original)
        titleEl.removeAttribute('data-dsh-style-title-active')
        titleEl.removeAttribute('data-dsh-style-title-orig')
      }
      const styleEl = document.querySelector('style[data-plugin="dsh-style-alias"]')
      if (styleEl) styleEl.remove()
    }

    // 原生设置输入框：DSH 设置页的输入框本身就是一个原生 <input> + CSS 规则，
    // 这里用同一套 Token 复刻该规则，避免浏览器默认输入框观感。
    function AliasInput(props) {
      return h('input', { ...props, type: 'text', className: 'dsh-style-native-input' })
    }

    function AliasModal({ open, onClose, title, description, footer, children }) {
      if (PrimitivesModal) {
        return h(PrimitivesModal, {
          open,
          onClose,
          title,
          closeLabel: '关闭',
          description,
          footer,
          className: 'dsh-style-alias-dialog',
        }, children)
      }
      if (!open) return null
      if (typeof document === 'undefined' || !createPortal) return null
      return createPortal(h('div', {
        className: 'dsh-style-alias-overlay',
        onMouseDown: (event) => { if (event.target === event.currentTarget) onClose() },
      }, h('div', { className: 'dsh-style-alias-card', role: 'dialog', 'aria-label': title },
        h('h3', { className: 'dsh-style-alias-title' }, title),
        description ? h('p', { className: 'dsh-style-alias-desc' }, description) : null,
        children,
        footer ? h('div', { className: 'dsh-style-alias-foot' }, footer) : null)), document.body)
    }

    // 详情页页头按钮：仅对「组合包」类型的插件显示，位于页头操作区，
    // 天然排在原生「卸载」按钮左侧。
    function PluginAliasAction(props) {
      const subject = props ? props.subject : null
      const [aliases, setAliases] = React.useState(aliasStore.get())
      const [open, setOpen] = React.useState(false)
      const [draft, setDraft] = React.useState('')
      React.useEffect(() => aliasStore.subscribe(() => setAliases(aliasStore.get())), [])
      if (!subject || subject.kind !== 'bundle' || !subject.pkg || !subject.pkg.name) return null
      const id = subject.pkg.name
      const current = aliases[id] || ''
      const openModal = () => {
        setDraft(current)
        setOpen(true)
      }
      const close = () => setOpen(false)
      const save = () => {
        aliasStore.set(id, draft)
        setOpen(false)
      }
      const onKeyDown = (event) => {
        if (!event) return
        if (event.key === 'Enter') {
          event.preventDefault()
          save()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          close()
        }
      }
      // 页头按钮：复刻 DSH 设置页 secondaryButton（“设置 → 模型 → 编辑”）的样式规则，
      // 原生 <button> + 同一套设计 Token，视觉与原生按钮一致。
      const button = h('button', {
        type: 'button',
        className: 'dsh-style-native-button',
        onClick: openModal,
        'aria-label': current ? '编辑插件别名' : '添加插件别名',
      }, current ? '编辑别名' : '添加别名')
      const modal = h(AliasModal, {
        open,
        onClose: close,
        title: '设置插件别名',
        description: '为当前插件设置自定义显示名称，不影响插件原始名称及运行。',
        footer: h(React.Fragment, null,
          Button
            ? h(Button, { variant: 'outline', onClick: close }, '取消')
            : h('button', { type: 'button', className: 'dsh-style-native-button', onClick: close }, '取消'),
          Button
            ? h(Button, { variant: 'primary', onClick: save }, '保存')
            : h('button', { type: 'button', className: 'dsh-style-native-button', onClick: save }, '保存')),
      }, h(AliasInput, {
        value: draft,
        onChange: (event) => setDraft(event && event.target ? event.target.value : ''),
        onKeyDown,
        placeholder: '输入插件别名',
        'aria-label': '插件别名',
        autoFocus: true,
      }))
      return h(React.Fragment, null, button, modal)
    }

    const inject = ['slots', 'sessions']

    function apply(ctx) {
      appCtx = ctx
      applyStyles(store.get())
      startAliasObserver()
      ctx.effect(() => () => cleanup(), 'dsh-style: 释放外观样式')
      ctx.effect(() => () => stopAliasObserver(), 'dsh-style: 释放插件别名')
      // 插件详情的页头操作区：在原生「卸载」按钮左侧增加「添加别名 / 编辑别名」。
      ctx.slots.inject('plugins.detail.actions', () => ctx.slots.register({
        name: 'plugins.detail.actions',
        id: 'dsh-style-alias',
        order: 10,
      }, PluginAliasAction))
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'style',
        order: 40,
        label: () => '外观',
      }, AppearanceSection))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-style-botentry',
        order: 900,
      }, BotEntryBridge))
      // 会话行「更多」菜单：注入一项显示相对时间（原来的行内时间已隐藏）。
      const sessionsList = (ctx && ctx.sessions && ctx.sessions.list) || null
      ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({
        name: 'sidebar.workspaces.session.menu.item',
        id: 'dsh-style-time',
        order: 50,
        inject: () => (sessionsList ? { hooks: { sessions: sessionsList } } : {}),
      }, SessionTimeMenuItem))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-style-monitor-host',
        order: 901,
      }, MonitorHost))
      ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
        name: 'conversation.session.header.utilities',
        id: 'dsh-style-monitor-btn',
        order: 50,
      }, MonitorButton))
      // 官方 list slot：渲染在「欢迎语行」与「输入卡片」之间，宽度随首页列宽。
      // 组件自身在非 hero 相位 / 关闭开关时返回 null，不污染正常对话。
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
        name: 'conversation.input.dock',
        id: 'dsh-style-activity',
        order: -20,
      }, QoderActivityCard))
    }

    exports.apply = apply
    exports.inject = inject
    exports.AppearanceSection = AppearanceSection
    exports.LayoutCard = LayoutCard
    exports.EffectsCard = EffectsCard
    exports.SidebarCard = SidebarCard
    exports.__internal = { applyStyles, readSettings, tagOnce }

    return module.exports
  },
})
