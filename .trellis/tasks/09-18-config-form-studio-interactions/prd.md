# 实现 Studio 原型交互与体验模式

## 目标

让设计师在不编写业务函数、不调用接口的前提下完成可运行的高保真本地交互，并让设计态、体验态和导出源码保持一致。

## 前置条件

- Surface 基础、Studio 资产管理、Dataset 和业务物料子任务已完成。

## 需求

- R1：Inspector 增加 `interaction` 区域，并提供页面级交互总览、依赖与诊断，不提供流程图。
- R2：默认可视化编辑条件，高级模式编辑安全表达式；两者使用同一 AST、确定求值
  语义和诊断合同，包括 own property/prototype 防护、missing/coalesce、类型严格比较、
  boolean condition、有限算术、JSON-safe 函数以及 32 深度/256 节点上限。
- R3：状态表达式持续计算 visible/disabled/readonly/required 和物料白名单展示属性；
  相同 normalized target 只允许一条规则，有规则时动态值覆盖静态 baseline。
- R4：值动作在依赖字段变化后按 interactions 声明顺序执行 set/copy/clear，初始化时
  不执行；同 target 多写给 warning 且 last write wins，一个事务后统一重算。
- R5：语义激活器只允许一个主要动作：navigate、back、open、close-current、close-all。
- R6：主要动作可配置执行前校验；失败聚焦错误且不执行动作。
- R7：为 foundation 已定义的 Surface 参数和具名输出提供作者 UI；调用点使用固定值或安全表达式映射，返回结果通过 Prototype Runtime 原子写入调用者字段。
- R8：Experience UI 接入 foundation 已完成的页面历史和无静态深度上限 overlay instance 栈；每次 open 继续使用其唯一实例和独立表单状态，不复制会话 reducer。
- R9：同一 Surface 可重复或循环打开，但只能由用户语义动作触发，禁止加载时自动 open。
- R10：设计模式聚焦当前 Surface；体验模式执行真实页面、浮层、焦点、遮罩、ESC、返回和重置行为。
- R11：交互入口可选择已有目标 Surface，或在一个可撤销事务中创建、绑定并打开新的 Dialog/Drawer；资产任务只提供通用 Surface 命令。

## 验收标准

- [ ] AC1：静态必填直接开关、动态必填、显隐、禁用、只读和值联动均可创作和预览。
- [ ] AC2：非法表达式保留草稿、精确报错、暂停规则并阻止体验与导出，不静默回退旧值。
- [ ] AC3：值联动循环被稳定诊断；同目标多写显示警告并按明示顺序确定执行结果。
- [ ] AC4：Page -> Dialog -> Drawer -> 同一 Dialog 等重复/循环用户打开路径实例隔离、可逐层关闭。
- [ ] AC5：ESC、mask、关闭按钮只关闭栈顶实例并将焦点还给 opener；返回在无浮层时回退页面历史。
- [ ] AC6：具名结果一次事务写回多个字段并只触发一次后续联动计算。
- [ ] AC7：设计/体验 E2E、Runtime、Compiler、协议和可访问性测试通过。
- [ ] AC8：表达式测试覆盖 inherited/forbidden path、missing、严格深比较、短路、同型
  排序、函数参数、非 boolean condition、除零/非有限结果和 AST limits，且 Preview 与
  Source 结果一致。

## 范围外

- 不提供原始事件名、任意函数、动作链、延时、并行、重试、事务编排或 HTTP。
- 不通过 iframe RPC 把组件参数转发给 Studio 动作注册器。
- 不重新实现或改变 Prototype Runtime v1 的页面历史、实例栈和主要动作 reducer 公共合同。
