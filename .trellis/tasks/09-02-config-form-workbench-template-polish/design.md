# ConfigForm Workbench 模板创建页精修技术设计

## 1. 保留的数据与行为合同

`TemplateCreationWorkspace.vue` 继续拥有现有局部展示状态，模板数据、Catalog Service、adapter loader、eligibility analyzer、preview builder 和 controller 创建事务保持原边界。

不得改变：

- `ProjectTemplateCatalogEntry` / manifest 格式与当前 version 规则；
- 搜索字段、category/provider 筛选语义和首个可用项选择行为；
- listbox roving tabindex、Arrow/Home/End/Enter 与移动 Escape 行为；
- `previewRequest` generation token、disposed guard 和 Runtime state revision guard；
- `analyzeTemplateEligibility` 的创建前门禁；
- submitting/controller busy 的重复提交与退出阻断。

## 2. 响应式信息架构

### 2.1 宽屏：1001 像素及以上

```text
[ compact catalog 280-340px ] [ identity / eligibility / runtime preview / sticky create ]
```

目录固定为可扫描工具栏 + 列表，不使用卡片网格。详情区以真实预览为主要面积，sticky 创建区不覆盖可滚动内容。

### 2.2 中屏：641–1000 像素

```text
[ 52-56px category rail ] [ detail / runtime preview ]
          |
          +-> Browse opens catalog ElDrawer on demand
```

- Rail 表达 All/Blank/Starter 与“浏览模板”，使用 Lucide 图标、Tooltip 和 aria-label。
- Catalog Drawer 承载搜索、provider Select、结果数与完整 listbox，append 到 `#workbench-overlays`。
- 默认已有合法选择时直接展示详情；没有选择或筛选无结果时详情显示明确 CTA 打开目录。
- Drawer 关闭后焦点回到触发器；不与外观 Drawer 嵌套，两者状态互斥。

### 2.3 移动：640 像素及以下

- 不显示中屏 rail/Drawer，使用 `ElSegmented` 在 Catalog/Details 两个单窗格间切换，默认 Catalog。
- 选择模板后提供清晰的 Details 动作；Enter 进入详情，Escape 从详情回目录，提交中不允许离开。
- 顶栏、分段控件、内容和 sticky footer 使用稳定高度，长诊断不覆盖预览或创建按钮。

## 3. 目录行与资格状态

每行按稳定顺序呈现：模板名称、类别、adapter/provider、资格状态。描述只在空间允许时作为次级信息，避免两行描述压低扫描速度。

资格不做全目录预加载，避免改变 adapter 加载时机：

- 现有 `prepareSelectedTemplate()` 仍是唯一选择后资格/preview 流程。
- 增加纯展示 cache，以 `templateId + target + registryLock fingerprint` 为 key，记录已实际检查的 checking/eligible/ineligible 结果。
- 未选择过的行显示“待检查”或中性状态；选中时显示 checking，完成后缓存真实结果。
- 创建按钮仍只读取当前选择的 canonical `eligibility`，展示 cache 不能绕过门禁。

## 4. 状态表达

从当前混合空态拆分为互斥视图状态：

| 状态 | 呈现 | 下一步 |
| --- | --- | --- |
| catalog loading | 紧凑 skeleton/progress | 等待 |
| fatal catalog load error | 错误标题 + 原因 | Retry catalog |
| partial provider diagnostics | 列表上方 warning | Retry provider / 继续可用项 |
| filtered empty | 当前筛选摘要 | Clear filters |
| no selection | 详情占位与目录入口 | Browse templates |
| eligibility checking/blocked | 详情状态区 | 等待 / 修改选择 |
| preview error | 预览区域错误 | Retry preview |
| submitting | sticky action busy | 防止重复提交/退出 |

fatal load error 需要独立字段，不能再仅通过 `templates.length === 0` 与 `catalogDiagnostics` 推断，因为 diagnostics 也可能是带可用模板的部分失败。

## 5. 视觉与组件

- 搜索用 `ElInput`，provider 用 `ElSelect`，顶层 Template/JSON 和移动 Catalog/Details 用 `ElSegmented`，中屏目录用 `ElDrawer`，命令用 `ElButton`/图标按钮。
- 列表本体保留语义 listbox/option，以维持 roving keyboard；不强行用不匹配的菜单组件。
- 所有控件消费父主题 semantic token，overlay 继续挂到 `#workbench-overlays`。
- 页面 section 使用无框布局带，不把详情、预览和 footer 各自包装成浮卡。
- Runtime iframe 不继承 Workbench palette。

## 6. 预期文件范围

- `src/features/templates/components/TemplateCreationWorkspace.vue`
- `src/features/templates/types/` 与 locale messages（仅新增展示合同/文案）
- `src/styles/templates.css`
- `src/features/templates/__tests__/template-creation-workspace.test.ts`
- `e2e/template-management.spec.ts` 与父任务分配的模板视觉哨兵

Catalog/project/runtime service 原则上不修改；只有现有公开 helper 足以复用且不改变合同的情况下才做最小引用调整。

## 7. 测试设计

- View state：fatal error、partial diagnostics、filtered empty、no selection、checking/blocked、preview error、submitting 逐项测试文案和动作。
- Responsive：宽屏目录宽度；900 像素 rail + Drawer + preview 优先；390 像素 segmented 单窗格与 sticky footer。
- Keyboard：listbox roving、Enter 详情、Escape 返回/关闭 Drawer、Drawer 焦点恢复。
- Existing behavior：搜索、category/provider、selection、eligibility、preview race、Runtime revision、创建 disabled reason、重复提交。
- Theme/runtime：四 palette 的 Light/Dark 根/overlay 渲染与 Preview iframe computed-style 隔离。
- Visual：父矩阵中的 900/390 模板哨兵覆盖 zh/en 与 Light/Dark；不再单独乘出完整主题笛卡尔矩阵。

## 8. 回滚

布局 CSS、目录展示 metadata、状态表达分别保持在 Template feature 内。若 Drawer 或状态拆分破坏既有流程，回滚展示层而保留父主题 token；不得修改 Catalog/Eligibility/Runtime 合同绕过失败测试。
