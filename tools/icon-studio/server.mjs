import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import { ROOT,LOCAL,config,json,atomicJSON } from './lib/common.mjs';
import { coverage } from './lib/match.mjs';
import { ReviewStore } from './lib/review.mjs';
const inventory=json(path.join(LOCAL,'data/dsh-inventory.json'));
const library=json(path.join(LOCAL,'data/qoder-index.json'));
const matches=json(path.join(LOCAL,'data/candidates.json'));
const pilot=json(path.join(LOCAL,'data/pilot-30.json'));
const audit=json(path.join(LOCAL,'data/source-audit.json'));
const icons=new Map(library.icons.map(x=>[x.id,x]));
const store=new ReviewStore(path.join(process.env.ICON_STUDIO_REVIEW_DIR||path.join(LOCAL,'reviews'),'decisions.json'),inventory,library.icons);
const token=crypto.randomBytes(24).toString('hex');
const port=Number(process.env.ICON_STUDIO_PORT||config.port||43184);
const publicFiles=new Map([['/','index.html'],['/index.html','index.html'],['/app.js','app.js'],['/style.css','style.css']]);
function send(res,status,data,type='application/json; charset=utf-8',headers={}){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers});res.end(typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data));}
function state(){const decisions=store.effective();return {revision:store.state.revision,csrfToken:token,inventory,candidates:matches.records,engine:matches.engine,pilot,decisions,coverage:coverage(inventory,matches.records,decisions),pack:{...library.pack,assetRoot:undefined},audit:{...audit,sourceStats:audit.sourceStats.map(x=>({...x,sha256:x.sha256}))},library:library.icons.map(({visual,...x})=>x)};}
const server=http.createServer(async(req,res)=>{
  try{
    if(!new RegExp('^(127\\.0\\.0\\.1|localhost):'+port+'$').test(req.headers.host||''))return send(res,403,{error:'Loopback access only'});
    const url=new URL(req.url,'http://127.0.0.1:'+port);
    if(req.method==='POST'){
      if(req.headers['x-studio-token']!==token||!req.headers['content-type']?.startsWith('application/json'))return send(res,403,{error:'缺少本地审核令牌。'});
      const origin=req.headers.origin;if(origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(origin))return send(res,403,{error:'Origin rejected'});
      if(url.pathname!=='/api/review')return send(res,404,{error:'Not found'});
      const chunks=[];let length=0;for await(const c of req){length+=c.length;if(length>65536)return send(res,413,{error:'请求过大'});chunks.push(c);}
      const input=JSON.parse(Buffer.concat(chunks));store.update(input);const decisions=store.effective();return send(res,200,{revision:store.state.revision,decisions,coverage:coverage(inventory,matches.records,decisions)});
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Method not allowed'});
    if(url.pathname==='/api/state')return send(res,200,state());
    if(url.pathname==='/api/health')return send(res,200,{ok:true,app:'DSH Icon Mapping Studio',dshVersion:audit.dshVersion,records:inventory.length,library:icons.size});
    if(url.pathname==='/api/export'){
      const data=store.export({dshVersion:audit.dshVersion,packs:[library.pack],candidates:matches.records});atomicJSON(path.join(process.env.ICON_STUDIO_EXPORT_DIR||path.join(LOCAL,'exports'),'icon-mapping.json'),data);
      return send(res,200,data,'application/json; charset=utf-8',{'Content-Disposition':'attachment; filename="dsh-icon-mapping.json"'});
    }
    if(url.pathname.startsWith('/assets/pack/')){
      const id=decodeURIComponent(url.pathname.slice('/assets/pack/'.length));const item=icons.get(id);if(!item)return send(res,404,{error:'未知图标'});
      const file=path.resolve(library.pack.assetRoot,item.relativePath);if(!file.startsWith(path.resolve(library.pack.assetRoot)+path.sep))return send(res,403,{error:'Forbidden'});
      return send(res,200,fs.readFileSync(file),'image/svg+xml',{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"});
    }
    if(url.pathname.startsWith('/assets/native/')){
      const file=path.basename(url.pathname);if(!/^[\w.-]+\.svg$/.test(file)||!inventory.some(x=>x.icon&&path.basename(x.icon.file)===file))return send(res,404,{error:'未知原生图标'});
      return send(res,200,fs.readFileSync(path.join(LOCAL,'native-icons',file)),'image/svg+xml',{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"});
    }
    if(publicFiles.has(url.pathname)){
      const name=publicFiles.get(url.pathname),type=name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'text/html';
      return send(res,200,fs.readFileSync(path.join(ROOT,'public',name)),type+'; charset=utf-8',{'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'"});
    }
    return send(res,404,{error:'Not found'});
  }catch(e){send(res,e.status||400,{error:e.message});}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`端口 ${port} 已被占用。可用 ICON_STUDIO_PORT 指定其他端口；未终止现有进程。`:e);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{console.log(`Icon Mapping Studio Local: http://127.0.0.1:${port}\nDSH ${audit.dshVersion} · ${inventory.length} semantic records · ${icons.size} target SVGs\n审核文件：${store.file}\n只读原始素材；不连接 DSH 运行时，不替换图标。`);if(process.argv.includes('--open'))execFile('open',[`http://127.0.0.1:${port}`],e=>{if(e)console.error('浏览器未自动打开，请访问上面的本地地址。');});});
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>server.close(()=>process.exit(0)));
