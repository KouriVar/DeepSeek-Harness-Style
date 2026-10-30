#!/bin/bash
# dsh-style 自动同步守护进程：每 60s 调用 auto-sync.sh 一次。
# 启动：nohup bash scripts/auto-sync-daemon.sh >/tmp/dshstyle-autosync-daemon.log 2>&1 &
# 停止：kill $(cat /tmp/dshstyle-autosync.pid)
set -u
REPO="/Users/halfsignal/Documents/配置目录/软件目录/默认文件-DeepSeek/dsh-style"
PIDFILE="/tmp/dshstyle-autosync.pid"
if [ -f "$PIDFILE" ]; then
  old=$(cat "$PIDFILE" 2>/dev/null)
  if [ -n "${old:-}" ] && kill -0 "$old" 2>/dev/null; then exit 0; fi
fi
echo $$ >"$PIDFILE"
trap 'rm -f "$PIDFILE"' EXIT
while true; do
  /bin/bash "$REPO/scripts/auto-sync.sh" >/dev/null 2>&1
  sleep 60
done
