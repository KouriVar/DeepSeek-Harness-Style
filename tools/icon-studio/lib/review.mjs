import fs from 'node:fs';
import path from 'node:path';
import { atomicJSON, json, hash } from './common.mjs';
export class ReviewStore {
  constructor(file,inventory,icons) {
    this.file=file;this.inventory=new Map(inventory.map(x=>[x.id,x]));this.icons=new Map(icons.map(x=>[x.id,x]));
    this.state=fs.existsSync(file)?json(file):{schemaVersion:1,revision:0,decisions:{}};
    if(this.state.schemaVersion!==1||!Number.isInteger(this.state.revision)||!this.state.decisions)throw Error('审核文件结构无效；未覆盖原文件。');
  }
  update(input) {
    if(input.revision!==this.state.revision)throw Object.assign(Error('审核数据已更新，请刷新后重试。'),{status:409});
    const item=this.inventory.get(input.id);if(!item)throw Object.assign(Error('未知语义 ID'),{status:400});
    const decisions={...this.state.decisions};
    if(input.action==='reset')delete decisions[input.id];
    else {
      if(!['select','confirm','ignore'].includes(input.action))throw Object.assign(Error('未知审核操作'),{status:400});
      const target=input.targetId?this.icons.get(input.targetId):null;
      if(input.action!=='ignore'&&!target)throw Object.assign(Error('请先选择有效目标图标'),{status:400});
      if(input.action==='confirm'&&!item.icon&&!input.acknowledgeUnresolved)throw Object.assign(Error('原生图标尚未解析，需要实机检查并明确勾选已检查动态引用后才能确认。'),{status:400});
      decisions[input.id]={status:input.action==='confirm'?'confirmed':input.action==='ignore'?'ignored':'pending-review',targetId:input.action==='ignore'?null:target.id,note:String(input.note||'').slice(0,2000),reviewedBy:input.action==='select'?null:'local-human',updatedAt:new Date().toISOString(),nativeFingerprint:item.icon?.sourceSha256||hash(JSON.stringify(item.nativeRef)),targetFingerprint:target?.sourceSha256||null,acknowledgedUnresolved:!!input.acknowledgeUnresolved};
    }
    const next={schemaVersion:1,revision:this.state.revision+1,decisions};
    atomicJSON(this.file,next);this.state=next;return next;
  }
  effective() {
    const out={};
    for(const [id,d]of Object.entries(this.state.decisions)) {
      const item=this.inventory.get(id),target=this.icons.get(d.targetId);
      const current=item?.icon?.sourceSha256||(item?hash(JSON.stringify(item.nativeRef)):null);
      const stale=!item||(d.targetId&&!target)||(d.nativeFingerprint!==current)||(target&&d.targetFingerprint!==target.sourceSha256);
      out[id]=stale?{...d,status:'pending-review',stale:true}:d;
    }
    return out;
  }
  export({dshVersion,packs,candidates={}}) {
    const decisions=this.effective(),entries={};
    for(const item of this.inventory.values()) {
      const d=decisions[item.id],target=d?.status==='confirmed'?this.icons.get(d.targetId):null;
      entries[item.id]={semanticId:item.id,area:item.area,status:d?.status||(candidates[item.id]?.candidates.length?'pending-review':'unmatched'),native:{...item.nativeRef,name:item.nativeName,sourcePath:item.usages[0]?.sourcePath,component:item.component},target:target?{packId:target.packId,packVersion:target.packVersion,iconId:target.id,name:target.name,relativePath:target.relativePath,sha256:target.sourceSha256}:null,fallback:'native',review: d?{reviewedBy:d.reviewedBy,note:d.note,updatedAt:d.updatedAt,stale:!!d.stale}:null};
    }
    return {schemaVersion:1,kind:'dsh-icon-semantic-map',generatedAt:new Date().toISOString(),dshVersion,revision:this.state.revision,packs:packs.map(p=>({id:p.id,version:p.version,kind:p.kind})),policy:{onlyHumanConfirmedTargets:true,fallback:'native',automaticReplacementEnabled:false},entries};
  }
}
