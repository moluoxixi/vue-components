# 配置化表单设计器中宽属性区修复

## 目标

修复 Designer 在中宽容器中把 Properties 排到 Canvas 下一行的问题。桌面保持三栏，medium 使用不阻断画布选择的侧滑 Inspector，narrow 保持 Palette / Canvas / Properties 三视图；属性编辑控件在有限宽度内保持紧凑、清晰且可访问。

## 当前事实

- Designer 已使用根容器 `ResizeObserver` 判定 `desktop / medium / narrow`，不再依赖浏览器 viewport：`packages/ConfigForm/designer/src/components/ConfigFormDesigner.vue:67`。
- desktop 已支持 Materials / Properties 独立收起，narrow 已使用三个 roving tabs；弹窗焦点、真实半透明拖拽预览和清晰投放边界已在前序任务完成。
- medium CSS 当前固定为 `"palette canvas" / "properties properties"` 两行，并让 Properties 占 `34%` 高度：`packages/ConfigForm/designer/src/styles.scss:1329`。
- 实际 Workbench 中 Designer 宽约 `887px` 时，Canvas 高约 `674px`，Properties 被放到 `y≈802px`，Designer 总高度增长到约 `1094px`，形成额外纵向滚动链。
- 现有 Playground E2E 把 `properties.y > palette.y` 当成正确断言，需要随修复更新：`packages/ConfigForm/playground/e2e/config-form-playground.spec.ts:1053`。

## 需求

### R1. 中宽工作区

- `721..1100px` 时 Canvas 始终占据唯一工作区行，Properties 不得下置、换行或增加 Designer 总高度。
- Materials 与 Properties 作为互斥 overlay drawer；Materials 从左侧进入，Properties 从右侧进入。
- drawer 为非模态：不设置 `aria-modal`、不让 Canvas `inert`、不使用遮罩；用户可在 Properties 打开时继续选择 Canvas 节点，Inspector 随选择更新。
- drawer 提供明确关闭按钮和 Escape 关闭；关闭后只在焦点没有转移到 Canvas 或其他有效控件时恢复触发器焦点。
- drawer 隐藏时使用现有 `hidden + inert` 契约保持组件实例、active property tab 与滚动位置，不通过 `v-if` 重建。

### R2. 属性字段布局

- 右侧 Inspector 保持稳定宽度；字段 label 不允许任意换行挤压 control。
- 空间不足的 setter 采用紧凑纵向行：单行 label 省略、完整 `title`/accessible name、control 独占下一行。
- Properties 自身是唯一纵向滚动容器，不在 setter 列表内制造嵌套滚动。

### R3. 属性 Tabs

- Properties / Validation / Conditions / Reactions 使用完整 tab / tabpanel 关联。
- 支持 roving `tabindex` 和 Left / Right / Home / End；切换 tab 不改变选中节点或文档 history。

### R4. 兼容与测试

- 不修改 `DesignerDocument`、controller/history、compiler、registry、公共 props/emits/expose 或双 adapter 契约。
- 更新 medium 单测与 Playwright 几何断言，删除“Properties 必须位于 Canvas 下方”的旧预期。
- Chromium 覆盖 Element Plus 与 Ant Design Vue 的 drawer、Escape、Canvas 继续选择、无横向溢出和截图。
- Designer 单测、类型检查、构建和 Workbench 嵌入回归通过。

## 验收标准

- [ ] AC1：medium 时 Canvas、Materials/Properties drawer 位于同一垂直工作区，Properties 不产生第二行，Designer 高度不因打开面板增加。
- [ ] AC2：任意时刻最多一个 drawer 可见；打开 Properties 后仍可选择 Canvas 中其他节点并看到 Inspector 更新。
- [ ] AC3：Escape 和关闭按钮正确收起 drawer，`hidden`、`inert`、`aria-expanded` 与焦点恢复一致。
- [ ] AC4：属性 label/control 在 desktop、304px drawer 和窄屏中不发生破坏性换行、裁切或横向溢出。
- [ ] AC5：属性 tabs 的 ARIA 与键盘模型通过自动化断言，切换不产生文档命令。
- [ ] AC6：desktop 三栏与 narrow 三视图无回归，双 adapter 浏览器场景通过。

## 非目标

- 不在本任务实现 Source / Config provider、流程引擎或项目数据模型。
- 不重做 DesignerDocument、Runtime validation 或 material adapter。
- 不新增模态 drawer、遮罩、嵌套卡片或第二套侧栏入口。
