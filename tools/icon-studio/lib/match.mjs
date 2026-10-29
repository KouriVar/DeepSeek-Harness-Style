import fs from 'node:fs';
import path from 'node:path';
import { LOCAL, config, toolRequire, json, writeJSON, hash, slug, svgInfo } from './common.mjs';
let sharp;
export const AREAS=['Sidebar','Toolbar','Composer','Conversation','Workspace','File Explorer','Settings','Task Monitor','Plugin UI','Other'];
const synonyms={
  attachment:['attachment','attach','paperclip','附件'],more:['more','menu','dots','更多'],folder:['folder','文件夹'],
  newchat:['new','chat','edit','circle','新建会话','新任务'], search:['search','find','搜索'], panelleft:['sidebar','panel','layout','left','fold','unfold','侧边栏'],
  paperclip:['attachment','attach','clip','附件'], send:['send','arrow','up','plane','发送'], stop:['stop','square','停止'], copy:['copy','duplicate','复制'],
  ellipsis:['more','menu','dots','更多'], folderclose:['folder','closed','文件夹'], folderopen:['folder','open','文件夹'],
  pluginpinwheel:['plugin','puzzle','apps','extensions','插件'], cordisplugin:['plugin','puzzle','apps','插件'],
  checklist:['list','check','todo','task','monitor','任务监控'], clock:['calendar','schedule','time','clock','automation','定时','自动化'],
  calendar:['calendar','schedule','automation','定时'], microphone:['mic','microphone','voice','麦克风'], plus:['add','plus','添加'],
  close:['close','cancel','关闭'], browse:['file','read','browse','查看'], agentpreset:['agent','robot','ai','智能体'],
  plan:['list','check','todo','plan','计划'], settings:['settings','gear','设置'], refresh:['refresh','reload','刷新'],
  trash:['delete','trash','remove','删除'], branch:['branch','git','分支'], pin:['pin','pushpin','置顶'], warning:['warning','error','alert','警告'],
  chevrondown:['arrow','down','下拉'], chevronup:['arrow','up','展开'], chevronleft:['arrow','left','返回'], chevronright:['arrow','right','展开'],
  play:['play','run','运行'], globe:['global','earth','globe','web','网页'], code:['code','代码'], link:['link','links','链接'],
};
function words(s){return slug(s).split('-').filter(x=>x&&!['qoder','icon','outline','regular','medium','fill','line','svg','inline','local','dynamic'].includes(x));}
function nativeKey(name){return name.replace(/^(InlineSvg-|Local-)/,'').replace(/^(Icon|Qoder)/,'').replace(/(Outline|Fill)?(Regular|Medium)$/,'').replace(/(Line|Fill)$/,'').replace(/[^a-z]/gi,'').toLowerCase();}
export function keywords(name){const tokens=words(name);const key=nativeKey(name);return [...new Set([...tokens,...(synonyms[key]||[])])];}
async function pixels(svg){sharp??=toolRequire('sharp');const {data,info}=await sharp(Buffer.from(svg)).resize(24,24,{fit:'contain'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});return Array.from({length:24*24},(_,i)=>data[i*info.channels+info.channels-1]/255);}
function similarity(a,b){let dot=0,aa=0,bb=0,min=0,max=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];min+=Math.min(a[i],b[i]);max+=Math.max(a[i],b[i]);}return aa&&bb?.65*dot/Math.sqrt(aa*bb)+.35*min/Math.max(max,.001):0;}
// Explicit, reviewable semantic preferences. These are candidate hints, never approved mappings.
const hints={
  newchat:['QoderEditCircleLine','QoderChatNewLine'], search:['QoderSearchLine'],panelleft:['QoderSidebarFoldLine','QoderSidebarUnfoldLine','QoderLayoutLeftLine'],
  paperclip:['QoderAttachment2','QoderAttachmentLine'],send:['QoderArrowUpLine','QoderSendPlaneLine'],stop:['QoderStopFill','QoderStopCircleLine'],
  copy:['QoderFileCopyLine','QoderFileCopy2Line'],ellipsis:['QoderMoreLine','QoderMore2Line'],pluginpinwheel:['QoderAppsLine','QoderPuzzleLine'],cordisplugin:['QoderPuzzleLine','QoderAppsLine'],
  folderclose:['QoderFolderLine'],folderopen:['QoderFolderOpenLine'],checklist:['QoderListCheck3','QoderListCheck2','QoderTodoLine'],clock:['QoderTimeLine','QoderCalendarScheduleLine'],
  calendar:['QoderCalendarScheduleLine','QoderCalendarLine'],microphone:['QoderMicLine','QoderMic2Line'],plus:['QoderAddLine'],close:['QoderCloseLine'],settings:['QoderSettings3Line'],
};
export async function indexQoder(){
  const source=json(path.join(config.qoderRoot,'source-info.json'));
  const original=json(path.join(config.qoderRoot,'manifest.json'));
  if(original.length!==3546)throw Error('Unexpected Qoder named-icon count; inspect resource version before continuing');
  const custom=json(path.join(config.qoderRoot,'custom-ui/manifest.json'));
  const font=json(path.join(config.qoderRoot,'font-icons/icon-definitions.json'));
  const pack={id:'qoder-local',version:source.version,kind:'svg',assetRoot:config.qoderRoot,sourceSha256:source.asarSha256,extractedPreview:path.join(config.qoderRoot,'preview.html'),namedIcons:original.length,customIcons:custom.length,fontDefinitions:Object.keys(font).length};
  const icons=[];let cursor=0;const input=[...original,...custom];
  await Promise.all(Array.from({length:8},async()=>{while(cursor<input.length){const item=input[cursor++],file=path.resolve(config.qoderRoot,item.file);if(!file.startsWith(path.resolve(config.qoderRoot)+path.sep))throw Error('Asset escapes pack root');const svg=fs.readFileSync(file,'utf8');if(item.svgSha256&&item.svgSha256!==hash(svg))throw Error('Qoder asset checksum mismatch: '+item.file);const id='qoder-local:'+item.name;icons.push({id,packId:pack.id,packVersion:pack.version,name:item.name,originalFilename:path.basename(file),relativePath:item.file,svgPath:file,previewUrl:'/assets/pack/'+encodeURIComponent(id),component:item.name,fontFamily:null,keywords:keywords(item.name),source:item.source,...svgInfo(svg),visual:await pixels(svg)});}}));
  icons.sort((a,b)=>a.id.localeCompare(b.id));
  writeJSON(path.join(LOCAL,'data/qoder-index.json'),{pack,icons});
  writeJSON(path.join(LOCAL,'data/qoder-font-index.json'),{packId:pack.id,kind:'font',family:'qoder-seti',woffPath:path.join(config.qoderRoot,'font-icons/qoder-seti.woff'),definitions:Object.entries(font).map(([name,x])=>({id:'qoder-seti:'+name,name,...x,reviewStatus:'not-part-of-svg-matching'}))});
  return {pack,icons};
}
export async function recommend(inventory,icons){
  const vectors=new Map(),candidates={};
  for(const item of inventory){
    let nativePixels=null;
    if(item.icon){const file=path.join(LOCAL,item.icon.file);if(!vectors.has(file)){try{vectors.set(file,await pixels(fs.readFileSync(file,'utf8')));}catch{vectors.set(file,null);}}nativePixels=vectors.get(file);}
    const key=item.semanticRole||nativeKey(item.nativeName),tokens=new Set([...(synonyms[key]||[]),...keywords(item.nativeName)]);
    const contextual=words(item.semantics);const preferred=hints[key]||[];
    const directions=['left','right','up','down'].filter(d=>tokens.has(d));
    const scored=[];
    if(item.resolution==='needs-inspection'&&item.nativeName.startsWith('Dynamic-')){candidates[item.id]={status:'needs-manual-selection',reason:'原生图标由动态选择器提供，缺少确定的几何，等待运行时检查。',candidates:[]};continue;}
    for(const target of icons){
      const targetTokens=new Set(target.keywords),overlap=[...tokens].filter(t=>targetTokens.has(t));
      const hint=preferred.indexOf(target.name);
      const visual=nativePixels?similarity(nativePixels,target.visual):null;
      const sem=overlap.length/Math.max(2,Math.min(tokens.size,5));
      const context=contextual.filter(t=>targetTokens.has(t));
      if(!overlap.length&&hint<0)continue;
      if(directions.length&&['left','right','up','down'].some(d=>targetTokens.has(d)&&!directions.includes(d)))continue;
      if(tokens.has('stop')&&['play','send','start'].some(t=>targetTokens.has(t)))continue;
      const fill=/Fill/.test(item.nativeName),targetFill=/Fill$/.test(target.name);
      const line=/Outline/.test(item.nativeName),targetLine=/Line$/.test(target.name);
      const style=fill===targetFill?.85:.3;
      const state=directions.length?directions.every(d=>targetTokens.has(d))?1:.3:1;
      const score=Math.min(1,.42*Math.min(1,sem)+.28*(visual??0)+.1*(style+(line&&targetLine?.15:0))+.07*state+.05*Math.min(1,context.length/2)+(hint>=0?.18-.02*hint:0));
      if(score<.31)continue;
      const reasons=[`名称/语义词交集：${overlap.join('、')||'人工编写的语义别名规则'}`,`使用上下文：${item.area} / ${item.component}${context.length?'，关联词 '+[...new Set(context)].join('、'):''}`,visual===null?'几何：原生资源未解析，无法比较':`几何：统一到 24×24 的透明度轮廓相似度 ${(visual*100).toFixed(1)}%`, `风格：原生 ${item.icon?.geometryStyle||'未知'}；候选 ${target.geometryStyle}${line&&targetLine?'，均为线性外观':''}`,`状态：${directions.length?'已约束方向 '+directions.join('/'):'未发现明确方向约束；仍需审核激活/禁用等变体'}`];
      if(hint>=0)reasons.push('命中可审查的功能语义候选规则；这不代表已确认等价。');
      scored.push({targetId:target.id,score:Number(score.toFixed(4)),dimensions:{semantic:Number(sem.toFixed(3)),visual:visual===null?null:Number(visual.toFixed(3)),style,state,context:context.length},reasons,uncertainties:['候选尚未经人工确认。',...(item.stateVariants.length?['存在条件或状态分支，请逐项检查。']:[]),...(visual!==null&&visual<.45?['几何相似度较低，主要依据功能语义推荐。']:[])]});
    }
    scored.sort((a,b)=>b.score-a.score||a.targetId.localeCompare(b.targetId));
    candidates[item.id]={status:scored.length?'pending-review':'needs-manual-selection',reason:scored.length?'本地 AI 辅助语义规则 + 批量几何比较，最多五个；没有自动批准。':'缺少同时满足语义和几何/风格条件的候选，需要人工选择。',candidates:scored.slice(0,5)};
  }
  writeJSON(path.join(LOCAL,'data/candidates.json'),{engine:{id:'local-semantic-geometry-v1',type:'AI-authored-local-rules',modelCalls:0,description:'AI 编写的语义扩展及功能候选规则，结合本地栅格轮廓比较；非模型置信概率，不将推荐视作确认。',weights:{semantic:.42,visual:.28,style:.1,state:.07,context:.05,semanticHint:.18}},records:candidates});
  return candidates;
}

