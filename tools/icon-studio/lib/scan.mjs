import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT, PLUGIN, LOCAL, config, toolRequire, Asar, slug, hash, json, writeJSON, serialize, svgInfo } from './common.mjs';
const parser = toolRequire('@babel/parser');
const traverse = toolRequire('@babel/traverse').default;
const parse = s => parser.parse(s, { sourceType:'unambiguous', errorRecovery:true, plugins:['jsx','typescript'] });
const keyOf = n => n?.name || n?.value;
function calleeName(n) { if(n?.type==='SequenceExpression') return calleeName(n.expressions.at(-1)); if(n?.type==='MemberExpression') return keyOf(n.property); return n?.name; }
function stringValue(n) { return ['StringLiteral','NumericLiteral','BooleanLiteral'].includes(n?.type)?n.value:null; }
function objectProp(node,name) { return node?.properties?.find(p=>keyOf(p.key)===name)?.value; }

export function readSources() {
  const archive = new Asar(path.join(config.dshApp,'Contents/Resources/app.asar'));
  const version = JSON.parse(archive.read('package.json'));
  const sources=[];
  for(const entry of archive.files.keys()) {
    if(!/^dsh\/node_modules\/@deepseek-ai\/[^/]+\/lib\/client\.js$/.test(entry)) continue;
    sources.push({ id:entry, package:entry.split('/')[3], path:archive.filename+'!/'+entry, kind:'shipped-client', text:archive.read(entry).toString() });
  }
  const frontend = [...archive.files.keys()].find(n=>/dsh-web-frontend\/dist\/assets\/index-[^/]+\.js$/.test(n));
  sources.push({id:frontend,package:'dsh-web-frontend',path:archive.filename+'!/'+frontend,kind:'frontend',text:archive.read(frontend).toString()});
  const profile=json(path.join(config.profile,'package.json'));
  const pluginRoots = [];
  for(const name of Object.keys(profile.dependencies || {})) {
    const folder=path.join(config.profile,'node_modules',name);
    try {
      const real=fs.realpathSync(folder), pkg=json(path.join(real,'package.json'));
      const client=pkg.exports?.['./client'];
      const relative=typeof client==='string'?client:client?.default;
      const entry=relative?path.join(real,relative):fs.existsSync(path.join(real,'client.js'))?path.join(real,'client.js'):null;
      pluginRoots.push({name,path:real,client:entry});
      if(entry&&fs.existsSync(entry)) sources.push({id:'plugin:'+name+':'+path.relative(real,entry),package:name,path:entry,kind:'profile-plugin',text:fs.readFileSync(entry,'utf8')});
    }catch(e){pluginRoots.push({name,error:e.message});}
  }
  const fonts=[...archive.files.keys()].filter(n=>/dsh-web-frontend.*\.(woff2?|ttf)$/.test(n));
  archive.close();
  return {sources,version,pluginRoots,fonts};
}

