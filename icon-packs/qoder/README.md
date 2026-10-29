# Qoder · 5-icon build sample

DSH `0.2.1-rc.3` / Qoder `0.4.11`。仅包含在本机 Studio 中已人工确认的五项：新建会话、搜索、自动化日历、发送、停止。

`mapping.json` 遵循 `dsh-icon-build-map` v1，每项对应一个唯一 `native.resource`。`native-icons/` 保留从实际发行代码还原的原生 SVG；`svg/` 保留对应 Qoder 原始几何和 viewBox。目标全部是单色 `currentColor`。

**字形与渲染方式：** Qoder 的 `Line` 通常以填充轮廓实现线性外观；本样本五个目标的实际渲染均为 `fill`，所以只提供 `.fill.svg`，`target.variant` 均为 `fill`。不要把这些路径改成 `fill="none" stroke="currentColor"`，否则会描绘轮廓边界，改变原图。`native.mode` 记录原生事实，不强制目标使用相同渲染方式。

**固定变体：** 每个唯一原生资源固定一个目标字形，选中/未选中继续通过颜色和背景表达。按选中态切换字形留给运行时阶段。

**计数：** 当前扫描有 700 个语义位置，153 个已解析的唯一 native.resource；不是假设的 314。`coverage.json` 的 missing 表示本样本没有映射的资源，不保证已打包其中的 SVG。Dynamic 与其他未解析引用分别列出，均回退原生。

**定位注意：** primitives 的 Regular/Medium 可能共用基础路径，仅通过包装组件提供 strokeWidth。原生预览是解析后的结果，未必能在压缩 JS 中直接匹配整段 SVG 字符串。补丁器应解析组件/包装关系和几何属性，遇到零匹配、多匹配、冲突或版本不符就拒绝修改并报告，不能盲目全局替换。映射中命名组件的 sourcePath 指向 primitives 定义所在的 frontend bundle；Local 和 inline 指向其模块。

**安装选择：** 先生成修改后的 `.app` 副本，在副本上备份、替换、ad-hoc 重签和验证，再由用户切换到该副本。该仓库本次只准备数据，尚未包含 `scripts/apply-icon-pack.mjs`，因此尚未修改或重签 DSH。

`evidence.json` 保留语义 ID、审批时间和 SVG 校验值；不包含整个 Qoder 图库。
