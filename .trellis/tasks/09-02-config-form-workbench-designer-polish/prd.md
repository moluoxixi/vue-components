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
9. Designer 样式按公开组件拆分 Sass 入口，保留兼容的整包样式入口，并允许消费者按需引入单个组件样式；Designer 核心不得用宽泛的原生标签选择器覆盖 Provider 组件内部焦点样式。
10. Workbench 私有应用中的组件专属样式应跟随组件所有权，只有主题 token、Teleport/overlay、跨包 bridge 和跨组件响应式规则保留在全局入口。
11. 表单间距在 Inspector 中使用成熟数字控件，单位固定为 px，用户只能输入 0–64 的数字；持久化值保持规范的 `<number>px` 字符串并由模型 schema 校验。
12. 表单支持 0–480px 的整数标签宽度；Desktop、Tablet、Mobile 均可配置，Tablet 默认继承 Desktop、Mobile 默认继承 Tablet；设置进入 Project Model、Compiler/Vue backend 与真实 Runtime renderer，仅在左侧标签布局时控制标签列宽。
13. Desktop、Tablet、Mobile 复用同一个断点布局编辑组件，Columns、Field span、Label width 的顺序、DOM 和样式一致；Tablet/Mobile 仅额外提供 override 开关，在窄 Inspector 中不得溢出或形成重复边框。
14. 普通字段物料提供高层声明 API，由组件、默认值和属性描述自动生成 Runtime binding、Setter 与节点工厂；业务注册物料时不必创建具名 Registry layer，也不必手写 `createNode`。底层物料和 layer API 继续服务布局、复合子图与高级覆盖。

## 验收标准

- [ ] 1440/900/390、Light/Dark、zh/en 下无文本截断、遮挡、非预期横向滚动或不可辨识的关键动作。
- [ ] 900 像素四个指定入口有短文字且 Canvas 保持可见；390 像素顶栏、底栏与工具条触控和键盘均可达。
- [ ] Canvas、selection、drag、resize、camera、drop candidate、Preview 与 Runtime 几何/样式隔离回归通过。
- [ ] Designer 每个公开视觉组件都有独立 Sass 入口，整包入口保持兼容；按需入口不加载无关组件规则。
- [ ] 左侧物料搜索等 Element Plus 控件的内部 input 不再命中 Designer 原生控件 focus outline，焦点视觉只由 Element Plus 主题负责。
- [ ] Gap Inspector 仅接受数字并以 px 持久化；任意单位、负数和超上限值在模型边界被拒绝。
- [ ] 标签宽度可编辑、持久化、编译并在 Design/Preview Runtime 生效；顶部标签布局不应用固定标签列。
- [ ] 三个断点的 Columns、Field span、Label width 使用同一组件与视觉结构；响应式标签宽度按 Desktop→Tablet→Mobile 继承并在对应 Runtime 断点生效。
- [ ] Tablet/Mobile 的 Columns 与 Field span 在窄面板中保持完整可见并按 1–24 整数提交。
- [ ] 普通字段物料可通过一个声明对象完成注册，生成的节点默认值相互隔离，并继续通过真实 Provider 属性控件编辑；Element Plus 与 Ant Design Vue 使用对称的 `{ materials, layers, optionResolver }` Registry 入口。
- [ ] 设计器与 Workbench 受影响单测、typecheck、build、E2E、axe、视觉基线、lint 和 `git diff --check` 通过。

## 范围外

- 修改 Project Model、History、Command、RuntimeHost 协议或 Provider Runtime 业务样式。
- 重做拖拽、Camera、selection overlay、响应式命令业务接线。
- 新增通用 Base UI 抽象或第三套 UI 组件库。
