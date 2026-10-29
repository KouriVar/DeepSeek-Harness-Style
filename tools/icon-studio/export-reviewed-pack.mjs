#!/usr/bin/env node
// Export the live review snapshot and its assets; never changes review decisions or the app.
import fs from 'node:fs';
import path from 'node:path';
import { LOCAL, PLUGIN, config, hash, json, writeJSON, svgInfo } from './lib/common.mjs';

const destination = path.join(PLUGIN, 'icon-packs/qoder');
const base = `http://127.0.0.1:${config.port || 43184}`;
const get = async route => {
  const response = await fetch(base + route);
  if (!response.ok) throw Error(`${route}: HTTP ${response.status}`);
  return response.json();
};
let state, mapping;
for (let attempt = 0; attempt < 5; attempt++) {
  mapping = await get('/api/export');
  state = await get('/api/state');
  if (mapping.revision === state.revision) break;
}
if (mapping.revision !== state.revision) throw Error('审核正在变化，请稍后重新导出。');
const disk = json(path.join(LOCAL, 'reviews/decisions.json'));
if (disk.revision !== mapping.revision) throw Error('服务与已保存的审核版本不同，请先重新打开工作台。');
const library = json(path.join(LOCAL, 'data/qoder-index.json'));
const inventory = state.inventory;
const targets = new Map(library.icons.map(icon => [icon.id, icon]));
const items = new Map(inventory.map(item => [item.id, item]));
const assets = new Map();
const nativeIndex = new Map();
const targetIndex = new Map();
const approved = new Map();
const warnings = [];

