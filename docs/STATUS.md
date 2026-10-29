# DSH UI 定制项目 · 交接状态（手递文档）

> 新会话/新成员先读这份。仓库：`KouriVar/DeepSeek-Harness-Style`（public）。
> 本地路径：`/Users/halfsignal/Documents/配置目录/软件目录/默认文件-DeepSeek/dsh-style`

## 0. 环境与网络
- DSH 安装版：`/Applications/DeepSeek Harness.app`（`0.2.1-rc.3`，asar 有完整性校验 + Developer ID 签名）。
- **github.com:443 在本机被 DNS 黑洞**，git 只能用 SSH over 443：
  - remote：`ssh://git@ssh.github.com:443/KouriVar/DeepSeek-Harness-Style.git`
  - push 前设：`export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/id_ed25519_dshstyle -o IdentitiesOnly=yes -o StrictHostKeyChecking=no"`
  - 仓库里加了 read-write Deploy Key（非账号级）。

## 1. dsh-style 插件（已装进 desktop profile）
- 结构：`index.js`（宿主占位）、`client.js`（浏览器端，手写 ModuleLoader 包装）、`cordis.patch.yml`。
- 已实现：设置页「外观」(`settings.section`)；**布局 Classic/Inset**；**通用/协作 pill 切换器**；**任务监控**（工具栏按钮 + 浮层 + 事件适配器，默认关）；全部可持久化（`localStorage: dsh-style:settings`）。
- 安装：desktop profile 里 `link:` 指向本目录 + bundles 含 `dsh-style`（`~/.dsh/profiles/desktop/package.json`）。
- 改 `client.js` 由 `dsh-client-hmr` 自动热重载（改宿主 `index.js` 需重启）。
- 测试：`node test/smoke.mjs`、`node test/layout.mjs`。备份：`~/.dsh/profiles/desktop/package.json.bak-dshstyle-*`。

## 2. 图标系统（方案 B：构建期替换 + 缺失回退原生）
- 图标包：`icon-packs/qoder/`
  - `dsh-icon-mapping.json`：Studio 导出（700 使用位置，328 confirmed → 70 唯一原生图标，53 目标 SVG，153 原生 SVG）。
  - `mapping.build.json`：由 `scripts/convert-mapping.mjs` 生成（按唯一 native.resource 去重，含 variant）。
  - `mapping.json`：旧 5 图标样本（保留）。
  - 报告：`convert.report.json`、`dryrun.report.txt`。
- 工具：
  - `scripts/convert-mapping.mjs`：Studio 审阅 JSON → build-map。
  - `scripts/apply-icon-pack.mjs`：定位/替换图标几何 → 重算 asar 分块 SHA256 + `Info.plist` header 哈希 → 生成 `.app` 副本 → ad-hoc 重签 → `--verify`。
    - 产物副本：`/Applications/DeepSeek Harness (Qoder Icons).app`
    - 常用：`node scripts/apply-icon-pack.mjs --dry-run`
      `node scripts/apply-icon-pack.mjs --apply --force --out "/Applications/DeepSeek Harness (Qoder Icons).app"`
      `node scripts/apply-icon-pack.mjs --verify --out "<app>"`
- **状态：61/70 唯一图标替换成功，副本已验证**（header hash==plist、file integrity 16615/16615、`codesign --verify --strict` PASS；官方 App 未改）。
  - 相对 58/70 新增 3 个：`IconBranchOutlineRegular`、`IconMicrophoneOutlineRegular`、`IconPinFillRegular`——根因是**补丁器匹配 bug**（圆属性无空格、参数化 rect、fill/outline 共用字形），已修 `scripts/apply-icon-pack.mjs`，未改任何几何。
