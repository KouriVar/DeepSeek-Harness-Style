#!/bin/bash
# dsh-style 自动同步：本地有改动 → 静置后自动 commit + push 到 GitHub；每天一个 tar 备份（保留 7 份）。
# 由 LaunchAgent ai.deepseek.dshstyle.autosync 每 60s 调用。
set -u
REPO="/Users/halfsignal/Documents/配置目录/软件目录/默认文件-DeepSeek/dsh-style"
TARDIR="/Users/halfsignal/Documents/配置目录/软件目录/默认文件-DeepSeek"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export GIT_TERMINAL_PROMPT=0 LANG="zh_CN.UTF-8" LC_ALL="zh_CN.UTF-8"

cd "$REPO" || exit 0
LOG="$REPO/.git/auto-sync.log"
LOCK="$REPO/.git/auto-sync.lockdir"
log() { echo "[$(date '+%F %T')] $*" >>"$LOG"; }

# 单实例锁
if ! mkdir "$LOCK" 2>/dev/null; then exit 0; fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

# 1) 有本地改动：等静置 12s 再提交，避免提交到"写一半"的文件
if [ -n "$(git status --porcelain)" ]; then
  newest=$(git status --porcelain | cut -c4- | sed 's/.* -> //' | while IFS= read -r f; do [ -e "$f" ] && stat -f %m "$f" 2>/dev/null; done | sort -n | tail -1)
  now=$(date +%s)
  if [ -n "${newest:-}" ] && [ $((now - newest)) -lt 12 ]; then exit 0; fi
  git add -A >>"$LOG" 2>&1
  if git diff --cached --quiet; then
    :
  else
    git commit -m "chore(auto-sync): $(date '+%F %T')" >>"$LOG" 2>&1 && log "committed $(git rev-parse --short HEAD)"
  fi
fi

# 2) 与远端同步（fetch → 必要时 rebase → push）
git fetch origin main -q >>"$LOG" 2>&1 || { log "fetch failed"; exit 0; }
local=$(git rev-parse HEAD 2>/dev/null)
remote=$(git rev-parse origin/main 2>/dev/null)
if [ "$local" != "$remote" ]; then
  if ! git merge-base --is-ancestor HEAD origin/main 2>/dev/null; then
    git pull --rebase --autostash origin main >>"$LOG" 2>&1 || { log "rebase failed"; exit 0; }
  fi
  if git push origin main >>"$LOG" 2>&1; then
    log "pushed $(git rev-parse --short HEAD)"
  else
    log "push failed"
  fi
fi

# 3) 每天一个 tar 备份，保留最近 7 份
last=$(ls -t "$TARDIR"/dsh-style-backup-*.tar.gz 2>/dev/null | head -1)
need=1
if [ -n "$last" ]; then
  age=$(( $(date +%s) - $(stat -f %m "$last") ))
  [ "$age" -lt 86400 ] && need=0
fi
if [ "$need" = 1 ]; then
  out="$TARDIR/dsh-style-backup-$(date +%Y%m%d-%H%M).tar.gz"
  if tar -czf "$out" --exclude='.git' --exclude='node_modules' --exclude='*.tgz' --exclude='client.js.bak-*' . >>"$LOG" 2>&1; then
    log "backup $out"
  fi
  ls -t "$TARDIR"/dsh-style-backup-*.tar.gz 2>/dev/null | tail -n +8 | while IFS= read -r f; do rm -f "$f"; done
fi
