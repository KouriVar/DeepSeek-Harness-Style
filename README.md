# dsh-style

一个**纯客户端**的 DeepSeek Harness 外观定制插件：在 Harness **原生「设置」里新增「外观」页**，
用 Harness 自带控件做可逆的样式定制。不碰 Bot、不碰宿主业务逻辑、不改 DSH 本身组件。

当前版本：**0.1.1（Phase 1）**。变更见 [CHANGELOG.md](./CHANGELOG.md)。  
详细的功能 / 改动范围见 [功能说明（FEATURES.md）](https://github.com/KouriVar/DeepSeek-Harness-Style/blob/main/docs/FEATURES.md)。

## 0.1.1 同款外观（默认值）

全新安装、没有旧 `localStorage` 时，插件默认就是作者当前这套外观：

- 布局：**内嵌（Inset）**
- 隐藏滚动条、隐藏会话标签栏（对话/轨迹）
- 隐藏品牌、隐藏新会话
- 任务监控：开启、**浮动**面板
- 动效：不减少
- `monitorAlwaysShow.team = false`

老用户已经保存的 `dsh-style:settings` 不会被覆盖；要和朋友完全一致，按下面「给朋友装」检查一遍。

## 功能

- **原生设置页**：往 `settings.section` 注册「外观」页（`order: 40`），复用原生
  `Switch` / `SegmentedControl` / `Button`，外观与交互由 Harness 渲染，不自绘。
- **布局模式**
  - `内嵌（Inset）`：外层浅灰底板，右侧主内容变成白色圆角卡片，默认。
  - `经典（Classic）`：保持原生 AppFrame，作为完整原生回退。
- **侧栏对齐**：以 macOS 红绿灯关闭按钮中心 `22.75px` 为基准，功能导航、文件夹、会话状态槽共列；
  「工作区」标题与图标列对齐；会话标题与文件夹标题同列；行左右内缩统一为 `8.75px`。
- **细节修复**：工作区头图标 28px hover 背景不再被 18px 标题行裁剪；底部账户卡不再贴左边框；
  插件页 / 自动化任务页顶部空白一致；会话 HoverCard 缩进到主内容卡片内 `8.75px`。
- **工作区会话行**：时间、置顶、归档收进「更多」菜单；标题占满整行。
- **效果开关**：启用样式插件 / 减少动效 / 隐藏滚动条 / 隐藏会话标签栏。
- **标题栏按钮**：`.dsh-style-tb` 自绘四个 28px 按钮——折叠侧栏 / 后退 / 前进 / **刷新页面**
  （`location.reload()` 真正重载整个 Web 应用；刷新前会校验桌面壳缓存的启动注入，插件刚热更新过时只提示
  「请退出 App 后重新打开」而不会触发「应用无法启动」）；整组可关，刷新按钮另有独立开关。
- **Qoder 风格首页（仅新会话 hero 相位）**：欢迎组贴顶、活跃度热力图居中、输入卡片下沉，
  欢迎语由工作区/模式两个原生选择器原地句化；全部规则限定在 `[data-phase="hero"]`，正常对话零影响。
- **苹果树邮戳插画**：首页标题上方的 174×100 小卡片（素材内联）。悬停整体 `scale(1.03)`／500ms，
  树区 200ms 交叉淡入彩色，说明卡随鼠标做 `rotateZ ±8°`／`translateX ±12px` 弹簧摆动
  （stiffness 120 / damping 16，`requestAnimationFrame` 积分，`pointermove` 不触发 React 重渲染），
  热区光标为 canvas 生成的苹果；支持 Tab 聚焦、Esc 关闭与 `prefers-reduced-motion` 降级。
- **可持久化**：设置保存在 `localStorage`（键 `dsh-style:settings`），重启后恢复。
- **可逆、无污染**：禁用/卸载时移除全部 `data-dsh-style-*` 属性与样式表，不留全局样式。
- **修改后重启**：桌面端 HMR 不保证，更新 `client.js` 后请重启 Harness。

## 安装到 DSH

已验证：**macOS + DeepSeek Harness `0.2.1-rc.5`**。插件是桌面客户端插件，不适用 web profile。

1. 从 [Releases](https://github.com/KouriVar/DeepSeek-Harness-Style/releases/latest) 下载
   `dsh-style-0.1.1.tgz`。
2. Harness → **Settings → Plugins → Add plugin**，选择这个 `.tgz`。
3. **重启 Harness**。
4. 打开 **Settings → 外观**，确认「启用样式插件」是开的；其它默认值见上一节。

命令行安装（profile 名以本机为准，桌面版通常是 `desktop`）：

```sh
npm pack            # 生成 dsh-style-0.1.1.tgz
dsh plugin --profile desktop add /绝对路径/dsh-style-0.1.1.tgz
```

开发期也可以把本目录 `link` 进 profile 的 `package.json`：

```json
{
  "dependencies": { "dsh-style": "link:/绝对路径/dsh-style" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-style"] } }
}
```

然后 `pnpm install`，重启 Harness。

## 给朋友装（同款 UI）

1. 用 **macOS 版 DeepSeek Harness 0.2.1-rc.5**（其它版本选择器可能对不上）。
2. 下载 `dsh-style-0.1.1.tgz`，按上面步骤安装并重启。
3. 全新安装默认就是作者这套外观；检查 **Settings → 外观** 是否全开。
4. 为完全一致，再确认：
   - 系统 / DSH 外观：**浅色**（插件跟随 DSH 主题，不强改主题）
   - 侧栏宽度：约 **280px**
   - 正文字号：默认 **14**
   - 缩放：**100%**
5. 如果朋友之前装过旧版，`localStorage` 里已有设置：在「外观」页把布局切到 **内嵌**，并打开
   隐藏滚动条 / 隐藏标签栏 / 隐藏品牌 / 隐藏新会话 / 任务监控；或清掉 `dsh-style:settings` 后重启。

**图标替换不在插件包里。** 要连 Qoder 图标也一致，需要按下面的「图标替换」单独给 `.app` 打补丁；
它和 UI 插件是两件事。

## 兼容性

- 0.1.1 在 **0.2.1-rc.5** 实测；DSH 更新后类名/结构可能变化，侧栏选择器和 HoverCard 可能需要适配。
- 插件不修改官方 `app.asar`；通过 profile 安装，官方 app 保持原样。
- 侧栏横向基准按 macOS 红绿灯按钮设计；Windows/Linux 版不保证同一像素位置。

## 结构

```
dsh-style/
  package.json         # dsh.client.platform = web；exports ./client；dsh.bundle.patch
  index.js             # 宿主半边：占位（无服务、无 Config）
  client.js            # 浏览器半边：注册「外观」页 + 布局/效果/侧栏样式引擎
  cordis.patch.yml     # 把宿主入口挂到 profile（entry id: style）
  test/smoke.mjs       # 无头冒烟测试
  test/layout.mjs      # 假 DOM 测试
  docs/FEATURES.md     # 功能说明 / 改动范围
  scripts/apply-app-locale.mjs  # 可选：app 原生中文本地化（非插件运行时）
  CHANGELOG.md
  LICENSE
  README.md
```

## 怎么工作

- **页面**：`client.js` 往插槽 `settings.section` 注册 `{ id:'style', order:40, label:'外观' }`。
- **控件**：使用原生 `@deepseek-ai/dsh-client-ui-primitives` 的 `Switch` / `SegmentedControl` / `Button`。
- **定位**：用语义锚点 `[data-shell-bottom]` + `[data-rightbar-col]` 打上自有 `data-dsh-style-*`；
  样式优先用这些属性和结构后缀（如 `_pageHead`、`projectRow`），HoverCard 使用当前构建的
  `_bggy...` 类；DSH 升级后如类名变化需要适配。
- **生效**：通过 `data-dsh-style-*` + 插件自有 `<style data-plugin="dsh-style">` 施加。
- **持久化**：值存在 `localStorage`。

## 自测（不需要启动 DSH）

```sh
node test/smoke.mjs
node test/layout.mjs
```

## 路线图

1. 主题：强调色、字号、界面密度、动效强度（用原生控件）。
2. 组件级开关：导航栏 / 输入框 / 消息布局的显隐与形态。
3. 预设主题：一键整套。
4. 宿主设置后端：值写进 settings 命名空间（跨设备、可恢复默认）。

## 命名

包名与模块 id 目前是 `dsh-style`（`client.js` 里的 `id` 必须与包名一致）。想换成别的名字时，
同步改 `package.json.name`、`client.js` 的 `id`、`cordis.patch.yml` 的 `name`、以及本 README 即可。

## Phase 04 开发工具：图标映射工作台

在项目根目录运行 `npm run icons:studio`，或双击
`tools/icon-studio/Start Icon Studio.command`。它是与 DSH 运行时解耦的本机工具，
用于真实图标清单、Qoder 候选对比、人工审核和语义映射 JSON 导出。
重建索引用 `npm run icons:index`，验证用 `npm run icons:test`。
详见 [Icon Mapping Studio 使用说明](./tools/icon-studio/README.md)。

## 图标替换（Icon System · 预览）

不改官方 app，用图标包替换原生图标（缺失自动回退原生）：

- 图标包：`icon-packs/qoder/`（`mapping.json` + `svg/` + `native-icons/`）
- 补丁器：`scripts/apply-icon-pack.mjs`

```sh
# 1) 只报告将替换哪些图标（不改任何文件）
node scripts/apply-icon-pack.mjs --dry-run

# 2) 生成改好的 .app 副本
node scripts/apply-icon-pack.mjs --apply --force --out "/Applications/DeepSeek Harness (Qoder Icons).app"
```

说明：DSH 的 app 启用了 **asar 完整性校验** + Developer ID 签名。补丁器会：按元素定位并替换图标几何 →
重算被改文件的**分块 SHA256** → 同步 `Info.plist` 的 `ElectronAsarIntegrity` **header 哈希** →
对副本 **ad-hoc 重签**。原 app 不受影响。

## App 原生中文本地化（可选，非插件）

DSH 的网页 UI 语言和 macOS **原生**打开面板/菜单语言是两件事。0.2.1-rc.5 的 app 没有
`zh-Hans.lproj` / `CFBundleLocalizations`，所以即使系统是中文，Cmd+O 的访达面板仍可能英文。

仓库里保留了一个补丁脚本（**不是插件运行时，不随 `.tgz` 分发**）：

```sh
# 先完全退出 DSH；只检查，不改文件
node scripts/apply-app-locale.mjs --dry-run

# 修改当前 app：自动备份 zip，补 zh-Hans/zh_CN lproj + Info.plist，保留 entitlements，ad-hoc 重签
node scripts/apply-app-locale.mjs --apply
```

说明：

- 会修改 `/Applications/DeepSeek Harness.app` 的签名（ad-hoc），**DSH 更新会覆盖**，更新后要重跑。
- 首次 `--apply` 默认备份到 `~/Documents/DeepSeek Harness Backups/`；也可用 `--backup <zip>` 指定。
- 恢复：`rm -rf "/Applications/DeepSeek Harness.app" && ditto -x -k <backup.zip> "/Applications"`。
- 这是 best-effort 的 app 层补丁；原生面板语言最终由 AppKit/Electron 决定，不是 dsh-style 的设置。

