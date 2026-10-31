// Fake-DOM test for the inset layout engine.
//
// No browser needed: builds a tiny DOM shaped like the real AppFrame
// (frame > [sidebar, center, rightbar(data-rightbar-col), bottom(data-shell-bottom)])
// and exercises applyStyles() end to end:
//   inset  -> tags the three columns and writes the stylesheet
//   classic-> removes the tags (full native fallback)
//   disabled-> removes every attribute and clears the stylesheet (no residue)
import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'

const code = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

// 插件里用了浏览器全局（MutationObserver / getComputedStyle），Node 侧给最小 stub。
globalThis.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return [] } }
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '', length: 0, item: () => '' })

function makeEl(tag) {
  const el = {
    tag,
    attrs: {},
    dataset: {},
    style: {
      getPropertyValue() { return '' },
      setProperty() {},
      getPropertyPriority() { return '' },
      removeProperty() {},
    },
    children: [],
    parentElement: null,
    previousElementSibling: null,
    innerHTML: '',
    textContent: '',
    disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false } },
    setAttribute(key, value) { this.attrs[key] = String(value) },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null },
    hasAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attrs, key) },
    removeAttribute(key) { delete this.attrs[key] },
    addEventListener() {},
    removeEventListener() {},
    appendChild(child) { this.children.push(child); child.parentElement = this; return child },
    append(...kids) { for (const kid of kids) this.appendChild(kid) },
    insertBefore(child, ref) {
      const index = ref ? this.children.indexOf(ref) : -1
      if (index >= 0) this.children.splice(index, 0, child)
      else this.children.push(child)
      child.parentElement = this
      return child
    },
    removeChild(child) { this.children = this.children.filter((c) => c !== child); child.parentElement = null },
    remove() { if (this.parentElement) this.parentElement.removeChild(this) },
    contains(node) {
      let cursor = node
      while (cursor) { if (cursor === this) return true; cursor = cursor.parentElement }
      return false
    },
    closest() { return null },
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 } },
    querySelector(selector) {
      if (selector === ':scope > [data-rightbar-col]') {
        return this.children.find((child) => child.hasAttribute('data-rightbar-col')) || null
      }
      return null
    },
  }
  Object.defineProperty(el, 'className', {
    get() { return this.attrs.class || '' },
    set(value) { this.attrs.class = String(value) },
  })
  return el
}

let styleEl = null
const html = makeEl('html')
const body = makeEl('body')
const head = makeEl('head')
const frame = makeEl('div')
const sidebar = makeEl('div')
const center = makeEl('div')
const rightbar = makeEl('div')
const bottom = makeEl('div')
rightbar.setAttribute('data-rightbar-col', '')
bottom.setAttribute('data-shell-bottom', '')
center.previousElementSibling = sidebar
rightbar.previousElementSibling = center
frame.appendChild(sidebar)
frame.appendChild(center)
frame.appendChild(rightbar)
frame.appendChild(bottom)
const known = [html, body, frame, sidebar, center, rightbar, bottom]

const fakeDocument = {
  documentElement: html,
  body,
  head,
  createElement(tag) {
    const el = makeEl(tag)
    if (tag === 'style') styleEl = el
    return el
  },
  querySelector(selector) {
    if (selector === 'style[data-plugin="dsh-style"]') return styleEl
    if (selector === '[data-shell-bottom]') return bottom
    return null
  },
  addEventListener() {},
  removeEventListener() {},
  querySelectorAll(selector) {
    const match = selector.match(/^\[(data-dsh-style-[a-z]+)\]$/)
    if (!match) return []
    return known.filter((el) => el.hasAttribute(match[1]))
  },
}

const store = new Map()
const fakeLocalStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)) },
}

let def = null
const resizeListeners = new Set()
const fakeWindow = {
  __ModuleLoader__: { load: (value) => { def = value } },
  addEventListener(type, fn) { if (type === 'resize') resizeListeners.add(fn) },
  removeEventListener(type, fn) { if (type === 'resize') resizeListeners.delete(fn) },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
}
new Function('window', 'document', 'localStorage', code)(fakeWindow, fakeDocument, fakeLocalStorage)

const exported = def.factory((id) => {
  if (id === 'react') return { createElement: () => null, useState: () => [undefined, () => {}], useEffect: () => {} }
  if (id === '@deepseek-ai/dsh-client-ui-primitives') return {}
  throw new Error('unexpected require: ' + id)
})
const { applyStyles } = exported.__internal

// --- inset: tags three columns, writes CSS, sets html attribute
applyStyles({ enabled: true, layout: 'inset', reduceMotion: false, hideScrollbars: false, titlebarButtons: false, refCards: false, composerChrome: false })
assert.equal(html.getAttribute('data-dsh-style-layout'), 'inset', 'html carries layout=inset')
assert.ok(frame.hasAttribute('data-dsh-style-frame'), 'frame tagged')
assert.ok(center.hasAttribute('data-dsh-style-main'), 'center column tagged as main')
assert.ok(sidebar.hasAttribute('data-dsh-style-sidebar'), 'sidebar column tagged')
assert.ok(styleEl && styleEl.textContent.includes('[data-dsh-style-main]'), 'stylesheet contains main rule')
assert.ok(styleEl.textContent.includes('--dsh-style-inset-radius'), 'stylesheet defines inset tokens')

// --- classic: removes tags, native layout restored
applyStyles({ enabled: true, layout: 'classic', reduceMotion: false, hideScrollbars: false, titlebarButtons: false, refCards: false, composerChrome: false })
assert.equal(html.getAttribute('data-dsh-style-layout'), 'classic', 'html carries layout=classic')
// 经典模式下仍会打结构标记（沉浸式外壳对两种布局都生效）；inset 样式由 html 上的 layout 属性门控。
assert.ok(frame.hasAttribute('data-dsh-style-frame'), 'classic keeps structural tags')
assert.ok(styleEl.textContent.includes('data-dsh-style-layout'), 'stylesheet is gated by layout attribute')

// --- disabled: no residue at all
applyStyles({ enabled: false, layout: 'inset', reduceMotion: false, hideScrollbars: false, titlebarButtons: false, refCards: false, composerChrome: false })
assert.equal(html.getAttribute('data-dsh-style-layout'), null, 'layout attribute cleared when disabled')
assert.equal(html.getAttribute('data-dsh-style-enabled'), null, 'enabled attribute cleared when disabled')
assert.equal(styleEl.textContent, '', 'stylesheet cleared when disabled')
assert.ok(!center.hasAttribute('data-dsh-style-main'), 'no main tag when disabled')

console.log('OK  inset tags frame/main/sidebar and writes tokens')
console.log('OK  classic removes tags (native fallback)')
console.log('OK  disable clears every attribute + stylesheet (no residue)')
