# ConfigForm 生产级 Low-Code IDE 实施计划

> 完成状态：2026-08-30 已完成实现、真实浏览器验收与全量质量门。可重复证据见 [`evidence.md`](./evidence.md)。

## 执行规则

- 本计划是一个完整生产交付，切片只是降低回滚风险；不得把任一中间切片作为任务完成。
- 每个切片遵循：先补 contract/regression test，再实现，再运行该切片验证。
- 不在旧 `App.vue` / `styles.css` 继续堆叠并行状态。迁移完成的职责必须从旧根组件删除。
- 任意发现会改变 PRD 产品行为时回到 planning，更新 PRD/design 并重新请求批准。

## 0. 开工与基线

- [x] 用户批准最终 PRD/design/implement 摘要后运行 `task.py start`。
- [x] 加载 `trellis-before-dev`，读取 ConfigForm frontend spec 与 cross-layer/code-reuse guides。
- [x] 记录当前 Workbench、Designer、Runtime、Core、Element/Ant adapter 的 test/typecheck/build 基线。
- [x] 保存 1440/900/390、Light/Dark、en/zh 的旧 UI browser evidence，作为结构回归对照而非视觉目标。
- [x] 建立生产 fixture：200 节点、三级 layout 嵌套、全部注册物料、flows、两页 application。

验证：

```bash
pnpm --filter @moluoxixi/config-form-core test
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form test
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
```

## 1. Registry 与投影契约

- [x] 扩展 `LowCodeComponentRegistration`，用完整 `source` adapter 替代单一 `sourceComponent`。
- [x] 把 props/events/bindings/slots/defaults/layout/designPolicy/runtime/source 的校验集中在 Registry bootstrap。
- [x] 为 Element Plus / Ant Design Vue 的全部 registration 补齐 source adapter、full-width 与 layout capability。
- [x] 增加 exhaustive registry contract suite：默认节点、schema、runtime mount、specimen mount、source emit、依赖、slots、events/bindings。
- [x] 修复 Designer readonly/render context 与 Runtime 的 props 合并差异，确保 registration defaults、node props、reaction props 顺序一致。
- [x] 禁止缺失 source/runtime contract 的物料进入可编辑 Registry。

切片门：

```bash
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer-element-plus test
pnpm --filter @moluoxixi/config-form-designer-antd-vue test
pnpm --filter @moluoxixi/config-form-designer typecheck
```

回滚点：registration 扩展保持旧 `sourceComponent` compatibility adapter，调用方完成迁移后再删除。

## 2. Workspace Session 与单一 Operation History

- [x] 新增 `WorkspaceSession`，接管 application/current page/model revision/dirty/save/conflict。
- [x] 定义应用级 operation envelope 与 transaction；复用现有 `applyModelOperation` 和 page reducer。
- [x] 实现 transaction inverse/undo/redo、batch 原子性、Inspector mergeKey 和跨页面 history 行为。
- [x] 将 Preview/Config/Source 的 snapshot/revision gate 收口到 ProjectionCoordinator。
- [x] 把 selection、panel、viewport、runtime values 明确放入 transient state。
- [x] 为 refresh/save conflict/volatile repository/migration error 建立可恢复状态。
- [x] 用 property tests 覆盖 operation -> inverse -> original、batch failure 原子性和 revision 单调性。

切片门：

```bash
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
```

回滚点：持久化 Application v2 不变；可切回现有 snapshot history。

## 3. 受控 Design Surface 与真实拖拽

- [x] 新建直接消费 `LowCodePageModel` 的受控 Design Surface；Workbench 不再通过 live `DesignerDocument` 驱动编辑。
- [x] 保留 RuntimeSurface + projected candidate model + editor bridge；删除 Workbench 路径中的 Designer standalone Preview/Import/Export/internal history。
- [x] 重构 Runtime DOM registration、ResizeObserver 与 overlay scheduler，确保每帧读写分离。
- [x] candidate 节点只加半透明样式；selection/drop/resize/empty target 全部在 overlay。
- [x] 继续使用真实 DOM sanitized clone 作为 fixed DragOverlay，统一 cleanup/cancel/drop/page switch/readonly。
- [x] 删除持久末尾空白格；实现 root、before/after、empty slot、last child、三级 nested sticky target。
- [x] Resize 根据 Registry capability 输出 span/size operation；多选输出单 transaction。
- [x] 完善 pointer、touch、keyboard drag 与 live region。
- [x] 用全物料浏览器 contract 比较 candidate rect 与 drop 后 rect，宽高容差 `<=1px`；覆盖 Date/Time full width。

