# ConfigForm Workbench 设计器视觉精修

## 目标

在不改变 ConfigForm 设计器领域交互与 Runtime 几何的前提下，把现有 Workbench 设计器精修为可长时间高频使用的专业 IDE：提升排版、层级、Canvas framing 与中小屏命令发现性。

## 上下文

- 父任务：`09-02-config-form-workbench-ui-polish`。
- 既有组件化与无障碍任务已经完成 Element Plus chrome、Tooltip、响应式 overflow、移动底栏、Camera 和视觉基线；本任务不重复迁移，也不回退既有合同。
- 当前主要短板是 900 像素编辑入口不够自解释、390 像素顶栏依赖图标、Dark 壳层与白色 Runtime sheet 反差过强，以及宽屏局部 9 像素文字难扫读。

## 需求

1. 保留现有四区工作台、Canvas 中心地位、面板职责和真实 Runtime iframe，不重做状态、命令或拖拽架构。
2. 建立 12–13 像素为主的紧凑排版层级，修正 9 像素导航/元数据；文字不得随 viewport 缩放，字距固定为 0。
3. 使用父主题任务提供的语义 token 统一面板、控件、边界、选中、焦点和状态反馈，不在局部硬编码品牌色。
4. 仅调整父文档中的 Canvas framing 与周边层级，弱化 Dark 壳层对白色 Runtime sheet 的突兀反差；不得向 Runtime iframe 注入 Workbench 主题，也不得改变几何超过 1 像素。
5. 900 像素为保存、导出、组件和属性使用图标加本地化短文字；其余命令保持图标、Tooltip 或 More 菜单。
6. 390 像素顶栏保持紧凑图标，五项底部导航保留文字；粗指针关键命中区不小于 44×44 像素。
7. 所有命令继续使用既有 emit、快捷键、ARIA、disabled reason、Tooltip、focus restoration 和 overlay 约定。
8. 属性配置中的枚举、布尔、数值等通用模式优先采用与数据类型匹配的成熟组件；不得在 UI 库无关的 Designer 核心倒灌 Element Plus。

## 验收标准

- [ ] 1440/900/390、Light/Dark、zh/en 下无文本截断、遮挡、非预期横向滚动或不可辨识的关键动作。
- [ ] 900 像素四个指定入口有短文字且 Canvas 保持可见；390 像素顶栏、底栏与工具条触控和键盘均可达。
- [ ] Canvas、selection、drag、resize、camera、drop candidate、Preview 与 Runtime 几何/样式隔离回归通过。
- [ ] 设计器与 Workbench 受影响单测、typecheck、build、E2E、axe、视觉基线、lint 和 `git diff --check` 通过。

## 范围外

- 修改 Project Model、History、Command、RuntimeHost 协议或 Provider Runtime 业务样式。
- 重做拖拽、Camera、selection overlay、响应式命令业务接线。
- 新增通用 Base UI 抽象或第三套 UI 组件库。
