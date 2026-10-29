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

    // ------------------------------------------------------------------ 配置
    const STORE_KEY = 'dsh-style:settings'
    const DEFAULTS = { enabled: true, layout: 'classic', reduceMotion: false, hideScrollbars: false }
    const LAYOUT_OPTIONS = [
      { value: 'classic', label: '经典' },
      { value: 'inset', label: '内嵌' },
    ]

    function readSettings() {
      try {
        const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
        const merged = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) }
        if (merged.layout !== 'inset' && merged.layout !== 'classic') merged.layout = DEFAULTS.layout
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
      '--dsh-style-inset-radius:14px;',
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
        const rules = [BASE_CSS]
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

    function AppearanceSection() {
      const [cfg, setCfg] = React.useState(store.get)
      React.useEffect(() => store.subscribe(() => setCfg(store.get())), [])
      return h('div', { style: pageStyle },
        h('div', null,
          h('h2', { style: headingStyle }, '外观'),
          h('p', { style: introStyle }, '自定义 DeepSeek Harness 客户端的外观。修改会立即生效，并保存在本机。')),
        h(LayoutCard, { cfg, set: store.set }),
        h(EffectsCard, { cfg, set: store.set }))
    }

    const inject = ['slots']

    function apply(ctx) {
      applyStyles(store.get())
      ctx.effect(() => () => cleanup(), 'dsh-style: 释放外观样式')
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'style',
        order: 40,
        label: () => '外观',
      }, AppearanceSection))
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
