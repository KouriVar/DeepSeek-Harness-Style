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

    // ------------------------------------------------------------------ 配置
    const STORE_KEY = 'dsh-style:settings'
    const DEFAULTS = {
      enabled: true,
      layout: 'classic',
      reduceMotion: false,
      hideScrollbars: false,
      hideBrand: false,
      hideNewSession: false,
      hideTabs: false,
      monitorEnabled: false,
      monitorMode: 'floating',
      monitorAlwaysShow: {},
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
    ]

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
    const SIDEBAR_VIS_CSS = [
      'html[data-dsh-style-hide-brand="true"] [data-dsh-style-sidebar] [class*="_logoRow"]{display:none !important;}',
      'html[data-dsh-style-hide-newsession="true"] [data-dsh-style-sidebar] [class*="_newSession"]{display:none !important;}',
      // 隐藏会话标签栏（对话 / 轨迹 / …）：连整行一起收掉，会话区自动变高。
      'html[data-dsh-style-hide-tabs="true"] div:has(> [data-conversation-tabs]){display:none !important;}',
      // 标签栏没了，把会话头压到和右栏头一致的高度（38px），标题/图标才能对齐、也不留空白。
      'html[data-dsh-style-hide-tabs="true"] [data-dsh-style-main] header[data-window-drag]:not([class*="headerBlank"]){min-height:38px !important;height:38px !important;padding-top:0 !important;padding-bottom:0 !important;align-items:center !important;}',
      // 去掉标题栏 / 右栏头部那条分割线（和 Qoder 一样，无分割线）。
      'html[data-dsh-style-enabled="true"] [data-dsh-style-main] header[data-window-drag]{border-bottom:0 !important;}',
      'html[data-dsh-style-enabled="true"] [data-rightbar-col] [class*="_header"]{border-bottom:0 !important;}',
      // 按 Qoder 实测规格收紧侧栏（它更密更精致）：
      //  - 列表行：qoder `h-7 px-2 gap-2 text-[13px]/16` → 高 28 / 内距 8 / gap 8 / 字号 13；
      //  - 分区标题：qoder `h-[18px] pl-2 text-[13px] leading-4 font-medium` → 高 18 / 左 8 / 13px。
      'html[data-dsh-style-enabled="true"] [data-dsh-style-sidebar] [class*="_sectionHeader"]{height:18px !important;padding-left:8px !important;margin-bottom:6px !important;font-size:13px !important;font-weight:500 !important;line-height:16px !important;}',
      'html[data-dsh-style-enabled="true"] [data-dsh-style-sidebar] [class*="_panelRow"]{min-height:28px !important;height:28px !important;padding:0 8px !important;gap:8px !important;font-size:13px !important;line-height:16px !important;}',
      'html[data-dsh-style-enabled="true"] [data-dsh-style-sidebar] [class*="_panelRow"] svg{width:14px !important;height:14px !important;}',
      // regionArea 原本 margin-left:-4 / margin-right:-12（负右边距让行高亮一直顶到侧栏右边缘，所以显得"很宽"）。
      // 归零后左右各有 12px 内边距，行高亮两边对称、更窄更精致。
      'html[data-dsh-style-enabled="true"] [data-dsh-style-sidebar] [class*="_regionArea"]{margin-left:0 !important;margin-right:0 !important;}',
      // 实测：左侧标题文字顶 63px、右侧「开始」/图标顶 74px（截图 2x），右栏低约 11px≈5pt。
      // 右栏 panel 是 top:0 绝对定位，dock 标签栏自带约 5px 顶部内边距；用 top 偏移补齐，
      // 不用 transform（避免破坏内部 fixed 定位的 tooltip）。
      'html[data-dsh-style-enabled="true"] [data-sidebar-right-panel]:not([data-sidebar-right-panel="fullscreen"]){top:-5px !important;}',
    ].join('')

    // 把「智能体团队 / 子智能体 / 后台任务」三个头部入口从顶栏移到「任务监控」后，
    // 头部这几处隐藏（仅当任务监控开启，保证信息仍可见）。
    const HIDE_HEADER_CSS = [
      'html[data-dsh-style-monitor="true"] [data-team-action]{display:none !important;}',
      'html[data-dsh-style-monitor="true"] [class*="_switcherRoot"]{display:none !important;}',
      'html[data-dsh-style-monitor="true"] [class*="_4iHfma_trigger"]{display:none !important;}',
      '[data-dsh-style-chip-hidden]{display:none !important;}',
    ].join('')

    // 模式切换器（通用 / 协作）的样式。与布局无关，启用插件时始终存在。
    const PILL_CSS = [
      '[data-dsh-style-modeswitcher]{display:flex;padding:0 12px 0 10px;margin:-12px 0 6px;}',
      '.dsh-style-pill{display:inline-flex;align-items:center;gap:0;padding:0;border-radius:999px;border:1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.10));background:color-mix(in srgb, var(--dsw-alias-label-primary, #fff) 3.5%, transparent);}',
      '.dsh-style-pill-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:28px;padding:0 8px;border:1px solid transparent;border-radius:999px;background:transparent;color:var(--dsw-alias-label-tertiary, inherit);font:inherit;font-size:13px;font-weight:500;line-height:1;cursor:pointer;transition:background .15s,color .15s,border-color .15s;}',
      '.dsh-style-pill-btn:hover:not(:disabled){color:var(--dsw-alias-label-primary, inherit);background:color-mix(in srgb, var(--dsw-alias-label-primary, #fff) 7%, transparent);}',
      '.dsh-style-pill-btn.is-active{background:color-mix(in srgb, var(--dsw-alias-state-success-primary, #22c55e) 14%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary, #22c55e) 50%, transparent);color:color-mix(in srgb, var(--dsw-alias-state-success-primary, #22c55e) 82%, #ffffff);}',
      '.dsh-style-pill-btn:disabled{opacity:.4;cursor:default;}',
      '.dsh-style-pill-label{white-space:nowrap;}',
      '[data-sidebar-collapsed] [data-dsh-style-modeswitcher]{display:none;}',
      '[data-dsh-style-hidden-entry]{display:none !important;}',
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
      const el = styleTag()
      if (el) {
        const rules = [BASE_CSS, IMMERSIVE_CSS, TITLEBAR_CSS, SIDEBAR_VIS_CSS, HIDE_HEADER_CSS, PILL_CSS, MONITOR_CSS]
        if (cfg.reduceMotion) rules.push(MOTION_CSS)
        if (cfg.hideScrollbars) rules.push(SCROLL_CSS)
        el.textContent = rules.join('\n')
      }
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
          Button
            ? h(Button, { variant: 'secondary', onClick: () => set({ layout: 'classic' }) }, '恢复默认')
            : h('button', { type: 'button', onClick: () => set({ layout: 'classic' }) }, '恢复默认')))
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

    // -------------------------------------------------- 模式切换器（通用 / 协作）
    // ds-bot 把「普通对话（agent 面）」与「Halfsignal（bot 面）」做成同一行 panellist 的
    // 两种标签：'Halfsignal Bot'（当前在通用面）↔ 'Halfsignal Chat'（当前在协作面），
    // 点该行即在两面间切换。DSH 侧栏没有“顶部插槽”，所以我们在该行所在的导航列表前插入
    // 自己的容器，用 portal 渲染胶囊，并隐藏原行（底层路由、插件注册、会话数据都不动）。
    // 切换 = 点击被隐藏的原行，仍走 ds-bot 自己的 surface 切换；状态以原行当前标签为准。
    function halfsignalRow() {
      if (typeof document === 'undefined') return null
      for (const el of Array.from(document.querySelectorAll('[class*="panelRow"]'))) {
        if (/Halfsignal\s+(Bot|Chat)/i.test(el.textContent || '')) return el
      }
      return null
    }
    function modeFromRow(row) {
      if (!row) return 'general'
      return /Chat/i.test(row.textContent || '') ? 'collab' : 'general'
    }
    let pillHost = null
    function ensurePillHost(row) {
      if (typeof document === 'undefined') return null
      const list = row.closest('[class*="panelList"]') || row.parentElement
      const brandRow = document.querySelector('[class*="logoRow"]')
      const anchor = brandRow && brandRow.parentElement ? brandRow : list
      if (!anchor || !anchor.parentElement) return null
      if (!pillHost) {
        pillHost = document.createElement('div')
        pillHost.setAttribute('data-dsh-style-modeswitcher', '')
      }
      if (pillHost.parentElement !== anchor.parentElement || pillHost.nextElementSibling !== anchor) {
        anchor.parentElement.insertBefore(pillHost, anchor)
      }
      return pillHost
    }
    function restoreEntryRow() {
      if (typeof document === 'undefined') return
      for (const el of Array.from(document.querySelectorAll('[data-dsh-style-hidden-entry]'))) el.removeAttribute('data-dsh-style-hidden-entry')
    }
    function removePillHost() {
      if (pillHost && pillHost.parentElement) pillHost.parentElement.removeChild(pillHost)
      pillHost = null
    }

    function ModeSwitcher(props) {
      const options = [
        { id: 'general', label: '通用', Icon: IconChat },
        { id: 'collab', label: '协作', Icon: IconAgent },
      ]
      return h('div', { className: 'dsh-style-pill', role: 'tablist', 'aria-label': '模式' },
        options.map((option) => {
          const active = props.mode === option.id
          const disabled = option.id === 'collab' && !props.available
          const Icon = option.Icon
          return h('button', {
            key: option.id,
            type: 'button',
            role: 'tab',
            'aria-selected': active,
            'aria-label': option.label,
            title: option.label,
            disabled,
            className: 'dsh-style-pill-btn' + (active ? ' is-active' : ''),
            onClick: () => { if (!disabled) props.onPick(option.id) },
          }, Icon ? h(Icon, { size: 16 }) : null, active ? h('span', { className: 'dsh-style-pill-label' }, option.label) : null)
        }))
    }

    // 常驻组件：挂在 shell.overlay（list 插槽，始终渲染），用 portal 把胶囊画到侧栏。
    function ModeSwitcherBridge() {
      const [mode, setMode] = React.useState('general')
      const [available, setAvailable] = React.useState(false)
      const [host, setHost] = React.useState(null)
      const [enabled, setEnabled] = React.useState(store.get().enabled)
      React.useEffect(() => store.subscribe(() => setEnabled(store.get().enabled)), [])
      React.useEffect(() => {
        if (typeof document === 'undefined') return undefined
        let raf = 0
        const sync = () => {
          if (!store.get().enabled) {
            restoreEntryRow()
            removePillHost()
            setHost(null)
            setAvailable(false)
            setMode('general')
            return
          }
          if (document.querySelector('[data-sidebar-collapsed]')) {
            restoreEntryRow()
            setAvailable(false)
            return
          }
          const row = halfsignalRow()
          if (!row) {
            setAvailable(false)
            setMode('general')
            return
          }
          row.setAttribute('data-dsh-style-hidden-entry', '')
          const nextHost = ensurePillHost(row)
          setHost((prev) => (prev === nextHost ? prev : nextHost))
          setAvailable(true)
          const nextMode = modeFromRow(row)
          setMode((prev) => (prev === nextMode ? prev : nextMode))
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
          restoreEntryRow()
          removePillHost()
        }
      }, [enabled])
      const onPick = (target) => {
        const row = halfsignalRow()
        if (!row) return
        if (target === modeFromRow(row)) return
        setMode(target)
        row.click()
        const run = () => { const now = halfsignalRow(); if (now) setMode(modeFromRow(now)) }
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
        else setTimeout(run, 16)
      }
      if (!enabled || !host || !createPortal) return null
      return createPortal(h(ModeSwitcher, { mode, available, onPick }), host)
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

    function AppearanceSection() {
      const [cfg, setCfg] = React.useState(store.get)
      React.useEffect(() => store.subscribe(() => setCfg(store.get())), [])
      return h('div', { style: pageStyle },
        h('div', null,
          h('h2', { style: headingStyle }, '外观'),
          h('p', { style: introStyle }, '自定义 DeepSeek Harness 客户端的外观。修改会立即生效，并保存在本机。')),
        h(LayoutCard, { cfg, set: store.set }),
        h(EffectsCard, { cfg, set: store.set }),
        h(SidebarCard, { cfg, set: store.set }),
        h(TaskMonitorCard, { cfg, set: store.set }))
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

    const inject = ['slots']

    function apply(ctx) {
      appCtx = ctx
      applyStyles(store.get())
      ctx.effect(() => () => cleanup(), 'dsh-style: 释放外观样式')
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'style',
        order: 40,
        label: () => '外观',
      }, AppearanceSection))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-style-mode',
        order: 900,
      }, ModeSwitcherBridge))
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
