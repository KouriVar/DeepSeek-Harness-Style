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

function makeEl(tag) {
  return {
    tag,
    attrs: {},
    style: {},
    children: [],
    parentElement: null,
    previousElementSibling: null,
    setAttribute(key, value) { this.attrs[key] = String(value) },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null },
    hasAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attrs, key) },
    removeAttribute(key) { delete this.attrs[key] },
    appendChild(child) { this.children.push(child); child.parentElement = this; return child },
    querySelector(selector) {
      if (selector === ':scope > [data-rightbar-col]') {
        return this.children.find((child) => child.hasAttribute('data-rightbar-col')) || null
      }
      return null
    },
  }
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
const fakeWindow = { __ModuleLoader__: { load: (value) => { def = value } } }
new Function('window', 'document', 'localStorage', code)(fakeWindow, fakeDocument, fakeLocalStorage)

const exported = def.factory((id) => {
  if (id === 'react') return { createElement: () => null, useState: () => [undefined, () => {}], useEffect: () => {} }
  if (id === '@deepseek-ai/dsh-client-ui-primitives') return {}
  throw new Error('unexpected require: ' + id)
})
const { applyStyles } = exported.__internal

// --- inset: tags three columns, writes CSS, sets html attribute
applyStyles({ enabled: true, layout: 'inset', reduceMotion: false, hideScrollbars: false })
assert.equal(html.getAttribute('data-dsh-style-layout'), 'inset', 'html carries layout=inset')
assert.ok(frame.hasAttribute('data-dsh-style-frame'), 'frame tagged')
assert.ok(center.hasAttribute('data-dsh-style-main'), 'center column tagged as main')
assert.ok(sidebar.hasAttribute('data-dsh-style-sidebar'), 'sidebar column tagged')
assert.ok(styleEl && styleEl.textContent.includes('[data-dsh-style-main]'), 'stylesheet contains main rule')
assert.ok(styleEl.textContent.includes('--dsh-style-inset-radius'), 'stylesheet defines inset tokens')

// --- classic: removes tags, native layout restored
applyStyles({ enabled: true, layout: 'classic', reduceMotion: false, hideScrollbars: false })
assert.equal(html.getAttribute('data-dsh-style-layout'), 'classic', 'html carries layout=classic')
assert.ok(!frame.hasAttribute('data-dsh-style-frame'), 'frame tag removed')
assert.ok(!center.hasAttribute('data-dsh-style-main'), 'main tag removed')
assert.ok(!sidebar.hasAttribute('data-dsh-style-sidebar'), 'sidebar tag removed')

// --- disabled: no residue at all
applyStyles({ enabled: false, layout: 'inset', reduceMotion: false, hideScrollbars: false })
assert.equal(html.getAttribute('data-dsh-style-layout'), null, 'layout attribute cleared when disabled')
assert.equal(html.getAttribute('data-dsh-style-enabled'), null, 'enabled attribute cleared when disabled')
assert.equal(styleEl.textContent, '', 'stylesheet cleared when disabled')
assert.ok(!center.hasAttribute('data-dsh-style-main'), 'no main tag when disabled')

console.log('OK  inset tags frame/main/sidebar and writes tokens')
console.log('OK  classic removes tags (native fallback)')
console.log('OK  disable clears every attribute + stylesheet (no residue)')
