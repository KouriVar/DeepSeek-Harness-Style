# 输入框（composer）组件规格 · 实测值

> 数据来源：真机 DSH 0.2.1-rc.5（窗口 1512 CSS px，浅色主题），在页面里临时插探针读 `getComputedStyle` / `getBoundingClientRect`。
> 标注 **【插件】** 的项是 dsh-style 改过的；其余是 DSH 原生值。视觉微调时只改插件那几行即可。

## 1. 结构（从外到内）

```
JZLxKW_root          → 外容器，986×158，padding 0 16px 4px（左右 16 由 --dsh-composer-side-clearance 决定）
└─ [data-composer-card] → 输入卡片，672×128（当前窗口下的实测宽；max-width 672px），圆角 16px【插件】，白底
   ├─ [data-dsh-refcards]  → 附件/引用栅格（插件插入，空时移除），padding 0 14px，gap 12
   ├─ [data-composer-input] → 编辑器，668×60，min-height 60px【插件】
   └─ JZLxKW_row          → 底部工具行，672×42，padding 2px 8px 6px，gap 12
      ├─ 加号按钮 28×28
      ├─ 权限按钮 100×28
      ├─ 模型选择 264×28
      ├─ 语音按钮 28×28
      └─ 发送/停止 34×34
```

## 2. 尺寸与间距

| 项 | 值 |
|---|---|
| 卡片宽 | 672px（当前窗口；`max-width: 672px`，随布局变化） |
| 卡片高（空态） | 128px |
| 卡片内距 | 上 14px【插件，原 8px】 / 左 0 / 右 0 / 下 0 |
| 卡片子元素间距 | `row-gap: 12px` |
| 卡片圆角 | **16px**【插件，原 `--dsw-radius-panel` = 28px】 |
| 卡片描边 | `box-shadow: rgba(0,0,0,.1) 0 0 0 .5px, …`（无 border） |
| 外容器内距 | `0 16px 4px` |
| 编辑器 | 668×60；内距 上 4 / 下 0 / 左 14；`min-height 60px`【插件，原 36px】 |
| 工具行 | 672×42；内距 `2px 8px 6px`；`gap 12px`；无上边框 |
| 栅格（有附件时） | 左右 14px，`gap 12px`；引用卡 164×64 圆角 12；官方图片 64×64 圆角 20（`--dsw-radius-xl`） |

## 3. 字体

| 项 | 值 |
|---|---|
| 编辑器正文 | `font-size 14px`，`line-height 24px` |
| 工具行文字（权限 / 模型） | `font-size 13px` |
| 加号 / 发送按钮字号（内部图标容器） | `13.3333px` |

## 4. 按钮（从左到右）

| 按钮 | 尺寸 | 圆角 | 背景 | 图标 | 说明 |
|---|---|---|---|---|---|
| 加号（添加文件或调用指令） | 28×28 | **8px**【插件，原 999px】 | `rgb(245,246,247)` | 14×14 | 圆形 → 圆角矩形 |
| 权限（访问模式） | 100×28 | 8px（原生） | 透明 | 14×14 | 文字 13px |
| 模型选择 | 264×28 | 8px（原生） | 透明 | —（纯文字） | 文字 13px |
| 语音输入 | 28×28 | 8px（原生） | 透明 | 18×18 | 本来就是圆角矩形 |
| 发送 / 停止 | 34×34 | **10px**【插件，原 999px】 | `rgb(65,118,230)` | 16×16 | 圆形 → 圆角矩形；发送态与停止态共用 |

## 5. 设计 token（`document.documentElement`）

| token | 值 |
|---|---|
| `--dsw-radius-xl` | 20px |
| `--dsw-radius-panel` | 28px |
| `--dsw-radius-lg` | 16px |

> `--dsh-composer-card-max-width` 在 documentElement 上读不到（应定义在 composer 作用域内），实测卡片 `max-width` 为 672px。

## 6. 插件改过的值一览（可回滚）

| 位置 | 原生 | 现在 |
|---|---|---|
| 卡片圆角 | 28px | 16px |
| 加号按钮圆角 | 999px | 8px |
| 发送/停止圆角 | 999px | 10px |
| 编辑器 min-height | 36px | 60px（+1 行，行高 24px） |
| 卡片顶部内距 | 8px | 14px（与文字左内距 14 对齐） |
| 附件/引用栅格 | 官方横向 rail | 统一 wrap 栅格，左右 14、gap 12、卡片 164×64 |

对应代码：`client.js` 的 `COMPOSER_CHROME_CSS`（圆角 / min-height）与 `REFCARD_CSS`（栅格）。
