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
- **状态：58/70 唯一图标替换成功，真机已验证**（整机 integrity/签名 PASS）。
- **剩余 12 个未换（回退原生，需 Studio 重新导出"源码态原生 SVG"）**：
  `IconBranchOutlineRegular、IconMicrophoneOutlineRegular、IconPinFillRegular、Local-SearchIcon、Local-ShareIcon、InlineSvg-arrow-up-icon、InlineSvg-chevron-left-icon、InlineSvg-chevron-right-icon、InlineSvg-close-icon、InlineSvg-key-icon、InlineSvg-link-icon、InlineSvg-lock-icon`
  （原因：Studio 导出的原生 SVG 是*渲染态*，与 bundle 中压缩源码的 path 对不上；需从源码态重新导出，或按组件名反查。）

## 3. 设计 Token（已导入 Figma）
- 提取：`scripts/extract-tokens.mjs`（读 `dsh-client-ui-theme` 的 `--dsw-*`，静态色板+明暗 alias 解析）→ `design/tokens/dsh-tokens.json`。
  - 共 384 个 `--dsw-*`；输出 190 色（含 100 `alias/*` 语义色）+ 6 radius；其余为字体/渐变/计算值（`dsh-tokens.skipped.json`）。
- Figma 文件：**DeepSeek Desktop App**，fileKey `3RSG2PjWlV5KTTlhPSY9dC`。
  - 已建集合 **`DSH Tokens`**（id `VariableCollectionId:1:4`），modes：`Light`(`1:2`) / `Dark`(`1:3`)。
  - 已导入 **106 个变量**（100 语义色 alias/* 的 Light+Dark + 6 radius）——0 失败。
- **待办**：用户说自己又新建了「mode 1 / mode 2（浅色 / 深色）」—**新会话先 `figma_get_variables` 查当前 collections/modes 的真实名称与 modeId**，再把 token 按用户指定的 mode 导入（不要假设仍叫 Light/Dark）。另：static 色板 77 个、字体 182 个（需生成 Figma **Text Styles**）尚未导。

## 4. 下一步计划（用户方向）
- 用户是 UI 设计师，计划：**Figma 出稿 → fork 原版 DSH 源码 → 新分支改 UI**。
- 建议顺序：①先做「构建可行性 spike」（clone `deepseek-harness`、装依赖、起 dev 构建）验证能否本地构建 Electron app；②定 Tokens 为单一事实源（Figma Variables ↔ 代码 `--dsw-*`）；③组件级改造尽量新增文件/主题层，减少与 upstream 冲突；④分支 `feat/ui-redesign`，remote `origin=自己的`、`upstream=官方`。
- 图标系统（方案 B/补丁器）可作为过渡；fork 后可直接把 Qoder 图标编进构建。

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
