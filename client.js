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

    // ------------------------------------------------------------------ 配置
    const STORE_KEY = 'dsh-style:settings'
    const DEFAULTS = {
      enabled: true,
      layout: 'classic',
      reduceMotion: false,
      hideScrollbars: false,
      monitorEnabled: false,
      monitorMode: 'floating',
      monitorSections: { progress: true, subagents: true, tools: true, jobs: true, artifacts: true, web: true },
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
        merged.monitorSections = { ...DEFAULTS.monitorSections, ...(merged.monitorSections && typeof merged.monitorSections === 'object' ? merged.monitorSections : {}) }
        if (merged.monitorMode !== 'docked' && merged.monitorMode !== 'floating') merged.monitorMode = DEFAULTS.monitorMode
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

    // 模式切换器（通用 / 协作）的样式。与布局无关，启用插件时始终存在。
    const PILL_CSS = [
      '[data-dsh-style-modeswitcher]{display:flex;padding:0 12px 0 4px;margin:-12px 0 6px;}',
      '.dsh-style-pill{display:inline-flex;align-items:center;gap:2px;padding:3px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.25));background:color-mix(in srgb, var(--dsw-alias-label-primary, #888) 5%, transparent);}',
      '.dsh-style-pill-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0 9px;border:1px solid transparent;border-radius:999px;background:transparent;color:var(--dsw-alias-label-tertiary, inherit);font:inherit;font-size:13px;line-height:1;cursor:pointer;transition:background .15s,color .15s,border-color .15s;}',
      '.dsh-style-pill-btn:hover:not(:disabled){color:var(--dsw-alias-label-primary, inherit);background:color-mix(in srgb, var(--dsw-alias-label-primary, #888) 8%, transparent);}',
      '.dsh-style-pill-btn.is-active{background:var(--dsw-alias-bg-base, #fff);border-color:var(--dsw-alias-border-l2, rgba(128,128,128,.3));color:var(--dsw-alias-label-primary, inherit);}',
      '.dsh-style-pill-btn:disabled{opacity:.4;cursor:default;}',
      '.dsh-style-pill-label{white-space:nowrap;}',
      '[data-sidebar-collapsed] [data-dsh-style-modeswitcher]{display:none;}',
      '[data-dsh-style-hidden-entry]{display:none !important;}',
    ].join('')

    // 任务监控：工具栏按钮 + 浮层面板。
    const MONITOR_CSS = [
      '.dsh-style-monitor-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-tertiary,inherit);cursor:pointer;transition:background .15s,color .15s;}',
      '.dsh-style-monitor-btn:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12));color:var(--dsw-alias-label-primary,inherit);}',
      '.dsh-style-monitor-btn[data-active]{background:var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.16));color:var(--dsw-alias-label-primary,inherit);}',
      '.dsh-style-monitor-panel{position:fixed;z-index:9999;top:56px;right:24px;width:380px;max-width:calc(100vw - 32px);max-height:min(70vh,720px);display:flex;flex-direction:column;border-radius:14px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.25));background:var(--dsw-alias-bg-base,#fff);box-shadow:var(--dsw-elevation-prominent,0 8px 30px rgba(0,0,0,.16));color:var(--dsw-alias-label-primary,inherit);overflow:hidden;}',
      '.dsh-style-monitor-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.16));}',
      '.dsh-style-monitor-title{font-size:14px;font-weight:600;}',
      '.dsh-style-monitor-headbtn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,inherit);cursor:pointer;}',
      '.dsh-style-monitor-headbtn:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12));color:var(--dsw-alias-label-primary,inherit);}',
      '.dsh-style-monitor-body{overflow:auto;padding:6px 14px 14px;}',
      '.dsh-style-monitor-sec{padding:10px 0 4px;}',
      '.dsh-style-monitor-sec-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,inherit);margin:0 0 6px;}',
      '.dsh-style-monitor-empty{font-size:12px;color:var(--dsw-alias-label-tertiary,inherit);opacity:.8;margin:0;}',
      '.dsh-style-monitor-row{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12.5px;min-width:0;}',
      '.dsh-style-monitor-row-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}',
      '.dsh-style-monitor-meta{font-size:11.5px;color:var(--dsw-alias-label-tertiary,inherit);flex:none;}',
      '.dsh-style-monitor-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-label-tertiary,#999);}',
      '.dsh-style-monitor-dot[data-s="running"]{background:#1e86ff;}',
      '.dsh-style-monitor-dot[data-s="done"]{background:#00c972;}',
      '.dsh-style-monitor-dot[data-s="error"]{background:#e02135;}',
      '.dsh-style-monitor-dot[data-s="pending"]{background:#b0b0b0;}',
      '.dsh-style-monitor-dot[data-s="cancelled"]{background:#c9a227;}',
      '.dsh-style-monitor-link{color:var(--dsw-alias-state-business-primary,#1e86ff);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
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

    function tagOnce() {
      if (typeof document === 'undefined') return
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
        attributeFilter: ['data-ds-dark-theme'],
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
        stopTagging()
        return
      }
      root.setAttribute('data-dsh-style-enabled', 'true')
      root.setAttribute('data-dsh-style-motion', cfg.reduceMotion ? 'reduced' : 'full')
      root.setAttribute('data-dsh-style-scrollbars', cfg.hideScrollbars ? 'hidden' : 'shown')
      root.setAttribute('data-dsh-style-layout', cfg.layout === 'inset' ? 'inset' : 'classic')
      root.setAttribute('data-dsh-style-dark', isDark() ? 'true' : 'false')
      const el = styleTag()
      if (el) {
        const rules = [BASE_CSS, PILL_CSS, MONITOR_CSS]
        if (cfg.reduceMotion) rules.push(MOTION_CSS)
        if (cfg.hideScrollbars) rules.push(SCROLL_CSS)
        el.textContent = rules.join('\n')
      }
      if (cfg.layout === 'inset') startTagging()
      else stopTagging()
    }

    function cleanup() {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      for (const attr of STYLE_ATTRS) root.removeAttribute(attr)
      const el = document.querySelector(STYLE_TAG)
      if (el) el.textContent = ''
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
          h(SegmentedControl, {
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
        h(Switch, { label: '启用样式插件', checked: cfg.enabled, onChange: (value) => set({ enabled: value }) }),
        h(Switch, { label: '减少动效', checked: cfg.reduceMotion, onChange: (value) => set({ reduceMotion: value }) }),
        h(Switch, { label: '隐藏滚动条', checked: cfg.hideScrollbars, onChange: (value) => set({ hideScrollbars: value }) }))
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
      ['progress', '执行进度'],
      ['subagents', '子智能体'],
      ['tools', 'Skills 与 MCP'],
      ['jobs', '后台任务'],
      ['artifacts', '文件产出'],
      ['web', '网页查阅'],
    ]
    function TaskMonitorCard({ cfg, set }) {
      const sections = cfg.monitorSections || {}
      return h('section', { style: sectionStyle, 'aria-label': '任务监控' },
        h('h3', { style: sectionTitleStyle }, '任务监控'),
        h(Switch, { label: '启用任务监控', checked: Boolean(cfg.monitorEnabled), onChange: (value) => set({ monitorEnabled: value }) }),
        h('p', { style: hintStyle }, '开启后会在右上角工具栏出现「任务监控」按钮，实时查看当前会话的执行过程。默认关闭，独立于布局与模式切换。'),
        cfg.monitorEnabled
          ? h('div', { style: rowStyle },
            h(SegmentedControl, {
              id: 'dsh-style-monitor-mode',
              label: '展示方式',
              value: cfg.monitorMode,
              options: [{ value: 'floating', label: '浮层' }, { value: 'docked', label: '停靠' }],
              onChange: (value) => set({ monitorMode: value }),
            }),
            cfg.monitorMode === 'docked' ? h('p', { style: hintStyle }, '停靠模式正在接入，当前仍以浮层显示。') : null,
            h('div', { style: { display: 'flex', flexDirection: 'column' } },
              SECTION_TOGGLES.map(([key, label]) => h(Switch, {
                key,
                label: '显示：' + label,
                checked: sections[key] !== false,
                onChange: (value) => set({ monitorSections: { ...sections, [key]: value } }),
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
      return { pending: '等待', running: '进行中', done: '已完成', error: '失败', cancelled: '已取消' }[status] || status || ''
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
      const data = { progress: [], subagents: [], tools: [], jobs: [], artifacts: [], web: [] }
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
      return data
    }

    function MonitorButton({ sessionId }) {
      const [open, setOpen] = React.useState(monitorUi.get().open && monitorUi.get().sessionId === sessionId)
      const [enabled, setEnabled] = React.useState(store.get().monitorEnabled)
      React.useEffect(() => monitorUi.subscribe(() => setOpen(monitorUi.get().open && monitorUi.get().sessionId === sessionId)), [sessionId])
      React.useEffect(() => store.subscribe(() => setEnabled(store.get().monitorEnabled)), [])
      if (!enabled) return null
      return h('button', {
        type: 'button',
        className: 'dsh-style-monitor-btn',
        'data-active': open || undefined,
        'aria-pressed': open,
        'aria-label': '打开任务监控',
        title: '打开任务监控',
        onClick: () => {
          const current = monitorUi.get()
          if (current.open && current.sessionId === sessionId) monitorUi.set({ open: false })
          else monitorUi.set({ open: true, sessionId })
        },
      }, IconChecklist ? h(IconChecklist, { size: 16 }) : '☑')
    }

    function TaskMonitorPanel({ cfg, data, onClose }) {
      const sections = cfg.monitorSections || {}
      const section = (key, title, children) => (sections[key] === false ? null : h('div', { className: 'dsh-style-monitor-sec' },
        h('h4', { className: 'dsh-style-monitor-sec-title' }, title), children))
      const empty = (text) => h('p', { className: 'dsh-style-monitor-empty' }, text)
      const row = (key, status, name, meta, title) => h('div', { className: 'dsh-style-monitor-row', key },
        h('span', { className: 'dsh-style-monitor-dot', 'data-s': status }),
        h('span', { className: 'dsh-style-monitor-row-name', title: title || name }, name),
        meta ? h('span', { className: 'dsh-style-monitor-meta' }, meta) : null)
      return h('div', { className: 'dsh-style-monitor-panel', role: 'dialog', 'aria-label': '任务监控' },
        h('div', { className: 'dsh-style-monitor-head' },
          h('span', { className: 'dsh-style-monitor-title' }, '任务监控'),
          h('button', { type: 'button', className: 'dsh-style-monitor-headbtn', title: '关闭', 'aria-label': '关闭', onClick: onClose }, IconClose ? h(IconClose, { size: 16 }) : '×')),
        h('div', { className: 'dsh-style-monitor-body' },
          section('progress', '执行进度', data.progress.length === 0
            ? empty('暂无任务计划')
            : data.progress.map((item, index) => row(index, item.status, item.title || '(未命名)', monitorStatusLabel(item.status)))),
          section('subagents', '子智能体', data.subagents.length === 0
            ? empty('暂无子智能体')
            : data.subagents.map((item, index) => row(index, item.status, item.title || item.name, item.name, item.title))),
          section('tools', 'Skills 与 MCP', data.tools.length === 0
            ? empty('暂无技能 / MCP / 工具调用')
            : data.tools.map((item, index) => row(index, item.status, item.name, (item.category === 'skill' ? '技能' : item.category === 'mcp' ? 'MCP' : '内置') + ' · ' + item.count + ' 次'))),
          section('jobs', '后台任务', data.jobs.length === 0
            ? empty('暂无后台任务')
            : data.jobs.map((job, index) => row(index, jobDotStatus(job.status), job.title || job.id || '(任务)', monitorStatusLabel(jobDotStatus(job.status))))),
          section('artifacts', '文件产出', data.artifacts.length === 0
            ? empty('暂无文件产出')
            : data.artifacts.map((item, index) => row(index, item.status, item.path, item.kind === 'created' ? '新建' : '修改'))),
          section('web', '网页查阅', data.web.length === 0
            ? empty('暂无网页查阅')
            : data.web.map((item, index) => h('div', { className: 'dsh-style-monitor-row', key: index },
              h('span', { className: 'dsh-style-monitor-dot', 'data-s': item.status }),
              h('a', { className: 'dsh-style-monitor-link', href: item.url, target: '_blank', rel: 'noreferrer', title: item.url }, hostOf(item.url)))))))
    }

    function MonitorHost() {
      const [ui, setUi] = React.useState(monitorUi.get())
      const [cfg, setCfg] = React.useState(store.get)
      const [data, setData] = React.useState({ progress: [], subagents: [], tools: [], jobs: [], artifacts: [], web: [] })
      React.useEffect(() => monitorUi.subscribe(() => setUi(monitorUi.get())), [])
      React.useEffect(() => store.subscribe(() => setCfg(store.get())), [])
      const sessionId = ui.sessionId
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
      return createPortal(h(TaskMonitorPanel, { cfg, data, onClose: () => monitorUi.set({ open: false }) }), document.body)
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
      ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
        name: 'conversation.session.header.actions',
        id: 'dsh-style-monitor-btn',
        order: 10,
      }, MonitorButton))
    }

    exports.apply = apply
    exports.inject = inject
    exports.AppearanceSection = AppearanceSection
    exports.LayoutCard = LayoutCard
    exports.EffectsCard = EffectsCard
    exports.__internal = { applyStyles, readSettings, tagOnce }
    return module.exports
  },
})
