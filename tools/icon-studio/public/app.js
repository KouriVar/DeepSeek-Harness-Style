const $=s=>document.querySelector(s);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const statusNames={'unmatched':'未匹配','pending-review':'待审核',confirmed:'已确认',ignored:'已忽略'};
const areaLabels={'Sidebar':'侧边栏','Toolbar':'工具栏','Composer':'输入框','Conversation':'会话','Workspace':'工作区','File Explorer':'文件浏览器','Settings':'设置','Task Monitor':'任务监控','Plugin UI':'插件 UI','Other':'其他'};
// 粗略中文释义只用于显示/搜索，原始名称、ID 和映射保持原样。
const zhWords={question:'问题',questions:'提问',answer:'回答',questionanswer:'问答',questionmark:'问号',processicons:'过程图标',chat:'会话',new:'新建',newchat:'新建会话',chatnew:'新建会话',edit:'编辑',circle:'圆形',search:'搜索',find:'查找',sidebar:'侧边栏',panel:'面板',left:'左侧',right:'右侧',up:'向上',down:'向下',arrow:'箭头',chevron:'折叠箭头',folder:'文件夹',file:'文件',open:'打开',close:'关闭',copy:'复制',copied:'已复制',more:'更多',ellipsis:'更多操作',menu:'菜单',attachment:'附件',paperclip:'附件',send:'发送',stop:'停止',play:'播放',pause:'暂停',refresh:'刷新',settings:'设置',calendar:'日历',schedule:'定时任务',time:'时间',clock:'时钟',task:'任务',todo:'待办',check:'勾选',checklist:'任务清单',list:'列表',monitor:'监控',process:'过程',icons:'图标',icon:'图标',module:'模块',plugin:'插件',pinwheel:'风车',puzzle:'拼图',apps:'应用',agent:'智能体',preset:'预设',robot:'机器人',code:'代码',terminal:'终端',command:'命令',tool:'工具',tools:'工具',skill:'技能',workspace:'工作区',project:'项目',browser:'浏览器',web:'网页',global:'全球',globe:'网页',link:'链接',links:'链接',book:'书籍',read:'阅读',write:'写入',image:'图片',user:'用户',users:'用户组',team:'团队',group:'分组',add:'添加',plus:'添加',minus:'减去',delete:'删除',trash:'删除',remove:'移除',warning:'警告',error:'错误',alert:'警示',info:'信息',information:'信息',help:'帮助',loading:'加载中',loader:'加载',spinner:'加载动画',mic:'麦克风',microphone:'麦克风',voice:'语音',volume:'音量',sound:'声音',music:'音乐',video:'视频',camera:'相机',download:'下载',upload:'上传',save:'保存',share:'分享',external:'外部',window:'窗口',layout:'布局',bottom:'底部',top:'顶部',center:'居中',horizontal:'横向',vertical:'纵向',expand:'展开',collapse:'收起',fold:'折叠',unfold:'展开',pin:'置顶',branch:'分支',git:'版本管理',commit:'提交',merge:'合并',history:'历史',private:'私密',lock:'锁定',unlock:'解锁',shield:'防护',security:'安全',key:'密钥',permission:'权限',eye:'查看',sparkle:'闪光',ai:'智能',think:'思考',thinking:'思考',plan:'计划',goal:'目标',flag:'旗帜',star:'星标',heart:'喜欢',like:'赞',dislike:'踩',thumb:'拇指',message:'消息',notification:'通知',bell:'铃铛',queue:'队列',inspect:'检查',data:'数据',database:'数据库',table:'表格',document:'文档',text:'文字',font:'字体',bold:'粗体',italic:'斜体',underline:'下划线',format:'格式',clear:'清除',filter:'筛选',sort:'排序',sliders:'调节',toggle:'切换',light:'浅色',dark:'深色',sun:'太阳',moon:'月亮',system:'系统',speed:'速度',gauge:'仪表',rocket:'火箭',archive:'归档',unarchive:'取消归档',reply:'回复',back:'后退',forward:'前进',navigation:'导航',home:'主页',map:'地图',location:'位置',cloud:'云',double:'双重',success:'成功',failed:'失败',retry:'重试',run:'运行',running:'运行中',progress:'进度',activity:'活动',account:'账号',profile:'个人资料',connect:'连接',network:'网络',phone:'手机',mobile:'移动端',desktop:'桌面',computer:'电脑',finder:'访达',zoom:'缩放',off:'关闭',on:'开启',large:'大号',small:'小号',mini:'迷你',mark:'标记',header:'顶部栏',leading:'前置',controls:'操作',input:'输入',bar:'栏',row:'行',item:'项目',card:'卡片',button:'按钮',default:'默认',feedback:'反馈',approval:'审批',reference:'引用',root:'主界面',entry:'入口'};
function chineseName(value){
  if(!value)return '图标';if(/[\u3400-\u9fff]/.test(value))return value;
  let clean=String(value).replace(/\.svg$/,'').replace(/^(Qoder|Icon|InlineSvg-|Local-|Dynamic-|CssSvg-)/,'').replace(/(?:Outline|Fill)?(?:Regular|Medium)$/,'');
  const key=clean.replace(/[^a-z]/gi,'').toLowerCase();if(zhWords[key])return zhWords[key];
  const style=/(Line|Fill)$/.exec(clean)?.[1];if(style)clean=clean.slice(0,-style.length);
  const base=clean.replace(/[^a-z]/gi,'').toLowerCase();
  const words=clean.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/([A-Z])([A-Z][a-z])/g,'$1 $2').split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return (zhWords[base]||words.map(w=>zhWords[w.toLowerCase()]||w).join('·')||'图标')+(style?' · '+(style==='Line'?'线性':'实心'):'');
}
function geometryLabel(value){return value==='stroke'?'描边绘制':value==='filled-path'?'填充路径绘制':value||'未知';}
let state,libraryById,pilotById,currentId,scope='pilot',area='all',background='light',busy=false,libraryLimit=60,toastTimer,svgText='';
const svgCache=new Map();
function notify(text){$('#toast').textContent=text;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',3300);}
function safeSVG(text){
  const doc=new DOMParser().parseFromString(text,'image/svg+xml');const svg=doc.documentElement;
  if(svg.localName!=='svg'||doc.querySelector('parsererror'))throw Error('无效 SVG');
  const allowed=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs','linearGradient','radialGradient','stop','clipPath','mask','title','use']);
  for(const n of [svg,...svg.querySelectorAll('*')]){if(!allowed.has(n.localName)){n.remove();continue;}for(const a of [...n.attributes])if(a.name.startsWith('on')||a.name==='style'||['href','xlink:href'].includes(a.name)&&!a.value.startsWith('#'))n.removeAttribute(a.name);}
  svg.removeAttribute('width');svg.removeAttribute('height');svg.setAttribute('aria-hidden','true');return document.importNode(svg,true);
}
async function mountIcon(node,url,emptyText='待实机检查'){
  node.replaceChildren();if(!url){node.append(el('span','unavailable',emptyText));return;}
  try{if(!svgCache.has(url))svgCache.set(url,fetch(url).then(r=>{if(!r.ok)throw Error('图标读取失败');return r.text();}));const text=await svgCache.get(url);if(node.isConnected)node.replaceChildren(safeSVG(text));}catch{if(node.isConnected)node.append(el('span','unavailable','预览读取失败'));}
}
function recommendation(item){return state.candidates[item.id]||{candidates:[],reason:'需要人工选择'};}
function decision(item){return state.decisions[item.id];}
function status(item){const d=decision(item);return d?.status||(recommendation(item).candidates.length?'pending-review':'unmatched');}
function targetId(item){const d=decision(item);if(d?.status==='ignored')return null;return d?.targetId||recommendation(item).candidates[0]?.targetId||null;}
function current(){return state.inventory.find(x=>x.id===currentId);}
function title(item){const label=pilotById.get(item.id)?.role||item.label||item.component;return /[\u3400-\u9fff]/.test(label)?label:chineseName(/^[a-zA-Z_ -]+$/.test(label)&&label!=='module'?label:item.nativeName);}
function filtered(){
  const query=$('#queue-search').value.trim().toLowerCase(),wanted=$('#status').value,resolution=$('#resolution').value;
  return state.inventory.filter(x=>(scope==='all'||pilotById.has(x.id))&&(area==='all'||x.area===area)&&(wanted==='all'||status(x)===wanted)&&(resolution==='all'||resolution==='resolved'&&x.icon||resolution==='unresolved'&&!x.icon||resolution==='plugin'&&x.pluginUsage)&&(!query||[x.nativeName,x.label,x.component,x.id,title(x),...x.usages.map(u=>u.sourcePath)].join(' ').toLowerCase().includes(query))).sort((a,b)=>scope==='pilot'?[...pilotById.keys()].indexOf(a.id)-[...pilotById.keys()].indexOf(b.id):a.id.localeCompare(b.id));
}
function drawStats(){
  const c=state.coverage;
  for(const [id,key]of [['total','identified'],['ai','aiCandidates'],['confirmed','confirmed'],['reviewed','reviewed'],['unmatched','unmatched']])$('#stat-'+id).textContent=c[key];
  const percent=c.identified?100*c.confirmed/c.identified:0;
  $('#progress-label').textContent='人工确认覆盖率 '+percent.toFixed(1)+'%';$('#progress-fill').style.width=percent+'%';
  $('#stat-preview').textContent=c.withPreview+' 可预览';$('#dataset-label').textContent='DSH '+state.audit.dshVersion+' · '+state.pack.namedIcons+' SVG + '+state.pack.customIcons+' 组件变体';
  $('#all-count').textContent=c.identified;
  const areas=$('#areas');areas.replaceChildren();
  const all=el('button',area==='all'?'active':'','全部区域');all.append(el('span','',c.confirmed+' / '+c.identified));all.onclick=()=>{area='all';render();};areas.append(all);
  for(const [key,v]of Object.entries(c.areas)){const b=el('button',area===key?'active':'',areaLabels[key]||key);b.title=key+' · AI 候选 '+v.aiCandidates+'，已审核 '+v.reviewed;b.append(el('span','',v.confirmed+' / '+v.identified));b.onclick=()=>{area=key;render();};areas.append(b);}
}
function drawQueue(rows){
  $('#queue-count').textContent=rows.length;const list=$('#queue-list');const previous=list.scrollTop;list.replaceChildren();
  for(const item of rows){
    const b=el('button','queue-item'+(item.id===currentId?' active':''));b.dataset.id=item.id;b.setAttribute('aria-current',item.id===currentId?'true':'false');
    const mini=el('span','mini-icon');const info=el('div','queue-item-info');info.append(el('div','queue-item-title',title(item)),el('div','queue-item-native',item.nativeName));
    const bottom=el('div','queue-item-bottom');bottom.append(el('span','',statusNames[status(item)]),el('span','',item.icon?(areaLabels[item.area]||item.area):'待检查引用'));info.append(bottom);
    b.append(mini,info,el('i','queue-item-status '+status(item)));b.onclick=()=>{currentId=item.id;render();};list.append(b);mountIcon(mini,item.icon?.url);
  }
  list.scrollTop=previous;
}
function drawDetail(){
  const item=current();$('#empty').hidden=!!item;$('#review-content').hidden=!item;if(!item)return;
  const d=decision(item),target=libraryById.get(targetId(item)),rec=recommendation(item);
  $('#item-title').textContent=title(item);$('#item-area').textContent=(areaLabels[item.area]||item.area)+' / '+chineseName(item.component);
  $('#item-status').textContent=statusNames[status(item)]+(d?.stale?' · 资源已变化':'');$('#item-status').className='pill '+status(item);
  $('#semantic-id').textContent=item.id;
  $('#native-name').textContent=chineseName(item.nativeName)+'（'+item.nativeName+'）';$('#native-meta').textContent=item.icon?(item.icon.viewBox||'未知 viewBox')+' · '+geometryLabel(item.icon.geometryStyle):'动态或未解析资源';mountIcon($('#native-stage'),item.icon?.url);
  $('#target-name').textContent=(target?chineseName(target.name)+'（'+target.originalFilename+'）':null)||(d?.status==='ignored'?'保留原生图标':'需要人工选择');$('#target-meta').textContent=target?(target.viewBox||'未知 viewBox')+' · '+geometryLabel(target.geometryStyle):d?.status==='ignored'?'导出 target 为 null，fallback 为 native':'点击搜索全部图标';mountIcon($('#target-stage'),target?.previewUrl,d?.status==='ignored'?'保留 DSH 原生图标':'手动选择目标图标');
  $('#target-tag').textContent=d?.status==='confirmed'?'人工确认':d?.status==='ignored'?'已忽略 · 原生回退':d?.targetId?'人工选择 · 待确认':'AI 候选';
  $('#native-svg').disabled=!item.icon;$('#target-svg').disabled=!target;
  $('#candidate-count').textContent=rec.candidates.length?'最多 5 个 · 当前 '+rec.candidates.length+' 个':'需要人工选择';
  const list=$('#candidates');list.replaceChildren();
  for(const entry of rec.candidates){const icon=libraryById.get(entry.targetId);if(!icon)continue;const b=el('button','candidate'+(icon.id===target?.id?' active':''));b.dataset.targetId=icon.id;b.title=chineseName(icon.name)+' · '+icon.name+' · 综合分 '+(entry.score*100).toFixed(1)+'，非确认概率';b.setAttribute('aria-pressed',String(icon.id===target?.id));const mini=el('div','candidate-icon');b.append(mini,el('div','candidate-label',chineseName(icon.name)),el('div','candidate-name',icon.name.replace(/^Qoder/,'')),el('div','candidate-score','综合 '+Math.round(entry.score*100)+' / 100'));b.onclick=()=>save('select',icon.id);list.append(b);mountIcon(mini,icon.previewUrl);}
  if(!rec.candidates.length)list.append(el('p','unavailable',rec.reason));
  const evidence=$('#match-evidence');evidence.replaceChildren();const chosen=rec.candidates.find(x=>x.targetId===target?.id);
  evidence.append(el('h4','',chosen?'匹配依据 · 可审查的本地评分':target?'手动选择的目标':'需要人工选择'));
  const ul=el('ul');for(const reason of chosen?.reasons||[target?'该目标由人工搜索选取，没有伪造自动匹配依据。':rec.reason])ul.append(el('li','',reason.replace(/filled-path/g,'填充路径').replace(/stroke/g,'描边').replace(/Sidebar|Toolbar|Composer|Conversation|Workspace|File Explorer|Settings|Task Monitor|Plugin UI|Other/g,x=>areaLabels[x]||x).replace(/PROCESS_ICONS/g,'过程图标').replace(/\bquestion\b/g,'问题')));evidence.append(ul);
  const uncertainties=(chosen?.uncertainties||['尚未经人工确认。']).filter(x=>d?.status!=='confirmed'||!/尚未|未经/.test(x));
  const caution=el('div','caution',(d?.status==='confirmed'?'此项已由人工确认。 ':'')+uncertainties.join(' ')+' 推荐分不是等价性证明；请对照实际功能与状态。');evidence.append(caution);
  $('#usage-count').textContent=item.usages.length+' 处';const source=$('#source-evidence');source.replaceChildren();
  for(const note of item.notes)source.append(el('p','',note));
  for(const usage of item.usages){const row=el('div','source-entry');row.append(el('strong','',usage.component+' · '+usage.usageType),el('div','source-path',usage.sourcePath+':'+usage.line+':'+usage.column));if(usage.sourceRegion)row.append(el('div','source-path','源码分区：'+usage.sourceRegion));row.append(el('p','','尺寸：'+(usage.size??'未知')+'（'+usage.sizeResolution+'） · '+(usage.pluginUsage?'插件使用':'DSH 发行代码')));row.append(el('p','','状态条件：'+(usage.stateConditions.join(' / ')||'未静态解析到条件；不代表没有状态')));row.append(el('pre','',usage.snippet));source.append(row);}
  $('#note').value=d?.note||'';$('#acknowledge').checked=!!d?.acknowledgedUnresolved;$('#unresolved-label').hidden=!!item.icon;
  $('#confirm').disabled=busy||!target;$('#ignore').disabled=busy;$('#reset').disabled=busy;$('#manual-open').disabled=busy;
  $('#save-state').textContent=busy?'正在写入本机…':d?'已保存 · '+new Date(d.updatedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'自动候选未确认';
}
function render(){
  drawStats();const rows=filtered();if(!rows.some(x=>x.id===currentId))currentId=rows[0]?.id;drawQueue(rows);drawDetail();
  for(const b of document.querySelectorAll('.scope'))b.classList.toggle('active',b.dataset.scope===scope);
}
async function save(action,selected){
  if(busy||!current())return;const item=current(),id=item.id;const target=selected??targetId(item);
  const input={id,action,targetId:target,revision:state.revision,note:$('#note').value,acknowledgeUnresolved:$('#acknowledge').checked};
  busy=true;$('#confirm').disabled=true;$('#ignore').disabled=true;$('#reset').disabled=true;$('#save-state').textContent='正在写入本机…';
  try{
    const res=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':state.csrfToken},body:JSON.stringify(input)});const data=await res.json();if(!res.ok)throw Error(data.error);
    Object.assign(state,data);notify(action==='confirm'?'映射已人工确认并保存':action==='ignore'?'已忽略，将回退原生图标':action==='reset'?'已恢复自动候选，撤销本项人工审核':'候选已保存，仍需人工确认');
  }catch(e){notify(e.message);}finally{busy=false;render();}
}
function drawLibrary(){
  const query=$('#library-search').value.trim().toLowerCase();const rows=state.library.filter(x=>!query||[x.name,x.originalFilename,x.relativePath,...x.keywords,chineseName(x.name)].join(' ').toLowerCase().includes(query));
  $('#library-count').textContent=rows.length+' 个匹配 · 显示 '+Math.min(rows.length,libraryLimit)+' 个 · 选择后仍需确认映射';const grid=$('#library-grid');grid.replaceChildren();
  for(const icon of rows.slice(0,libraryLimit)){const b=el('button','library-item');const image=el('div','candidate-icon');b.append(image,el('span','candidate-label',chineseName(icon.name)),el('span','',icon.name));b.onclick=async()=>{if(busy)return;await save('select',icon.id);$('#library-dialog').close();};grid.append(b);mountIcon(image,icon.previewUrl);}
  $('#library-more').hidden=rows.length<=libraryLimit;
}
async function showSVG(which){const item=current();const target=libraryById.get(targetId(item));const url=which==='native'?item.icon?.url:target?.previewUrl;if(!url)return;try{const res=await fetch(url);if(!res.ok)throw Error('读取 SVG 失败');svgText=await res.text();$('#svg-title').textContent=which==='native'?item.nativeName:target.originalFilename;$('#svg-source').textContent=svgText;$('#svg-dialog').showModal();}catch(e){notify(e.message);}}
function showReport(){
  const root=$('#report-content');root.replaceChildren();root.append(el('p','',`DSH ${state.audit.dshVersion} · 构建 ${state.audit.dshBuildCommit||'未知'}。资源清单来自本机安装包中的实际客户端代码与 profile 插件。`),el('p','',`已扫描 ${state.audit.sourceStats.length} 个入口；原生图标预览 ${state.audit.primitivePreviews} 个。可预览资源 ${state.coverage.uniqueNativeResources} 个，被 ${state.coverage.identified} 个语义位置引用。`));
  for(const note of state.audit.scopeNotes)root.append(el('p','',note));
  root.append(el('p','',`目标资源：${state.pack.namedIcons} 个命名 SVG、${state.pack.customIcons} 个组件变体、${state.pack.fontDefinitions} 条 qoder-seti 字体定义。字体单独索引，不混入 SVG 候选。原始素材通过只读路径使用。`));
  root.append(el('p','',state.engine.description),el('p','','首轮 30 项的“验证”表示源代码引用、资源和候选链路通过检查，不表示用户已批准。未识别到的预期角色：'+(state.pilot.missingRequestedRoles.join('、')||'无')));
  const table=el('table','report-table');const tr=el('tr');for(const h of ['区域','语义位置','AI 候选','人工确认','已审核'])tr.append(el('th','',h));table.append(tr);
  for(const [area,c]of Object.entries(state.coverage.areas)){const row=el('tr');for(const value of [areaLabels[area],c.identified,c.aiCandidates,c.confirmed,c.reviewed])row.append(el('td','',value));table.append(row);}root.append(table);
  root.append(el('p','','插件实际注册：'+(state.audit.stylePluginRegistrations||[]).map(x=>x.slot+' → '+x.component).join('；')+'。样式通过插件自有 data 属性与 style[data-plugin="dsh-style"] 生效。本工作台未加入宿主注册，也未启用图标替换。'));
  $('#report-dialog').showModal();
}
function bind(){
  $('#queue-search').oninput=render;$('#status').onchange=render;$('#resolution').onchange=render;
  for(const b of document.querySelectorAll('.scope'))b.onclick=()=>{scope=b.dataset.scope;area='all';render();};
  for(const b of document.querySelectorAll('button[data-background]'))b.onclick=()=>{background=b.dataset.background;$('.comparison').dataset.background=background;for(const x of document.querySelectorAll('button[data-background]'))x.classList.toggle('active',x===b);};
  $('#icon-size').onchange=e=>$('.comparison').style.setProperty('--icon-size',e.target.value+'px');
  $('#theme').onclick=()=>{document.body.classList.toggle('dark');try{localStorage.setItem('icon-studio-theme',document.body.classList.contains('dark')?'dark':'light');}catch{}};
  $('#confirm').onclick=()=>save('confirm');$('#ignore').onclick=()=>save('ignore');$('#reset').onclick=()=>save('reset');
  $('#manual-open').onclick=()=>{libraryLimit=60;$('#library-search').value='';$('#library-dialog').showModal();drawLibrary();$('#library-search').focus();};
  $('#library-search').oninput=()=>{libraryLimit=60;drawLibrary();};$('#library-more').onclick=()=>{libraryLimit+=60;drawLibrary();};
  for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$('#'+b.dataset.close).close();
  $('#native-svg').onclick=()=>showSVG('native');$('#target-svg').onclick=()=>showSVG('target');
  $('#svg-copy').onclick=async()=>{try{await navigator.clipboard.writeText(svgText);notify('SVG 已复制');}catch{notify('剪贴板不可用，可选择并复制代码。');}};
  $('#report-open').onclick=showReport;
  $('#export').onclick=()=>notify('导出只包含人工确认的目标；其余位置回退原生图标。');
}
async function boot(){
  try{try{document.body.classList.toggle('dark',localStorage.getItem('icon-studio-theme')==='dark');}catch{}
    const res=await fetch('/api/state');if(!res.ok)throw Error('索引读取失败');state=await res.json();libraryById=new Map(state.library.map(x=>[x.id,x]));pilotById=new Map(state.pilot.items.map(x=>[x.id,x]));currentId=state.pilot.items[0]?.id;bind();render();$('#loading').remove();
  }catch(e){$('#loading').textContent='无法读取本地索引：'+e.message;}
}
boot();