function extractNative(frontend) {
  const ast=parse(frontend.text), iconBindings=new Map(),publicComponents=new Map();
  traverse(ast,{ObjectProperty(p){const name=keyOf(p.node.key);if(/^[A-Z]\w+$/.test(name)&&p.node.value.type==='Identifier') {const b=p.scope.getBinding(p.node.value.name);if(b){if(/^Icon[A-Z]/.test(name))iconBindings.set(name,b);else publicComponents.set(p.node.value.name,name);}}}});
  const icons=new Map(), errors=[];
  fs.mkdirSync(path.join(LOCAL,'native-icons'),{recursive:true});
  for(const [name,binding] of iconBindings) {
    try {
      const declarations=new Map(), factories=new Set();
      const collect=(b,seen=new Set())=>{
        const n=b.path.node;const init=n.init;
        if(!init||!['ArrowFunctionExpression','FunctionExpression','StringLiteral','NumericLiteral','BooleanLiteral','ObjectExpression','ArrayExpression'].includes(init.type)) throw Error('Non-static icon dependency');
        if(seen.has(b.identifier.name))return;seen.add(b.identifier.name);
        b.path.get('init').traverse({CallExpression(p){if(!['jsx','jsxs'].includes(calleeName(p.node.callee)))throw Error('Icon invokes non-SVG function');},MemberExpression(p){if(['jsx','jsxs'].includes(keyOf(p.node.property))&&p.node.object.type==='Identifier')factories.add(p.node.object.name);}});
        b.path.get('init').traverse({ReferencedIdentifier(p){const ref=p.scope.getBinding(p.node.name);if(!ref||factories.has(p.node.name)||ref.path.node.start>=init.start&&ref.path.node.end<=init.end)return;collect(ref,seen);}});
        declarations.set(b.identifier.name,frontend.text.slice(init.start,init.end));
      };
      collect(binding);
      const jsx=(tag,props)=>typeof tag==='function'?tag(props||{}):({tag,props});
      const context=Object.fromEntries([...factories].map(x=>[x,{jsx,jsxs:jsx}]));
      const code=[...declarations].map(([n,e])=>`const ${n}=(${e});`).join('\n')+`\n${binding.identifier.name}({size:16});`;
      const el=vm.runInNewContext(code,context,{timeout:150,displayErrors:false});
      if(el.tag!=='svg')throw Error('Not an SVG');
      const svg=serialize(el);const file='native-icons/'+name+'.svg';fs.writeFileSync(path.join(LOCAL,file),svg);
      icons.set(name,{name,file,svg,source:frontend.path,component:'@deepseek-ai/dsh-client-ui-primitives',...svgInfo(svg)});
    }catch(e){errors.push({name,error:e.message});}
  }
  return {icons,errors,exported:iconBindings.size,symbols:new Map([...iconBindings].map(([n,b])=>[b.identifier.name,n])),publicComponents};
}

function classify(source,component,region='') {
  const x=(source.package+' '+component+' '+region).toLowerCase();
  if(source.kind==='profile-plugin')return /monitor/i.test(component)?'Task Monitor':'Plugin UI';
  if(/sidebar-files|filetree|fileexplorer/.test(x))return 'File Explorer';
  if(/attachment|composer|chatinput|promptinput|inputarea|inputbar/.test(x))return 'Composer';
  if(/settings|plugin-manager|plugin-market/.test(x))return 'Settings';
  if(/schedule/.test(x))return 'Other';
  if(/workspace|directory-picker/.test(x))return 'Workspace';
  if(/sidebar/.test(x))return 'Sidebar';
  if(/toolbar|header|open-in-app|layout/.test(x))return 'Toolbar';
  if(/conversation|chat|feedback|trajectory|tool|approval|reference/.test(x))return 'Conversation';
  return 'Other';
}
function owner(p) {
  let cur=p;
  while(cur){
    if(cur.isFunctionDeclaration()&&cur.node.id?.name&&!['apply','factory'].includes(cur.node.id.name))return cur.node.id.name;
    if(cur.isVariableDeclarator()&&/^[A-Z]/.test(cur.node.id?.name||''))return cur.node.id.name;
    if(cur.isFunctionExpression()&&cur.node.id?.name)return cur.node.id.name;
    if((cur.isArrowFunctionExpression()||cur.isFunctionExpression())&&cur.parentPath?.isVariableDeclarator())return keyOf(cur.parentPath.node.id);
    cur=cur.parentPath;
  }
  return 'module';
}
function resolveIcon(node,scope,seen=new Set()) {
  if(!node)return null;
  if(node.type==='MemberExpression'&&!node.computed&&/^Icon[A-Z]/.test(keyOf(node.property)))return keyOf(node.property);
  if(node.type==='Identifier') {
    if(/^Icon[A-Z]/.test(node.name)) {
      const b=scope.getBinding(node.name);if(!b)return node.name;
    }
    if(seen.has(node.name))return null;seen.add(node.name);
    const b=scope.getBinding(node.name);
    if(b?.path.isVariableDeclarator())return resolveIcon(b.path.node.init,b.path.scope,seen);
    if(b?.path.isImportSpecifier())return keyOf(b.path.node.imported);
  }
  return null;
}
function staticSVG(node) {
  let dynamicGeometry=false;
  const evaluate=n=>{
    if(n==null)return undefined;
    if(['StringLiteral','NumericLiteral','BooleanLiteral'].includes(n.type))return n.value;
    if(n.type==='NullLiteral')return null;
    if(n.type==='ArrayExpression')return n.elements.map(evaluate);
    if(n.type==='ObjectExpression')return Object.fromEntries(n.properties.filter(p=>p.type==='ObjectProperty'&&p.key).map(p=>{const v=evaluate(p.value);if(v===undefined&&['d','points','x','y','cx','cy','r','rx','ry','x1','x2','y1','y2','transform','viewBox','children'].includes(keyOf(p.key)))dynamicGeometry=true;return [keyOf(p.key),v];}).filter(([,v])=>v!==undefined));
    if(n.type==='CallExpression'&&['jsx','jsxs','createElement','h'].includes(calleeName(n.callee))){const tag=evaluate(n.arguments[0]);if(!tag)return undefined;const props=evaluate(n.arguments[1])||{};if(n.arguments.length>2)props.children=n.arguments.slice(2).map(evaluate);return {tag,props};}
    if(n.type==='UnaryExpression'&&n.operator==='-'&&n.argument.type==='NumericLiteral')return -n.argument.value;
    return undefined;
  };
  const el=evaluate(node);if(!el||el.tag!=='svg'||dynamicGeometry)return null;
  el.props.width=el.props.width||16;el.props.height=el.props.height||16;el.props.xmlns='http://www.w3.org/2000/svg';
  try{const svg=serialize(el);return /<(path|circle|rect|line|polygon|polyline|ellipse)\b/.test(svg)?svg:null;}catch{return null;}
}

