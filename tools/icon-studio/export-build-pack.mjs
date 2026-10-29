import fs from 'node:fs';
import path from 'node:path';
import {PLUGIN,LOCAL,config,json,writeJSON,svgInfo,hash} from './lib/common.mjs';
import {ReviewStore} from './lib/review.mjs';
const inventory=json(path.join(LOCAL,'data/dsh-inventory.json'));
const {pack,icons}=json(path.join(LOCAL,'data/qoder-index.json'));
const pilot=json(path.join(LOCAL,'data/pilot-30.json'));
const audit=json(path.join(LOCAL,'data/source-audit.json'));
const store=new ReviewStore(path.join(LOCAL,'reviews/decisions.json'),inventory,icons);
const decisions=store.effective(),targets=new Map(icons.map(x=>[x.id,x]));
const groups=new Map();
for(const i of inventory.filter(x=>x.icon)){const key=i.icon.file;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
const roles=['新建会话','搜索','自动化任务','发送','停止'];
const out=path.join(PLUGIN,'icon-packs/qoder');
if(fs.existsSync(path.join(out,'mapping.json')))throw Error('输出目录已有 mapping.json，未覆盖。请先保留现有包再明确处理。');
const items=[],used=new Set(),evidence=[];
for(const role of roles){
 const p=pilot.items.find(x=>x.role===role),i=inventory.find(x=>x.id===p?.id),d=i&&decisions[i.id];
 if(!i?.icon||d?.status!=='confirmed'||d.stale)throw Error(role+' 尚未有效人工确认，停止导出');
 if(used.has(i.icon.file))continue;
 const group=groups.get(i.icon.file),choices=new Set(group.filter(x=>decisions[x.id]?.status==='confirmed').map(x=>decisions[x.id].targetId));
 if(choices.size>1)throw Error('同一原生资源有冲突选择：'+i.nativeName);
 const target=targets.get(d.targetId);if(!target)throw Error('目标不存在');
 const svg=fs.readFileSync(target.svgPath,'utf8');
 if(hash(svg)!==target.sourceSha256)throw Error('目标指纹变化');
 if(/<(?:script|image|foreignObject)\b|\bon\w+\s*=|(?:href|xlink:href)\s*=/i.test(svg))throw Error('目标包含不支持的内容');
 const info=svgInfo(svg);if([...info.fills,...info.strokes].some(x=>!['none','currentColor'].includes(x)))throw Error('不是单色 currentColor：'+target.name);
 // Preserve the actual renderer. A Line glyph can still consist of filled outlines.
 const variant=info.geometryStyle==='stroke'?'stroke':'fill';
 const filename=target.name+'.'+variant+'.svg';
 const nativeFile=path.basename(i.icon.file),nativeSvg=fs.readFileSync(path.join(LOCAL,i.icon.file));
 if(hash(nativeSvg)!==i.icon.sourceSha256)throw Error('原生指纹变化');
 fs.mkdirSync(path.join(out,'svg'),{recursive:true});fs.mkdirSync(path.join(out,'native-icons'),{recursive:true});
 fs.writeFileSync(path.join(out,'svg',filename),svg);fs.writeFileSync(path.join(out,'native-icons',nativeFile),nativeSvg);
 const source=i.nativeRef.packId==='dsh-primitives'?audit.sourceStats.find(s=>s.kind==='frontend')?.path:i.usages[0].sourcePath;
 const sourcePath=source.includes('!/')?source.split('!/')[1]:path.relative(PLUGIN,source);
 items.push({native:{name:i.nativeName,resource:'native-icons/'+nativeFile,sourcePath,viewBox:i.icon.viewBox,mode:i.icon.geometryStyle==='stroke'?'stroke':'fill'},target:{[variant]:'svg/'+filename,variant,viewBox:info.viewBox}});
 evidence.push({role,semanticIds:group.map(x=>x.id),nativeResource:'native-icons/'+nativeFile,nativeSha256:hash(nativeSvg),targetId:target.id,targetSha256:hash(svg),approvedAt:d.updatedAt,appearance:/Line$/.test(target.name)?'line':/Fill$/.test(target.name)?'solid':'custom',renderer:variant});
 used.add(i.icon.file);
}
const mapping={schemaVersion:1,kind:'dsh-icon-build-map',dshVersion:audit.dshVersion,pack:{id:'qoder',version:pack.version},items};
writeJSON(path.join(out,'mapping.json'),mapping);
const missing=[...groups].filter(([k])=>!used.has(k)).map(([resource,rows])=>({name:rows[0].nativeName,resource:'native-icons/'+path.basename(resource),usageCount:rows.length}));
writeJSON(path.join(out,'coverage.json'),{nativeTotal:groups.size,mapped:items.length,scope:'5-icon-approved-pilot',missing:missing.map(x=>x.name),missingResources:missing,unsupportedDynamic:[...new Set(inventory.filter(x=>x.nativeName.startsWith('Dynamic-')).map(x=>x.nativeName))],otherUnresolved:[...new Set(inventory.filter(x=>!x.icon&&!x.nativeName.startsWith('Dynamic-')).map(x=>x.nativeName))],notes:['nativeTotal 依据当前 Studio 可解析的唯一 native.resource 计数，不把使用位置或未解析动态引用当作唯一 SVG。','此小样只携带 5 个已确认目标及其对应原生 SVG，未匹配资源不在包内，保留原生。','Line/Fill 字形命名与 SVG 实际 fill/stroke 渲染是两个维度；未伪造 stroke 版本。']});
writeJSON(path.join(out,'evidence.json'),{dshBuildCommit:audit.dshBuildCommit,packSourceSha256:pack.sourceSha256,items:evidence});
console.log(JSON.stringify({out,mapped:items.length,nativeTotal:groups.size,roles:evidence.map(x=>x.role)},null,2));
