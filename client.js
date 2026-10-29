// dsh-style — browser half.
//
// DeepSeek Harness loads this as a classic script through window.__ModuleLoader__
// (the same wrapper the shipped client packages use: `dsh` resolves the seeded
// platform modules react / react-dom / @deepseek-ai/dsh-client-ui-primitives).
//
// It registers ONE native Settings page ("Appearance") into the `settings.section`
// slot — the same slot the built-in settings pages use — so the page shows up in
// the Settings left navigation and inherits the native look. The controls are the
// native `Switch` primitive; no DSH component is restyled or replaced.
//
// Values persist per browser/device in localStorage. To grow this into a real
// theme plugin, add more fields here and/or move storage onto the host settings
// service (see index.js).
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

    const STORE_KEY = 'dsh-style:settings'
    const DEFAULTS = { enabled: true, reduceMotion: false, hideScrollbars: false }

    function readSettings() {
      try {
        const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
        return { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) }
      } catch {
        return { ...DEFAULTS }
      }
    }

    function writeSettings(value) {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(value))
      } catch {
        /* storage unavailable */
      }
    }

    const STYLE_TAG = 'style[data-plugin="dsh-style"]'
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

    // Apply the toggles across the whole client. Everything is gated on
    // `enabled` and fully reversible: switch it off and the marks go away.
    function applyStyles(cfg) {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      root.setAttribute('data-dsh-style-enabled', cfg.enabled ? 'true' : 'false')
      root.setAttribute('data-dsh-style-motion', cfg.reduceMotion ? 'reduced' : 'full')
      root.setAttribute('data-dsh-style-scrollbars', cfg.hideScrollbars ? 'hidden' : 'shown')
      const rules = []
      if (cfg.enabled) {
        if (cfg.reduceMotion) {
          rules.push('[data-dsh-style-motion="reduced"] *, [data-dsh-style-motion="reduced"] *::before, [data-dsh-style-motion="reduced"] *::after{transition-duration:0.001ms !important;animation-duration:0.001ms !important;animation-iteration-count:1 !important;scroll-behavior:auto !important}')
        }
        if (cfg.hideScrollbars) {
          rules.push('[data-dsh-style-scrollbars="hidden"] *{scrollbar-width:none !important}')
          rules.push('[data-dsh-style-scrollbars="hidden"] *::-webkit-scrollbar{width:0 !important;height:0 !important}')
        }
      }
      const el = styleTag()
      if (el) el.textContent = rules.join('\n')
    }

    // Fallback only: used if a future build stops exporting the native Switch.
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

    const headingStyle = { fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--dsw-alias-label-primary, inherit)' }
    const introStyle = { fontSize: '13px', margin: '4px 0 8px', color: 'var(--dsw-alias-label-tertiary, inherit)', opacity: 0.75 }
    const boxStyle = { display: 'flex', flexDirection: 'column', maxWidth: '640px', minWidth: 0 }

    function AppearanceSection() {
      const [cfg, setCfg] = React.useState(readSettings)
      React.useEffect(() => { applyStyles(cfg) }, [cfg])
      const update = (key, value) => {
        setCfg((previous) => {
          const next = { ...previous, [key]: value }
          writeSettings(next)
          return next
        })
      }
      return h('div', { style: boxStyle },
        h('h2', { style: headingStyle }, 'Appearance'),
        h('p', { style: introStyle }, 'Customize how the DeepSeek Harness client looks. Changes are saved on this device.'),
        h(Switch, { label: 'Enable style plugin', checked: cfg.enabled, onChange: (value) => update('enabled', value) }),
        h(Switch, { label: 'Reduce motion', checked: cfg.reduceMotion, onChange: (value) => update('reduceMotion', value) }),
        h(Switch, { label: 'Hide scrollbars', checked: cfg.hideScrollbars, onChange: (value) => update('hideScrollbars', value) }))
    }

    const inject = ['slots']

    function apply(ctx) {
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'style',
        order: 40,
        label: () => 'Appearance',
      }, AppearanceSection))
    }

    exports.apply = apply
    exports.inject = inject
    exports.AppearanceSection = AppearanceSection
    return module.exports
  },
})
