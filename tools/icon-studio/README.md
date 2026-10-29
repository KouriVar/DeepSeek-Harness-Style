# Icon Mapping Studio · Phase 04

在现有 `dsh-style/tools/` 内运行的本机审核工具。读取安装版 DSH 的真实客户端代码、当前 profile 的插件客户端入口和已经提取的 Qoder 素材。没有图标替换引擎，也不注册进 DSH 运行时。

## 使用

双击 `Start Icon Studio.command`，或在 `dsh-style` 根目录执行：

```sh
npm run icons:studio
```

默认地址 `http://127.0.0.1:43184`。启动器使用 macOS 用户会话的 launchd 托管服务，关闭终端或聊天后仍可访问；用 `npm run icons:stop` 停止。该任务不安装登录自启项，重新登录后需再运行启动器。端口被占用时不会杀死已有进程；可用 `ICON_STUDIO_PORT=43186 node tools/icon-studio/server.mjs --open` 指定其他端口。

首次使用或 DSH/插件代码更新后：

```sh
npm run icons:index
npm run icons:test
```

`config.local.json` 存放本机应用、profile、现有素材根目录和依赖位置，已加入 Git 忽略。迁移机器时参考 `config.example.json`。当前复用本机现有的 Babel parser/traverse 和 sharp，没有给 DSH 插件加载任何新依赖。也可在本目录安装 `package.json` 声明的三个工具依赖，解析器会优先使用本目录依赖。

## 审核流程

1. 默认打开真实的首轮 30 个用例，可切换完整清单、UI 区域、审核状态或资源解析状态。
2. 左右统一尺寸比较，支持亮色、暗色和双色背景。候选按钮显示综合分，并展开语义、上下文、几何、风格、状态依据。分数不是模型置信概率。
3. 选择其他候选或手动搜索全库，会保存为“待审核”；只有点击“确认映射”才算完成。
4. “跳过 / 忽略”保留原生回退。“恢复默认”撤销该项人工选择和审核，恢复自动建议。
5. 审核结果保存在 `.local/reviews/decisions.json`，与浏览器 localStorage 无关；重启服务器仍保留。并发审核通过 revision 检测冲突。
6. 点击导出得到 `dsh-icon-mapping.json`，同时写入 `.local/exports/icon-mapping.json`。导出只有人工确认的 target；其他位置的 target 为 null，fallback 为 native。

动态引用未还原时必须先实机检查，并勾选相应说明，才允许确认。重建索引后，如果原生/目标 SVG 指纹变化，旧确认会自动退回待审核；失效记录仍保留在审核文件中，不会悄悄覆盖。

## 本机产物

所有机器数据、提取后的原生预览和审核结果都放在已忽略的 `.local/`：

- `data/dsh-inventory.json`：每个语义位置、原生引用、使用组件、源文件行列、源码分区、尺寸、状态条件、插件来源、代码摘录。
- `data/source-audit.json`：实际扫描入口、应用版本/构建、插件位置、解析限制。
- `data/qoder-index.json`：3,546 个命名 SVG + 7 个自定义变体的元信息、关键词、原始路径及用于几何比较的向量。完整 Qoder 素材通过只读引用使用，没有复制进插件。
- `data/qoder-font-index.json`：独立的 qoder-seti 字体及 385 条定义；未混入 SVG 匹配。
- `data/candidates.json`：每个原生记录最多五个候选及逐项依据。
- `data/pilot-30.json`：第一批 30 个真实用例及资源验证标记，humanReviewed 初始全为 false。
- `data/coverage.json`：全量清单的 AI 候选、人工审核、未匹配数量及区域统计。
- `native-icons/`：还原的 DSH 原生 SVG 预览，供工作台使用。
- `reports/`：本机覆盖率报告与浏览器验证截图。

## 方法及边界

扫描 AST 中实际 JSX/runtime/createElement 调用、原生别名、局部 SVG 组件调用、条件分支和注册对象的图标引用。平台组件内部的图标仅在该导出组件被发行客户端引用时纳入。配置引用和 SVG 定义会明确标注，不能据此断言当前路由一定可见。动态组件、动态图片地址、无法静态求值的几何标记待检查。

这台机器没有找到完整的 DSH TSX 仓库；使用当前安装版本 `app.asar` 内保留组件名/region 的发行代码。`sourcePath` 的 `!` 之前是实际 ASAR 路径，之后是包内文件路径；行号属于该发行文件。不会伪装成原始 TSX 行号。

推荐通过 AI 编写的本地语义扩展规则，结合 24×24 透明度轮廓相似度、UI 上下文、风格和方向/状态约束完成。模型调用数为零，没有对完整图库逐个询问模型。视觉分只反映几何，不证明功能等价。源代码静态条件不能覆盖所有运行时注册、主题和插件行为。

适配其他图标库时使用新的 packId 和索引条目，继续沿用 `semanticId → {native,target,fallback}` 契约；不要给原生记录分配数组下标作为 ID。当前 pack 为 `qoder-local`。本阶段没有远程图标包下载、本地素材缓存或图标运行时替换。

## 工程边界

只修改开发工具、根 package 的工具 scripts 和 Git 忽略规则。没有修改 `client.js`、`index.js`、`cordis.patch.yml`、现有 DSH 业务代码或 Qoder 应用。npm 发布的 `files` 白名单未变，不会把工具或本机素材装进 DSH。没有推送 GitHub。
