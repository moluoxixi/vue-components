# ConfigForm Designer 结构治理

## 目标

把 ConfigForm Designer 从大型编排组件和带逻辑 barrel 重构为可查阅、可独立测试的职责模块，同时保持公开 API、编辑命令、Runtime 投影、样式与用户交互不变。

## 背景

- `DesignerCanvas/index.vue` 当前 1657 行，同时承担 Camera、Runtime bridge、drop targets、selection、drag、resize、toolbar/menu、overlay 和生命周期清理。
- `DesignSurface/index.vue` 691 行，混合 workspace/focus、controller/session 装配、命令适配和快捷键；`DesignerPropertyPanel/index.vue` 597 行，混合 projection、setter 写入和 tab/focus 状态。
- 两套 Designer adapter 共有 7 条 `feature.index-barrel-only` debt，原因是 `materials/*/index.ts` 同时承载 bindings/defaults/setters/source 运行逻辑。
- 两套 adapter 的 Runtime material、OptionSource/ChoiceDefault setter 与 OptionState 都只被 `materials` Feature 使用；Antd readonly content 只被 `readonly` Feature 使用，当前却位于包级 `src/components/`。

## 需求

1. 将 Canvas Camera、Runtime/geometry bridge、drop-target resolution、selection、node drag、resize 与 menu/overlay 状态拆入 `DesignerCanvas/composables/`，保持纯几何和 drag 算法位于既有 services/utils。
2. 将 Runtime 渲染、selection/resize overlay、node toolbar/menu 和 drag visual 等可视区域拆入 `DesignerCanvas/components/`；子组件只能通过 typed props/emits/callbacks 消费父级能力。
3. `DesignerCanvas/index.vue` 只保留 props/emits、session 注入、composable 组装和模板编排，不直接拥有成组 window/pointer/keyboard 监听逻辑。
4. 为 Camera 计算与快捷键、Space pan、Runtime node register/unregister、external geometry re-anchor、selection modifier、menu focus/Escape、resize commit/cancel 和 teardown 补行为回归，再移动实现。
5. `DesignSurface` 拆出 workspace/focus 与 command/shortcut composables；保持 controller/session provider、public slots/expose 和 Workbench consumer 合同不变。
6. `DesignerPropertyPanel` 拆出 projection/setter state 与 tab/focus composables；`DesignerPalette` 拆出 drag lifecycle，保持其双 consumer 和 slot scope 不变。
7. 两套 adapter 将 bindings/defaults/setters/source 逻辑移入 `materials/constants|defaults|services`；`index.ts` 只做真实责任 barrel，不保留旧目录 forwarding shim。
8. 将所有 material-only Runtime/setter/OptionState 组件移入各自 `materials/components/`，readonly-only 组件移入 `readonly/components/`，删除无真实跨 Feature consumer 的包级 components barrel。
9. 清零 `config-form-designer-structure-governance` 的 7 条 debt，不新增组件 owner、barrel、深导入或循环依赖问题。
10. 继续遵守 current-contract-only，不新增 legacy alias、兼容目录或第二套编辑状态。
11. 验证用 production build 不得改写 Git 跟踪的自动组件声明；开发态仍通过 Vite `serve` 更新声明。

## 验收标准

- [x] Designer 家族生产文件不存在 P0/P1 热点（单文件不超过 800 行），入口组件职责可由目录直接识别。
- [x] 7 条目标 architecture debt 全部删除，unknown/stale 诊断为零，adapter 私有组件均位于真实 material/readonly Feature 下。
- [x] `DesignSurfaceProps/Emits/Slots/Expose`、PropertyPanel、Palette、Registry 工厂及两套 adapter package exports 不变。
- [x] Canvas 新回归覆盖 camera、Runtime registration、drop/selection/menu/resize 与清理边界，现有 drag/session/style/adapter 测试继续通过。
- [x] Designer 三包 test/typecheck/build、ConfigForm package smoke、Workbench unit/templates/build/E2E、全仓 lint/typecheck/architecture tests 和 `git diff --check` 通过。
- [x] Workbench 与组件 Playground 的 production build 不再并发改写源码声明，生成文件保持无 diff。

## 范围外

- 不重构 Model/Compiler/Runtime/Workbench 内部实现。
- 不改变 Designer 视觉设计、交互语义、项目协议或公开 Registry/Material API。
- 不在本批提取跨 adapter 公共算法；只有确认稳定且至少两个消费者的能力才进入后续复用任务。

## 关键决策

- 拆分依据是状态/生命周期所有权和依赖方向，不按行数平均切割。
- 依赖固定为 `types/services/utils <- composables <- private components <- index.vue <- DesignSurface`。
- `useDesignerController` 与 Registry 已有清晰 domain/service 边界，本批不再次拆散。
- 没有待用户决定的产品、兼容性或交互问题。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
