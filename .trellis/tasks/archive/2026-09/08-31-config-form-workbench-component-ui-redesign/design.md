# ConfigForm Workbench 组件化视觉重构设计

## 1. 产品语境

- 主题：单页配置化表单的 Design-first Low-Code IDE。
- 用户：需要长时间、高频搭建和验证业务表单的前端开发者与平台工程师。
- 单一任务：在真实 Runtime Canvas 上准确编辑页面，并通过 Inspector、Preview、History 和 Export 完成闭环。

视觉方向定义为“精密编辑台”：像工程仪器一样高信息密度、稳定、可预测。大胆点只用在一处，即 Canvas 选中态在 Layers、Canvas 和 Inspector 之间共享同一条清晰的蓝色身份线，其余界面保持克制。

## 2. 视觉计划

### 颜色

采用六个语义角色，不用一色铺满界面：

| 角色 | Light | Dark |
| --- | --- | --- |
| Canvas | `#FFFFFF` | `#FFFFFF` |
| Workspace | `#F3F5F8` | `#111318` |
| Panel | `#FFFFFF` | `#1A1D23` |
| Line | `#D8DDE6` | `#343942` |
| Text | `#1D2430` | `#E8EBF0` |
| Accent | `#3478F6` | `#5B9BFF` |

成功、警告和危险沿用 Element Plus 语义色，但降低背景饱和度。Dark theme 只改变 Workbench chrome，不向 Runtime iframe 注入主题样式。

### 字体

- UI/正文：`Segoe UI Variable, Inter, system-ui, sans-serif`，强调可扫描性。
- 数据/代码/版本：`Cascadia Code, JetBrains Mono, monospace`。
- 紧凑面板内使用明确的 12/13/14px 层级，字距固定为 0；不随 viewport 缩放字号。

### 布局

```text
┌ Project / Page ───── Commands / Status ───────── Preview / Export ┐
├ Components · Layers · Pages · History ┬ Canvas ┬ Inspector ──────┤
│ mature Tabs / Input / Tree / Scrollbar │ Runtime│ Form / Collapse │
│ domain rows and material registry      │ overlay│ provider schema │
└────────────────────────────────────────┴────────┴─────────────────┘
```

390px 下通过成熟 Drawer/Tabs 在 Components、Canvas、Inspector 之间切换，Canvas 保持固定 intrinsic frame 并由 camera Fit，不改变 Runtime 几何。

### 自我校验

初版若仅把颜色换成通用深色 SaaS，会继续显得模板化。最终方向改为由编辑器事实驱动：Canvas 永远白色、结构层级靠面板边界和密度编码、选中身份贯穿三栏、命令状态使用工具式文案。删除无关渐变、装饰卡片和多余动效。

## 3. 成熟组件边界

| 区域 | 采用 Element Plus | 保留领域实现 |
| --- | --- | --- |
| Topbar/Toolbar | `ElButton`、`ElButtonGroup`、`ElDropdown`、`ElTooltip`、`ElBadge` | Command/History/Preview 接线 |
| 左侧栏 | `ElTabs`、`ElInput`、`ElTreeV2`、`ElScrollbar`、`ElEmpty` | Registry 分组、Layers selection/arrange、Page/History projection |
| Inspector | `ElForm`、`ElFormItem`、`ElInput`、`ElInputNumber`、`ElSwitch`、`ElSelect`、`ElSegmented`、`ElCollapse` | Registry setter schema、批量 command、Flow 事件入口 |
| 辅助工作区 | `ElDialog`、`ElDrawer`、`ElTabs`、`ElAlert`、`ElLoading` | Export file model、Page Manager、Flow Workspace、Preview Session |
| Canvas | 仅复用基础 Button/Tooltip | RuntimeHost、camera、selection、resize、drag、candidate、geometry bridge |
| Source/Config | Dialog/Tabs/Tree 可复用 | Monaco model、生成文件快照、只读与下载合同 |

任何薄适配组件都必须以领域名命名，例如 `WorkbenchCommandDropdown`，不能建立 `BaseButton`、`BaseTabs` 之类二次 UI 框架。

## 4. 按需导入

Workbench Vite 增加 `unplugin-vue-components/vite` 与 `ElementPlusResolver({ importStyle: 'css' })`，生成本包专用 `components.d.ts`。仅在脚本调用 `ElMessage`、`ElNotification` 等 API 时使用 auto-import resolver 或显式命名导入；模板组件不手写聚合 import。

禁止：

```ts
app.use(ElementPlus)
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
```

构建测试检查 Rollup 输出和生成声明，防止全量库或未使用样式进入 Workbench。

## 5. 状态与兼容边界

Element Plus 组件只拥有展开、焦点、hover、输入中间态等 UI 状态。业务提交仍由现有 Workbench contexts、Designer controller 和 Project Session 控制。迁移必须保持已有 `aria-label`、稳定 `data-*` 测试标识和键盘合同；若成熟组件默认 DOM 与 Runtime/overlay hit testing 冲突，优先保留领域组件而不是改 Model 或 geometry bridge。

## 6. 迁移与回滚

按区域分批迁移，每批都有截图、axe、keyboard 和 Provider E2E。旧样式仅在对应区域验证完成后删除。某个 Element Plus 组件无法满足领域交互时，回滚该区域到原实现并记录缺口，不保留两套并行状态机。
