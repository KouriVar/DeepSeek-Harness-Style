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
      titlebarRefresh: true,
      // 输入框引用卡片（正文 @文件引用镜像成输入框上方一行卡片）。
      refCards: true,
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
      homeStamp: true,
      // 实体详情：默认关闭，开启后才会识别并注入可点击实体。
      entityEnabled: false,
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
        merged.titlebarRefresh = merged.titlebarRefresh !== false
        merged.refCards = merged.refCards !== false
        merged.sidebarCompact = merged.sidebarCompact !== false
        merged.hovercardInset = merged.hovercardInset !== false
        merged.pageTopSpacing = merged.pageTopSpacing !== false
        merged.workspaceRowCompact = merged.workspaceRowCompact !== false
        merged.agentEntryMerge = merged.agentEntryMerge !== false
        merged.hovercardFollowTheme = merged.hovercardFollowTheme !== false
        merged.qoderHome = merged.qoderHome !== false
        merged.homeHeatmap = merged.homeHeatmap !== false
        merged.homeDemoData = merged.homeDemoData !== false
        merged.homeStamp = merged.homeStamp !== false
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
      // 展开 / 正在展开 / 正在关闭 三种状态都保持"内容区 + 右栏合成一个大圆角框"：
      // 关闭动画期间若提前切成独立卡片，右栏就会像浮在成品卡片上（原来割裂观感的根因）。
      // 只有真正收起之后（data-dsh-rb="closed"）才恢复主区完整圆角。
      'html[data-dsh-style-layout="inset"] [data-dsh-style-frame]:is([data-dsh-rb="open"],[data-dsh-rb="opening"],[data-dsh-rb="closing"]) [data-dsh-style-main]{',
      'border-radius:var(--dsh-style-inset-radius) 0 0 var(--dsh-style-inset-radius);',
      'border-right-color:transparent;',
      '}',
      'html[data-dsh-style-layout="inset"] [data-dsh-style-frame]:is([data-dsh-rb="open"],[data-dsh-rb="opening"],[data-dsh-rb="closing"]) [data-rightbar-col]{',
      'background:var(--dsw-alias-bg-base);',
      'border-top:1px solid var(--dsh-style-inset-border);',
      'border-right:1px solid var(--dsh-style-inset-border);',
      'border-bottom:1px solid var(--dsh-style-inset-border);',
      'border-left:1px solid var(--dsh-style-inset-border);',
      'border-radius:0 var(--dsh-style-inset-radius) var(--dsh-style-inset-radius) 0;',
      'overflow:hidden;',
      '}',
      // 关闭动画期间把右栏内容裁到列宽里：面板贴在窗口右缘、宽度不变，
      // 不裁的话它会"悬"在会话区上方，看起来像悬浮叠层。
      'html[data-dsh-style-layout="inset"] [data-dsh-style-frame][data-dsh-rb="closing"] [data-rightbar-col]{',
      'overflow:hidden !important;',
      '}',
      // 合体↔分离 的边框/圆角切换加同参数过渡，避免动画收尾那一帧跳变。
      'html[data-dsh-style-layout="inset"] [data-dsh-style-main]{',
      'transition:border-radius .2s var(--dsh-style-motion-ease,cubic-bezier(.4,0,.2,1)),border-right-color .2s var(--dsh-style-motion-ease,cubic-bezier(.4,0,.2,1));',
      '}',
      'html[data-dsh-style-layout="inset"] [data-rightbar-col]{',
      'transition:border-radius .2s var(--dsh-style-motion-ease,cubic-bezier(.4,0,.2,1)),border-color .2s var(--dsh-style-motion-ease,cubic-bezier(.4,0,.2,1)),background-color .2s var(--dsh-style-motion-ease,cubic-bezier(.4,0,.2,1));',
      '}',
      // DSH 把布局过渡写在 [data-animating] 内，而该属性与列宽变化是**同一帧**才加上；
      // 浏览器只在「变化前已存在过渡声明」时才启动插值 → 真机逐帧采样证实
      // grid-template-columns 的 transitionrun 从未触发、列宽一帧到位（用户录屏的硬切）。
      // 改为常驻声明，用同一条曲线；拖拽 / instant 时关掉，保留原生手感。
      'html[data-dsh-style-layout="inset"] [data-dsh-style-frame]{',
      'transition:grid-template-columns var(--ds-transition-duration-slow,.3s) var(--ds-ease-in-out,cubic-bezier(.4,0,.2,1)) !important;',
      '}',
      'html[data-dsh-style-layout="inset"] [data-dsh-style-frame][data-dragging],',
      'html[data-dsh-style-layout="inset"] [data-dsh-style-frame][data-rightbar-instant]{',
      'transition:none !important;',
      '}',
      // 让会话头（标题 / 快捷区 / 右侧工具）与窗口顶栏（红绿灯）垂直对齐：
      // 内嵌布局顶部多了 4px 间隙，把 header 的顶部内边距抵掉同样的量。
      // 注意：这里不能排除 headerBlank —— 新会话页（hero）的 header 就是 blank 的，
      // 一旦排除，它的 padding-top 保持 10px，右上角按钮就会比会话页低一截。
      'html[data-dsh-style-layout="inset"] [data-dsh-style-main] header[data-window-drag]{padding-top:calc(10px - var(--dsh-style-inset-gap)) !important;}',
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

    // 顶部窗口控制：折叠 / 后退 / 前进 / 刷新。放在红绿灯右侧（沿用原生 leadingSeat 坐标 left:88 / top:11，
    // 相对红绿灯约 16px 间距）。原生折叠按钮与占位控制隐藏，统一由这套接管。
    const TITLEBAR_CSS = [
      '.dsh-style-tb{position:fixed;top:11px;left:88px;display:flex;align-items:center;gap:2px;z-index:2147483000;-webkit-app-region:no-drag;}',
      '.dsh-style-tb-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#9aa0a6);cursor:pointer;padding:0;transition:background .12s,color .12s;}',
      '.dsh-style-tb-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));color:var(--dsw-alias-label-primary,inherit);}',
      '.dsh-style-tb-btn:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active,rgba(128,128,128,.2));}',
      '.dsh-style-tb-btn:disabled{opacity:.3;cursor:default;}',
      '.dsh-style-tb-btn svg{display:block;}',
      // 刷新被拦下时的提示气泡（浅色/深色都用深底白字，像系统 tooltip）。
      '[data-dsh-style-tip]{position:fixed;z-index:2147483001;max-width:280px;padding:7px 11px;border-radius:9px;background:rgba(28,28,30,.95);color:#f5f5f7;font-size:12px;line-height:17px;box-shadow:0 10px 26px rgba(0,0,0,.32);pointer-events:none;}',
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
      'html[data-dsh-style-hide-tabs="true"] [data-dsh-style-main] header[data-window-drag]{min-height:38px !important;height:38px !important;padding-top:0 !important;padding-bottom:0 !important;align-items:center !important;}',
      // 右上角「侧边栏」按钮：以**右侧栏展开时**的位置为唯一基准。
      // 收起态由会话头 corner 渲染（原生 padding-right:28 - 外边距 16 = 距面板右缘 12px），
      // 展开态由右栏工具栏渲染，两者差一截。这里只改会话头的右内距，
      // 整组按钮随之内缩，按钮组内部间距不变（不会重叠、不会被圆角裁切）。
      'html[data-dsh-style-enabled="true"] [data-rightbar-collapsed] [data-dsh-style-main] header[data-window-drag]{',
      'padding-right:var(--dsh-style-corner-pad,22px) !important;',
      '}',
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
      '--dsh-q-title-gap:10px;',
      '--dsh-q-card-gap:28px;',
      '--dsh-q-top:clamp(24px,6vh,80px);',
      '--dsh-q-bottom:clamp(16px,3vh,40px);',
      '--dsh-q-card-radius:12px;',
      '--dsh-q-card-border:#e7e7e7;',
      '--dsh-q-empty:#eeeeee;',
      '--dsh-q-l1:#ecf8f1;',
      '--dsh-q-l2:#b5ddc3;',
      '--dsh-q-l3:#7fc79b;',
      '--dsh-q-l4:#4ea876;',
      '--dsh-q-underline:#d7d7d7;',
      '--dsh-q-underline-gap:0px;',
      '--dsh-q-gap-1:8px;',
      '--dsh-q-gap-2:10px;',
      '--dsh-q-prefix:"在";',
      '--dsh-q-mid:"用";',
      '--dsh-q-suffix:"创造了不起的事物";',
      '}',

      // ① 列宽：hero 相把内容列钉到 767（Qoder 实测），输入框与热力图共用这一个变量
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="stack"]{--dsh-composer-card-max-width:min(767px, 100%);width:min(799px, 100%) !important;}',
      // 两张卡用同一个 width 表达式，几何上不可能再分叉
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] .dsh-qcard,',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] .JZLxKW_card{width:min(767px, 100%) !important;max-width:none !important;}',

      // ② 上下分离：组贴在「距输入框 150px」的位置，上方剩余空间由 auto margin 吸收
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-conversation-scroll]{justify-content:flex-start !important;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-composer-seat]{flex:1 1 auto !important;min-height:0 !important;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="stack"],',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] div:has(> [data-slot="conversation.composer.bar"]){',
      'height:100%;box-sizing:border-box;gap:0 !important;',
      'padding-top:var(--dsh-q-top);padding-bottom:var(--dsh-q-bottom);',
      '}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="input"],',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-slot="conversation.composer.bar"] > *{margin-top:168px !important;}',
      // 输入卡片的 root/hero 都带 --dsh-composer-side-clearance 的左右内距，会把卡片缩窄 32px；
      // 用类选择器直接抹掉，保证它与热力图卡片严格同宽同边。
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] .JZLxKW_root,',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] .JZLxKW_hero{padding-left:0 !important;padding-right:0 !important;}',

      // 欢迎块自身不再吃满高度（原生 HeroShell.root 是 height:100%，会把句子行推远）
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="stack"]{justify-content:flex-end;}',
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
      // 标题前的图标：整槽隐藏（不占位，标题自然居中）
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-slot="conversation.hero.brand.mark"],',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [class*="fishHitbox"]{display:none !important;}',

      // ③ 动态欢迎语：整行居中，两个原生选择器原地句化
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="sentence"],',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] div:has(> [data-slot="conversation.hero.agentPreset"]){',
      'display:flex !important;justify-content:center !important;align-items:baseline !important;flex-wrap:wrap !important;',
      'gap:0 !important;margin-top:var(--dsh-q-title-gap) !important;padding:0 !important;',
      'font-size:var(--dsh-q-sentence-size) !important;line-height:1.4 !important;',
      'font-weight:600 !important;',
      'color:var(--dsh-q-sentence-color) !important;',
      '}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="sentence"]::before{content:var(--dsh-q-prefix);margin-right:var(--dsh-q-gap-1);}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="sentence"]::after{content:var(--dsh-q-suffix);margin-left:var(--dsh-q-gap-2);}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="sentence"] [class*="heroOptions"]{display:none !important;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="sentence"] > [data-slot="conversation.hero.options"]{display:none !important;}',

      // 选择器本体：去掉胶囊底色与图标，变成带下划线的词
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="ws"],',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="mode"],',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] div:has(> [data-slot="conversation.hero.agentPreset"]) > div > button{',
      'background:transparent !important;border:none !important;box-shadow:none !important;',
      'padding:0 !important;margin:0 !important;min-height:0 !important;height:auto !important;',
      'font-size:inherit !important;font-weight:600 !important;line-height:inherit !important;',
      'color:var(--dsh-q-sentence-color) !important;',
      'text-decoration:none !important;position:relative;',
      '}',
      // 下划线用伪元素画，不用 text-decoration：
      // Chromium 在 text-underline-offset 超过基线下方可用空间时会直接不画（WebKit 不会），
      // 所以改用一条绝对定位的 1px 线，位置完全可控、两个选择器必然同高。
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="ws"]::after,',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="mode"]::after{',
      'content:"";position:absolute;left:0;right:0;',
      'bottom:var(--dsh-q-underline-gap);height:1px;',
      'background:var(--dsh-q-underline);pointer-events:none;',
      '}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="ws"]:hover,',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="mode"]:hover{',
      'color:var(--dsw-alias-label-primary,#000) !important;background:transparent !important;',
      '}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="ws"] svg,',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="mode"] svg{display:none !important;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="modeWrap"]{display:inline-flex !important;align-items:baseline !important;}',
      'html[data-dsh-style-qoderhome="true"] [data-phase="hero"] [data-dsh-qoder="modeWrap"]::before{content:var(--dsh-q-mid);margin-left:var(--dsh-q-gap-2);margin-right:var(--dsh-q-gap-1);}',

      // ④ 热力图卡片
      '.dsh-qcard{',
      'box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width);align-self:center;',
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
      'html[data-dsh-style-dark="true"]{--dsh-q-sentence-color:#a0a0a4;--dsh-q-card-border:rgba(255,255,255,.12);--dsh-q-empty:rgba(255,255,255,.08);--dsh-q-l1:#1e3a29;--dsh-q-l2:#2b5c3c;--dsh-q-l3:#3f8a56;--dsh-q-l4:#63bd7f;--dsh-q-underline:rgba(255,255,255,.38);}',
      'html[data-dsh-style-dark="true"] .dsh-qtab{color:#8a8a8f;}',
      'html[data-dsh-style-dark="true"] .dsh-qtab[data-active="true"]{color:#e8e8ea;}',
      'html[data-dsh-style-dark="true"] .dsh-qmonths{color:#7c7c82;}',
      'html[data-dsh-style-dark="true"] .dsh-qsum{color:#5c5c62;}',
      'html[data-dsh-style-dark="true"] .dsh-qempty{color:#707076;}',
      // ---- 苹果树邮戳卡（174×100 基准，坐标来自交接文档）----
      '.dsh-qstamp{position:relative;box-sizing:border-box;width:174px;height:100px;flex:none;align-self:center;order:-1;margin:0 auto var(--dsh-q-stamp-gap,18px);transform:scale(1);transform-origin:50% 60%;transition:transform 500ms cubic-bezier(.22,.8,.28,1);will-change:transform;outline:none;}',
      '.dsh-qstamp[data-active="true"]{transform:scale(1.03);}',
      '.dsh-qstamp:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4085f2);outline-offset:4px;border-radius:4px;}',
      '.dsh-qstamp-plate{position:absolute;left:14px;top:14px;width:140px;height:72px;box-sizing:border-box;border:1px solid var(--dsh-q-card-border);border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,.05);}',
      '.dsh-qstamp-tree{position:absolute;left:18px;top:18px;width:64px;height:64px;overflow:hidden;border-radius:1px;background:#24402a;}',
      '.dsh-qstamp-img{position:absolute;left:4px;top:4px;width:56px;height:56px;object-fit:contain;transition:opacity 200ms ease;}',
      '.dsh-qstamp-img[data-layer="color"]{opacity:0;}',
      '.dsh-qstamp[data-tree="true"] .dsh-qstamp-img[data-layer="default"]{opacity:0;}',
      '.dsh-qstamp[data-tree="true"] .dsh-qstamp-img[data-layer="color"]{opacity:1;}',
      '.dsh-qstamp-year{position:absolute;left:91px;top:20px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:12px;font-weight:500;color:var(--dsw-alias-label-primary,#111);}',
      '.dsh-qstamp-cap{position:absolute;left:91px;top:65px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:6px;line-height:8px;font-weight:400;color:var(--dsw-alias-label-tertiary,#9a9a9a);white-space:nowrap;}',
      '.dsh-qstamp-stamp{position:absolute;left:120px;top:32px;width:52px;height:52px;opacity:.9;pointer-events:none;}',
      '.dsh-qstamp-tip{position:fixed;z-index:1000;box-sizing:border-box;width:288px;max-width:calc(100vw - 56px);padding:12px;border-radius:8px;border:1px solid var(--dsh-q-card-border);background:var(--dsw-alias-bg-elevated,#fff);box-shadow:0 4px 14px rgba(0,0,0,.08);pointer-events:none;transform-origin:50% 100%;will-change:transform;}',
      '.dsh-qstamp-tip h4{margin:0 0 6px;font-size:12px;line-height:16px;font-weight:600;color:var(--dsw-alias-label-primary,#111);}',
      '.dsh-qstamp-tip p{margin:0;font-size:12px;line-height:18px;color:var(--dsh-q-sentence-color);}',
      'html[data-dsh-style-dark="true"] .dsh-qstamp{filter:brightness(.86) saturate(.92);}',
      'html[data-dsh-style-dark="true"] .dsh-qstamp-tip{background:#232326;border-color:rgba(255,255,255,.14);box-shadow:0 4px 14px rgba(0,0,0,.22);}',
      '@media (prefers-reduced-motion:reduce){.dsh-qstamp{transition:none;}.dsh-qstamp[data-active="true"]{transform:none;}.dsh-qstamp-img{transition:none;}}',
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

    // ---- 顶部窗口控制（折叠 / 后退 / 前进 / 刷新） ----
    let titlebarEl = null
    function tbIcon(kind) {
      if (kind === 'panel') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.2" y="3.2" width="11.6" height="9.6" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M6.4 3.4v9.2" stroke="currentColor" stroke-width="1.4"/></svg>'
      if (kind === 'back') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M9.8 3.6 5.4 8l4.4 4.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      if (kind === 'refresh') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 8a6 6 0 1 1-6-6c1.68 0 3.29.67 4.49 1.83L14 5.33" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2v3.33h-3.33" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6.2 3.6 10.6 8l-4.4 4.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    }
    function nativeToggle() {
      if (typeof document === 'undefined') return null
      return document.querySelector('[data-dsh-style-sidebar] [class*="_toggle"]')
        || document.querySelector('[data-shell-leading] button')
        || document.querySelector('button[class*="_toggle"]')
    }
    // 真正的页面刷新：重载渲染进程里的整个 Web 应用（等同浏览器 Cmd+R：页面、连接、插件状态全部重来），
    // 不是只重跑 apply()。reload() 正常时页面随之卸载，下面的兜底计时器不会执行；
    // 万一导航被拦下（页面没卸载），1200ms 后整页再导航一次，并把按钮恢复可用。
    function reloadPage(btn) {
      if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true') }
      let navigating = false
      try { window.location.reload(); navigating = true } catch {}
      if (!navigating) { try { window.location.href = window.location.href } catch {} }
      setTimeout(() => {
        try { window.location.href = window.location.href } catch {}
        if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy') }
      }, 1200)
    }
    // 刷新前的「启动注入」校验（DSH 0.2.1-rc.5 桌面壳的缓存 bug 兜底）：
    // 桌面主进程在 Host 启动时把 `window.__DSH_BOOT__`（每个插件 bundle 的 rev URL）缓存进内存，
    // 之后 client-hmr 热替换会让 rev 变新、旧 URL 在 Host 侧立刻 404（Host 只保留当前代 + 上一代 batch）。
    // 这时整页刷新会在 boot 阶段报 `<插件>: import failed`，桌面壳直接弹「应用无法启动」。
    // 所以刷新前先 GET 一遍启动注入里的每个插件脚本：只要有一个不是 200，就只提示、不刷新。
    async function bootInjectionStale() {
      let boot = null
      try { boot = (typeof window !== 'undefined' && window.__DSH_BOOT__) || null } catch { boot = null }
      if (!boot) return false
      const urls = []
      for (const row of Array.isArray(boot.entries) ? boot.entries : []) {
        if (row && typeof row.url === 'string' && row.url) urls.push(row.url)
      }
      if (urls.length === 0) return false
      for (const url of urls) {
        try {
          const res = await fetch(url)
          if (res.status !== 200) return true
        } catch {
          return true
        }
      }
      return false
    }
    function showTitlebarTip(anchor, text) {
      if (typeof document === 'undefined' || !document.body) return
      let tip = document.querySelector('[data-dsh-style-tip]')
      if (!tip) {
        tip = document.createElement('div')
        tip.setAttribute('data-dsh-style-tip', '')
        tip.setAttribute('role', 'status')
        document.body.appendChild(tip)
      }
      tip.textContent = text
      let left = 88
      let top = 45
      try {
        const rect = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null
        if (rect && rect.width) { left = Math.round(rect.left); top = Math.round(rect.bottom + 6) }
      } catch {}
      tip.style.left = left + 'px'
      tip.style.top = top + 'px'
      if (showTitlebarTip.timer) clearTimeout(showTitlebarTip.timer)
      showTitlebarTip.timer = setTimeout(() => { try { tip.remove() } catch {} }, 4500)
    }
    function syncTitlebar() {
      if (!titlebarEl) return
      const collapsed = Boolean(document.querySelector('[data-sidebar-collapsed]'))
      const c = titlebarEl.querySelector('[data-act="toggle"]')
      if (c) c.setAttribute('aria-label', collapsed ? '展开侧边栏' : '收起侧边栏')
    }
    function mountTitlebar() {
      if (typeof document === 'undefined' || !document.body) return
      const cfg = store.get()
      if (cfg.titlebarButtons === false) { unmountTitlebar(); return }
      const wantRefresh = cfg.titlebarRefresh !== false
      // 开关切换后按钮组合变了：先拆再建（同一帧内完成，不会闪）。
      if (titlebarEl && (titlebarEl.__hasRefresh !== wantRefresh || !document.body.contains(titlebarEl))) unmountTitlebar()
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
      if (wantRefresh) {
        const refresh = mk('reload', 'refresh', '刷新页面')
        refresh.addEventListener('click', async (e) => {
          e.preventDefault()
          if (refresh.dataset.busy === 'true') return
          refresh.dataset.busy = 'true'
          refresh.disabled = true
          try {
            if (await bootInjectionStale()) {
              showTitlebarTip(refresh, '插件刚热更新过，整页刷新会在启动时报错。请退出 App 后重新打开。')
              return
            }
            reloadPage(refresh)
          } finally {
            refresh.dataset.busy = 'false'
            refresh.disabled = false
          }
        })
        box.append(refresh)
      }
      box.__hasRefresh = wantRefresh
      document.body.appendChild(box)
      titlebarEl = box
      syncTitlebar()
    }
    function unmountTitlebar() {
      if (titlebarEl) { try { titlebarEl.remove() } catch {} titlebarEl = null }
    }

    // ---- 输入框引用卡片（正文 @文件引用的只读镜像） ----
    // 只读：从 composer 编辑器里的 chip DOM 派生一排卡片，不碰编辑器模型、不改引用语义
    // （模型收到的仍是 @相对路径）。点卡片 → 定位/高亮正文引用；点引用 → 高亮卡片；
    // 引用被删除时卡片随之消失、编号按当下顺序自动重排。
    const REFCARD_CSS = [
      '[data-dsh-refcards]{box-sizing:border-box;width:100%;display:flex;align-items:stretch;gap:8px;overflow-x:auto;overflow-y:hidden;padding:0 12px 2px;scrollbar-width:none;}',
      '[data-dsh-refcards]::-webkit-scrollbar{display:none}',
      '[data-dsh-refcard]{position:relative;flex:none;box-sizing:border-box;display:inline-flex;align-items:center;gap:10px;width:240px;height:64px;padding:0 12px;border-radius:14px;border:.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.12));background:var(--dsw-specific-input-major,#fff);box-shadow:0 2px 10px rgba(0,0,0,.06);cursor:pointer;transition:border-color .12s,box-shadow .12s,background .12s;}',
      '[data-dsh-refcard]:hover{border-color:var(--dsw-alias-border-l3,rgba(0,0,0,.2));}',
      '[data-dsh-refcard]:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px;}',
      '[data-dsh-refcard][data-dsh-refflash="true"]{border-color:var(--dsw-alias-state-business-primary,#4d6bfe);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 28%,transparent);}',
      '[data-dsh-refnum]{flex:none;width:16px;height:16px;border-radius:999px;background:var(--dsw-alias-fill-tertiary,rgba(0,0,0,.08));color:var(--dsw-alias-label-tertiary,#8a9099);font-size:10px;line-height:16px;text-align:center;}',
      '[data-dsh-reficon]{flex:none;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:#fff;font-size:9px;font-weight:600;letter-spacing:.2px;text-transform:uppercase;}',
      '[data-dsh-refbody]{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}',
      '[data-dsh-refname]{font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary,inherit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '[data-dsh-refmeta]{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,#8a9099);}',
      '[data-composer-chip][data-dsh-chip-flash="true"]{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:1px;border-radius:6px;}',
    ].join('')

    const REFCARD_KINDS = [
      ['image', '图片', '#16a34a', ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'heif', 'avif', 'bmp', 'ico', 'tif', 'tiff']],
      ['video', '视频', '#0ea5e9', ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'mpg', 'mpeg']],
      ['audio', '音频', '#8b5cf6', ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus']],
      ['pdf', 'PDF', '#dc2626', ['pdf']],
      ['doc', '文档', '#2563eb', ['doc', 'docx', 'rtf', 'odt', 'pages', 'md', 'mdx', 'markdown', 'txt']],
      ['sheet', '表格', '#15803d', ['xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'tsv', 'numbers', 'ods']],
      ['slides', '演示', '#ea580c', ['ppt', 'pptx', 'key', 'odp']],
      ['archive', '压缩包', '#78716c', ['zip', 'tar', 'gz', 'tgz', 'rar', '7z', 'dmg', 'iso']],
      ['code', '代码', '#475569', ['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'css', 'scss', 'sass', 'less', 'html', 'htm', 'xml', 'json', 'yaml', 'yml', 'sh', 'bash', 'zsh', 'py', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'rb', 'php', 'swift', 'toml', 'ini', 'conf', 'sql', 'vue', 'svelte', 'astro']],
    ]
    const REFCARD_KIND_BY_EXT = (() => {
      const map = new Map()
      for (const [kind, label, color, exts] of REFCARD_KINDS) for (const ext of exts) map.set(ext, { kind, label, color })
      return map
    })()
    function refCardKind(ext) {
      return REFCARD_KIND_BY_EXT.get(ext) || { kind: 'file', label: '引用', color: '#64748b' }
    }

    const refCards = (() => {
      let enabled = false
      let row = null
      let chips = []
      let signature = ''
      let observer = null
      let raf = 0
      let docClick = null

      function composerCard() {
        let best = null
        let area = 0
        const viewH = (typeof window !== 'undefined' && window.innerHeight) || 0
        for (const el of Array.from(document.querySelectorAll('[data-composer-card]'))) {
          if (!el.isConnected) continue
          const r = el.getBoundingClientRect()
          if (r.width < 160 || r.height < 32) continue
          if (r.bottom < 0 || r.top > viewH) continue
          const a = r.width * r.height
          if (a > area) { area = a; best = el }
        }
        return best
      }
      function editorOf(card) {
        if (!card) return null
        return card.querySelector('[data-composer-input]') || card.querySelector('[contenteditable="true"]')
      }
      // 只收「文件」引用：命令 chip、目录、会话引用都不画卡片（没有扩展名的一律跳过）。
      function collect(card) {
        const editor = editorOf(card)
        if (!editor) return []
        const out = []
        for (const chip of Array.from(editor.querySelectorAll('[data-composer-chip]'))) {
          const source = (chip.getAttribute('data-composer-chip') || '').toLowerCase()
          if (source.indexOf('command') >= 0 || source.indexOf('slash') >= 0) continue
          const name = (chip.textContent || '').trim()
          if (!name) continue
          const hit = /\.([A-Za-z0-9]{1,8})$/.exec(name)
          if (!hit) continue
          const ext = hit[1].toLowerCase()
          out.push({ chip, name, ext, kind: refCardKind(ext) })
        }
        return out
      }
      // 行挂在 composer 卡片内部的最前面（不浮层）：卡片自然长高，卡片行随输入框一起滚动。
      function ensureRow(card) {
        if (!row) {
          row = document.createElement('div')
          row.setAttribute('data-dsh-refcards', '')
          row.setAttribute('role', 'list')
          row.setAttribute('aria-label', '输入框引用卡片')
        }
        // 同一张 composer 卡片里只允许存在一行：旧实例残留 / React 重建都会叠出多行。
        for (const el of Array.from(card.querySelectorAll(':scope > [data-dsh-refcards]'))) {
          if (el !== row) { try { el.remove() } catch {} }
        }
        if (row.parentElement !== card) {
          try { card.insertBefore(row, card.firstChild) } catch { try { card.appendChild(row) } catch {} }
        }
        return row
      }
      function hideRow() {
        if (row) { try { row.remove() } catch {} row = null }
      }
      function flash(el, attr, ms) {
        try {
          el.setAttribute(attr, 'true')
          setTimeout(() => { try { el.removeAttribute(attr) } catch {} }, ms || 1400)
        } catch {}
      }
      function focusChip(index) {
        const item = chips[index]
        if (!item || !item.chip || !item.chip.isConnected) { schedule(); return }
        try { item.chip.scrollIntoView({ block: 'nearest', inline: 'nearest' }) } catch {}
        flash(item.chip, 'data-dsh-chip-flash', 1400)
        if (row && row.isConnected) {
          const card = row.querySelectorAll('[data-dsh-refcard]')[index]
          if (card) flash(card, 'data-dsh-refflash', 1400)
        }
      }
      function cardNode(item, index) {
        const card = document.createElement('div')
        card.setAttribute('data-dsh-refcard', '')
        card.setAttribute('role', 'listitem')
        card.setAttribute('tabindex', '0')
        card.title = item.name + '（点击定位正文里的引用）'
        const num = document.createElement('span')
        num.setAttribute('data-dsh-refnum', '')
        num.textContent = String(index + 1)
        const icon = document.createElement('span')
        icon.setAttribute('data-dsh-reficon', '')
        icon.style.background = item.kind.color
        icon.textContent = item.ext.slice(0, 4).toUpperCase()
        const body = document.createElement('span')
        body.setAttribute('data-dsh-refbody', '')
        const name = document.createElement('span')
        name.setAttribute('data-dsh-refname', '')
        name.textContent = item.name
        const meta = document.createElement('span')
        meta.setAttribute('data-dsh-refmeta', '')
        meta.textContent = item.kind.label
        body.append(name, meta)
        card.append(num, icon, body)
        card.addEventListener('click', () => focusChip(index))
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focusChip(index) }
        })
        return card
      }
      function sync() {
        if (!enabled) return
        const card = composerCard()
        if (!card) { chips = []; signature = ''; hideRow(); return }
        const next = collect(card)
        chips = next
        const sig = next.map((item) => item.name + '#' + item.ext).join('|')
        if (sig !== signature) {
          signature = sig
          if (!next.length) { hideRow(); return }
          const rowEl = ensureRow(card)
          rowEl.replaceChildren(...next.map((item, index) => cardNode(item, index)))
          return
        }
        // 内容没变但行还在（常见于 React 重渲染把子节点重建），重新挂到卡片内部。
        if (next.length) ensureRow(card)
        else hideRow()
      }
      function schedule() {
        if (raf) return
        const rafFn = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 16)
        raf = rafFn(() => { raf = 0; sync() })
      }
      // 点正文里的引用 → 高亮对应卡片（capture 阶段，不阻止原生行为）。
      function onDocClick(event) {
        const target = event.target
        if (!target || typeof target.closest !== 'function') return
        const chip = target.closest('[data-composer-chip]')
        if (!chip) return
        const index = chips.findIndex((item) => item.chip === chip)
        if (index < 0 || !row || !row.isConnected) return
        const card = row.querySelectorAll('[data-dsh-refcard]')[index]
        if (card) flash(card, 'data-dsh-refflash', 1400)
      }
      function start() {
        if (enabled) return
        enabled = true
        // HMR 重载时旧插件实例可能没被回收：用 window 上的单例把手把它停掉，避免每实例各插一行。
        try {
          const prev = globalThis.__dshStyleRefCards
          if (prev && prev !== api && typeof prev.stop === 'function') prev.stop()
        } catch {}
        try { globalThis.__dshStyleRefCards = api } catch {}
        // 旧实例残留（HMR/重载）先清掉，避免叠两排。
        for (const stale of Array.from(document.querySelectorAll('[data-dsh-refcards]'))) { try { stale.remove() } catch {} }
        for (const stale of Array.from(document.querySelectorAll('[data-dsh-chip-flash]'))) { try { stale.removeAttribute('data-dsh-chip-flash') } catch {} }
        if (typeof MutationObserver === 'function') {
          observer = new MutationObserver(schedule)
          observer.observe(document.body, { childList: true, subtree: true, characterData: true })
        }
        window.addEventListener('resize', schedule)
        docClick = onDocClick
        document.addEventListener('click', docClick, true)
        schedule()
      }
      function stop() {
        enabled = false
        if (observer) { try { observer.disconnect() } catch {} observer = null }
        window.removeEventListener('resize', schedule)
        if (docClick) { document.removeEventListener('click', docClick, true); docClick = null }
        if (raf) { try { cancelAnimationFrame(raf) } catch {} raf = 0 }
        for (const item of chips) { try { item.chip.removeAttribute('data-dsh-chip-flash') } catch {} }
        chips = []
        signature = ''
        hideRow()
        try { if (globalThis.__dshStyleRefCards === api) delete globalThis.__dshStyleRefCards } catch {}
      }
      const api = { start, stop, refresh: schedule }
      return api
    })()


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

    let rbSettleTimer = 0

    // 把 frame 的内联 grid-template-columns 规范成可插值形式，并在 React 每次改写后同步纠正。
    //   `288px minmax(400px, 1fr) minmax(0px, 632px)` → `288px 1fr 632px`
    // 只处理三轨道且形态匹配的原值；匹配不上就原样保留，绝不猜。
    const GRID_COLS_RE = /^\s*([\d.]+px)\s+minmax\(\s*(?:0px|\d+(?:\.\d+)?px)?\s*,\s*1fr\s*\)\s+minmax\(\s*0px\s*,\s*([\d.]+px)\s*\)\s*$/

    function normalizeGridColumns(frame) {
      if (typeof document === 'undefined' || !frame) return
      if (!frame.__dshGridSync) {
        frame.__dshGridSync = true
        const apply = () => {
          const raw = frame.style.getPropertyValue('grid-template-columns')
          if (!raw) return
          const hit = GRID_COLS_RE.exec(raw)
          if (!hit) return
          const normalized = hit[1] + ' 1fr ' + hit[2]
          if (raw === normalized && frame.style.getPropertyPriority('grid-template-columns') === 'important') return
          frame.style.setProperty('grid-template-columns', normalized, 'important')
        }
        // 同步纠正：MutationObserver 回调在下一个绘制之前执行，
        // 所以 React 写入与纠正发生在同一帧，浏览器看不到中间值。
        new MutationObserver(apply).observe(frame, { attributes: true, attributeFilter: ['style'] })
        apply()
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
      // 右栏布局动画状态机（供 CSS 使用，避免"关闭第一帧就切成最终外观"）：
      //   closed  = 已收起
      //   opening = 正在展开（右栏从 0 长出来）
      //   open    = 完全展开
      //   closing = 正在关闭（右栏仍有宽度、正在收）→ 视觉上仍按"合体大框"处理
      // 左侧栏单独开关时 data-animating 也会出现，但右栏宽度是 0，不会误判成 closing。
      const rbCol = frame.querySelector(':scope > [data-rightbar-col]')
      const rbCollapsed = frame.hasAttribute('data-rightbar-collapsed')
      const rbAnimating = frame.hasAttribute('data-animating')
      const rbWidth = rbCol ? rbCol.getBoundingClientRect().width : 0
      let rbState = rbCollapsed ? 'closed' : 'open'
      if (rbAnimating) {
        if (!rbCollapsed) rbState = 'opening'
        else if (rbWidth > 1) rbState = 'closing'
      }
      const prevRb = frame.getAttribute('data-dsh-rb')
      if (prevRb !== rbState) frame.setAttribute('data-dsh-rb', rbState)
      // 动画态兜底：transitionend 之后若没有触发新的 DOM 变更，700ms 后强制重算一次收尾
      if (rbState === 'opening' || rbState === 'closing') {
        if (rbSettleTimer) clearTimeout(rbSettleTimer)
        rbSettleTimer = setTimeout(() => { rbSettleTimer = 0; scheduleTag() }, 700)
      }


      // 让右侧栏开合真正插值：DSH 内联写的是
      //   `${sidebar}px minmax(0|400px, 1fr) minmax(0px, ${rightbar}px)`
      // 收起/展开时中间轨道的 min 在 0px 与 400px 之间变，轨道列表整体不可插值
      // → 真机逐帧采样证实 grid-template-columns 的 transition 从未启动（列宽一帧到位）。
      // 这里把三条轨道统一成「固定长度 + 1fr + 固定长度」，开关时只有最后一条变化，
      // 浏览器才能逐帧插值出真实布局宽度。
      normalizeGridColumns(frame)

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
        attributeFilter: ['data-ds-dark-theme', 'data-sidebar-collapsed', 'data-rightbar-collapsed', 'data-animating'],
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
        if (cfg.refCards !== false) rules.push(REFCARD_CSS)
        if (cfg.reduceMotion) rules.push(MOTION_CSS)
        if (cfg.hideScrollbars) rules.push(SCROLL_CSS)
        el.textContent = rules.join('\n')
      }
      if (cfg.qoderHome === false) tagQoderHome()
      if (cfg.titlebarButtons === false) unmountTitlebar()
      // 输入框引用卡片：开关变化时启停只读镜像（默认开）。
      if (cfg.refCards !== false) refCards.start()
      else refCards.stop()
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
      refCards.stop()
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
        h(SwitchRow, { label: '标题栏窗口按钮（折叠 / 后退 / 前进 / 刷新）', checked: cfg.titlebarButtons !== false, onChange: (value) => set({ titlebarButtons: value }) }),
        h(SwitchRow, { label: '标题栏刷新按钮（真正重新加载页面）', checked: cfg.titlebarRefresh !== false, onChange: (value) => set({ titlebarRefresh: value }) }),
        h(SwitchRow, { label: '输入框引用卡片（正文 @文件镜像到输入框顶部）', checked: cfg.refCards !== false, onChange: (value) => set({ refCards: value }) }))
    }

    // 交互：属于「功能」类的行为开关（默认开）。
    function InteractionCard({ cfg, set }) {
      return h('section', { style: sectionStyle, 'aria-label': '交互' },
        h('h3', { style: sectionTitleStyle }, '交互'),
        h(SwitchRow, { label: '会话行时间 / 操作收进「更多」', checked: cfg.workspaceRowCompact !== false, onChange: (value) => set({ workspaceRowCompact: value }) }),
        h(SwitchRow, { label: '「智能体 / 通用」入口改名并归位', checked: cfg.agentEntryMerge !== false, onChange: (value) => set({ agentEntryMerge: value }) }))
    }

    // 规划中的条目：只做「记录需求」的占位行（参照上下文感知插件的 v0.2 行）——
    // badge + 禁用开关 + 说明，不写 localStorage、不接任何设置。
    const plannedBadgeStyle = {
      padding: '0 6px',
      border: '0.5px solid var(--dsw-alias-border-l3, rgba(0,0,0,.16))',
      borderRadius: '999px',
      fontSize: '11px',
      lineHeight: '16px',
      color: 'var(--dsw-alias-label-tertiary, #8a9099)',
    }
    function PlannedRow({ label, hint }) {
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 0' } },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' } },
          h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 } },
            h('span', { style: { fontSize: '14px', color: 'var(--dsw-alias-label-secondary, inherit)' } }, label),
            h('span', { style: plannedBadgeStyle }, 'v0.2')),
          // 纯占位：开关禁用且不接 onChange，避免看起来像能开。
          h('div', { style: { pointerEvents: 'none', opacity: 0.55 }, 'aria-hidden': 'true' },
            h(Switch, { checked: false, disabled: true, onChange: () => {} }))),
        hint ? h('p', { style: hintStyle }, hint) : null)
    }
    function PlannedCard() {
      return h('section', { style: sectionStyle, 'aria-label': '规划中' },
        h('h3', { style: sectionTitleStyle }, '规划中（未实现）'),
        h(PlannedRow, {
          label: '输入框引用卡片 · 剩余部分',
          hint: '卡片的镜像显示、双向高亮与自动编号已实现（见上方「输入框引用卡片」开关）。v0.2 剩余：正文引用显示为「附件 N」短链接；卡片上的 × 回删正文引用（插件没有编辑器 API，目前只能点卡片定位）。',
        }))
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
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-sidebar-collapsed', 'data-rightbar-collapsed', 'data-animating'] })
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
        h(SwitchRow, { label: '首页苹果树邮戳插画（悬停互动）', checked: cfg.homeStamp !== false, onChange: (value) => set({ homeStamp: value }) }),
        h('p', { style: hintStyle }, '只作用于新建会话首页（hero 相位）：欢迎区与热力图在上、输入框在下，进入正常对话后自动失效。热力图读真实会话数据，按每个会话的「最近活动日」（updatedAt）计数，不是逐日事件史。'))
    }

    // -------------------------------------------------- Qoder 首页：苹果树邮戳卡
    // 素材内联为 data URL（插件是单文件 CJS，无法按相对路径取图）。
    const QODER_STAMP_IMG = {treeDefault: 'data:image/webp;base64,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', treeColor: 'data:image/webp;base64,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', stamp: 'data:image/webp;base64,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'}
    const QODER_STAMP_COPY = [
      '一个小念头，也能长成一片森林。今天想做些什么？',
      '让好奇心先走一步。把刚刚想到的点子写下来吧。',
    ]

    // 苹果光标：只作用于插画热区，用原生 cursor 跟随，不做拖尾。
    let qoderCursorCache = null
    function qoderAppleCursor() {
      if (qoderCursorCache !== null) return qoderCursorCache
      qoderCursorCache = ''
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 32
        canvas.height = 32
        const ctx = canvas.getContext('2d')
        if (!ctx) return qoderCursorCache
        ctx.font = '24px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🍎', 16, 17)
        qoderCursorCache = 'url(' + canvas.toDataURL('image/png') + ') 16 16, pointer'
      } catch (error) {
        qoderCursorCache = ''
      }
      return qoderCursorCache
    }

    // 极简弹簧积分（stiffness 120 / damping 16，质量 1），不引入动画库。
    function qoderSpring() {
      let value = 0
      let velocity = 0
      let target = 0
      let raf = 0
      let last = 0
      const tick = (now) => {
        const dt = Math.min(0.064, Math.max(0.001, (now - last) / 1000))
        last = now
        velocity += (-120 * (value - target) - 16 * velocity) * dt
        value += velocity * dt
        if (Math.abs(value - target) < 0.02 && Math.abs(velocity) < 0.02) {
          value = target
          velocity = 0
          raf = 0
          return
        }
        raf = requestAnimationFrame(tick)
      }
      return {
        set(next) {
          target = next
          if (raf) return
          last = performance.now()
          raf = requestAnimationFrame(tick)
        },
        read() { return value },
        stop() { if (raf) cancelAnimationFrame(raf); raf = 0 },
      }
    }

    function QoderStampCard(props) {
      const useSessions = props.useSessions
      const sessionId = props.sessionId
      const [settings, setSettings] = React.useState(store.get)
      React.useEffect(() => store.subscribe(() => setSettings(store.get())), [])
      const blank = typeof useSessions === 'function'
        ? useSessions((value) => Boolean(value && value.byId && sessionId !== void 0 && value.byId[sessionId] && value.byId[sessionId].blank === true))
        : false
      const [copy, setCopy] = React.useState(null)
      const [treeOn, setTreeOn] = React.useState(false)
      const rootRef = React.useRef(null)
      const tipRef = React.useRef(null)
      const onRef = React.useRef(false)

      const open = React.useCallback(() => {
        if (onRef.current) return
        onRef.current = true
        // 每次进入热区随机选一条，一次悬停期间固定（pointermove 不再随机）
        setCopy(QODER_STAMP_COPY[Math.random() < 0.5 ? 0 : 1])
      }, [])
      const close = React.useCallback(() => {
        onRef.current = false
        setCopy(null)
        setTreeOn(false)
      }, [])

      // 说明卡：定位 + 弹簧摇摆（只写 DOM，不在 pointermove 里 setState）
      React.useLayoutEffect(() => {
        if (copy === null) return
        const root = rootRef.current
        const node = tipRef.current
        if (!root || !node) return
        const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const gap = 12
        const marginX = 28
        const marginY = 16
        const place = () => {
          const rect = root.getBoundingClientRect()
          const width = node.offsetWidth
          const height = node.offsetHeight
          let left = rect.left + rect.width / 2 - width / 2
          left = Math.max(marginX, Math.min(window.innerWidth - width - marginX, left))
          let top = rect.top - gap - height
          if (top < marginY) top = rect.bottom + gap
          node.style.left = Math.round(left) + 'px'
          node.style.top = Math.round(top) + 'px'
          return rect
        }
        let rect = place()
        const rotate = qoderSpring()
        const shift = qoderSpring()
        let raf = 0
        const paint = () => {
          node.style.transform = 'rotate(' + rotate.read().toFixed(2) + 'deg) translateX(' + shift.read().toFixed(2) + 'px)'
          raf = requestAnimationFrame(paint)
        }
        if (!reduced) raf = requestAnimationFrame(paint)
        const onMove = (event) => {
          if (reduced) return
          const dx = Math.max(-60, Math.min(60, event.clientX - rect.left - rect.width / 2))
          rotate.set(dx / 60 * 8)
          shift.set(dx / 60 * 12)
        }
        const onResize = () => { rect = place() }
        window.addEventListener('pointermove', onMove, { passive: true })
        window.addEventListener('resize', onResize)
        window.addEventListener('scroll', onResize, true)
        return () => {
          if (raf) cancelAnimationFrame(raf)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('resize', onResize)
          window.removeEventListener('scroll', onResize, true)
          rotate.stop()
          shift.stop()
        }
      }, [copy])

      React.useEffect(() => () => { onRef.current = false }, [])

      if (settings.qoderHome === false || settings.homeStamp === false || !blank) return null

      const card = h('div', {
        ref: rootRef,
        className: 'dsh-qstamp',
        tabIndex: 0,
        role: 'img',
        'data-active': copy === null ? 'false' : 'true',
        'data-tree': treeOn ? 'true' : 'false',
        'aria-label': '苹果树插画：1666 年的苹果树邮票',
        'aria-describedby': copy === null ? undefined : 'dsh-qstamp-tip',
        style: { cursor: qoderAppleCursor() || undefined },
        onPointerEnter: open,
        onPointerLeave: close,
        onFocus: () => { open(); setTreeOn(true) },
        onBlur: close,
        onKeyDown: (event) => {
          if (event.key !== 'Escape') return
          close()
          if (event.currentTarget && event.currentTarget.blur) event.currentTarget.blur()
        },
        onClick: () => { if (onRef.current) close(); else open() },
      },
        h('div', { className: 'dsh-qstamp-plate' }),
        h('div', {
          className: 'dsh-qstamp-tree',
          onPointerEnter: () => setTreeOn(true),
          onPointerLeave: () => setTreeOn(false),
        },
          h('img', { className: 'dsh-qstamp-img', 'data-layer': 'default', src: QODER_STAMP_IMG.treeDefault, alt: '', draggable: false }),
          h('img', { className: 'dsh-qstamp-img', 'data-layer': 'color', src: QODER_STAMP_IMG.treeColor, alt: '', draggable: false }),
        ),
        h('span', { className: 'dsh-qstamp-year' }, '1666'),
        h('span', { className: 'dsh-qstamp-cap' }, 'The Apple', h('br'), 'Gravity · 1666'),
        h('img', { className: 'dsh-qstamp-stamp', src: QODER_STAMP_IMG.stamp, alt: '', draggable: false }),
      )

      const tip = copy !== null && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined'
        ? ReactDOM.createPortal(
            h('div', { className: 'dsh-qstamp-tip', id: 'dsh-qstamp-tip', role: 'tooltip', ref: tipRef },
              h('h4', null, '苹果树下的灵感'),
              h('p', null, copy)),
            document.body)
        : null
      return h(React.Fragment, null, card, tip)
    }

    // 预加载三张图，避免第一次悬停闪图
    if (typeof Image === 'function') {
      for (const src of [QODER_STAMP_IMG.treeDefault, QODER_STAMP_IMG.treeColor, QODER_STAMP_IMG.stamp]) {
        const preload = new Image()
        preload.src = src
      }
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
        h(EntityDetailCardSettings, { cfg, set: store.set }),
        h(InteractionCard, { cfg, set: store.set }),
        h(PlannedCard, {}))
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

    // ================================================================
    // 实体详情（Entity Detail）—— 内部模块
    //
    // 设计要点（与 Phase 0 验证结论一致）：
    //  · 识别在 host 半（ctx.llm），client 只负责触发与渲染；
    //  · 只对已 settled 的 Assistant 消息注入（无 [data-streaming]）；
    //  · 用 SSE 无关的「签名 + 缓存」保证重复渲染幂等；
    //  · 面板走原生 shell.overlay（不碰 rightbar）；
    //  · 分栏靠中栏 padding-right（不是缩窄后仍居中）；
    //  · 全部副作用可逆：stop() 必须断开/取消/解包/移除。
    // ================================================================
    const ENTITY_UI_KEY = 'dsh-style:entity'
    const ENTITY_SKIP = 'pre, code, a, button, .katex, [data-footnotes], [contenteditable="true"], textarea, input, svg, [data-dsh-entity]'
    const ENTITY_MAX_PER_MSG = 24
    // 只处理最近的若干条已定型消息：首次进入长会话时避免把整段历史都送进模型。
    const ENTITY_SCAN_LIMIT = 6

    // ---- 面板状态（不可变快照：useSyncExternalStore 要求引用变化） ----
    const entityUi = (() => {
      let state = { open: false, mounted: false, name: null, type: null, status: 'idle', card: null, error: null, width: 420, animKey: 0 }
      const listeners = new Set()
      return {
        get: () => state,
        set: (patch) => {
          state = { ...state, ...patch }
          for (const listener of listeners) { try { listener() } catch {} }
        },
        subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
      }
    })()

    // ---------------------------------------------------------------
    // 容器级布局：Entity Frame 必须活在「中间会话主容器」里
    //
    // 真实 DOM（Phase 2 用 ResizeObserver + DOMRect 实测）：
    //   [data-dsh-style-main] (centerCol, 与原生右栏同一层)
    //     └ .root(ConversationRoot, position:relative)   ← 我们的定位容器
    //         ├ header(38px)                            ← 顶部工具栏，不参与收窄
    //         └ [data-conversation-content]             ← Chat Frame 区
    //             └ [data-conversation-scroll]
    //                 ├ 聊天流根(下方正文)               ← 让出宽度
    //                 └ [data-composer-seat]
    //                     ├ [data-composer-card]        ← 让出宽度
    //                     └ [data-composer-dock]        ← 统计栏，保持全宽
    //
    // 因此：面板绝对定位在 .root 内（right:0 → 主容器右缘，永远到不了原生右栏），
    // top = header 底边，bottom = 输入框卡片底边；只给「聊天流根」和「输入框卡片」
    // 让出宽度，header 与统计栏完全不动。
    // ---------------------------------------------------------------
    const ENTITY_MIN_PANEL = 300
    const ENTITY_MIN_CHAT = 240
    const ENTITY_MIN_PANEL_NARROW = 180
    const ENTITY_IDEAL = 380
    const ENTITY_MAX_PANEL = 480
    const ENTITY_GAP = 12

    function entityHostEl() {
      if (typeof document === 'undefined') return null
      return document.querySelector('[data-dsh-entity-host]')
    }

    // 聊天流根：scroll 里除 composerSeat 之外的「有实际盒子」的子树。
    // 原生结构是 scroll > div[data-slot](display:contents) > 真正的 viewArea，
    // 所以遇到 display:contents 的插槽出口要往下钻一层，否则 padding 不生效。
    function entityChatEl() {
      const scroll = document.querySelector('[data-conversation-scroll]')
      if (!scroll) return null
      const pick = (el, depth) => {
        if (!el || depth > 4) return null
        if (el.hasAttribute('data-composer-seat')) return null
        const cs = getComputedStyle(el)
        if (cs.display !== 'contents' && el.getBoundingClientRect().width > 0) return el
        for (const child of el.children) {
          const hit = pick(child, depth + 1)
          if (hit) return hit
        }
        return null
      }
      for (const child of scroll.children) {
        const hit = pick(child, 0)
        if (hit) return hit
      }
      return null
    }

    function tagEntityLayout() {
      if (typeof document === 'undefined') return null
      const main = document.querySelector('[data-dsh-style-main]')
      if (!main) return null
      const root = main.querySelector('[data-phase]') || main.firstElementChild
      const chat = entityChatEl()
      if (root && !root.hasAttribute('data-dsh-entity-host')) root.setAttribute('data-dsh-entity-host', '')
      if (chat && !chat.hasAttribute('data-dsh-entity-chat')) chat.setAttribute('data-dsh-entity-chat', '')
      return { main, root, chat }
    }

    function untagEntityLayout() {
      if (typeof document === 'undefined') return
      for (const el of document.querySelectorAll('[data-dsh-entity-host]')) el.removeAttribute('data-dsh-entity-host')
      for (const el of document.querySelectorAll('[data-dsh-entity-chat]')) {
        el.removeAttribute('data-dsh-entity-chat')
        el.style.removeProperty('padding-right')
      }
      for (const el of document.querySelectorAll('[data-composer-card]')) el.style.removeProperty('margin-right')
    }

    // 计算：可用宽度 → 面板宽度 / 模式 / 上下边界（全部来自真实 DOMRect）
    function computeEntityLayout() {
      const tagged = tagEntityLayout()
      if (!tagged || !tagged.root) return null
      const { main, root } = tagged
      const rr = root.getBoundingClientRect()
      const header = root.querySelector('[data-window-drag]')
      const hr = header ? header.getBoundingClientRect() : null
      const card = root.querySelector('[data-composer-card]')
      const cr = card ? card.getBoundingClientRect() : null
      const avail = Math.round(rr.width)
      const top = hr ? Math.max(0, Math.round(hr.bottom - rr.top)) : 38
      const bottomGap = cr ? Math.max(0, Math.round(rr.bottom - cr.bottom)) : 0

      // 宽度策略（全部基于中间会话容器的实测宽度，不用窗口宽度）：
      //   1) 常规：380 左右（视口容器 34%），上限 480、下限 300；
      //   2) 空间不足：收窄面板，但必须同时保证正文 >= 240（不覆盖、不压瘪）；
      //   3) 极端窄（< 520）：才退化成贴在输入框上方的卡片。
      let width = Math.min(ENTITY_MAX_PANEL, Math.max(ENTITY_MIN_PANEL, Math.min(ENTITY_IDEAL, Math.round(avail * 0.34))))
      let mode = 'side'
      if (avail - width - ENTITY_GAP < ENTITY_MIN_CHAT) {
        width = Math.max(ENTITY_MIN_PANEL_NARROW, avail - ENTITY_MIN_CHAT - ENTITY_GAP)
      }
      if (avail < 520 || width < ENTITY_MIN_PANEL_NARROW) {
        mode = 'bottom'
        width = Math.max(240, avail - 24)
      }
      return { avail, top, bottomGap, width, mode, rootRect: { x: rr.x, y: rr.y, w: rr.width, h: rr.height }, cardBottom: cr ? cr.bottom : null, headerBottom: hr ? hr.bottom : null }
    }

    let entityLayoutObserver = null
    let entityLayoutRaf = 0
    function applyEntityLayout(open) {
      if (typeof document === 'undefined') return null
      const tagged = tagEntityLayout()
      if (!tagged || !tagged.root) return null
      const root = document.documentElement
      const { main, root: hostEl, chat } = tagged
      if (!open) {
        root.removeAttribute('data-dsh-style-entity')
        if (hostEl) hostEl.removeAttribute('data-dsh-entity-open')
        if (chat) chat.removeAttribute('data-dsh-entity-open')
        for (const el of document.querySelectorAll('[data-composer-card]')) el.removeAttribute('data-dsh-entity-open')
        if (hostEl) {
          hostEl.style.removeProperty('--dsh-entity-w')
          hostEl.style.removeProperty('--dsh-entity-top')
          hostEl.style.removeProperty('--dsh-entity-bottom')
        }
        return null
      }
      const layout = computeEntityLayout()
      if (!layout) return null
      // 归一化：先把可能残留的让位标记全清掉，再按当前模式重新决定，
      // 避免「右栏打开 → 模式切换」时旧 padding 留在别的节点上把正文挤成竖排。
      for (const el of document.querySelectorAll('[data-dsh-entity-chat]')) el.removeAttribute('data-dsh-entity-open')
      for (const el of document.querySelectorAll('[data-composer-card]')) el.removeAttribute('data-dsh-entity-open')
      root.setAttribute('data-dsh-style-entity', 'open')
      hostEl.setAttribute('data-dsh-entity-open', layout.mode)
      hostEl.style.setProperty('--dsh-entity-w', layout.width + 'px')
      hostEl.style.setProperty('--dsh-entity-top', layout.top + 'px')
      hostEl.style.setProperty('--dsh-entity-bottom', layout.bottomGap + 'px')
      if (layout.mode === 'side' && chat) {
        // 自检：让位后正文内容宽度必须仍然可用，否则退化为底部卡片
        const reserve = layout.width + 20
        const inner = chat.clientWidth - reserve
        if (inner >= 180) {
          chat.setAttribute('data-dsh-entity-open', '')
          for (const el of document.querySelectorAll('[data-composer-card]')) el.setAttribute('data-dsh-entity-open', '')
        } else {
          layout.mode = 'bottom'
          layout.width = Math.max(240, layout.avail - 24)
          hostEl.setAttribute('data-dsh-entity-open', 'bottom')
          hostEl.style.setProperty('--dsh-entity-w', layout.width + 'px')
        }
      } else if (layout.mode === 'side') {
        layout.mode = 'bottom'
        layout.width = Math.max(240, layout.avail - 24)
        hostEl.setAttribute('data-dsh-entity-open', 'bottom')
        hostEl.style.setProperty('--dsh-entity-w', layout.width + 'px')
      } else {
        if (chat) chat.removeAttribute('data-dsh-entity-open')
        for (const el of document.querySelectorAll('[data-composer-card]')) el.removeAttribute('data-dsh-entity-open')
      }
      entityUi.set({ width: layout.width })
      return layout
    }

    function scheduleEntityLayout() {
      if (typeof document === 'undefined') return
      if (entityLayoutRaf) return
      entityLayoutRaf = requestAnimationFrame(() => {
        entityLayoutRaf = 0
        if (entityUi.get().open || entityUi.get().mounted) applyEntityLayout(entityUi.get().open)
      })
    }

    function ensureEntityLayoutObserver() {
      if (typeof document === 'undefined' || entityLayoutObserver) return
      try {
        entityLayoutObserver = new ResizeObserver(() => scheduleEntityLayout())
        const main = document.querySelector('[data-dsh-style-main]')
        if (main) entityLayoutObserver.observe(main)
        const card = document.querySelector('[data-composer-card]')
        if (card) entityLayoutObserver.observe(card)
      } catch {}
      window.addEventListener('resize', scheduleEntityLayout)
    }

    function stopEntityLayoutObserver() {
      if (entityLayoutObserver) { try { entityLayoutObserver.disconnect() } catch {} entityLayoutObserver = null }
      if (typeof window !== 'undefined') window.removeEventListener('resize', scheduleEntityLayout)
      if (entityLayoutRaf) { try { cancelAnimationFrame(entityLayoutRaf) } catch {} entityLayoutRaf = 0 }
    }

    // ---- 客户端缓存的 host 能力探测（host 半未加载时优雅降级） ----
    let entityHostReady = null
    async function entityHostProbe() {
      if (entityHostReady !== null) return entityHostReady
      try {
        const res = await fetch('/api/style-entity/ping', { headers: { accept: 'application/json' } })
        entityHostReady = res.ok
      } catch { entityHostReady = false }
      return entityHostReady
    }

    // ---- 识别结果缓存（同一段文本只请求一次） ----
    const entityCache = new Map()   // textHash -> { entities: [...], at }
    const entityPending = new Map() // textHash -> Promise
    function hashText(text) {
      let h1 = 5381
      let h2 = 52711
      for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i)
        h1 = ((h1 * 33) ^ c) >>> 0
        h2 = ((h2 * 31) ^ c) >>> 0
      }
      return h1.toString(36) + h2.toString(36) + ':' + text.length
    }

    async function extractEntities(text, signal) {
      const key = hashText(text)
      const hit = entityCache.get(key)
      if (hit) return hit.entities
      if (entityPending.has(key)) return entityPending.get(key)
      const task = (async () => {
        try {
          const res = await fetch('/api/style-entity/extract', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text }),
            signal,
          })
          if (!res.ok) return []
          const data = await res.json()
          const entities = Array.isArray(data && data.entities) ? data.entities.filter((e) => e && e.ok !== false && e.quote) : []
          entityCache.set(key, { entities, at: Date.now() })
          if (entityCache.size > 200) entityCache.delete(entityCache.keys().next().value)
          return entities
        } catch { return [] } finally { entityPending.delete(key) }
      })()
      entityPending.set(key, task)
      return task
    }

    // ---- 注入：把实体名包成可点击元素 ----
    let entityLinks = []
    function entityRoots() {
      if (typeof document === 'undefined') return []
      const out = []
      const rows = document.querySelectorAll('[data-chat-flow-kind="assistant-step"]')
      for (const row of rows) {
        if (row.querySelector('[data-streaming]')) continue
        for (const md of row.querySelectorAll('[class*="_markdown_"]')) out.push(md)
      }
      return out
    }

    function injectInto(root, entities) {
      if (!entities || entities.length === 0) return 0
      const quotes = entities
        .map((e) => ({ name: String(e.name || e.quote || ''), quote: String(e.quote || e.name || ''), type: String(e.type || '') }))
        .filter((e) => e.quote.length >= 2)
        .sort((a, b) => b.quote.length - a.quote.length)
      if (quotes.length === 0) return 0
      let added = 0
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const targets = []
      let node
      while ((node = walker.nextNode())) {
        const parent = node.parentElement
        if (!parent) continue
        if (parent.closest(ENTITY_SKIP)) continue
        if (!node.nodeValue || !node.nodeValue.trim()) continue
        targets.push(node)
      }
      for (const textNode of targets) {
        if (added >= ENTITY_MAX_PER_MSG) break
        const text = textNode.nodeValue
        let best = null
        for (const q of quotes) {
          const at = text.indexOf(q.quote)
          if (at < 0) continue
          if (!best || at < best.at || (at === best.at && q.quote.length > best.quote.length)) best = { at, ...q }
        }
        if (!best) continue
        const before = text.slice(0, best.at)
        const hit = text.slice(best.at, best.at + best.quote.length)
        const after = text.slice(best.at + best.quote.length)
        const link = document.createElement('a')
        link.setAttribute('data-dsh-entity', best.name || hit)
        link.setAttribute('data-dsh-entity-type', best.type)
        link.setAttribute('data-dsh-entity-quote', hit)
        link.setAttribute('role', 'button')
        link.setAttribute('tabindex', '0')
        link.textContent = hit
        const frag = document.createDocumentFragment()
        if (before) frag.appendChild(document.createTextNode(before))
        frag.appendChild(link)
        if (after) frag.appendChild(document.createTextNode(after))
        textNode.parentNode.replaceChild(frag, textNode)
        entityLinks.push(link)
        added++
      }
      return added
    }

    function unwrapEntities() {
      if (typeof document === 'undefined') { entityLinks = []; return }
      for (const link of entityLinks) {
        try {
          const parent = link.parentNode
          if (!parent) continue
          parent.replaceChild(document.createTextNode(link.textContent), link)
          parent.normalize()
        } catch {}
      }
      entityLinks = []
      for (const root of document.querySelectorAll('[data-dsh-entity-sig]')) {
        root.removeAttribute('data-dsh-entity-sig')
      }
    }

    // ---- 面板内容 ----
    async function openEntity(name, type, context) {
      tagEntityLayout()
      ensureEntityLayoutObserver()
      const layout = applyEntityLayout(true)
      const width = layout ? layout.width : 380
      entityUi.set({ open: true, mounted: true, name, type, status: 'loading', card: null, error: null, width, mode: layout ? layout.mode : 'side', animKey: entityUi.get().animKey + 1 })
      try {
        const res = await fetch('/api/style-entity/enrich', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, type, context: String(context || '').slice(0, 600) }),
        })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const data = await res.json()
        entityUi.set({ status: data && data.matched ? 'ready' : 'empty', card: data || null })
      } catch (error) {
        entityUi.set({ status: 'empty', error: String((error && error.message) || error) })
      }
    }

    function closeEntity() {
      entityUi.set({ open: false, status: 'idle' })
      applyEntityLayout(false)
      // 等滑出动画结束再卸载节点；禁用时 stop() 会立刻 unmountEntity()
      setTimeout(() => { if (!entityUi.get().open) entityUi.set({ mounted: false }) }, 420)
    }

    function unmountEntity() {
      entityUi.set({ open: false, mounted: false, status: 'idle', card: null })
    }

    const ENTITY_CSS = [
      // 只让「正文」和「输入框卡片」让位；header 与统计栏不动。
      '[data-dsh-entity-chat][data-dsh-entity-open]{padding-right:calc(var(--dsh-entity-w,380px) + 20px);transition:padding-right .3s cubic-bezier(.22,1,.36,1);}',
      '[data-composer-card][data-dsh-entity-open]{margin-right:calc(var(--dsh-entity-w,380px) + 20px);transition:margin-right .3s cubic-bezier(.22,1,.36,1);}',
      'html[data-dsh-style-entity="open"] [data-dsh-entity]{color:inherit;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;cursor:pointer;border-radius:3px;}',
      'html[data-dsh-style-entity="open"] [data-dsh-entity]:hover{background:rgba(96,165,250,.16);}',
      '[data-dsh-entity]{color:inherit;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;cursor:pointer;}',
      // 定位容器 = [data-dsh-entity-host]（会话根，position:relative，已是原生样式）
      // right:0 → 主容器右缘；top/bottom 由实测 DOMRect 写入，不用窗口尺寸。
      '[data-dsh-entity-panel]{position:absolute;right:0;top:var(--dsh-entity-top,38px);bottom:var(--dsh-entity-bottom,0px);width:var(--dsh-entity-w,380px);box-sizing:border-box;z-index:40;pointer-events:none;display:flex;align-items:flex-end;justify-content:flex-end;padding:0 8px 8px 0;}',
      // 空间不足时的明确降级：贴在输入框上方，不横向挤压正文与输入框。
      '[data-dsh-entity-host][data-dsh-entity-open="bottom"] [data-dsh-entity-panel]{left:12px;right:12px;width:auto;top:auto;bottom:calc(var(--dsh-entity-bottom,0px) + 8px);max-height:46%;padding:0;}',
      '[data-dsh-entity-panel][data-open="true"]{pointer-events:auto;}',
      '[data-dsh-entity-card]{pointer-events:auto;box-sizing:border-box;width:100%;max-height:100%;margin:0 8px 8px 0;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base,#1b1b1f);color:var(--dsw-alias-text-primary,#f5f5f5);border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.28));border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.32);transform:translateY(calc(100% + 16px));transition:transform .34s cubic-bezier(.22,1,.36,1);font:13px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;}',
      '[data-dsh-entity-panel][data-open="true"] [data-dsh-entity-card]{transform:translateY(0);}',
      '[data-dsh-entity-head]{display:flex;align-items:flex-start;gap:10px;padding:14px 14px 10px;}',
      '[data-dsh-entity-title]{font-size:16px;font-weight:650;line-height:1.3;word-break:break-word;}',
      '[data-dsh-entity-kind]{display:inline-block;margin-top:4px;padding:1px 8px;border-radius:999px;font-size:11px;opacity:.75;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.32));}',
      '[data-dsh-entity-close]{margin-left:auto;flex:0 0 auto;width:26px;height:26px;border-radius:8px;border:0;background:transparent;color:inherit;cursor:pointer;opacity:.6;font-size:15px;line-height:1;}',
      '[data-dsh-entity-close]:hover{opacity:1;background:rgba(128,128,128,.16);}',
      '[data-dsh-entity-body]{padding:0 14px 14px;overflow:auto;}',
      '[data-dsh-entity-imgwrap]{margin:0 14px 12px;border-radius:12px;overflow:hidden;background:rgba(128,128,128,.12);max-height:180px;display:flex;align-items:center;justify-content:center;}',
      '[data-dsh-entity-img]{width:100%;height:auto;max-height:180px;object-fit:cover;display:block;}',
      '[data-dsh-entity-placeholder]{width:100%;height:104px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;opacity:.5;letter-spacing:1px;}',
      '[data-dsh-entity-summary]{font-size:13.5px;line-height:1.7;white-space:pre-wrap;}',
      '[data-dsh-entity-section]{margin-top:12px;font-size:12px;opacity:.72;}',
      '[data-dsh-entity-links]{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}',
      '[data-dsh-entity-link]{display:inline-block;padding:3px 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));font-size:12px;color:inherit;text-decoration:none;}',
      '[data-dsh-entity-link]:hover{background:rgba(128,128,128,.14);}',
      '[data-dsh-entity] [data-dsh-entity-skeleton]{display:block;}',
      '[data-dsh-entity-skel]{height:10px;border-radius:6px;background:rgba(128,128,128,.18);margin:8px 0;}',
      '[data-dsh-entity-empty]{opacity:.66;font-size:12.5px;line-height:1.7;}',
    ].join('\n')

    function ensureEntityStyle() {
      if (typeof document === 'undefined') return null
      let el = document.querySelector('style[data-plugin="dsh-style-entity"]')
      if (!el) {
        el = document.createElement('style')
        el.setAttribute('data-plugin', 'dsh-style-entity')
        document.head.appendChild(el)
      }
      if (el.textContent !== ENTITY_CSS) el.textContent = ENTITY_CSS
      return el
    }

    function EntityDetailCard({ card, name, type, status }) {
      if (status === 'loading') {
        return h('div', null,
          h('div', { 'data-dsh-entity-imgwrap': '' }, h('div', { 'data-dsh-entity-placeholder': '' }, (name || '?').slice(0, 2))),
          h('div', { 'data-dsh-entity-body': '' },
            h('div', { 'data-dsh-entity-skel': '', style: { width: '70%' } }),
            h('div', { 'data-dsh-entity-skel': '', style: { width: '92%' } }),
            h('div', { 'data-dsh-entity-skel': '', style: { width: '85%' } })),
        )
      }
      if (status === 'empty' || !card || !card.matched) {
        return h('div', { 'data-dsh-entity-body': '' },
          h('div', { 'data-dsh-entity-imgwrap': '' }, h('div', { 'data-dsh-entity-placeholder': '' }, (name || '?').slice(0, 2))),
          h('div', { 'data-dsh-entity-empty': '' },
            '没找到可信的资料。',
            h('br'),
            '可用来源：GitHub / npm / PyPI / Hacker News 与 Wikidata。没有匹配到时会保持空状态，不编造内容。'))
      }
      const ent = card.entity || {}
      const links = Array.isArray(ent.links) ? ent.links.filter((l) => l && l.href) : []
      const sources = Array.isArray(ent.sources) ? ent.sources.filter((s) => s && s.href) : []
      return h(React.Fragment, null,
        ent.imageUrl
          ? h('div', { 'data-dsh-entity-imgwrap': '' },
              h('img', { 'data-dsh-entity-img': '', src: ent.imageUrl, alt: ent.name || name, loading: 'lazy', referrerPolicy: 'no-referrer' }))
          : h('div', { 'data-dsh-entity-imgwrap': '' }, h('div', { 'data-dsh-entity-placeholder': '' }, (name || '?').slice(0, 2))),
        h('div', { 'data-dsh-entity-body': '' },
          ent.summary ? h('div', { 'data-dsh-entity-summary': '' }, ent.summary) : null,
          ent.description && ent.description !== ent.summary
            ? h('div', { 'data-dsh-entity-section': '' }, ent.description)
            : null,
          links.length
            ? h('div', null,
                h('div', { 'data-dsh-entity-section': '' }, '相关链接'),
                h('div', { 'data-dsh-entity-links': '' },
                  links.slice(0, 8).map((l, i) => h('a', {
                    key: 'l' + i, 'data-dsh-entity-link': '', href: l.href, target: '_blank', rel: 'noopener noreferrer',
                  }, l.label || l.href))))
            : null,
          sources.length
            ? h('div', { 'data-dsh-entity-section': '' },
                '来源：',
                sources.slice(0, 5).map((s, i) => h('a', {
                  key: 's' + i, href: s.href, target: '_blank', rel: 'noopener noreferrer',
                  style: { color: 'inherit', marginRight: 8, textDecoration: 'underline', textDecorationStyle: 'dotted' },
                }, s.label || s.href)))
            : null,
          h('div', { 'data-dsh-entity-section': '' },
            card.confidence != null ? '匹配置信度 ' + Math.round(card.confidence * 100) + '%' : ''),
        ))
    }

    let entityPortalHost = null
    function EntityPanelHost() {
      const state = React.useSyncExternalStore(entityUi.subscribe, entityUi.get, entityUi.get)
      // 面板必须挂在会话主容器内部（不是 shell.overlay 的视口层）。
      const [host, setHost] = React.useState(entityHostEl)
      React.useEffect(() => {
        if (host) return undefined
        let alive = true
        const tick = () => {
          if (!alive) return
          const el = entityHostEl()
          if (el) { entityPortalHost = el; setHost(el) } else { requestAnimationFrame(tick) }
        }
        tick()
        return () => { alive = false }
      }, [host])
      if (!state.mounted) return null
      const panel = h('div', { 'data-dsh-entity-panel': '', 'data-open': state.open ? 'true' : 'false', 'data-mode': state.mode || 'side' },
        h('div', { 'data-dsh-entity-card': '', role: 'dialog', 'aria-label': '实体详情' },
          h('div', { 'data-dsh-entity-head': '' },
            h('div', null,
              h('div', { 'data-dsh-entity-title': '' }, state.name || '实体'),
              state.type ? h('span', { 'data-dsh-entity-kind': '' }, state.type) : null),
            h('button', {
              type: 'button', 'data-dsh-entity-close': '', 'aria-label': '关闭实体详情',
              onClick: () => closeEntity(),
            }, '×')),
          h(EntityDetailCard, { card: state.card, name: state.name, type: state.type, status: state.status })))
      const target = host || entityHostEl()
      if (target && ReactDOM && typeof ReactDOM.createPortal === 'function') {
        try { return ReactDOM.createPortal(panel, target) } catch {}
      }
      return panel
    }

    // ---- 运行时：观察 settled 消息 → 识别 → 注入 ----
    function createEntityRuntime() {
      let stopped = true
      let observer = null
      let debounce = null
      let controller = null
      let started = false

      const shouldHandle = (node) => {
        if (!(node instanceof Element)) return false
        if (node.matches('[data-chat-flow-kind]')) return true
        return node.querySelector('[data-chat-flow-kind]') !== null
      }

      const relevantMutations = (records) => {
        for (const record of records) {
          if (record.type === 'childList') {
            for (const n of record.addedNodes) if (shouldHandle(n)) return true
            for (const n of record.removedNodes) if (shouldHandle(n)) return true
          } else if (record.type === 'attributes') {
            const t = record.target
            if (t instanceof Element && (t.hasAttribute('data-streaming') || t.closest('[data-chat-flow-kind]'))) return true
          }
        }
        return false
      }

      const scan = async () => {
        if (stopped) return
        const allRoots = entityRoots()
        const roots = allRoots.slice(Math.max(0, allRoots.length - ENTITY_SCAN_LIMIT))
        for (const root of roots) {
          if (stopped) return
          const text = (root.textContent || '').trim()
          if (text.length < 20) continue
          const sig = hashText(text)
          const already = root.getAttribute('data-dsh-entity-sig')
          if (already === sig && root.querySelector('[data-dsh-entity]')) continue
          if (already === sig && !root.querySelector('[data-dsh-entity]')) {
            const cached = entityCache.get(sig)
            if (cached) { injectInto(root, cached.entities); continue }
          }
          const cached = entityCache.get(sig)
          if (cached) {
            const added = injectInto(root, cached.entities)
            if (added > 0) root.setAttribute('data-dsh-entity-sig', sig)
            continue
          }
          const hostOk = await entityHostProbe()
          if (stopped) return
          if (!hostOk) return
          controller = controller || new AbortController()
          const entities = await extractEntities(text, controller.signal)
          if (stopped) return
          const added = injectInto(root, entities)
          root.setAttribute('data-dsh-entity-sig', sig)
          if (added === 0) { /* 无实体也记签名，避免重复请求 */ }
        }
      }

      const schedule = () => {
        if (stopped || debounce) return
        const run = () => { debounce = null; scan() }
        debounce = setTimeout(run, 320)
      }

      // 点击委托：命中实体 → 打开面板
      const onClick = (event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        const link = target.closest('[data-dsh-entity]')
        if (!link) return
        event.preventDefault()
        event.stopPropagation()
        const name = link.getAttribute('data-dsh-entity') || link.textContent || ''
        const type = link.getAttribute('data-dsh-entity-type') || ''
        let context = ''
        try { context = (link.closest('[class*="_markdown_"]') || {}).textContent || '' } catch {}
        openEntity(name, type, context)
      }

      const onKey = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        const target = event.target
        if (!(target instanceof Element)) return
        const link = target.closest('[data-dsh-entity]')
        if (!link) return
        event.preventDefault()
        openEntity(link.getAttribute('data-dsh-entity') || '', link.getAttribute('data-dsh-entity-type') || '', '')
      }

      return {
        start() {
          if (typeof document === 'undefined') return
          if (!stopped) return
          stopped = false
          if (started) { schedule(); return }
          started = true
          ensureEntityStyle()
          tagEntityLayout()
          ensureEntityLayoutObserver()
          try {
            const host = document.querySelector('[data-dsh-style-main]') || document.body
            observer = new MutationObserver((records) => {
              if (relevantMutations(records)) schedule()
            })
            observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-streaming', 'class'] })
          } catch {}
          document.addEventListener('click', onClick, false)
          document.addEventListener('keydown', onKey, false)
          schedule()
        },
        stop() {
          if (typeof document === 'undefined') { stopped = true; return }
          if (stopped) { /* 仍然清理一遍，保证幂等 */ }
          stopped = true
          if (debounce) { clearTimeout(debounce); debounce = null }
          if (observer) { try { observer.disconnect() } catch {} observer = null }
          document.removeEventListener('click', onClick, false)
          document.removeEventListener('keydown', onKey, false)
          if (controller) { try { controller.abort() } catch {} controller = null }
          entityPending.clear()
          unwrapEntities()
          unmountEntity()
          applyEntityLayout(false)
          stopEntityLayoutObserver()
          untagEntityLayout()
          const style = document.querySelector('style[data-plugin="dsh-style-entity"]')
          if (style) style.remove()
          started = false
        },
        scan,
        openEntity,
        closeEntity,
        get active() { return !stopped },
      }
    }

    const entityRuntime = createEntityRuntime()

    function entityStatusText() {
      if (entityHostReady === true) return '宿主识别服务已连接'
      if (entityHostReady === false) return '宿主识别服务未就绪：需要重启一次 DSH 才会加载插件宿主侧'
      return '正在检测宿主识别服务…'
    }

    function EntityDetailCardSettings({ cfg, set }) {
      const on = cfg.entityEnabled === true
      return h('section', { style: sectionStyle, 'aria-label': '实体详情' },
        h('h3', { style: sectionTitleStyle }, '实体详情'),
        h(SwitchRow, { label: '启用实体详情', checked: on, onChange: (value) => set({ entityEnabled: value }) }),
        h('p', { style: hintStyle }, '在已完成的回复里把实体名变成可点击文本；点击后右侧滑出详情卡，正文与输入框同步左移，点空白不关闭，只有手动关闭才恢复。识别由本机 DSH 模型完成，只读公开数据源（GitHub / npm / PyPI / Hacker News / Wikidata），匹配不到时显示空状态，不编造内容。'),
        on ? h('p', { style: hintStyle }, '状态：' + entityStatusText()) : null)
    }

    function syncEntityRuntime() {
      try {
        if (store.get().entityEnabled === true) entityRuntime.start()
        else entityRuntime.stop()
      } catch {}
    }

    const inject = ['slots', 'sessions']

    function apply(ctx) {
      appCtx = ctx
      applyStyles(store.get())
      startAliasObserver()
      ctx.effect(() => () => cleanup(), 'dsh-style: 释放外观样式')
      ctx.effect(() => () => stopAliasObserver(), 'dsh-style: 释放插件别名')
      // 实体详情运行时：跟随开关启停，stop() 必须幂等且清干净。
      ctx.effect(() => {
        syncEntityRuntime()
        const offEntity = store.subscribe(syncEntityRuntime)
        return () => { offEntity(); entityRuntime.stop() }
      }, 'dsh-style: 实体详情运行时')
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
      // 实体详情面板：常驻在原生 shell.overlay（list 槽），不占用、不替换 rightbar。
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-style-entity-panel',
        order: 950,
      }, EntityPanelHost))
      // 官方 list slot：渲染在「欢迎语行」与「输入卡片」之间，宽度随首页列宽。
      // 组件自身在非 hero 相位 / 关闭开关时返回 null，不污染正常对话。
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
        name: 'conversation.input.dock',
        id: 'dsh-style-activity',
        order: -20,
      }, QoderActivityCard))
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
        name: 'conversation.input.dock',
        id: 'dsh-style-stamp',
        order: -30,
      }, QoderStampCard))

    }

    exports.apply = apply
    exports.inject = inject
    exports.AppearanceSection = AppearanceSection
    exports.LayoutCard = LayoutCard
    exports.EffectsCard = EffectsCard
    exports.SidebarCard = SidebarCard
    exports.__internal = { applyStyles, readSettings, tagOnce, entityRuntime, entityUi, hashText, injectInto, unwrapEntities, entityRoots, openEntity, closeEntity, syncEntityRuntime }

    return module.exports
  },
})
