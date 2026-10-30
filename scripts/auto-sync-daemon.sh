#!/bin/bash
# dsh-style 自动同步守护进程：每 60s 调用 auto-sync.sh 一次。
# 默认**暂停**：先 touch .git/autosync-enabled 才会工作。
# 启动：nohup bash scripts/auto-sync-daemon.sh >/tmp/dshstyle-autosync-daemon.log 2>&1 &
# 停止：kill $(cat /tmp/dshstyle-autosync.pid)
set -u
REPO="/Users/halfsignal/Documents/配置目录/软件目录/默认文件-DeepSeek/dsh-style"
PIDFILE="/tmp/dshstyle-autosync.pid"

# 显式开关（默认关闭）：防止未经确认的自动提交与推送。
if [ ! -f "$REPO/.git/autosync-enabled" ]; then
  echo "[auto-sync] paused: 缺少 $REPO/.git/autosync-enabled，未启动循环。"
  echo "[auto-sync] 确认要自动提交/推送后再执行: touch \"$REPO/.git/autosync-enabled\""
  exit 0
fi
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
