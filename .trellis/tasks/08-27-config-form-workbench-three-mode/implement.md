# Design-first 低代码 IDE 实施计划

## 实施顺序

1. [x] 定义版本化 Config Model、Registry schema、diagnostic、migration 和只读 projection 类型；补 schema/legacy migration 测试。
2. [x] 提取 Config Model Store 与 insert/move/update/resize/duplicate/remove/batch reducer，以 inverse operation 实现 Undo/Redo。
3. [x] 将现有 Material Registry 适配为统一 Component Registry，补 props/events/bindings/slots/defaults 元数据和双 adapter 一致性测试。
4. [x] 重构 Designer controller 使用 Model Store；保留拖拽、排序、嵌套、复制、删除和键盘操作，删除旧 document 双写入口。
5. [x] 实现 Canvas/Layers 共享多选、selection overlay、批量 operation 与布局 Resize handle。
6. [x] 实现 Registry-driven ConfigForm Inspector，覆盖页面级、单选、多选 mixed value、events 与 bindings。
7. [x] 重建 Workbench 三栏 IDE Shell、左侧 Components/Layers/Pages、面板隐藏、焦点迁移和 Light/Dark token。
8. [x] 统一 Runtime Renderer 与 revision-tagged Preview，实现可调整宽度/全屏的右侧实时分屏，保留 last-valid、viewport 与 runtime diagnostics。
9. [x] 实现单一导出下拉菜单与大尺寸只读预览弹窗，提供 Config JSON/Tree、Generated Vue Source readonly Monaco、复制/下载/项目导出；删除 Source/Config 编辑 provider。
10. [x] 升级 repository/template schema：Config Model 为权威，生成文件为 export/cache；补旧项目一次迁移与生成项目真实性验证。
11. [x] 补 desktop/medium/390px 浏览器交互、双 adapter、Dark Mode、无横向溢出和截图回归。

## 预计模块边界

- `packages/ConfigForm/designer/src/model/`：Config Model、schema、operations、history、selection。
- `packages/ConfigForm/designer/src/registry/`：统一 Component Registry 契约与现有 material adapter。
- `packages/ConfigForm/designer/src/components/`：Design Stage、Layers、Schema Inspector、Resize/Multi-select chrome。
- `packages/ConfigForm/workbench/src/ide/`：IDE Shell、theme、left panel、Preview split pane、export menu/dialog。
- `packages/ConfigForm/workbench/src/generator/`：JSON、Vue Source 与 project generator。
- `packages/ConfigForm/workbench/src/project/`：Model persistence、legacy migration、export。
- `packages/ConfigForm/workbench/src/App.vue`：只保留项目/页面选择与 IDE shell wiring。

## 验证门禁

```powershell
pnpm --dir packages/ConfigForm/designer test
pnpm --dir packages/ConfigForm/designer typecheck
pnpm --dir packages/ConfigForm/designer build
pnpm --dir packages/ConfigForm/workbench test
pnpm --dir packages/ConfigForm/workbench typecheck
pnpm --dir packages/ConfigForm/workbench build
pnpm --dir packages/ConfigForm/workbench verify:templates
pnpm --dir packages/ConfigForm/playground typecheck
pnpm --dir packages/ConfigForm/playground test:e2e -- --grep "designer|workbench"
pnpm lint
git diff --check
```

## 风险门

- Model core、Registry 和 Operation 必须先有纯测试，再迁移 Designer UI。
- 不在常规状态流继续调用 `parseDesignerConfig` 或从 Generated Source 回投影 Model。
- 不把 selection、panel、theme、Preview form values 或 Monaco model 写入 Config Model。
- 不接入流程引擎、任意 DOM、自定义源码组件或用户函数。
