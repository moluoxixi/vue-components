# Preview 响应式与层级穿透复盘

## 1. 根因分类

- **分类**：B - 跨层契约；D - 测试覆盖缺口。
- **具体原因**：Runtime 的 responsive layout 由 `--mx-config-form-active-columns` 与
  `--mx-config-form-active-span` 控制，但 Preview 只在外层滚动区域建立 container query，没有把实际改变宽度的
  `.preview-stage` 设为尺寸所有者。与此同时，Design editor 没有独立 stacking context，选中节点操作条的高
  `z-index` 可以穿过 sibling Preview。

## 2. 为什么早期修复未完成

1. 只给窄 Preview 调小 grid gap：缓解密度，但没有切换 Runtime 的 responsive variables。
2. 只检查字段 rect 与 stage：能证明 layout cell 没溢出，却看不到 Designer node actions 正在 Preview 上方绘制。
3. 只在默认模板验证：没有先选中 Canvas 节点，遗漏了仅在 selection overlay 出现时触发的层级冲突。

## 3. 预防机制

| 优先级 | 机制 | 具体动作 | 状态 |
| --- | --- | --- | --- |
| P0 | 架构 | `.preview-stage` 成为 named inline-size container，直接复用 Runtime tablet/mobile variables | DONE |
| P0 | 架构 | `.editor-pane` 建立 stacking context，Preview 作为更高 sibling overlay | DONE |
| P0 | E2E | 900px 下先选中节点，再打开 Preview 并点击真实 Select | DONE |
| P1 | 模板 | 内置 Profile 模板声明 tablet/mobile responsive defaults | DONE |
| P1 | 规范 | 记录 stage 所有权、断点、变量和 overlay isolation 合同 | DONE |

## 4. 系统性扩展

- **相似问题**：Page Manager、Flow、Export 等 overlay 也必须由稳定 sibling layer 隔离，不能只依赖不断增大的
  `z-index`。
- **设计改进**：Preview 不实现第二套 grid；它只选择 Runtime 已计算的 desktop/tablet/mobile variables。
- **流程改进**：视觉验收必须同时覆盖几何、computed style、hit testing 和真实控件交互。

## 5. 知识沉淀

- [x] 更新 `config-form-designer/frontend/quality-guidelines.md`。
- [x] 添加静态 CSS contract、模板 contract 和 Playwright 交互回归。
- [x] 将复盘和验证结果纳入当前任务归档材料。
