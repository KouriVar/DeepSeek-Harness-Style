#!/usr/bin/env node
// DSH Icon Pack patcher.
//
// Replaces DSH native icon geometry with icons from an icon-pack, producing a
// modified copy of the DeepSeek Harness .app. Handles the app's Electron asar
// integrity: patched files get a fresh per-file SHA256 (4MB blocks), the header
// JSON hash in Info.plist (ElectronAsarIntegrity) is rewritten, then the copy is
// ad-hoc re-signed. Missing/unresolvable mappings fall back to native.
//
// Usage:
//   node scripts/apply-icon-pack.mjs --dry-run                 # only report the plan
//   node scripts/apply-icon-pack.mjs --apply --out "~/Applications/DeepSeek Harness (Qoder Icons).app"
//
// Defaults: --app "/Applications/DeepSeek Harness.app", --pack "icon-packs/qoder".

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

// ---------------------------------------------------------------- args
function parseArgs(argv) {
  const out = { dryRun: true, force: false, app: '/Applications/DeepSeek Harness.app', pack: 'icon-packs/qoder', out: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') out.dryRun = false
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--force') out.force = true
    else if (a === '--app') out.app = argv[++i]
    else if (a === '--pack') out.pack = argv[++i]
    else if (a === '--out') out.out = argv[++i]
  }
  if (!out.out) out.out = path.join(os.homedir(), 'Applications', 'DeepSeek Harness (Qoder Icons).app')
  return out
}

// ---------------------------------------------------------------- asar read
function readAsar(asarPath) {
  const raw = fs.readFileSync(asarPath)
  const b = raw.readUInt32LE(4)
  const chunk = raw.subarray(8, 8 + b)
  const jsonLen = chunk.readUInt32LE(4)
  const jsonBytes = chunk.subarray(8, 8 + jsonLen)
  const tree = JSON.parse(jsonBytes.toString('utf8'))
  const base = 8 + b
  const files = new Map() // path -> { entry, data|null (null = unpacked) }
  const walk = (node, prefix) => {
    for (const [name, child] of Object.entries(node.files || {})) {
      const p = prefix + '/' + name
      if (child.files) walk(child, p)
      else {
        let data = null
        if (!child.unpacked) data = raw.subarray(base + Number(child.offset), base + Number(child.offset) + Number(child.size))
        files.set(p, { entry: child, data })
      }
    }
  }
  walk(tree, '')
  return { raw, tree, base, jsonBytes, files }
}

function sha256hex(buf) { return crypto.createHash('sha256').update(buf).digest('hex') }

function hashBlocks(buf, blockSize = 4194304) {
  const blocks = []
  for (let i = 0; i < buf.length; i += blockSize) blocks.push(sha256hex(buf.subarray(i, i + blockSize)))
  if (blocks.length === 0) blocks.push(sha256hex(Buffer.alloc(0)))
  return blocks
}

// ---------------------------------------------------------------- svg children
function svgChildren(svg) {
  const kids = []
  for (const m of svg.matchAll(/<path\b([^>]*?)\/?>/g)) {
    const d = /d="([^"]+)"/.exec(m[1])
    if (d) kids.push({ type: 'path', d: d[1] })
  }
  for (const m of svg.matchAll(/<rect\b([^>]*?)\/?>/g)) {
    const attrs = Object.fromEntries([...m[1].matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]))
    kids.push({ type: 'rect', attrs })
  }
  for (const m of svg.matchAll(/<circle\b([^>]*?)\/?>/g)) {
    const attrs = Object.fromEntries([...m[1].matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]))
    kids.push({ type: 'circle', attrs })
  }
  return kids
}

function targetPathD(svg) {
  const ds = [...svg.matchAll(/<path\b([^>]*?)\/?>/g)]
    .map((m) => /d="([^"]+)"/.exec(m[1])?.[1])
    .filter(Boolean)
  return ds.join(' ')
}
function parseViewBox(vb) {
  const p = String(vb || '0 0 16 16').trim().split(/\s+/).map(Number)
  return { x: p[0] || 0, y: p[1] || 0, w: p[2] || 16, h: p[3] || 16 }
}
function transformFor(targetVb, nativeVb) {
  const t = parseViewBox(targetVb)
  const n = parseViewBox(nativeVb)
  const s = Math.min(n.w / t.w, n.h / t.h)
  // map target coords -> native coords: translate(n.x,n.y) scale(s) translate(-t.x,-t.y)
  const tx = n.x + (-t.x * s)
  const ty = n.y + (-t.y * s)
  const f = (v) => Number(v.toFixed(6))
  return `translate(${f(tx)} ${f(ty)}) scale(${f(s)})`
}