切片门：

```bash
pnpm --filter @moluoxixi/config-form test
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @moluoxixi/config-form-designer build
```

回滚点：保留现有 drag controller/target resolver public contract；只替换 surface 组合和 scheduler。

## 4. Design-first Workbench Shell

- [x] 将 `App.vue` 拆为 host、session provider、shell 与 feature components。
- [x] 实现宽屏固定三栏和手工左右栏折叠；移除 Preview 驱动的 Designer 内部 responsive state。
- [x] 实现 Components/Layers/Pages panel；移除顶栏页面切换器。
- [x] Components 使用 lazy Runtime specimen；Layers/Pages 共享 session selection/operation。
- [x] Inspector 根据 Registry schema 生成，普通属性使用顶置单行 label 与下一行全宽 control，复杂 setter 保持全宽纵向布局。
- [x] 实现紧凑桌面 overlay panels 和移动端 bottom navigation/full-screen sheets。
- [x] 拆分 CSS tokens/scopes，避免 page section/card 嵌套和全局 selector 污染 Runtime。
- [x] 统一 icon button、tooltip、menu、focus、dialog primitives。

切片门：

- 组件测试覆盖 left tabs、panel collapse、Inspector rows、selection sync、mobile navigation。
- 浏览器检查 1440/900/390，无 overlap/overflow/text wrap，Canvas 操作在每个尺寸可达。

## 5. Preview Drawer 与运行态一致性

- [x] Preview 改为右侧 overlay drawer；默认 480px、可 resize、可 expanded，不参与三栏布局。
- [x] Preview 只消费 ProjectionCoordinator snapshot；移除 App 中重复 compiled/last-valid 状态簇。
- [x] Runtime values 按 stable field key 升级，新增/删除字段行为确定。
- [x] 实现 desktop/tablet/mobile、reset、submit、live/stale/error 状态。
- [x] 新 revision abort 旧 flow；关闭 Preview 释放 coordinator run。
- [x] 同 fixture 比较 Design/Preview 的 component tree、props、slot 和 responsive layout。

切片门：

```bash
pnpm --filter @moluoxixi/config-form test
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
```

浏览器必须证明 Preview 打开/expanded 均不触发 Designer 三栏退化。

## 6. Pages 与 Flow 工作区

- [x] Pages panel 统一切换/新建入口；Page Manager 保留完整 CRUD/home/route/order，并改为 session operation。
- [x] FlowDialog 改为 lazy-loaded feature；Core interpreter 和 Vue Flow controlled 模式保持。
- [x] 把 FlowWorkspace 的整数组替换 emit 改为细粒度 operation；node position 在 drag stop 提交一次。
- [x] 用 schema setter 配置 condition/reaction/action，JSON 仅作为高级只读诊断。
- [x] 补齐 action ref/field ref/reachability/branch/cycle validation 和错误定位。
- [x] 覆盖 resolve/reject/abort/timeout/latest/queue/ignore，确保 Preview 与 pure source trace 相同。

切片门：

```bash
pnpm --filter @moluoxixi/config-form-core test
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
```

## 7. Config Export

- [x] 把 Config snapshot/view state 从 App 移入 Export feature。
- [x] 默认生成 `defineFields<PageFormValues>() / defineField / defineFlow` TypeScript。
- [x] JSON/Tree 使用同一 immutable snapshot，保持只读。
- [x] 实现 stale banner/refresh/copy/download TS/download JSON。
- [x] 用 AST/parser round-trip 验证所有物料、slot、events、bindings、responsive 和 flows。
- [x] Export menu/labels 全部本地化并强制单行。

切片门：

```bash
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
```

## 8. Native Vue Source Generator

- [x] 建立 `SourceProject IR`、typed script/template printers 和 import/dependency collector。
- [x] 由 Registry source adapter 输出真实 Element Plus / Ant Design Vue component、v-model、props/events/slots/layout。
- [x] 删除 native input/select/layout switch 与 `materialName` 推断。
- [x] 生成完整多页面 Vue/Vite/router/project files 和纯 source flow runtime。
- [x] Source 工程移除 `page.model.json`、`form.config.ts`、Designer artifact 与全部 ConfigForm dependency/import。
- [x] Source snapshot 生成、文件树、Monaco、ZIP/Copy/Download 保持同 revision。
- [x] ProjectFileTree 覆盖 APG keyboard、focus/selection、folder/file、type-ahead 和 snapshot fallback。
- [x] Element/Ant 全物料工程执行 typecheck/build；关键 fixture 挂载并与 Preview 比较结构、props、layout、flows。

