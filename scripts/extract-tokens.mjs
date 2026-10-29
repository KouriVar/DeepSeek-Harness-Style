#!/usr/bin/env node
// Extract DSH design tokens (--dsw-*) from the installed app's theme package and
// emit a Figma-ready token set with resolved Light/Dark values.
//
//   node scripts/extract-tokens.mjs [--app /Applications/DeepSeek Harness.app] [--out design/tokens/dsh-tokens.json]
import fs from 'node:fs'
import path from 'node:path'

function parseArgs(a) { const o = { app: '/Applications/DeepSeek Harness.app', out: 'design/tokens/dsh-tokens.json' }; for (let i = 0; i < a.length; i++) { if (a[i] === '--app') o.app = a[++i]; else if (a[i] === '--out') o.out = a[++i] } return o }
const args = parseArgs(process.argv.slice(2))
const asarPath = path.join(args.app, 'Contents', 'Resources', 'app.asar')
const raw = fs.readFileSync(asarPath)
const b = raw.readUInt32LE(4)
const chunk = raw.subarray(8, 8 + b)
const jl = chunk.readUInt32LE(4)
const tree = JSON.parse(chunk.subarray(8, 8 + jl).toString('utf8'))
const base = 8 + b
let themeText = null
const walk = (node, prefix) => {
  for (const [name, c] of Object.entries(node.files || {})) {
    const p = prefix + '/' + name
    if (c.files) { walk(c, p); continue }
    if (p.endsWith('dsh-client-ui-theme/lib/client.js') && !c.unpacked) {
      themeText = raw.subarray(base + Number(c.offset), base + Number(c.offset) + Number(c.size)).toString('utf8')
    }
  }
}
walk(tree, '')
if (!themeText) { console.error('theme client.js not found'); process.exit(1) }

const light = {}
const dark = {}
const declRe = /(--[a-zA-Z0-9-]+)\s*:\s*([^;}]+)/g
const blockRe = /([^{}]+)\{([^{}]*)\}/g
let m
while ((m = blockRe.exec(themeText))) {
  const sel = m[1].trim().slice(-160)
  const body = m[2]
  if (!body.includes('--dsw-')) continue
  const isDark = sel.includes('data-ds-dark-theme')
  const isLight = !isDark && /(^|,)\s*(body|:root|html)\s*(,|$)/.test(sel)
  if (!isDark && !isLight) continue
  let d
  while ((d = declRe.exec(body))) {
    const target = isDark ? dark : light
    if (target[d[1]] === undefined) target[d[1]] = d[2].trim()
  }
}

const staticMap = {}
for (const mm of themeText.matchAll(/(--dsw-static-[a-zA-Z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g)) if (staticMap[mm[1]] === undefined) staticMap[mm[1]] = mm[2].trim()

function resolve(name, mode, depth = 0, seen = new Set()) {
  if (depth > 20 || seen.has(name)) return null
  const src = staticMap[name] ?? (mode === 'dark' ? (dark[name] ?? light[name]) : light[name])
  if (src === undefined) return null
  const next = new Set(seen); next.add(name)
  return src.replace(/var\(\s*(--dsw-[a-zA-Z0-9-]+)\s*(?:,[^)]*)?\)/g, (_x, ref) => resolve(ref, mode, depth + 1, next) ?? `var(${ref})`)
}

function toHex(value) {
  if (value === null) return null
  let v = value.trim()
  if (/^#[0-9a-f]{3,8}$/i.test(v)) {
    if (v.length === 4) return '#' + v.slice(1).split('').map((c) => c + c).join('')
    return v
  }
  const rgba = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?\s*\)$/i.exec(v)
  if (rgba) {
    const h = (n) => Math.round(Number(n)).toString(16).padStart(2, '0')
    const a = rgba[4] !== undefined ? Math.round(Number(rgba[4]) * 255) : 255
    return ('#' + h(rgba[1]) + h(rgba[2]) + h(rgba[3]) + (a < 255 ? h(a) : '')).toUpperCase()
  }
  return null
}

const names = [...new Set([...Object.keys(light), ...Object.keys(dark)])].filter((n) => n.startsWith('--dsw-')).sort()
const colors = []
const numbers = []
const skipped = []
for (const name of names) {
  const lv = resolve(name, 'light')
  const dv = resolve(name, 'dark')
  const lh = toHex(lv), dh = toHex(dv)
  if (lh || dh) {
    colors.push({ name: name.replace(/^--dsw-/, '').replace(/-/, '/'), token: name, light: lh || dh, dark: dh || lh })
  } else {
    skipped.push({ name, light: lv, dark: dv })
  }
}

for (const mm of themeText.matchAll(/(--dsw-radius-[a-zA-Z0-9-]+)\s*:\s*([0-9.]+)px/g)) {
  numbers.push({ name: 'radius/' + mm[1].replace(/^--dsw-radius-/, ''), token: mm[1], value: parseFloat(mm[2]) })
}

const out = {
  collection: 'DSH Tokens',
  modes: ['Light', 'Dark'],
  source: 'dsh-client-ui-theme@0.2.1-rc.3',
  color: colors,
  number: numbers,
  meta: { totalVars: names.length, color: colors.length, number: numbers.length, skipped: skipped.length },
}
fs.mkdirSync(path.dirname(args.out), { recursive: true })
fs.writeFileSync(args.out, JSON.stringify(out, null, 2) + '\n')
fs.writeFileSync(args.out.replace(/\.json$/, '.skipped.json'), JSON.stringify(skipped, null, 2) + '\n')
console.log(`tokens: ${names.length} total -> color ${colors.length}, number ${numbers.length}, skipped ${skipped.length}`)
console.log(`wrote ${args.out}`)
console.log('sample colors:', JSON.stringify(colors.slice(0, 6)))
console.log('sample numbers:', JSON.stringify(numbers.slice(0, 6)))