const portableSource = value => {
  if (!value) return value;
  const asar = value.indexOf('app.asar!');
  if (asar >= 0) return value.slice(asar);
  const modules = value.indexOf('/node_modules/');
  if (modules >= 0) return 'profile' + value.slice(modules);
  return path.isAbsolute(value) ? path.basename(value) : value;
};
const safePath = relative => {
  if (!relative || path.isAbsolute(relative) || relative.split('/').includes('..')) {
    throw Error(`Unsafe asset path: ${relative}`);
  }
  return relative;
};
const queueAsset = (relative, source, expectedHash) => {
  safePath(relative);
  const content = fs.readFileSync(source);
  const digest = hash(content);
  if (expectedHash && digest !== expectedHash) throw Error(`SVG fingerprint changed: ${relative}`);
  if (assets.has(relative) && assets.get(relative).sha256 !== digest) throw Error(`Asset collision: ${relative}`);
  const svg = content.toString('utf8');
  const info = svgInfo(svg);
  if (!info.viewBox || info.viewBox.split(/[\s,]+/).length !== 4) throw Error(`Missing viewBox: ${relative}`);
  if (/<(?:script|image|foreignObject)\b|\bon[a-z]+\s*=|<!DOCTYPE|\b(?:href|xlink:href)\s*=\s*["'](?!#)/i.test(svg)) {
    warnings.push({ resource: relative, reason: '复杂内容或外部引用，补丁器应检查或跳过。' });
  }
  assets.set(relative, { content, sha256: digest, bytes: content.length });
  return info;
};

// All currently resolved native resources, including unconfirmed usages and Local/inline SVGs.
for (const item of inventory) {
  const resource = item.nativeRef?.resource;
  if (!resource || !item.icon) continue;
  if (!resource.startsWith('native-icons/')) throw Error(`Unexpected native resource: ${resource}`);
  const info = queueAsset(resource, path.join(LOCAL, safePath(item.icon.file)), item.icon.sourceSha256);
  if (!nativeIndex.has(resource)) nativeIndex.set(resource, {
    resource, sha256: info.sourceSha256, viewBox: info.viewBox,
    mode: info.geometryStyle === 'stroke' ? 'stroke' : 'fill',
    names: [], semanticIds: [], sourcePaths: [],
  });
  const record = nativeIndex.get(resource);
  if (!record.names.includes(item.nativeName)) record.names.push(item.nativeName);
  record.semanticIds.push(item.id);
  for (const usage of item.usages || []) {
    const source = portableSource(usage.sourcePath);
    if (source && !record.sourcePaths.includes(source)) record.sourcePaths.push(source);
  }
}

for (const [id, entry] of Object.entries(mapping.entries)) {
  const item = items.get(id);
  if (!item) throw Error(`Unknown usage: ${id}`);
  entry.native.sourcePath = portableSource(entry.native.sourcePath);
  const native = nativeIndex.get(entry.native.resource);
  if (native) Object.assign(entry.native, { viewBox: native.viewBox, mode: native.mode, sha256: native.sha256 });
  if (!entry.target) continue;
  if (entry.status !== 'confirmed') throw Error(`Unconfirmed target: ${id}`);
  const icon = targets.get(entry.target.iconId);
  if (!icon || icon.relativePath !== entry.target.relativePath) throw Error(`Unknown target: ${id}`);
  const info = queueAsset(icon.relativePath, path.join(config.qoderRoot, safePath(icon.relativePath)), entry.target.sha256);
  if (!info.currentColor || [...info.fills, ...info.strokes].some(color => !['none', 'currentColor', 'inherit', 'transparent'].includes(color))) {
    warnings.push({ resource: icon.relativePath, reason: '目标不满足单色 currentColor，补丁器应检查或跳过。' });
  }
  targetIndex.set(icon.relativePath, {
    resource: icon.relativePath, iconId: icon.id, sha256: info.sourceSha256,
    viewBox: info.viewBox, geometryStyle: info.geometryStyle, currentColor: info.currentColor,
    fills: info.fills, strokes: info.strokes,
  });
  const key = entry.native.resource || entry.native.name;
  if (!approved.has(key)) approved.set(key, new Map());
  if (!approved.get(key).has(icon.id)) approved.get(key).set(icon.id, []);
  approved.get(key).get(icon.id).push(id);
}

const conflicts = [...approved].filter(([, choices]) => choices.size > 1).map(([nativeResource, choices]) => ({
  nativeResource, choices: [...choices].map(([targetId, semanticIds]) => ({ targetId, semanticIds })),
}));
const confirmed = Object.values(mapping.entries).filter(entry => entry.status === 'confirmed' && entry.target);
const unresolved = inventory.filter(item => !item.icon);
const coverage = {
  schemaVersion: 1, generatedAt: mapping.generatedAt, revision: mapping.revision,
  usageTotal: inventory.length, confirmedUsagePositions: confirmed.length,
  nativeTotal: nativeIndex.size, mapped: approved.size,
  unambiguousMapped: approved.size - conflicts.length,
  targetSvgCount: targetIndex.size,
  missing: [...nativeIndex.keys()].filter(resource => !approved.has(resource)),
  unsupportedDynamic: [...new Set(unresolved.filter(item => item.nativeName.startsWith('Dynamic-')).map(item => item.nativeName))],
  unresolvedUsagePositions: unresolved.length,
  unresolved: unresolved.map(item => ({ semanticId: item.id, name: item.nativeName, resolution: item.resolution })),
  conflicts, warnings: [...new Map(warnings.map(warning => [JSON.stringify(warning), warning])).values()],
  notes: [
    'mapped 按唯一原生资源计数；confirmedUsagePositions 按语义使用位置计数。',
    '审阅态选择原样保留；同一原生资源选择不同目标时由 converter/report 列为冲突并跳过，不能任取一条。',
    '原生素材包含所有当前可解析资源；动态与其他未解析引用未伪造 SVG，保留原生回退。',
    'SVG 保留原始几何和实际 fill/stroke 属性；Line 名称不等于 stroke 渲染。',
    '素材校验不代表补丁定位成功；尚未执行补丁器 dry-run、apply 或重签。',
  ],
};

// Finish all checks before writing the handoff. Preserve the existing five-icon build sample.
for (const [relative, asset] of assets) {
  const output = path.join(destination, relative);
  if (fs.existsSync(output) && hash(fs.readFileSync(output)) !== asset.sha256) throw Error(`Refusing to overwrite different existing asset: ${relative}`);
}
for (const [relative, asset] of assets) {
  const output = path.join(destination, relative);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, asset.content);
}
writeJSON(path.join(destination, 'dsh-icon-mapping.json'), mapping);
writeJSON(path.join(destination, 'coverage.review.json'), coverage);
writeJSON(path.join(destination, 'native-index.json'), { schemaVersion: 1, resources: [...nativeIndex.values()] });
writeJSON(path.join(destination, 'assets.manifest.json'), {
  schemaVersion: 1, revision: mapping.revision,
  sourceMapping: 'dsh-icon-mapping.json',
  mappingSha256: hash(fs.readFileSync(path.join(destination, 'dsh-icon-mapping.json'))),
  sourcePathConvention: 'app.asar!/… 或 profile/node_modules/…；不含本机绝对目录。',
  nativeCount: nativeIndex.size, targetCount: targetIndex.size,
  targets: [...targetIndex.values()],
  files: [...assets].map(([resource, asset]) => ({ resource, sha256: asset.sha256, bytes: asset.bytes })),
});
console.log(JSON.stringify({ destination, revision: mapping.revision, usages: inventory.length,
  confirmed: confirmed.length, native: nativeIndex.size, mappedNative: approved.size,
  targets: targetIndex.size, conflicts: conflicts.length, warnings: coverage.warnings.length }, null, 2));
