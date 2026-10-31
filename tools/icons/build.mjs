#!/usr/bin/env node
/**
 * 图标覆盖表构建器：icons/manifest.json → client.js 的 ICON_OVERRIDES 块。
 *
 * 为什么需要它：这个插件是单文件 CJS（走 `window.__ModuleLoader__.load`），没有资源管线，
 * 图片/SVG 只能内联成 data URL。所以「换图标」的实际动作是：把 svg 内联进 client.js。
 * 手动 base64 容易出错也难 review，这里做成一次生成、可重复执行、结果稳定（同样的输入 → 同样的输出）。
 *
 * 用法：
 *   npm run icons:build        # 生成并写回 client.js
 *   npm run icons:build -- --check   # 只校验不写盘（CI / 提交前用）
 *
 * 规则：
 *   - manifest 每条必须有 id / file / selector；file 默认相对 icons/；
 *   - enabled: false 的条目不写进产物（保留在表里做记录）；
 *   - 缺失的 svg 直接报错退出（不静默跳过，避免「以为换了其实没换」）；
 *   - 写回只替换 client.js 里 `// <icons:auto>` … `// </icons:auto>` 之间的内容。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, isAbsolute } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const iconsDir = join(root, 'icons')
const manifestPath = join(iconsDir, 'manifest.json')
const clientPath = join(root, 'client.js')

const BEGIN = '    // <icons:auto> 由 tools/icons/build.mjs 生成，勿手改；改图标请编辑 icons/manifest.json 后跑 npm run icons:build'
const END = '    // </icons:auto>'

const checkOnly = process.argv.includes('--check')

function fail(msg) {
  console.error('[icons] ' + msg)
  process.exit(1)
}

/** 压掉 SVG 里的空白与注释：data URL 更短，且输出稳定（便于 diff）。 */
function minifySvg(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim()
}

function toDataUrl(svg) {
  // base64 而不是百分号编码：路径里的引号/尖括号不必逐一转义，CSS 里也安全。
  return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64')
}

if (!existsSync(manifestPath)) fail('找不到 icons/manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const list = Array.isArray(manifest.icons) ? manifest.icons : []
if (list.length === 0) fail('icons/manifest.json 里没有任何条目')

const entries = []
const seen = new Set()
const areas = manifest.areas && typeof manifest.areas === 'object' ? manifest.areas : {}
for (const raw of list) {
  const id = String(raw.id || '').trim()
  if (!id) fail('有条目缺少 id')
  if (seen.has(id)) fail('id 重复：' + id)
  seen.add(id)
  if (!raw.selector) fail(id + ' 缺少 selector')

  // area 同时决定目录分类：file 应当落在 icons/<area>/ 下，方便按区域找、也方便以后按区域生成清单。
  const area = String(raw.area || '').trim()
  if (!area) fail(id + ' 缺少 area（取值见 manifest.areas）')
  if (!areas[area]) fail(id + ' 的 area 不在 manifest.areas 里：' + area)

  if (raw.enabled === false) {
    console.log('[icons] skip（enabled:false）' + area + ' · ' + id + ' · ' + (raw.native || '?'))
    continue
  }

  const file = String(raw.file || '')
  if (!file) fail(id + ' 缺少 file')
  const svgPath = isAbsolute(file) ? file : join(iconsDir, file)
  if (!existsSync(svgPath)) fail(id + ' 找不到图标文件：' + svgPath)
  if (!svgPath.startsWith(iconsDir + '/')) fail(id + ' 的 file 必须放在 icons/ 目录内：' + file)
  const areaDir = area.split('.').join('/') + '/'
  if (!file.replace(/\\/g, '/').startsWith(areaDir)) {
    fail(id + ' 的 file 应放在 icons/' + areaDir + ' 下（area 用点分层、目录用斜杠对齐）：' + file)
  }

  const svg = minifySvg(readFileSync(svgPath, 'utf8'))
  if (!/viewBox\s*=/.test(svg)) fail(id + ' 的 svg 缺少 viewBox（缩放会失真）：' + file)

  entries.push({
    id,
    area,
    native: raw.native || '',
    where: raw.where || '',
    selector: String(raw.selector),
    size: Number(raw.size) || 16,
    tint: raw.tint === 'color' ? 'color' : 'currentColor',
    hide: raw.hide === false ? false : (raw.hide || 'svg'),
    svg: toDataUrl(svg),
  })
}

const body = entries.length === 0
  ? '    const ICON_OVERRIDES = []'
  : '    const ICON_OVERRIDES = [\n' + entries.map((e) => {
      const parts = [
        'id: ' + JSON.stringify(e.id),
        'area: ' + JSON.stringify(e.area),
        'native: ' + JSON.stringify(e.native),
        'where: ' + JSON.stringify(e.where),
        'selector: ' + JSON.stringify(e.selector),
        'size: ' + e.size,
        'tint: ' + JSON.stringify(e.tint),
        'hide: ' + JSON.stringify(e.hide),
        'svg: ' + JSON.stringify(e.svg),
      ]
      return '      { ' + parts.join(', ') + ' },'
    }).join('\n') + '\n    ]'

const client = readFileSync(clientPath, 'utf8')
const start = client.indexOf(BEGIN)
const endMark = client.indexOf(END)
if (start < 0 || endMark < 0) fail('client.js 里找不到 <icons:auto> 标记块')
if (endMark < start) fail('client.js 的 icons 标记顺序不对')

const next = client.slice(0, start) + BEGIN + '\n' + body + '\n' + client.slice(endMark)
const changed = next !== client

if (checkOnly) {
  if (changed) fail('client.js 与 icons/manifest.json 不一致，请运行 npm run icons:build')
  console.log('[icons] OK · ' + entries.length + ' 条生效 / ' + (list.length - entries.length) + ' 条停用')
  process.exit(0)
}

if (changed) {
  writeFileSync(clientPath, next)
  console.log('[icons] 写入 client.js：' + entries.length + ' 条生效 / ' + (list.length - entries.length) + ' 条停用')
  for (const e of entries) console.log('  · [' + e.area + '] ' + e.id + ' ← ' + (e.native || '?') + ' @ ' + e.size + 'px (' + e.tint + ')')
} else {
  console.log('[icons] 无变化（' + entries.length + ' 条生效）')
}
