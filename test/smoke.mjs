// Headless smoke test for client.js.
//
// Loads the client the way DeepSeek Harness does — through a fake
// window.__ModuleLoader__ — injects stub `react` and UI primitives, then asserts
// that apply() registers exactly one native Settings page into the
// `settings.section` slot. Run with:  node test/smoke.mjs
import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'

const code = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

let def = null
const fakeWindow = { __ModuleLoader__: { load: (value) => { def = value } } }

const store = new Map()
const fakeLocalStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)) },
}

// `document` is intentionally undefined: the factory must not touch the DOM at
// load time, only when the page component mounts.
new Function('window', 'document', 'localStorage', code)(fakeWindow, undefined, fakeLocalStorage)

assert.ok(def, 'client defined a module through __ModuleLoader__.load')
assert.equal(def.id, 'dsh-style', 'module id equals the package name')

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useEffect: () => {},
}
const primitives = { Switch: () => null, SegmentedControl: () => null, Button: () => null }

const exported = def.factory((id) => {
  if (id === 'react') return React
  if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitives
  throw new Error('unexpected require: ' + id)
})

assert.equal(typeof exported.apply, 'function', 'exports apply()')
assert.ok(Array.isArray(exported.inject), 'exports inject[]')

const registrations = []
const injectedSlots = []
const disposers = []
const ctx = {
  effect: (fn, _label) => {
    const dispose = fn()
    disposers.push(dispose)
    return () => { if (typeof dispose === 'function') dispose() }
  },
  slots: {
    inject: (name, callback) => { injectedSlots.push(name); return callback() },
    register: (options, component) => {
      registrations.push({ options, component })
      return { dispose() {} }
    },
  },
}
exported.apply(ctx)

assert.ok(injectedSlots.includes('settings.section'), 'injects into the native settings.section slot')
assert.ok(injectedSlots.includes('shell.overlay'), 'mounts the bot-entry bridge in shell.overlay')
assert.ok(injectedSlots.includes('conversation.session.header.utilities'), 'registers the task-monitor toolbar button')
assert.ok(injectedSlots.includes('sidebar.workspaces.session.menu.item'), 'injects the session-row time menu item')
assert.ok(injectedSlots.includes('plugins.detail.actions'), 'injects the plugin-detail alias action')
assert.equal(registrations.length, 9, 'registers settings page + bot-entry bridge + monitor host + monitor button + session time menu item + plugin alias action + 2 qoder home dock cards + entity panel')
const entityPanel = registrations.find((entry) => entry.options.id === 'dsh-style-entity-panel')
assert.ok(entityPanel, 'entity detail panel registered into shell.overlay')
assert.equal(entityPanel.options.name, 'shell.overlay')
assert.equal(entityPanel.options.order, 950)
const settings = registrations.find((entry) => entry.options.name === 'settings.section')
const overlay = registrations.find((entry) => entry.options.name === 'shell.overlay' && entry.options.id === 'dsh-style-botentry')
const monitorHost = registrations.find((entry) => entry.options.id === 'dsh-style-monitor-host')
const monitorBtn = registrations.find((entry) => entry.options.id === 'dsh-style-monitor-btn')
assert.ok(settings, 'settings.section registered')
assert.equal(settings.options.id, 'style')
assert.equal(settings.options.order, 40)
assert.equal(settings.options.label(), '外观')
assert.equal(settings.component, exported.AppearanceSection)
assert.ok(overlay, 'bot-entry bridge registered')
assert.equal(overlay.options.order, 900)
assert.ok(monitorHost, 'monitor host registered')
assert.equal(monitorHost.options.name, 'shell.overlay')
assert.equal(monitorHost.options.order, 901)
assert.ok(monitorBtn, 'monitor button registered')
assert.equal(monitorBtn.options.name, 'conversation.session.header.utilities')
const aliasAction = registrations.find((entry) => entry.options.id === 'dsh-style-alias')
assert.ok(aliasAction, 'plugin alias action registered')
assert.equal(aliasAction.options.name, 'plugins.detail.actions')
assert.equal(typeof aliasAction.component, 'function')
assert.equal(typeof exported.LayoutCard, 'function', 'exports LayoutCard section')
assert.equal(typeof exported.EffectsCard, 'function', 'exports EffectsCard section')

console.log('OK  settings.section page registered: id=' + settings.options.id + ' order=' + settings.options.order)
console.log('OK  shell.overlay bot-entry bridge registered: id=' + overlay.options.id + ' order=' + overlay.options.order)
console.log('OK  task-monitor host + toolbar button registered')
console.log('OK  module id=' + def.id + ' inject=' + exported.inject.join(','))
