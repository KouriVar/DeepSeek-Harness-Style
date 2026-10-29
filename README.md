# dsh-style

一个**纯客户端**的 DeepSeek Harness 外观定制插件：在 Harness **原生「设置」里新增一个
「Appearance」页**（出现在设置左侧导航里），用 Harness 自带的 `Switch` 组件放几个可逆的
样式开关。不碰 Bot、不碰宿主业务逻辑、不改 DSH 本身组件。

> 这是最小骨架（walking skeleton），目的是先跑通「原生设置页 → 拨开关 → 生效 → 刷新仍在」
> 这条链路，后续再往里加主题/组件开关。

## 结构

```
dsh-style/
  package.json     # dsh.client.platform = web；exports ./client
  index.js         # 宿主半边：占位（无服务、无 Config）
  client.js        # 浏览器半边：注册 settings.section 页 + 应用开关
  test/smoke.mjs   # 无头冒烟测试（不启动 DSH 即可验证注册逻辑）
  README.md
```

## 怎么工作

- **页面**：`client.js` 往插槽 `settings.section` 注册 `{ id:'style', order:40, label:'Appearance' }`。
  这是 DSH 原生设置页自己用的同一个插槽，所以外观、导航都由 Harness 渲染。
- **控件**：用原生 `@deepseek-ai/dsh-client-ui-primitives` 的 `Switch`，不自绘、不覆盖样式。
  （只有当某版本不再导出 `Switch` 时，才退回一个极简 checkbox 兜底。）
- **生效**：三个开关 `enabled / reduceMotion / hideScrollbars`，通过 `data-dsh-style-*`
  属性 + 一个插件自有的 `<style data-plugin="dsh-style">` 施加；关掉就完全可逆。
- **持久化**：值存在浏览器 `localStorage`（键 `dsh-style:settings`），按设备保存。
  以后要「跨设备/写进宿主设置」，把 `index.js` 的宿主半边改成导出 schemastery `Config`
  并 `ctx.settings.configure(...)`，客户端改用 `ctx.configForms.get(ns)` 即可（接口已验证存在）。

## 自测（不需要启动 DSH）

```sh
node test/smoke.mjs
```

## 安装到 DSH（建议先在隔离 profile 验证，不要直接动正在用的那个）

Harness 的插件安装有两条路（会改动 profile，**需要重启 Harness 才加载新客户端**）：

1. 图形界面：Settings → Plugins → Add plugin，填本目录打出的 `.tgz` 或本地路径。
2. 命令行（示例，profile 名以你本机为准）：

```sh
# 打成包
npm pack            # 生成 dsh-style-0.0.1.tgz
# 装进某个 profile
dsh plugin --profile web add /绝对路径/dsh-style-0.0.1.tgz
```

开发期也可以把本目录 `link` 进 profile 的 `package.json`：

```json
{
  "dependencies": { "dsh-style": "link:/绝对路径/dsh-style" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-style"] } }
}
```

然后 `pnpm install`，重启 Harness。打开 Settings，左侧应多出 **Appearance**。

## 路线图

1. 加真实外观项：强调色、圆角、字号、界面密度、动效强度（用原生控件）。
2. 宿主设置后端：值写进 settings 命名空间（跨设备、可 reset 默认）。
3. 组件级开关：导航栏/输入框/消息布局的显隐与形态。
4. 预设主题：一键整套。

## 命名

包名与模块 id 目前是 `dsh-style`（`client.js` 里的 `id` 必须与包名一致）。想换成别的名字时，
同步改 `package.json.name`、`client.js` 的 `id`、以及本 README 即可。
