import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PLUGIN = path.resolve(ROOT, '../..');
export const LOCAL = path.join(ROOT, '.local');
export const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.local.json'), 'utf8'));
const ownRequire=createRequire(path.join(ROOT,'package.json'));
export const toolRequire = name => {try{return ownRequire(name);}catch{if(!config.toolchainRoot)throw Error('缺少依赖 '+name+'；在 tools/icon-studio 安装依赖或设置 toolchainRoot。');return createRequire(path.join(config.toolchainRoot,'package.json'))(name);}};
export const hash = text => crypto.createHash('sha256').update(text).digest('hex');
export const slug = text => String(text).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
export const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
export function writeJSON(p, value) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n'); }
export function atomicJSON(p, value) { fs.mkdirSync(path.dirname(p), { recursive: true }); const temp = p + '.' + crypto.randomUUID() + '.tmp'; fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); fs.renameSync(temp, p); }
export function escapeXML(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const attrs = { viewBox: 'viewBox', className: 'class', gradientUnits: 'gradientUnits', gradientTransform: 'gradientTransform', preserveAspectRatio: 'preserveAspectRatio', xlinkHref: 'href' };
export function serialize(el) {
  if (el == null || typeof el === 'boolean') return '';
  if (Array.isArray(el)) return el.map(serialize).join('');
  if (typeof el !== 'object') return escapeXML(el);
  if (typeof el.tag !== 'string' || !/^(svg|g|path|rect|circle|ellipse|line|polyline|polygon|defs|linearGradient|radialGradient|stop|clipPath|mask|title|use)$/.test(el.tag)) throw Error('Unsupported SVG tag');
  const out = Object.entries(el.props || {}).filter(([k,v]) => !['children','key','ref'].includes(k) && !k.startsWith('on') && v != null && typeof v !== 'function' && typeof v !== 'object').map(([k,v]) => ` ${attrs[k] || k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}="${escapeXML(v)}"`).join('');
  return `<${el.tag}${out}>${serialize(el.props?.children)}</${el.tag}>`;
}
export class Asar {
  constructor(filename) {
    this.filename = filename; this.fd = fs.openSync(filename, 'r');
    const header = Buffer.alloc(16); fs.readSync(this.fd, header, 0, 16, 0);
    this.base = 8 + header.readUInt32LE(4); const size = header.readUInt32LE(12);
    const data = Buffer.alloc(size); fs.readSync(this.fd, data, 0, size, 16);
    this.files = new Map();
    const walk = (n, prefix='') => { for (const [k,v] of Object.entries(n.files || {})) v.files ? walk(v,prefix+k+'/') : this.files.set(prefix+k,v); };
    walk(JSON.parse(data));
  }
  read(name) {
    const e = this.files.get(name); if (!e) throw Error('Missing ASAR entry: '+name);
    if (e.link) return this.read(e.link);
    if (e.unpacked) return fs.readFileSync(this.filename+'.unpacked/'+name);
    const b = Buffer.alloc(e.size); fs.readSync(this.fd,b,0,e.size,this.base+Number(e.offset)); return b;
  }
  close() { fs.closeSync(this.fd); }
}
export function svgInfo(svg) {
  const root = svg.match(/<svg\b([^>]*)>/i)?.[1] || '';
  const get = k => root.match(new RegExp('(?:^|\\s)'+k+'=["\']([^"\']*)["\']'))?.[1] || null;
  const fills = [...new Set([...svg.matchAll(/\bfill=["']([^"']*)["']/g)].map(x=>x[1]))];
  const strokes = [...new Set([...svg.matchAll(/\bstroke=["']([^"']*)["']/g)].map(x=>x[1]))];
  return { viewBox:get('viewBox'), width:get('width'),height:get('height'),fills,strokes,currentColor:svg.includes('currentColor'),pathCount:(svg.match(/<path\b/g)||[]).length,geometryStyle:strokes.some(x=>x!=='none')?'stroke':'filled-path', sourceSha256:hash(svg) };
}
