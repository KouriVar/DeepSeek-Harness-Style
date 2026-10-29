import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {LOCAL,json,hash,toolRequire} from '../lib/common.mjs';
import {ReviewStore} from '../lib/review.mjs';
import {coverage} from '../lib/match.mjs';
const inventory=json(path.join(LOCAL,'data/dsh-inventory.json'));
const {pack,icons}=json(path.join(LOCAL,'data/qoder-index.json'));
const {records:candidates}=json(path.join(LOCAL,'data/candidates.json'));
const pilot=json(path.join(LOCAL,'data/pilot-30.json'));
const makeStore=()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-icons-test-'));return {dir,store:new ReviewStore(path.join(dir,'decisions.json'),inventory,icons)};};
const ready=inventory.find(x=>x.icon&&candidates[x.id].candidates.length);
const target=candidates[ready.id].candidates[0].targetId;
test('真实清单、源证据和资源索引完整，候选不超过五个',()=>{
  assert.equal(pack.namedIcons,3546);assert.equal(pack.customIcons,7);assert.equal(icons.length,3553);
  assert.equal(new Set(inventory.map(x=>x.id)).size,inventory.length);
  const ids=new Set(icons.map(x=>x.id));
  for(const item of inventory){assert.ok(item.usages.length);for(const u of item.usages){assert.ok(u.line>0);assert.ok(u.sourcePath);assert.ok(u.snippet);}
    const rec=candidates[item.id];assert.ok(rec);assert.ok(rec.candidates.length<=5);
    for(const c of rec.candidates){assert.ok(ids.has(c.targetId));assert.ok(c.reasons.length>=5);assert.ok(c.score>=0&&c.score<=1);}
  }
});
test('首轮 30 项包含真实发送/停止分支及常用功能，绝无自动确认',()=>{
  assert.equal(pilot.items.length,30);assert.deepEqual(pilot.missingRequestedRoles,[]);
  for(const role of ['新建会话','搜索','侧栏展开','侧栏收起','插件','自动化任务','附件','发送','停止','复制','更多操作','任务监控入口'])assert.ok(pilot.items.some(x=>x.role===role),role);
  for(const p of pilot.items){assert.ok(p.previewAvailable,p.role);assert.ok(p.candidateCount>0,p.role);assert.equal(p.humanReviewed,false);}
  assert.equal(coverage(inventory,candidates).confirmed,0);
});
test('候选选择不产生有效映射；人工确认持久化并可恢复默认',()=>{
  const {dir,store}=makeStore();try{
    const opts={dshVersion:'test',packs:[pack],candidates};
    store.update({id:ready.id,action:'select',targetId:target,revision:0});
    assert.equal(store.export(opts).entries[ready.id].target,null);
    assert.equal(coverage(inventory,candidates,store.effective()).confirmed,0);
    store.update({id:ready.id,action:'confirm',targetId:target,revision:1,note:'临时测试'});
    const reloaded=new ReviewStore(store.file,inventory,icons);assert.equal(reloaded.effective()[ready.id].status,'confirmed');
    assert.equal(reloaded.export(opts).entries[ready.id].target.iconId,target);
    assert.equal(reloaded.export(opts).entries[ready.id].fallback,'native');
    reloaded.update({id:ready.id,action:'reset',revision:2});assert.equal(reloaded.export(opts).entries[ready.id].target,null);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('跳过回退、非法目标、并发修改和资源变化均不误导出',()=>{
  const {dir,store}=makeStore();try{
    assert.throws(()=>store.update({id:ready.id,action:'confirm',targetId:'missing',revision:0}));
    store.update({id:ready.id,action:'ignore',revision:0});assert.equal(store.effective()[ready.id].status,'ignored');
    assert.throws(()=>store.update({id:ready.id,action:'reset',revision:0}),/更新/);
    store.update({id:ready.id,action:'confirm',targetId:target,revision:1});
    const changed=icons.map(i=>i.id===target?{...i,sourceSha256:'changed'}:i);
    const changedStore=new ReviewStore(store.file,inventory,changed);
    assert.equal(changedStore.effective()[ready.id].stale,true);
    assert.equal(changedStore.export({dshVersion:'test',packs:[pack]}).entries[ready.id].target,null);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('未知的动态资源必须明确人工检查后才能确认',()=>{
  const item=inventory.find(x=>!x.icon),{dir,store}=makeStore();try{assert.ok(item);assert.throws(()=>store.update({id:item.id,action:'confirm',targetId:target,revision:0}),/实机检查/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('首轮所有实际 native/target SVG 可栅格化，指纹正确',async()=>{
  const sharp=toolRequire('sharp');
  for(const p of pilot.items){const item=inventory.find(x=>x.id===p.id);const svg=fs.readFileSync(path.join(LOCAL,item.icon.file));assert.equal(hash(svg),item.icon.sourceSha256);await sharp(svg).resize(24,24).png().toBuffer();for(const candidate of candidates[item.id].candidates){const target=icons.find(x=>x.id===candidate.targetId);await sharp(fs.readFileSync(target.svgPath)).resize(24,24).png().toBuffer();}}
});
