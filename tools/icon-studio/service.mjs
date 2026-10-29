import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFile} from 'node:child_process';
import {ROOT,LOCAL,config} from './lib/common.mjs';
const label='local.dsh.icon-mapping-studio';
const url=`http://127.0.0.1:${config.port||43184}`;
const action=process.argv[2]||'start';
const run=(args)=>spawnSync('/bin/launchctl',args,{encoding:'utf8'});
async function healthy(){try{const r=await fetch(url+'/api/health',{signal:AbortSignal.timeout(800)});const j=await r.json();return j.ok&&j.app==='DSH Icon Mapping Studio';}catch{return false;}}
if(action==='stop'){const r=run(['remove',label]);if(r.status!==0)throw Error(r.stderr||'无法停止服务');console.log('已停止工作台，审核文件保留。');}
else if(action==='status')console.log(await healthy()?'工作台运行中：'+url:'工作台未运行');
else if(action==='start'){
 if(!await healthy()){
  fs.mkdirSync(path.join(LOCAL,'logs'),{recursive:true});
  run(['remove',label]);
  const r=run(['submit','-l',label,'-o',path.join(LOCAL,'logs/server.log'),'-e',path.join(LOCAL,'logs/server-error.log'),'--',process.execPath,path.join(ROOT,'server.mjs')]);
  if(r.status!==0)throw Error(r.stderr||'launchctl 启动失败');
  let ready=false;for(let i=0;i<30;i++){if(await healthy()){ready=true;break;}await new Promise(r=>setTimeout(r,100));}
  if(!ready)throw Error('服务未就绪，请检查 .local/logs/server-error.log');
 }
 console.log('工作台已就绪：'+url+'（macOS 用户会话托管，不依赖聊天进程）');
 if(process.argv.includes('--open'))execFile('open',[url]);
}else throw Error('用法：node service.mjs start|stop|status [--open]');
