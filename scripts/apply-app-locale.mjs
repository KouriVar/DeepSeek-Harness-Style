#!/usr/bin/env node
// Best-effort macOS localization patch for the DeepSeek Harness .app.
//
// Why: DSH's web UI follows the in-app language, but the native NSOpenPanel /
// menus follow the app bundle's localization. The shipped 0.2.1-rc.5 app has
// no .lproj and no CFBundleLocalizations, so its native file picker falls back
// to English even on a zh-Hans macOS.
//
// This script adds zh-Hans.lproj / zh_CN.lproj, sets the Info.plist localization
// keys, preserves the existing entitlements, and ad-hoc re-signs the app.
// It is NOT part of the dsh-style runtime plugin and cannot be applied by the
// plugin at runtime. It modifies the app bundle; future DSH updates overwrite it.
//
// Usage:
//   node scripts/apply-app-locale.mjs --dry-run
//   node scripts/apply-app-locale.mjs --apply
//   node scripts/apply-app-locale.mjs --apply --app "/Applications/DeepSeek Harness.app" --backup "/path/backup.zip"
//
// Quit DSH before --apply. A full backup zip is created before any change.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

const APP_DEFAULT = '/Applications/DeepSeek Harness.app'
const PB = '/usr/libexec/PlistBuddy'

function parseArgs(argv) {
  const out = { apply: false, app: APP_DEFAULT, backup: null, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') out.apply = true
    else if (a === '--dry-run') out.apply = false
    else if (a === '--app') out.app = argv[++i]
    else if (a === '--backup') out.backup = argv[++i]
    else if (a === '--help' || a === '-h') out.help = true
    else throw new Error(`unknown arg: ${a}`)
  }
  return out
}

function exists(p) { try { return fs.existsSync(p) } catch { return false } }
function pb(plist, cmd) { return execFileSync(PB, ['-c', cmd, plist], { encoding: 'utf8' }) }
function tryPb(plist, cmd) { try { return pb(plist, cmd) } catch { return '' } }

function readEntitlements(app) {
  try {
    const raw = execFileSync('codesign', ['-d', '--entitlements', ':-', app], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    })
    const i = raw.indexOf('<?xml')
    if (i < 0) return null
    const file = path.join(os.tmpdir(), `dsh-app-entitlements-${process.pid}.plist`)
    fs.writeFileSync(file, raw.slice(i))
    return file
  } catch { return null }
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('node scripts/apply-app-locale.mjs [--dry-run|--apply] [--app path] [--backup path]')
    return
  }
  const app = path.resolve(args.app)
  const plist = path.join(app, 'Contents', 'Info.plist')
  const resources = path.join(app, 'Contents', 'Resources')
  if (!exists(plist)) throw new Error(`not a macOS app: ${app}`)

  const dev = tryPb(plist, 'Print :CFBundleDevelopmentRegion').trim()
  const locs = tryPb(plist, 'Print :CFBundleLocalizations')
  const hasHans = exists(path.join(resources, 'zh-Hans.lproj', 'InfoPlist.strings'))
  const hasCn = exists(path.join(resources, 'zh_CN.lproj', 'InfoPlist.strings'))
  console.log(`app: ${app}`)
  console.log(`CFBundleDevelopmentRegion: ${dev || '(none)'}`)
  console.log(`CFBundleLocalizations: ${locs ? locs.replace(/\n/g, ' ') : '(none)'}`)
  console.log(`zh-Hans.lproj: ${hasHans ? 'yes' : 'no'}; zh_CN.lproj: ${hasCn ? 'yes' : 'no'}`)

  if (!args.apply) {
    console.log('\nDry-run only. Re-run with --apply to modify the app (quit DSH first).')
    return
  }

  const backup = args.backup || path.join(os.homedir(), 'Documents', 'DeepSeek Harness Backups', `DeepSeek-Harness-app-backup-${stamp()}.zip`)
  fs.mkdirSync(path.dirname(backup), { recursive: true })
  console.log(`backup -> ${backup}`)
  execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, backup], { stdio: 'inherit' })

  for (const lproj of ['zh-Hans.lproj', 'zh_CN.lproj']) {
    const dir = path.join(resources, lproj)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'InfoPlist.strings'), '"CFBundleName" = "DeepSeek Harness";\n"CFBundleDisplayName" = "DeepSeek Harness";\n')
  }

  tryPb(plist, 'Delete :CFBundleLocalizations')
  pb(plist, 'Add :CFBundleLocalizations array')
  pb(plist, 'Add :CFBundleLocalizations:0 string zh-Hans')
  pb(plist, 'Add :CFBundleLocalizations:1 string zh_CN')
  pb(plist, 'Add :CFBundleLocalizations:2 string en')
  tryPb(plist, 'Delete :CFBundleAllowMixedLocalizations')
  tryPb(plist, 'Delete :CFBundleDevelopmentRegion')
  pb(plist, 'Add :CFBundleDevelopmentRegion string zh-Hans')
  pb(plist, 'Add :CFBundleAllowMixedLocalizations bool true')

  const ent = readEntitlements(app)
  execFileSync('xattr', ['-cr', app], { stdio: 'inherit' })
  const signArgs = ['--force', '--deep', '--sign', '-']
  if (ent) signArgs.push('--entitlements', ent)
  signArgs.push(app)
  execFileSync('codesign', signArgs, { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' })
  console.log('\nDone. Quit DSH and reopen it, then test the native Cmd+O file picker.')
  console.log('If it does not work, restore the backup zip with:')
  console.log(`  rm -rf "${app}" && ditto -x -k "${backup}" "${path.dirname(app)}"`)
}

try { main() } catch (e) {
  console.error(`\nERROR: ${e.message}`)
  process.exit(1)
}