// ---------------------------------------------------------------- element spans
// Find the JSX element call span that contains a signature at `sigIndex`.
// Returns { type, start, objStart, objEnd } where [start, objEnd] covers `"path",{...}` (quotes incl.).
function findElementSpan(content, sigIndex) {
  const types = ['path', 'rect', 'circle']
  let best = null
  for (const type of types) {
    const token = '"' + type + '"'
    let idx = content.lastIndexOf(token, sigIndex)
    if (idx < 0 || sigIndex - idx > 700) continue
    if (!best || idx > best.idx) best = { type, idx, token }
  }
  if (!best) return null
  const objStart = content.indexOf('{', best.idx + best.token.length)
  if (objStart < 0) return null
  let depth = 0
  let j = objStart
  for (; j < content.length; j++) {
    const ch = content[j]
    if (ch === '"' || ch === "'") {
      const q = ch; j++
      while (j < content.length && content[j] !== q) { if (content[j] === '\\') j++; j++ }
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) break }
  }
  if (depth !== 0) return null
  return { type: best.type, start: best.idx, objEnd: j }
}

// Find all occurrences of a rect by attribute match, filtered by native viewBox context.
function findRectIndices(content, attrs, nativeViewBox) {
  const want = { x: attrs.x, y: attrs.y, width: attrs.width, height: attrs.height }
  const out = []
  for (const m of content.matchAll(/\("rect",\s*\{([^}]*)\}/g)) {
    const got = Object.fromEntries([...m[1].matchAll(/([a-zA-Z-]+):\s*"([^"]*)"/g)].map((x) => [x[1], x[2]]))
    if (Object.entries(want).every(([k, v]) => v === undefined || got[k] === v)) {
      const at = m.index
      const before = content.slice(Math.max(0, at - 800), at)
      if (nativeViewBox && !before.includes(nativeViewBox)) continue
      out.push(at + m[0].indexOf('"rect"'))
    }
  }
  return out
}

function occurrences(content, needle) {
  const out = []
  if (!needle) return out
  let i = content.indexOf(needle)
  while (i >= 0) { out.push(i); i = content.indexOf(needle, i + 1) }
  return out
}

// ---------------------------------------------------------------- plan
function planItem(item, files, packDir) {
  const native = item.native
  const target = item.target
  const nativeSvg = fs.readFileSync(path.join(packDir, native.resource), 'utf8')
  const targetSvgPath = target[target.variant || 'fill'] || target.fill || target.stroke
  const targetSvg = fs.readFileSync(path.join(packDir, targetSvgPath), 'utf8')
  const targetD = targetPathD(targetSvg)
  if (!targetD) return { item, ok: false, reason: 'target has no <path d>' }

  // locate file by sourcePath suffix
  let filePath = null
  const suffix = String(native.sourcePath || '').replace(/^\/?/, '/')
  for (const p of files.keys()) if (p === suffix || p.endsWith(suffix) || suffix.endsWith('/' + p.replace(/^\//, ''))) { filePath = p; break }
  if (!filePath) for (const p of files.keys()) if (p.endsWith('/' + path.basename(native.sourcePath || ''))) { filePath = p; break }
  if (!filePath) return { item, ok: false, reason: 'source file not found' }
  const fileData = files.get(filePath).data
  if (!fileData) return { item, ok: false, reason: 'unpacked/binary file' }
  const content = fileData.toString('utf8')

  const kids = svgChildren(nativeSvg)
  if (kids.length === 0) return { item, ok: false, reason: 'native has no children' }
  const transform = transformFor(target.viewBox || '0 0 24 24', native.viewBox)
  const replacements = []
  for (let ci = 0; ci < kids.length; ci++) {
    const kid = kids[ci]
    let idxs
    if (kid.type === 'path') {
      idxs = occurrences(content, kid.d)
      if (idxs.length !== 1) return { item, ok: false, reason: idxs.length === 0 ? 'child not found (path)' : `ambiguous path x${idxs.length}` }
    } else if (kid.type === 'rect') {
      idxs = findRectIndices(content, kid.attrs, native.viewBox)
      if (idxs.length === 0) return { item, ok: false, reason: 'child not found (rect)' }
      if (idxs.length > 8) return { item, ok: false, reason: `too many rect matches x${idxs.length}` }
    } else {
      idxs = occurrences(content, kid.attrs.r ? `r: "${kid.attrs.r}"` : '')
      if (idxs.length !== 1) return { item, ok: false, reason: 'circle unresolved' }
    }
    for (const idx of idxs) {
      const span = findElementSpan(content, idx)
      if (!span) return { item, ok: false, reason: `cannot delimit element (${kid.type})` }
      if (ci === 0) {
        const obj = `{d:"${targetD.replace(/"/g, '\\"')}",fill:"currentColor",stroke:"none",transform:"${transform}"}`
        replacements.push({ start: span.start, end: span.objEnd + 1, text: `"path",${obj}` })
      } else if (span.type === 'rect') {
        replacements.push({ start: span.start, end: span.objEnd + 1, text: '"rect",{width:"0",height:"0",fill:"none",stroke:"none"}' })
      } else if (span.type === 'circle') {
        replacements.push({ start: span.start, end: span.objEnd + 1, text: '"circle",{r:"0",fill:"none",stroke:"none"}' })
      } else {
        replacements.push({ start: span.start, end: span.objEnd + 1, text: '"path",{d:"",fill:"none",stroke:"none"}' })
      }
    }
  }
  let patched = content
  for (const r of replacements.sort((a, b) => b.start - a.start)) {
    patched = patched.slice(0, r.start) + r.text + patched.slice(r.end)
  }
  return { item, ok: true, filePath, content, patched, kids: kids.length }
}

// ---------------------------------------------------------------- asar write
function buildAsar(tree, files, changedMap) {
  // Assign new offsets for all regular files in tree order.
  const dataParts = []
  let offset = 0
  const visit = (node, prefix) => {
    for (const [name, child] of Object.entries(node.files || {})) {
      const p = prefix + '/' + name
      if (child.files) { visit(child, p); continue }
      if (child.unpacked) continue
      const rec = files.get(p)
      let buf = changedMap.has(p) ? changedMap.get(p) : rec.data
      if (!buf) continue
      child.size = buf.length
      if (changedMap.has(p)) {
        const blocks = hashBlocks(buf)
        child.integrity = { algorithm: 'SHA256', hash: blocks[0], blockSize: 4194304, blocks }
      }
      // align offset to 4
      const pad = (4 - (offset % 4)) % 4
      if (pad) { dataParts.push(Buffer.alloc(pad)); offset += pad }
      child.offset = String(offset)
      dataParts.push(buf)
      offset += buf.length
    }
  }
  visit(tree, '')
  const data = Buffer.concat(dataParts)
  const jsonBuf = Buffer.from(JSON.stringify(tree), 'utf8')
  const payload = 4 + jsonBuf.length
  const n = Math.ceil(payload / 4) * 4
  const b = 4 + n
  const header = Buffer.alloc(8)
  header.writeUInt32LE(4, 0); header.writeUInt32LE(b, 4)
  const pickle = Buffer.alloc(b) // [uint32 n][uint32 jsonLen][json][pad]
  pickle.writeUInt32LE(n, 0); pickle.writeUInt32LE(jsonBuf.length, 4)
  jsonBuf.copy(pickle, 8)
  const asar = Buffer.concat([header, pickle, data])
  return { asar, jsonBuf }
}

// ---------------------------------------------------------------- main
const args = parseArgs(process.argv.slice(2))
const asarPath = path.join(args.app, 'Contents', 'Resources', 'app.asar')
const packDir = path.resolve(args.pack)
const mapping = JSON.parse(fs.readFileSync(path.join(packDir, 'mapping.json'), 'utf8'))
const asar = readAsar(asarPath)
console.log(`app:  ${args.app}`)
console.log(`pack: ${packDir}  (${mapping.items.length} icons)`)

const plans = []
for (const item of mapping.items) {
  try { plans.push(planItem(item, asar.files, packDir)) }
  catch (error) { plans.push({ item, ok: false, reason: String(error && error.message || error) }) }
}
let ok = 0
for (const plan of plans) {
  if (plan.ok) { ok++; console.log(`  OK   ${plan.item.native.name}  ->  ${plan.item.target[plan.item.target.variant || 'fill']}  (${plan.kids} child ren, ${path.basename(plan.filePath)})`) }
  else console.log(`  SKIP ${plan.item.native.name}  (${plan.reason})`)
}
console.log(`resolved ${ok}/${plans.length}`)

if (args.dryRun) {
  console.log('\n[dry-run] no files changed. Re-run with --apply to build the .app copy.')
  process.exit(0)
}

// group patches by file
const changed = new Map()
for (const plan of plans) if (plan.ok) {
  if (!changed.has(plan.filePath)) changed.set(plan.filePath, { plan })
  // if multiple icons in same file, apply sequentially on the already-patched content
}
// Apply per-file: start from original content, apply each item's replacements in order.
const byFile = new Map()
for (const plan of plans) if (plan.ok) {
  if (!byFile.has(plan.filePath)) byFile.set(plan.filePath, [])
  byFile.get(plan.filePath).push(plan)
}
const changedBuffers = new Map()
for (const [filePath, group] of byFile) {
  let content = group[0].content
  // Recompute replacements for each item against current content to keep offsets valid.
  for (const plan of group) {
    // Re-run planItem against a single-file map of current content
    const tmpFiles = new Map([[filePath, { entry: {}, data: Buffer.from(content, 'utf8') }]])
    const redo = planItem(plan.item, tmpFiles, packDir)
    if (!redo.ok) { console.warn(`  warn: re-apply failed for ${plan.item.native.name}: ${redo.reason}`); continue }
    content = redo.patched
  }
  changedBuffers.set(filePath, Buffer.from(content, 'utf8'))
}

const { asar: newAsar, jsonBuf } = buildAsar(asar.tree, asar.files, changedBuffers)
console.log(`built new app.asar: ${(newAsar.length / 1048576).toFixed(1)} MB, header hash ${sha256hex(jsonBuf).slice(0, 12)}…`)

// copy app (clone on APFS if possible), write asar, update plist, re-sign
if (fs.existsSync(args.out)) {
  const safe = args.out !== args.app && args.out.endsWith('.app') && !args.out.includes('/Applications/DeepSeek Harness.app')
  if (!args.force || !safe) { console.error(`out exists: ${args.out} (use --force to replace a .app copy)`); process.exit(2) }
  console.log(`--force: removing ${args.out}`)
  fs.rmSync(args.out, { recursive: true, force: true })
}
fs.mkdirSync(path.dirname(args.out), { recursive: true })
console.log(`copying ${args.app} -> ${args.out} …`)
try { execFileSync('cp', ['-Rc', args.app, args.out], { stdio: 'inherit' }) }
catch { execFileSync('cp', ['-R', args.app, args.out], { stdio: 'inherit' }) }

const outAsar = path.join(args.out, 'Contents', 'Resources', 'app.asar')
fs.writeFileSync(outAsar, newAsar)
const plist = path.join(args.out, 'Contents', 'Info.plist')
const headerHash = sha256hex(jsonBuf)
try {
  execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :ElectronAsarIntegrity:Resources/app.asar:hash ${headerHash}`, plist], { stdio: 'inherit' })
} catch (e) { console.warn('plist update failed (may not have integrity key):', e.message) }

// preserve original entitlements if any
let entFile = null
try {
  const ent = execFileSync('codesign', ['-d', '--entitlements', ':-', args.app], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  if (ent && ent.includes('<plist')) { entFile = path.join(os.tmpdir(), 'dsh-entitlements.plist'); fs.writeFileSync(entFile, ent) }
} catch { /* none */ }
console.log('ad-hoc re-signing the copy …')
const signArgs = ['--force', '--deep', '--sign', '-']
if (entFile) signArgs.push('--entitlements', entFile)
signArgs.push(args.out)
execFileSync('codesign', signArgs, { stdio: 'inherit' })
try { execFileSync('xattr', ['-dr', 'com.apple.quarantine', args.out], { stdio: 'ignore' }) } catch { /* ignore */ }

console.log(`\nDone. Patched copy: ${args.out}`)
console.log('Quit the current app, then open the copy to verify. Original is untouched.')