export function scan() {
  const {sources,version,pluginRoots,fonts}=readSources();
  const native=extractNative(sources.find(s=>s.kind==='frontend'));
  const records=new Map(),diagnostics=[],sourceStats=[];
  let callCount=0;
  const usedPrimitives=new Set(sources.filter(s=>s.kind!=='frontend').flatMap(s=>[...s.text.matchAll(/(?:_deepseek_ai_dsh_client_ui_primitives|prim)\.([A-Z]\w+)/g)].map(m=>m[1])));
  for(const source of sources) {
    let ast;try{ast=parse(source.text);}catch(e){diagnostics.push({source:source.path,error:e.message});continue;}
    const regionAt=pos=>{
      const hits=(ast.comments||[]).filter(c=>c.end<pos&&c.value.includes('#region '));
      return hits.at(-1)?.value.replace(/^.*#region\s*/,'').trim()||null;
    };
    const localSVGs=new Map();
    traverse(ast,{FunctionDeclaration(p){
      if(!p.node.id||!/icon|glyph|mark|caret|favicon/i.test(p.node.id.name))return;
      let result=null;
      p.traverse({ReturnStatement(r){const a=r.node.argument;if(a?.type==='CallExpression'&&stringValue(a.arguments[0])==='svg')result=staticSVG(a);}});
      if(result)localSVGs.set(p.node.start,result);
    }});
    let count=0;
    const record=(p,{name,kind='component',svg=null,note=null,reference=null,props=null,componentOverride=null,semanticRole=null})=>{
      count++;callCount++;
      const component=componentOverride||owner(p),region=regionAt(p.node.start);let area=classify(source,component,region||'');
      const propObject=props?.type==='ObjectExpression'?props:null;
      const sizeNode=objectProp(propObject,'size');const size=stringValue(sizeNode);
      const labels=[];const contexts=[];let cur=p;
      for(let i=0;cur&&i<5;i++,cur=cur.parentPath) {
        if(cur.isObjectProperty()&&!['children','icon'].includes(keyOf(cur.node.key)))labels.push(String(keyOf(cur.node.key)));
        if(cur.isCallExpression()&&cur.node.arguments[1]?.type==='ObjectExpression') {
          for(const prop of cur.node.arguments[1].properties)if(['title','aria-label','label','tooltip','data-testid'].includes(keyOf(prop.key))){const v=stringValue(prop.value);labels.push(v??source.text.slice(prop.value.start,prop.value.end));}
        }
        if(cur.isConditionalExpression()){const test=source.text.slice(cur.node.test.start,cur.node.test.end);contexts.push(p.node.start>=cur.node.alternate.start&&p.node.end<=cur.node.alternate.end?'!('+test+')':test);}
      }
      const label=[...new Set(labels)].filter(Boolean).join(' · ').slice(0,220);
      if(kind==='configuration-reference'&&name==='IconPaperclipOutlineRegular'&&source.package==='dsh-client-ui-conversation'){
        const registration=p.findParent(x=>x.isObjectExpression());const text=registration?source.text.slice(registration.node.start,registration.node.end):'';
        if(text.includes('input.file')){area='Composer';semanticRole='paperclip';}
      }
      const alias=slug(name.replace(/^Icon/,'').replace(/(Outline|Fill)?(Regular|Medium)$/,''));
      const semanticId=['dsh',slug(area),slug(source.package.replace(/^dsh-client-ui-/,'')),slug(component),slug(label)||'default',alias].join('.');
      const ref=native.icons.get(name);
      const line=p.node.loc.start.line,column=p.node.loc.start.column+1;
      const usage={sourcePath:source.path,sourceId:source.id,line,column,component,sourceRegion:region,area,usageType:kind,reference:reference||name,size:size??(sizeNode?source.text.slice(sizeNode.start,sizeNode.end):ref?.width??null),sizeResolution:size!==null?'explicit-static':sizeNode?'dynamic':ref?'component-default':'unknown',stateConditions:[...new Set(contexts)],snippet:source.text.slice(Math.max(0,p.node.start-180),Math.min(source.text.length,p.node.end+180)),pluginUsage:source.kind==='profile-plugin'};
      if(!records.has(semanticId)) {
        let file=ref?.file||null;
        if(svg){file='native-icons/inline-'+hash(svg).slice(0,16)+'.svg';fs.writeFileSync(path.join(LOCAL,file),svg);}
        records.set(semanticId,{id:semanticId,nativeName:name,semanticRole,nativeRef:{packId:ref?'dsh-primitives':source.kind==='profile-plugin'?'dsh-profile-plugin':'dsh-inline',component:name,resource:file},component,area,label:label||component,semantics:[component,name,label,semanticRole||'',source.package].join(' '),icon:file?{file,url:'/assets/native/'+path.basename(file),...(ref?svgInfo(ref.svg):svgInfo(svg))}:null,pluginProvided:source.kind==='profile-plugin'&&!ref,pluginUsage:source.kind==='profile-plugin',resolution:!file?'needs-inspection':kind==='static-svg'?'static-geometry':'resolved',notes:[...(note?[note]:[]),...(!file?['动态引用或原始资源无法静态解析，需人工检查。']:[])],usages:[]});
      }
      records.get(semanticId).usages.push(usage);
    };
    const handled=new Set();
    traverse(ast,{
      CallExpression(p) {
        if(!['jsx','jsxs','createElement','h'].includes(calleeName(p.node.callee)))return;
        const tag=p.node.arguments[0],props=p.node.arguments[1];
        let componentOverride=null;
        if(source.kind==='frontend') {
          let ancestor=p.parentPath;
          while(ancestor){const n=ancestor.node;const sym=n.type==='FunctionDeclaration'?n.id?.name:n.type==='VariableDeclarator'?n.id?.name:null;if(sym&&native.publicComponents.has(sym)&&usedPrimitives.has(native.publicComponents.get(sym))){componentOverride=native.publicComponents.get(sym);break;}ancestor=ancestor.parentPath;}
          if(!componentOverride)return;
        }
        const namesOf=(n,seen=new Set())=>{
          const name=source.kind==='frontend'&&n?.type==='Identifier'?native.symbols.get(n.name):resolveIcon(n,p.scope);
          if(name)return [name];
          if(n?.type==='ConditionalExpression')return [...namesOf(n.consequent,seen),...namesOf(n.alternate,seen)];
          if(n?.type==='LogicalExpression')return [...namesOf(n.left,seen),...namesOf(n.right,seen)];
          if(n?.type==='Identifier'&&!seen.has(n.name)){seen.add(n.name);const b=p.scope.getBinding(n.name);if(b?.path.isVariableDeclarator())return namesOf(b.path.node.init,seen);}
          return [];
        };
        const branches=[...new Set(namesOf(tag))];
        if(branches.length){for(const name of branches)record(p,{name,props,componentOverride,note:source.kind==='frontend'?'平台组件内部引用；该导出组件已被发行客户端引用。':null});handled.add(p.node.start);return;}
        const name=resolveIcon(tag,p.scope);
        if(name){record(p,{name,props});handled.add(p.node.start);return;}
        if(tag?.type==='Identifier'){
          const binding=p.scope.getBinding(tag.name),svg=binding&&localSVGs.get(binding.path.node.start);
          if(svg){record(p,{name:'Local-'+tag.name,kind:'local-svg-component',svg,props,note:'实际组件调用，预览来自本地组件的静态 SVG 几何。'});return;}
        }
        if(stringValue(tag)==='svg') {
          const svg=staticSVG(p.node);let semanticRole=null;
          const branch=p.parentPath;
          if(/InputBar\.js$/.test(regionAt(p.node.start)||'')&&branch.isConditionalExpression()&&source.text.slice(branch.node.test.start,branch.node.test.end)==='primaryStops'){semanticRole=p.key==='consequent'?'stop':'send';componentOverride='InputBar';}
          record(p,{name:'InlineSvg-'+slug(componentOverride||owner(p))+(semanticRole?'-'+semanticRole:svg?'-'+hash(svg).slice(0,8):''),semanticRole,svg,kind:'static-svg',props,componentOverride,note:semanticRole?'InputBar 的 primaryStops 条件分支，与 input.stop/input.send 标签及实际 SVG 几何交叉验证。':'SVG 定义位置；是否渲染取决于组件调用。动态路径未静态解析时不生成预览。'});return;
        }
        if(stringValue(tag)==='img') {
          const src=objectProp(props,'src');const srcText=src?source.text.slice(src.start,src.end):'';
          if(/icon|logo|\.svg|\.ico/i.test(srcText+' '+owner(p)))record(p,{name:'Image-'+slug(owner(p)),kind:'image-reference',reference:srcText,note:'图片地址可能由运行时服务提供，待实机检查。',props});
          return;
        }
        if(tag&&(/icon/i.test(tag.name||'')||tag.type==='MemberExpression'&&/icons?/i.test(source.text.slice(tag.start,tag.end))))record(p,{name:'Dynamic-'+slug(owner(p))+'-'+slug(source.text.slice(tag.start,tag.end)),kind:'dynamic-component',reference:source.text.slice(tag.start,tag.end),props,note:'动态组件选择器，当前静态分析不能确定实际图标。'});
      },
      ObjectProperty(p){
        if(source.kind==='frontend')return;
        if(!['icon','Icon','iconComponent','leadingIcon','trailingIcon'].includes(keyOf(p.node.key)))return;
        if(p.findParent(x=>x.isCallExpression()&&handled.has(x.node.start)))return;
        const name=resolveIcon(p.node.value,p.scope);
        if(name)record(p,{name,kind:'configuration-reference',note:'配置中存在真实图标引用；运行时是否显示取决于对应注册项和条件。'});
      }
    });
    // CSS masks/backgrounds are icons only when an SVG URL's class is actually referenced.
    // Gradient masks (scroll fades, secret masking, etc.) are not counted as icon glyphs.
    if(source.kind!=='frontend'){
      const cssAssets=[];
      traverse(ast,{StringLiteral(p){const text=p.node.value;if(!text.includes('data:image/svg+xml'))return;
        for(const hit of text.matchAll(/url\(\s*["']?(data:image\/svg\+xml[^\s"')]+)["']?\s*\)/g)){
          const opening=text.lastIndexOf('{',hit.index),boundary=text.lastIndexOf('}',opening);
          const selector=text.slice(boundary+1,opening);const classes=[...selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(x=>x[1]);
          let svg=null;try{const comma=hit[1].indexOf(',');svg=hit[1].slice(0,comma).includes(';base64')?Buffer.from(hit[1].slice(comma+1),'base64').toString():decodeURIComponent(hit[1].slice(comma+1));if(!svg.startsWith('<svg'))continue;}catch{continue;}
          for(const className of classes)cssAssets.push({className,svg,definitionLine:p.node.loc.start.line});
        }
      }});
      for(const asset of cssAssets){
        const aliases=[];
        traverse(ast,{ObjectProperty(p){if(p.node.value.type==='StringLiteral'&&p.node.value.value===asset.className){const declaration=p.parentPath?.parentPath;if(declaration?.isVariableDeclarator()&&declaration.node.id.type==='Identifier')aliases.push({object:declaration.node.id.name,property:keyOf(p.node.key),start:declaration.node.start});}}});
        traverse(ast,{MemberExpression(p){if(!aliases.some(a=>p.node.object.name===a.object&&keyOf(p.node.property)===a.property&&p.scope.getBinding(a.object)?.path.node.start===a.start))return;
          const semantic=aliases.find(a=>p.node.object.name===a.object&&keyOf(p.node.property)===a.property)?.property;
          record(p,{name:'CssSvg-'+slug(semantic||asset.className),svg:asset.svg,kind:'css-svg-reference',reference:asset.className,note:'实际 CSS 类引用；SVG 来自同一模块样式中的 data URI，定义行 '+asset.definitionLine+'。颜色/尺寸仍由原 CSS 控制。'});
        },StringLiteral(p){if(p.node.value!==asset.className||!p.parentPath.isObjectProperty()||keyOf(p.parentPath.node.key)!=='className')return;record(p,{name:'CssSvg-'+slug(asset.className),svg:asset.svg,kind:'css-svg-reference',reference:asset.className,note:'className 直接引用的 CSS SVG，定义行 '+asset.definitionLine+'。'});}});
      }
    }
    sourceStats.push({package:source.package,path:source.path,kind:source.kind,sha256:hash(source.text),recognizedReferences:count,parseErrors:ast.errors?.map(e=>e.message)||[]});
  }
  // Detect non-component icon mechanisms, without treating stylesheet definitions as rendered icons.
  const mechanisms=[];
  for(const source of sources)for(const [type,re] of [['icon-font',/@font-face|font-family:[^;}]*icon|fontFamily:\s*["'][^"']*icon/gi],['css-mask',/(?:-webkit-)?mask(?:-image)?\s*:/g],['css-content',/content:\s*["']\\[a-fA-F0-9]{3,6}/g]]) {
    const hits=[...source.text.matchAll(re)];if(hits.length)mechanisms.push({source:source.path,type,count:hits.length,resolution:'needs-inspection',note:'发现机制定义，不能据此断言每个字形已在 UI 使用。'});
  }
  const inventory=[...records.values()].sort((a,b)=>a.id.localeCompare(b.id));
  for(const i of inventory)i.stateVariants=[...new Set(i.usages.flatMap(u=>u.stateConditions))];
  const registrations=[];const styleSource=sources.find(s=>s.package==='dsh-style');
  if(styleSource)traverse(parse(styleSource.text),{CallExpression(p){if(calleeName(p.node.callee)!=='register')return;const obj=p.node.arguments[0];if(obj?.type!=='ObjectExpression')return;const slot=stringValue(objectProp(obj,'name'));if(slot)registrations.push({slot,id:stringValue(objectProp(obj,'id')),order:stringValue(objectProp(obj,'order')),component:keyOf(p.node.arguments[1]),sourcePath:styleSource.path,line:p.node.loc.start.line});}});
  const report={schemaVersion:1,generatedAt:new Date().toISOString(),dshVersion:version.version,dshBuildCommit:version.dshBuildCommit,sourceMode:'installed-client-code',originalRepositoryFound:false,app:config.dshApp,profile:config.profile,stylePlugin:PLUGIN,stylePluginLinked:fs.realpathSync(path.join(config.profile,'node_modules/dsh-style'))===PLUGIN,stylePluginRegistrations:registrations,styleMechanism:{attributes:'data-dsh-style-*',stylesheet:'style[data-plugin="dsh-style"]',cleanup:'ctx.effect disposal removes attributes and style',state:'localStorage dsh-style:settings'},sourceStats,pluginRoots,fonts,mechanisms,diagnostics,primitiveExports:native.exported,primitivePreviews:native.icons.size,primitiveFailures:native.errors,totalUsages:callCount,totalSemanticRecords:inventory.length,resolved:inventory.filter(x=>x.icon).length,unresolved:inventory.filter(x=>!x.icon).length,scopeNotes:['扫描安装包中的 lib/client.js、平台 primitives 及 profile 声明的客户端入口；未启动宿主业务。','没有完整 TSX 原始仓库；源码位置保留发行代码路径、组件名、region 注释和行列。','静态引用不代表当前 profile 的路由或条件必然执行；动态组件、图片、字体/CSS 机制单独标记。','同一原生图标可用于多个语义位置，按语义记录计数，另列唯一资源数。']};
  writeJSON(path.join(LOCAL,'data/dsh-inventory.json'),inventory);
  writeJSON(path.join(LOCAL,'data/source-audit.json'),report);
  return {inventory,report};
}
