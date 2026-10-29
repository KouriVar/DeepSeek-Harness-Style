#!/usr/bin/env node
// Convert Studio's review JSON (dsh-icon-mapping.json) into the patcher's
// build-map (mapping.build.json), deduped by unique native resource, only
// confirmed entries with a target. Infers fill/stroke variant from the target SVG.
//
//   node scripts/convert-mapping.mjs [packDir]
import fs from 'node:fs'
import path from 'node:path'

const root = process.argv[2] || 'icon-packs/qoder'
const src = JSON.parse(fs.readFileSync(path.join(root, 'dsh-icon-mapping.json'), 'utf8'))

function viewBoxOf(svg) { const m = /viewBox="([^"]+)"/.exec(svg); return m ? m[1] : null }
function inferVariant(svg) {
  const rootMatch = /<svg\b([^>]*)>/.exec(svg)
  const rootAttrs = rootMatch ? rootMatch[1] : ''
  const pathHasStroke = [...svg.matchAll(/<path\b([^>]*)>/g)].some((x) => /stroke=/.test(x[1]) && !/fill=/.test(x[1]))
  if (/stroke="currentColor"/.test(rootAttrs) || pathHasStroke) return 'stroke'
  return 'fill'
}

const byRes = new Map()
const conflicts = []
const missingSvg = new Set()
const missingNative = new Set()
let confirmed = 0
for (const e of Object.values(src.entries || {})) {
  if (!e || e.status !== 'confirmed' || !e.target) continue
  confirmed++
  const n = e.native || {}
  const t = e.target || {}
  if (!n.resource || !t.relativePath) continue
  const nativePath = path.join(root, n.resource)
  if (!fs.existsSync(nativePath)) { missingNative.add(n.resource); continue }
  const targetPath = path.join(root, t.relativePath)
  if (!fs.existsSync(targetPath)) { missingSvg.add(t.relativePath); continue }
  const tsvg = fs.readFileSync(targetPath, 'utf8')
  const item = {
    native: {
      name: n.name,
      resource: n.resource,
      sourcePath: String(n.sourcePath || '').replace(/^app\.asar!/, ''),
      viewBox: n.viewBox || '0 0 16 16',
      mode: n.mode || 'stroke',
    },
    target: {
      fill: t.relativePath,
      variant: inferVariant(tsvg),
      viewBox: viewBoxOf(tsvg) || '0 0 24 24',
      iconId: t.name,
    },
  }
  const prev = byRes.get(n.resource)
  if (prev) {
    if (prev.target.fill !== item.target.fill) conflicts.push({ resource: n.resource, keep: prev.target.fill, drop: item.target.fill })
    continue
  }
  byRes.set(n.resource, item)
}

const items = [...byRes.values()]
const variantCount = items.reduce((acc, i) => { acc[i.target.variant] = (acc[i.target.variant] || 0) + 1; return acc }, {})
const out = {
  schemaVersion: 1,
  kind: 'dsh-icon-build-map',
  dshVersion: src.dshVersion,
  pack: { id: 'qoder', version: (src.packs && src.packs[0] && src.packs[0].version) || '' },
  items,
}
fs.writeFileSync(path.join(root, 'mapping.build.json'), JSON.stringify(out, null, 2) + '\n')

const report = {
  confirmedEntries: confirmed,
  uniqueResources: items.length,
  variantCount,
  conflicts,
  missingSvg: [...missingSvg],
  missingNative: [...missingNative],
}
fs.writeFileSync(path.join(root, 'convert.report.json'), JSON.stringify(report, null, 2) + '\n')

console.log(`confirmed entries: ${confirmed}`)
console.log(`unique native resources -> items: ${items.length}`)
console.log(`variants: ${JSON.stringify(variantCount)}`)
console.log(`conflicts (same resource, different target): ${conflicts.length}`)
console.log(`missing target svg: ${missingSvg.size}   missing native svg: ${missingNative.size}`)
console.log(`wrote ${path.join(root, 'mapping.build.json')} and convert.report.json`)
if (conflicts.length) console.log('conflicts sample:', JSON.stringify(conflicts.slice(0, 5)))
