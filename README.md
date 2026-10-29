# dsh-style

一个**纯客户端**的 DeepSeek Harness 外观定制插件：在 Harness **原生「设置」里新增一个
「外观」页**（出现在设置左侧导航里），用 Harness 自带的原生控件做可逆的样式定制。
不碰 Bot、不碰宿主业务逻辑、不改 DSH 本身组件。

当前版本：`0.1.0`（第一个版本做**布局模式**）。变更见 [CHANGELOG.md](./CHANGELOG.md)。

## 功能

- **原生设置页**：往 `settings.section` 注册「外观」页（`order: 40`），复用原生
  `Switch` / `SegmentedControl` / `Button`，外观与交互由 Harness 渲染，不自绘。
- **布局模式**
  - `经典（Classic）`：完全保持原生 AppFrame，默认，作为完整原生回退。
  - `内嵌（Inset）`：外层浅灰底板，右侧主内容变成白色圆角卡片（上/右/下 4px、左侧 6px、圆角 20px），
    可即时切换、即时生效。
- **效果开关**：启用样式插件 / 减少动效 / 隐藏滚动条；内嵌布局下主会话区滚动条默认隐藏。
- **可持久化**：设置保存在浏览器 `localStorage`（键 `dsh-style:settings`），重启后恢复。
- **可逆、无污染**：禁用/卸载时移除全部 `data-dsh-style-*` 属性与样式表，不留全局样式。
- **热重载**：修改 `client.js` 后由 `dsh-client-hmr` 自动生效（约 0.5–1 秒），无需重启。

## 结构

```
dsh-style/
  package.json         # dsh.client.platform = web；exports ./client；dsh.bundle.patch
  index.js             # 宿主半边：占位（无服务、无 Config）
  client.js            # 浏览器半边：注册「外观」页 + 布局/效果引擎
  cordis.patch.yml     # 把宿主入口挂到 profile（entry id: style）
  test/smoke.mjs       # 无头冒烟测试（验证 settings.section 注册）
  test/layout.mjs      # 假 DOM 测试（Inset 打标 / Classic 还原 / 禁用清理）
  CHANGELOG.md
  LICENSE
  README.md
```

## 怎么工作

- **页面**：`client.js` 往插槽 `settings.section` 注册 `{ id:'style', order:40, label:'外观' }`。
  这是 DSH 原生设置页自己用的同一个插槽，所以外观、导航都由 Harness 渲染。
- **控件**：使用原生 `@deepseek-ai/dsh-client-ui-primitives` 的 `Switch` / `SegmentedControl` / `Button`，
  不自绘、不覆盖样式。
- **布局**：`root` 插槽（AppFrame）由 `dsh-client-ui-layout` 独占，没有公开插槽改它的类名。
  因此用**语义锚点** `[data-shell-bottom]` + 右侧栏 `[data-rightbar-col]` 的浅层兄弟关系定位三栏，
  再打上自有 `data-dsh-style-*` 属性；样式表只针对这些属性，不依赖 hash 类名、不做深层选择器覆盖。
- **生效**：通过 `data-dsh-style-*` 属性 + 插件自有的 `<style data-plugin="dsh-style">` 施加；
  布局规则只在 `html[data-dsh-style-layout="inset"]` 下生效，经典模式完全没有痕迹。
- **持久化**：值存在 `localStorage`。以后要「跨设备 / 写进宿主设置」，把 `index.js` 宿主半边改成
  导出 schemastery `Config` 并 `ctx.settings.configure(...)`，客户端改用 `ctx.configForms.get(ns)` 即可。

## 自测（不需要启动 DSH）

```sh
node test/smoke.mjs
node test/layout.mjs
```

## 安装到 DSH

Harness 的插件安装有两条路（会改动 profile，**首次加载新客户端需要重启 Harness**）：

1. 图形界面：Settings → Plugins → Add plugin，填本目录打出的 `.tgz` 或本地路径。
2. 命令行（示例，profile 名以你本机为准）：

```sh
npm pack            # 生成 dsh-style-0.1.0.tgz
dsh plugin --profile web add /绝对路径/dsh-style-0.1.0.tgz
```

开发期也可把本目录 `link` 进 profile 的 `package.json`：

```json
{
  "dependencies": { "dsh-style": "link:/绝对路径/dsh-style" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-style"] } }
}
```

然后 `pnpm install`，重启 Harness。打开 Settings，左侧应多出 **外观**。

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
用于真实图标清单、Qoder 候选对比、人工审核和语义映射 JSON 导出；本阶段不会替换 DSH 图标。
重建索引用 `npm run icons:index`，验证用 `npm run icons:test`。
详见 [Icon Mapping Studio 使用说明](./tools/icon-studio/README.md)。

## 图标替换（Icon System · 预览）
不改 DSH 源码，用图标包替换原生图标（缺失自动回退原生）：

- 图标包：`icon-packs/qoder/`（`mapping.json` + `svg/` + `native-icons/`）
- 补丁器：`scripts/apply-icon-pack.mjs`

```sh
# 1) 只报告将替换哪些图标（不改任何文件）
node scripts/apply-icon-pack.mjs --dry-run

# 2) 生成改好的 .app 副本（默认 ~/Applications）
node scripts/apply-icon-pack.mjs --apply --force --out "/Applications/DeepSeek Harness (Qoder Icons).app"
```

说明：DSH 的 app 启用了 **asar 完整性校验** + Developer ID 签名。补丁器会：按元素定位并替换图标几何 →
重算被改文件的**分块 SHA256** → 同步 `Info.plist` 的 `ElectronAsarIntegrity` **header 哈希** →
对副本 **ad-hoc 重签**。原 app 不受影响。
