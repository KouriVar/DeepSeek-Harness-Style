# 自动同步（本地 ↔ GitHub）

`dsh-style` 仓库有一个后台守护进程：**每 60 秒**检查一次本地改动，若有改动且已静置 12 秒，
就自动 `git add -A` → `commit` → `push` 到 `KouriVar/DeepSeek-Harness-Style` 的 `main`。

## 行为

- 只提交**真实改动**；无改动时只做 `fetch`，不产生空提交。
- `client.js` 有改动时先跑 `node --check`，语法不过就**跳过提交**，避免推送坏版本。
- 推之前若远端有新提交，会先 `pull --rebase --autostash` 再推。
- 每天生成一个 tar 备份到父目录（`dsh-style-backup-*.tar.gz`），只保留最近 7 份。
- 提交信息格式：`chore(auto-sync): YYYY-MM-DD HH:MM:SS`。
- 日志：`.git/auto-sync.log`

## 启动 / 停止

```bash
# 启动（已在运行则不会重复启动）
cd "/Users/halfsignal/Documents/配置目录/软件目录/默认文件-DeepSeek/dsh-style"
nohup /bin/bash scripts/auto-sync-daemon.sh >/tmp/dshstyle-autosync-daemon.log 2>&1 &

# 停止
kill "$(cat /tmp/dshstyle-autosync.pid)"

# 手动跑一次（立即同步）
bash scripts/auto-sync.sh
```

## 已知限制

macOS 的「文档目录保护」会让 launchd 后台任务无法读取 `~/Documents`（报
`Operation not permitted`），所以没有用 LaunchAgent，而是由当前有权限的 DSH 进程拉起守护进程：

- **DSH 桌面端开着**：一直自动同步。
- **重启电脑 / 关掉 DSH 后**：守护进程会退出，需要重新执行上面的「启动」命令（或下次会话里让我拉起）。
- 我在每次改完代码时也会手动 `commit + push`，所以即使守护进程没跑，也不会丢改动。

## 为什么不用 LaunchAgent

`launchctl bootstrap` 后任务以 `/bin/bash` 身份运行，被 TCC 拒绝访问 `~/Documents/...`，
`last exit code = 126`。要彻底后台常驻，需要给对应可执行文件授予「完全磁盘访问权限」，
不划算，改用守护进程。
