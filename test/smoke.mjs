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
let injectedSlot = null
const disposers = []
const ctx = {
  effect: (fn, _label) => {
    const dispose = fn()
    disposers.push(dispose)
    return () => { if (typeof dispose === 'function') dispose() }
  },
  slots: {
    inject: (name, callback) => { injectedSlot = name; return callback() },
    register: (options, component) => {
      registrations.push({ options, component })
      return { dispose() {} }
    },
  },
}
exported.apply(ctx)

assert.equal(injectedSlot, 'settings.section', 'injects into the native settings.section slot')
assert.equal(registrations.length, 1, 'registers exactly one settings page')
assert.equal(registrations[0].options.name, 'settings.section')
assert.equal(registrations[0].options.id, 'style')
assert.equal(registrations[0].options.order, 40)
assert.equal(registrations[0].options.label(), '外观')
assert.equal(registrations[0].component, exported.AppearanceSection)
assert.equal(typeof exported.LayoutCard, 'function', 'exports LayoutCard section')
assert.equal(typeof exported.EffectsCard, 'function', 'exports EffectsCard section')

console.log('OK  settings.section page registered: id=' + registrations[0].options.id + ' order=' + registrations[0].options.order)
console.log('OK  module id=' + def.id + ' inject=' + exported.inject.join(','))