- **剩余 9 个未换（回退原生）**：`InlineSvg-arrow-up-icon、InlineSvg-chevron-left-icon、InlineSvg-chevron-right-icon、InlineSvg-close-icon、Local-SearchIcon、Local-ShareIcon、InlineSvg-key-icon、InlineSvg-link-icon、InlineSvg-lock-icon`
  - 原因不同：这些**不在 app.asar**，属于外部 profile 插件 `ds-bot`（`dsh.plugin-ui.ds-bot.*`，真实 path 在 `~/.dsh/profiles/desktop/node_modules/ds-bot/client.js` → 软链到你自己的 `DeepSeek-Bot/ds-bot`）。补丁器只读写 app.asar，且 ds-bot 是 `~/.dsh` 共享 profile、会连带影响官方 App → 按"不改官方"约束**暂不动，回退原生**（详见 `icon-packs/qoder/remaining.report.md`）。

## 3. 设计 Token（已导入 Figma）✅ 2026-10-29 复核并补齐
- 提取：`scripts/extract-tokens.mjs`（读 `dsh-client-ui-theme` 的 `--dsw-*`，静态色板+明暗 alias 解析）→ `design/tokens/dsh-tokens.json`。
  - 共 384 个 `--dsw-*`；输出 190 色（100 `alias/*` 语义色 + 77 `static/*` + 13 其他）+ 6 radius；其余为字体/渐变/计算值（`dsh-tokens.skipped.json`）。
- Figma 文件：**DeepSeek Desktop App**，fileKey `3RSG2PjWlV5KTTlhPSY9dC`。
  - **`DSH Tokens`**（`VariableCollectionId:1:4`）真实 modes：**`Light`(`1:2`) / `Dark`(`1:3`)** —— 复核：用户说的「Mode 1/2」其实属于另一个空集合 `Collection`(`1:2`)；DSH Tokens 仍叫 Light/Dark。
  - **106 变量逐项比对 = 0 mismatch**（浅→`1:2`、深→`1:3`，已与 JSON 完全一致，未新建/改写）。
  - 新增 **`DSH Static`**（`VariableCollectionId:1:171`，单 mode）：**77 个 static 色板**，0 失败。
  - 新增 **30 个 Figma Text Styles**（`DSH/*`，SF Pro / Menlo），由 181 个字体 token 归一。
  - 复核报告：`docs/figma-tokens-report.md`。

## 4. 下一步计划（用户方向）
- **2026-10-29 用户决定：暂缓「fork 源码 / 构建 Electron」路线**（本机整机对外带宽被限 ~30KB/s，317MB 仓库完整 clone 需数小时，不划算）；也暂不处理 ds-bot 的 9 个图标。**当前专注：继续在现有 dsh-style 插件里改 style**（`client.js`，走 `dsh-client-hmr` 热重载，无需重启）。
- 历史建议（保留备查）：Figma 出稿 → fork → 新分支改 UI；Tokens 为单一事实源（Figma Variables ↔ 代码 `--dsw-*`）；组件改造尽量新增文件/主题层减少冲突；分支 `feat/ui-redesign`，`origin=自己的`、`upstream=官方`。若日后要构建，见 `docs/fork-build-spike.md`（如有）。

## 5. 命令速查
```sh
cd /Users/halfsignal/Documents/配置目录/软件目录/默认文件-DeepSeek/dsh-style
node scripts/extract-tokens.mjs                 # 重新提取 token -> design/tokens/dsh-tokens.json
node scripts/convert-mapping.mjs                # Studio JSON -> mapping.build.json
node scripts/apply-icon-pack.mjs --dry-run      # 报告替换命中
node scripts/apply-icon-pack.mjs --apply --force --out "/Applications/DeepSeek Harness (Qoder Icons).app"
node scripts/apply-icon-pack.mjs --verify --out "/Applications/DeepSeek Harness (Qoder Icons).app"
```

## 6. 关键约束 / 注意
- 不改官方 `/Applications/DeepSeek Harness.app`；只产出副本；副本 ad-hoc 签名，DSH 升级需重跑补丁器。
- 图标替换只认「真实 path」，不伪造；缺失一律回退原生。
- Figma 写入需在该文件里跑 **Figma Desktop Bridge 插件**（本会话已验证可写）。
- 仓库 public；提交信息中英均可，风格已用 `feat(...)/fix(...)`。
