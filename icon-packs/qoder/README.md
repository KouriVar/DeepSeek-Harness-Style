# Qoder · Studio 批量交接包

本批以 `dsh-icon-mapping.json` 为准，这是 **Studio 审阅态**格式（`entries` + `target`），不是补丁器的 build map。保留全部 700 个语义使用位置；只有 `confirmed` 且带 `target` 的记录可以进入后续转换。未确认、未解析及冲突项必须回退原生。

当前 revision **438**：328 条已确认使用位置，合并为 **70 个唯一原生资源**，对应 **53 个 Qoder 目标 SVG**；同一原生资源选择不同目标的冲突数为 0。这些是审核与素材计数，尚未证明构建时能够成功定位 70 个资源。

- `dsh-icon-mapping.json`：本批全量审核快照，原生引用与目标路径都相对于本目录。原生项补充实际 viewBox、mode、SHA256；sourcePath 使用 `app.asar!/…` 或 `profile/node_modules/…`，去掉本机绝对路径。
- `svg/`：53 个被确认映射引用的 Qoder 原始 SVG；额外保留此前 5 个 `.fill.svg` 样本。未上传完整 Qoder 图库。
- `native-icons/`：所有当前可解析的 **153 份唯一原生 SVG**，包括 Local、inline 与 CSS SVG；不是只导出已确认项。`native-index.json` 记录其校验值、使用位置及来源。
- `coverage.review.json`：本批覆盖统计、83 个未映射原生资源、137 个不同 Dynamic 名称及其他未解析使用位置；共有 163 个使用位置缺少可解析 SVG，未伪造资源。
- `assets.manifest.json`：本批引用的 206 个 SVG 文件及其 SHA256，另含映射快照校验值和目标属性。

素材已检查 XML、viewBox、引用闭合、SHA256；53 个目标全部使用单色 `currentColor`。原生 `inline-28d4ced6232a9b10.svg`（CssSvg-spinner）含 `foreignObject`，已在报告标记；它未确认映射，应回退原生。源 SVG 原样保留用于定位，不代表复杂原生结构都能替换。

**交接顺序：** converter 读取 `dsh-icon-mapping.json`，只收 confirmed + target，按唯一原生资源去重，并生成含真实 variant 的 build map；遇到目标冲突应 SKIP。然后接入补丁器，先 dry-run 生成逐图标 OK/SKIP 报告。可以先实现 converter 和 `--verify`；apply、生成应用副本及重签仍待报告确认。

**注意旧样本：** `mapping.json`、`coverage.json` 和 `evidence.json` 仍是原来的 5 图标 build sample。现有补丁器默认读取 `mapping.json`；不能直接运行旧样本后把结果当作本批全量报告。后续需让补丁器读取 converter 生成的 `mapping.build.json`，或明确覆盖 build map 后再 dry-run。

重新导出当前工作台并校验素材（不会修改审核选择或应用）：

```sh
node tools/icon-studio/export-reviewed-pack.mjs
```

需要本机 Studio 正在运行，且 `config.local.json` 指向已提取资源。重复导出会更新审核快照及索引，不删除旧样本，也不清理历史额外素材。

## 原 5 图标样本说明

DSH `0.2.1-rc.3` / Qoder `0.4.11`。仅包含在本机 Studio 中已人工确认的五项：新建会话、搜索、自动化日历、发送、停止。

`mapping.json` 遵循 `dsh-icon-build-map` v1，每项对应一个唯一 `native.resource`。`native-icons/` 保留从实际发行代码还原的原生 SVG；`svg/` 保留对应 Qoder 原始几何和 viewBox。目标全部是单色 `currentColor`。

**字形与渲染方式：** Qoder 的 `Line` 通常以填充轮廓实现线性外观；本样本五个目标的实际渲染均为 `fill`，所以只提供 `.fill.svg`，`target.variant` 均为 `fill`。不要把这些路径改成 `fill="none" stroke="currentColor"`，否则会描绘轮廓边界，改变原图。`native.mode` 记录原生事实，不强制目标使用相同渲染方式。

**固定变体：** 每个唯一原生资源固定一个目标字形，选中/未选中继续通过颜色和背景表达。按选中态切换字形留给运行时阶段。

**计数：** 当前扫描有 700 个语义位置，153 个已解析的唯一 native.resource；不是假设的 314。`coverage.json` 的 missing 表示本样本没有映射的资源，不保证已打包其中的 SVG。Dynamic 与其他未解析引用分别列出，均回退原生。

**定位注意：** primitives 的 Regular/Medium 可能共用基础路径，仅通过包装组件提供 strokeWidth。原生预览是解析后的结果，未必能在压缩 JS 中直接匹配整段 SVG 字符串。补丁器应解析组件/包装关系和几何属性，遇到零匹配、多匹配、冲突或版本不符就拒绝修改并报告，不能盲目全局替换。映射中命名组件的 sourcePath 指向 primitives 定义所在的 frontend bundle；Local 和 inline 指向其模块。

**安装选择：** 先生成修改后的 `.app` 副本，在副本上备份、替换、ad-hoc 重签和验证，再由用户切换到该副本。仓库已有 `scripts/apply-icon-pack.mjs`；本批交接没有运行 apply 或重签。

`evidence.json` 保留语义 ID、审批时间和 SVG 校验值；不包含整个 Qoder 图库。