切片门：

```bash
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench verify:templates
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
```

回滚点：旧 generator 仅留在测试 fixture 做差异审计；新 generator 未全绿前 Export Source 不切换。

## 9. Theme、I18n 与响应式完成度

- [x] 拆分 IDE/runtime/overlay theme scope；IDE Light/Dark 不改变整个 Runtime viewport/Preview computed style。
- [x] Inspector adapter tokens 只限定右栏 setter scope。
- [x] 建立类型化 `en-US/zh-CN` Workbench catalog，清除所有硬编码 visible/aria/title 文案。
- [x] 合并 adapter material locale 与 caller overrides；语言切换/持久化/html lang 完整。
- [x] 接入现有 i18n-tool 的构建期校验，不接入浏览器运行时 Provider/API key。
- [x] 覆盖 1440/900/390 x Light/Dark x en/zh；菜单、顶栏、dialog、Inspector 不换行或溢出。
- [x] reduced-motion 与 touch targets 完成。

切片门：

```bash
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
```

## 10. 性能、可访问性与生产质量门

- [x] active adapter 动态加载；非当前 adapter 不进入初始路径。
- [x] Monaco、Vue Flow、Source Generator/ZIP 按 feature lazy load。
- [x] 运行 200 节点 benchmark：Model op p95 <=8ms、drag frame p95 <=16.7ms、Preview publish p95 <=100ms。
- [x] 用 `@axe-core/playwright` 跑模板弹窗、桌面 Dark/Light、390px Inspector、Flow 与 Source 导出；同时覆盖 focus trap/return focus、键盘 drag/tree/menu/tab/dialog、对比度和 reduced-motion。
- [x] 跑全物料 Design/candidate/Preview/Source visual/DOM contract。
- [x] 跑 repository migration/save/refresh/conflict/volatile/error recovery。
- [x] 浏览器 console/network 无未处理错误、重复请求或泄露翻译凭证。
- [x] 对全部受影响包执行最终 full-scope test/typecheck/build。

最终命令清单（按实际 workspace script 校正）：

```bash
pnpm --filter @moluoxixi/config-form-core test
pnpm --filter @moluoxixi/config-form-core typecheck
pnpm --filter @moluoxixi/config-form-core build
pnpm --filter @moluoxixi/config-form test
pnpm --filter @moluoxixi/config-form typecheck
pnpm --filter @moluoxixi/config-form build
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @moluoxixi/config-form-designer build
pnpm --filter @moluoxixi/config-form-designer-element-plus test
pnpm --filter @moluoxixi/config-form-designer-element-plus typecheck
pnpm --filter @moluoxixi/config-form-designer-element-plus build
pnpm --filter @moluoxixi/config-form-designer-antd-vue test
pnpm --filter @moluoxixi/config-form-designer-antd-vue typecheck
pnpm --filter @moluoxixi/config-form-designer-antd-vue build
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench test:e2e
pnpm --filter @config-form/workbench verify:templates
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm lint
pnpm test:config-form-packages
```

## 11. 收尾

- [x] 加载 `trellis-check`，按受影响 package spec 做 full-scope review。
- [x] 若出现重复修复，运行 `trellis-break-loop` 并记录根因。
- [x] 更新 ConfigForm frontend spec：唯一 Model、Registry、RuntimeSurface overlay、Source adapter 与 theme boundary。
- [x] 提交产品代码与规范；运行 `trellis-finish-work` 归档任务并记录 journal。
- [x] 只有 AC1-AC13 全部有可重复证据后才通知用户完成。

## 高风险文件与预期替换

- `packages/ConfigForm/workbench/src/App.vue`：从 1599 行 orchestration root 收缩为 host composition。
- `packages/ConfigForm/workbench/src/styles.css`：拆分并移除 Preview/Designer 双重响应式规则。
- `packages/ConfigForm/designer/src/components/ConfigFormDesigner.vue`：兼容 facade，不再承载 Workbench 产品布局。
- `packages/ConfigForm/designer/src/components/DesignerCanvas.vue`：保留 Runtime candidate 核心，拆分 overlay scheduler/geometry/interaction。
- `packages/ConfigForm/workbench/src/project/export/source.ts`：替换 native HTML switch 为 typed Source IR + Registry source adapters。
- `packages/ConfigForm/workbench/src/components/FlowWorkspace.vue`：从 full-array emit 改为 controlled operation output。
- `packages/ConfigForm/workbench/src/components/WorkspaceCodeEditor.vue`：保留 Monaco wrapper，移出业务 snapshot 状态。