export function selectPilot(inventory,candidates){
  const specs=[
    ['新建会话',x=>x.area==='Sidebar'&&x.nativeName==='IconNewChatOutlineRegular'],
    ['搜索',x=>x.component==='WorkspaceBrowser'&&x.nativeName==='IconSearchOutlineRegular'],
    ['侧栏展开',x=>x.component==='HeaderLeadingControls'&&x.nativeName==='IconPanelLeftOutlineRegular'],
    ['侧栏收起',x=>x.component==='SidebarRoot'&&x.nativeName==='IconPanelLeftOutlineRegular'],
    ['插件',x=>x.nativeName==='IconPluginPinwheelOutlineRegular'&&x.area==='Settings'],
    ['自动化任务',x=>/schedule/i.test(x.id)&&/Calendar/.test(x.nativeName)&&!!x.icon],
    ['工作区文件夹（关闭）',x=>x.component==='ProjectRowItem'&&x.nativeName==='IconFolderCloseRegular'],
    ['工作区文件夹（展开）',x=>x.component==='ProjectRowItem'&&x.nativeName==='IconFolderOpenRegular'],
    ['顶部工具栏',x=>x.area==='Toolbar'&&!!x.icon],
    ['附件',x=>x.nativeName==='IconPaperclipOutlineRegular'&&x.area==='Composer'],
    ['发送',x=>x.semanticRole==='send'&&x.component==='InputBar'],
    ['停止',x=>x.semanticRole==='stop'&&x.component==='InputBar'],
    ['复制',x=>x.nativeName==='IconCopyOutlineRegular'&&x.area==='Conversation'],
    ['更多操作',x=>x.nativeName==='IconEllipsisOutlineRegular'&&x.component==='SessionNodeItem'],
    ['任务监控入口',x=>x.component==='MonitorButton'],
    ['任务监控关闭',x=>x.component==='TaskMonitorPanel'&&x.nativeName==='IconCloseOutlineRegular'],
    ['任务监控折叠',x=>x.component==='TaskMonitorPanel'&&x.nativeName==='IconChevronDownOutlineRegular'],
    ['文件浏览器文件夹（关闭）',x=>x.area==='File Explorer'&&x.nativeName==='IconFolderCloseRegular'],
    ['文件浏览器文件夹（展开）',x=>x.area==='File Explorer'&&x.nativeName==='IconFolderOpenRegular'],
    ['右侧面板展开',x=>x.component==='ExpandButton'&&x.nativeName==='IconPanelLeftOutlineRegular'],
    ['右侧面板收起',x=>x.component==='PanelChrome'&&x.nativeName==='IconPanelLeftOutlineRegular'],
    ['输入附件展开菜单',x=>x.area==='Composer'&&/Plus/.test(x.nativeName)],
    ['语音输入',x=>x.nativeName==='IconMicrophoneOutlineRegular'],
    ['工作区删除',x=>x.component==='ProjectRowItem'&&/Trash/.test(x.nativeName)],
    ['会话置顶',x=>x.component==='PinSessionMenuItem'],
    ['会话分支',x=>x.component==='ForkSessionMenuItem'],
    ['会话重命名',x=>x.component==='RenameSessionMenuItem'],
    ['浏览器刷新',x=>x.component==='BrowserBody'&&/Refresh/.test(x.nativeName)],
    ['设置',x=>/Settings/.test(x.nativeName)&&x.area==='Settings'],
    ['任务计划',x=>x.component==='TodoPanel'&&/Checklist/.test(x.nativeName)],
  ];
  const used=new Set(),selected=[],missing=[];
  for(const [role,find] of specs){const item=inventory.find(x=>!used.has(x.id)&&find(x));if(item){used.add(item.id);selected.push({id:item.id,role,nativeName:item.nativeName,sourcePath:item.usages[0].sourcePath,line:item.usages[0].line,previewAvailable:!!item.icon,candidateCount:candidates[item.id].candidates.length,validation:'static-source-and-asset-verified',humanReviewed:false});}else missing.push(role);}
  // Fill from actual source-backed icons only; missing requested roles remain explicit.
  for(const item of inventory.filter(x=>x.icon&&candidates[x.id].candidates.length&&!used.has(x.id)).sort((a,b)=>a.id.localeCompare(b.id))){if(selected.length>=30)break;used.add(item.id);selected.push({id:item.id,role:item.area+' / '+item.component,nativeName:item.nativeName,sourcePath:item.usages[0].sourcePath,line:item.usages[0].line,previewAvailable:true,candidateCount:candidates[item.id].candidates.length,validation:'static-source-and-asset-verified',humanReviewed:false});}
  const pilot={schemaVersion:1,scope:'first-30',items:selected,missingRequestedRoles:missing,meaning:'已核验源代码引用、预览资源和候选数据；没有代替用户作人工确认。'};
  writeJSON(path.join(LOCAL,'data/pilot-30.json'),pilot);return pilot;
}

export function coverage(inventory,candidates,decisions={}){
  const count=rows=>({identified:rows.length,withPreview:rows.filter(x=>x.icon).length,aiCandidates:rows.filter(x=>candidates[x.id]?.candidates.length).length,matched:rows.filter(x=>decisions[x.id]?.status==='confirmed').length,confirmed:rows.filter(x=>decisions[x.id]?.status==='confirmed').length,ignored:rows.filter(x=>decisions[x.id]?.status==='ignored').length,reviewed:rows.filter(x=>['confirmed','ignored'].includes(decisions[x.id]?.status)).length,unmatched:rows.filter(x=>!candidates[x.id]?.candidates.length&&!decisions[x.id]?.targetId&&!['confirmed','ignored'].includes(decisions[x.id]?.status)).length});
  return {...count(inventory),uniqueNativeResources:new Set(inventory.filter(x=>x.icon).map(x=>x.icon.file)).size,areas:Object.fromEntries(AREAS.map(a=>[a,count(inventory.filter(x=>x.area===a))]))};
}
