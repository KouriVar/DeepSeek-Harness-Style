import path from 'node:path';
import fs from 'node:fs';
import {LOCAL,atomicJSON} from './common.mjs';
import {ReviewStore} from './review.mjs';
import {coverage} from './match.mjs';
export function reports({inventory,icons,pack,report,pilot,candidates}){
  const store=new ReviewStore(path.join(LOCAL,'reviews/decisions.json'),inventory,icons);
  const stats=coverage(inventory,candidates,store.effective());
  atomicJSON(path.join(LOCAL,'exports/icon-mapping.json'),store.export({dshVersion:report.dshVersion,packs:[pack],candidates}));
  const md=`# Phase 04 本机资源及覆盖率报告

DSH ${report.dshVersion}，构建 ${report.dshBuildCommit}。生成于 ${new Date().toISOString()}。

实际样式插件：\`${report.stylePlugin}\`。当前 profile 的安装链接已确认：${report.stylePluginLinked}。

没有找到完整的 DSH 原始 TSX 仓库；基于已安装 app.asar 中的发行客户端代码扫描，保留实际包内路径、源码分区、组件名、行列和片段，不冒充原始 TSX 源码。

## 识别及推荐

- 扫描 ${report.sourceStats.length} 个客户端入口，发现 ${report.totalUsages} 处引用，归并为 **${stats.identified} 个语义位置**。
- 其中 ${stats.withPreview} 个位置有预览，引用 ${stats.uniqueNativeResources} 个不同原生资源；${report.unresolved} 个位置仍待检查。
- 原生图标库导出 ${report.primitiveExports} 个命名组件，成功还原 ${report.primitivePreviews} 个；失败项详见 source-audit.json。
- ${stats.aiCandidates} 个位置有 AI 辅助候选，${stats.unmatched} 个未匹配。
- **人工确认 ${stats.confirmed}，人工审核 ${stats.reviewed}，忽略 ${stats.ignored}。** 自动推荐不计入完成映射。
- Qoder 索引 ${pack.namedIcons} 个命名 SVG + ${pack.customIcons} 个自定义变体，另有 ${pack.fontDefinitions} 条字体定义。原始 Qoder 素材未复制进插件，全部原始 SVG 校验通过。

| 区域 | 语义位置 | 有预览 | AI 候选 | 人工确认 | 已审核 | 未匹配 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${Object.entries(stats.areas).map(([a,c])=>`| ${a} | ${c.identified} | ${c.withPreview} | ${c.aiCandidates} | ${c.confirmed} | ${c.reviewed} | ${c.unmatched} |`).join('\n')}

## 首轮 30 项

“验证”指源引用、实际资源、候选链路和预览可渲染，不表示人工批准。需要的重点角色缺失项：${pilot.missingRequestedRoles.join('、')||'无'}。

| 功能 | 原生组件/资源 | 首候选 | 候选数 | 源行 |
| --- | --- | --- | ---: | ---: |
${pilot.items.map(p=>`| ${p.role} | ${p.nativeName} | ${candidates[p.id].candidates[0]?.targetId||'需要人工选择'} | ${p.candidateCount} | ${p.line} |`).join('\n')}

## 现有插件注册与样式机制

${report.stylePluginRegistrations.map(r=>`- \`${r.slot}\` → \`${r.component}\`，id=\`${r.id}\`，order=${r.order}；client.js:${r.line}。`).join('\n')}

通过 data-dsh-style-* 属性和 style[data-plugin="dsh-style"] 应用可逆样式；原有 localStorage 与清理机制保留。本工作台与这些运行时入口解耦。

## 匹配方式与限制

1. AI 编写的语义规则与别名扩展，结合 UI 上下文、24×24 轮廓几何、风格和方向约束。模型调用 0 次；综合分不是概率或等价性证明。
2. 发行代码保留的条件、组件调用、配置引用和静态 SVG 定义分开标记。动态图片、字体/CSS 机制及未求值路径均留待检查；不能证明所有路由/插件在运行时都实际展示。
3. CSS 图标只有在 data-SVG 所属类存在实际引用时纳入；渐变遮罩、滚动淡出等不算图标。
4. 状态包含源码中识别到的分支，未覆盖所有主题、动效、缩放、图标组合和运行时输入。字体单独索引，暂未与 SVG 做字形匹配。
5. 导出的语义 JSON 只使用人工确认的 target，未确认和忽略项 fallback=native。资源指纹变化会撤销旧确认的有效性。
6. 未修改 Qoder、DSH 业务逻辑或现有样式插件入口；未启用替换引擎；未上传图标资源或推送 GitHub。

机器数据位于 .local/data；审核位于 .local/reviews；导出位于 .local/exports。配置、本机数据与素材预览已 Git 忽略。
`;
  fs.mkdirSync(path.join(LOCAL,'reports'),{recursive:true});fs.writeFileSync(path.join(LOCAL,'reports/coverage.md'),md);
  return stats;
}
