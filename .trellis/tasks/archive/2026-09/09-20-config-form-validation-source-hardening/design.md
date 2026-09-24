# 技术设计：校验合同、属性稳定性与原生源码导出

## 1. 设计目标

本次改动同时修正三个相互关联但必须分层负责的问题：

1. Designer 属性编辑是作者工作流，短暂的编译失败不能卸载作者界面。
2. Required 是字段状态，不是通用 RuleSet refinement，必须独立建模。
3. Raw Vue 是工程师接管的原生源码，不能把 ConfigForm 或 Zod 校验运行核心带入生成项目。

产品仍只负责 UI、布局、校验和全模拟数据交互；不恢复事件编辑、事件转发、任意 JavaScript、HTTP 或业务函数桩。

## 2. 合同与版本硬切

### 2.1 字段合同

字段节点统一采用：

```ts
interface SurfaceFieldNode {
  required?: boolean
  requiredMessage?: string
  validation?: RuleSetV2
  validateOn?: ValidateTrigger | ValidateTrigger[]
}
```

`requiredMessage` 只有在 `required === true` 时参与运行行为；Reader 仍接受它作为可编辑字段级文案，避免切换 Required 时丢失用户输入。动态 `required` 状态投影在运行时覆盖静态 `required` 基线，不回写持久化节点。

`ProjectNodePatchValues`、`FieldNodeSettings`、Canonical field IR、Runtime renderer field、Source plan 和相关 Reader/strict-key guard 同步增加这两个字段。

### 2.2 RuleSet v2

- 从 `RuleDescriptor`、parser、Zod 转换、编译结果和 Designer 规则列表彻底删除 `kind: 'required'`。
- 从 `CompiledRuleSet` 删除 `required`、`requiredMessage`，删除 optional/required 冲突和 Required refinement。
- 不增加旧 RuleSet 读取、迁移、别名或兼容分支。
- `custom` 继续是生产 Runtime 可注入能力；Studio Raw 源码对它 fail closed，不生成业务函数占位。

### 2.3 原子版本矩阵

| 合同 | 当前 | 目标 |
| --- | ---: | ---: |
| RuleSet | 1 | 2 |
| ProjectDocument | 6 | 7 |
| SurfaceGraph | 1 | 2 |
| Canonical Project IR | 5 | 6 |
| Compiler | 6.0.0 | 7.0.0 |

Registry v3、SourceFileSet v1、Project transfer 外层、Runtime Host 外层协议不升版：它们的自身 shape 未变，内部 Project/IR 版本已经严格拒绝混用。所有 Writer、Reader、fixture、模板、协议 guard 和测试必须在同一改动中切换。

## 3. Designer 属性与校验体验

### 3.1 valueKind 投影

校验编辑器不再自行猜测 string。Material 的 `DesignerDefaultValueKind` 通过 setter 投影到校验能力：

| valueKind | Rule base / 能力 |
| --- | --- |
| `text` | `string` 及字符串规则 |
| `number` | `number` 及数值规则 |
| `boolean` | `boolean`，首版不提供通用 refinement |
| `date` | `date` 及日期规则 |
| `time` | 首版只开放 Required、Required message 与 `validateOn` |
| `select` | 由静态 options 可精确表达时使用 enum/literal；否则只开放 Required |
| `multiselect` | 首版只开放 Required |

`time` 的实际值是 `HH:mm:ss` 字符串，不能伪装为带日期语义的 `date` RuleBase。不在本次为 time 或多选扩展新 RuleBase。通用规则编辑只在单选且类型可准确表达时出现；多字段选择仍可批量编辑 Required 与 Required message。规则种类按 base 过滤，不能创建与 base 不兼容的规则。

### 3.2 Required UI

Validation 区域固定将 Required 开关和 Required message 作为字段级控件展示，位于通用 Rules 之前。Required 不出现在“Add rule”选项。关闭通用 validation 不影响 Required；关闭 Required 不删除 message，重新开启可恢复文案。

### 3.3 中间状态

- 输入控件先在本地维护可编辑 draft，只在值满足合同时提交 Model command。
- 非法 regex flags、空 date bound、无效 multipleOf 等不会向 Model 写入 `undefined` 或非法 JSON。
- 业务值暂时不满足 Required、长度、范围、格式或 compare，不是 artifact 编译错误；这些规则只在 change/blur/submit 时执行。
- 默认值与声明 base 的基础类型不兼容仍产生可定位诊断，因为这是结构/类型错误，而非业务校验失败。

### 3.4 属性控件与权威模型收敛

属性表单可以维护本地输入状态，但 Model command result 和当前 graph 是权威来源。提交成功时按新 graph/revision 收敛；提交失败时立即回填权威值并保留 command diagnostic。不能只监听“值发生变化”，因为被拒绝命令不会产生新 graph。

空字符串、`0`、`false`、空数组和 `null` 必须按字段合同分别处理；删除使用显式 clear/unset intent，不能通过 truthiness 推断。

### 3.5 Options 能力与引用完整性

Material/Provider 为选择类 setter 声明允许的 option value 类型，Options 编辑器和默认值编辑器消费同一能力。Provider 不可渲染的类型不进入 ProjectDocument。

Options、基于 options 的 enum/literal validation 与默认值更新必须通过一个 Project command 原子提交。option value 变化时同步重算 validation base；新 options 无法继续表达现有 base 时清除完整 validation。若被引用 option 被删除或 value 改名，同一命令清除受影响默认值并返回明确的非错误提示。该命令只产生一个历史条目，一次 Undo 同时恢复 options、validation 与默认值，不得发布陈旧规则或悬空引用。

## 4. Workbench 稳定性与诊断所有权

### 4.1 最后成功 artifact

`WorkbenchDesignSession` 分离三类状态：当前 graph/current compilation、最后成功 runtime artifact、当前 compile diagnostics。一次编译失败时：

- 保留当前 graph 和最后成功 artifact；
- 更新 compile diagnostics；
- 不把 runtime artifact 清空；
- 后续合法编辑成功后原地替换 artifact 并清除对应 compile diagnostics。

Workbench 作者外壳的挂载由项目/Surface 会话决定，不由 `designRuntime` 是否存在决定。有最后成功 artifact 时 Canvas 继续显示；首次无 artifact 时 Canvas 显示稳定错误态，但 Layers、Inspector、Properties/Validation tabs 和修复命令保持可用。

### 4.2 诊断通道

command diagnostics 与 compile diagnostics 分开存储、组合展示。`execute`、undo、redo 或 jump 的空 command diagnostic 不得覆盖订阅回调同步产生的 compile diagnostic。每个通道只清理自己拥有的状态。

### 4.3 Runtime Host plain-data 边界

Runtime Host 中承载 `ModelJsonObject` 的状态使用 `shallowRef`，每次赋值仍先通过 `cloneWorkbenchJson` 获得 detached plain JSON。Vue 只能跟踪根引用，不能把嵌套 JSON 包装成 Proxy 后传给 Core/Headless。Core 不引入 Vue，也不使用 `toRaw` 修补调用方泄漏。

## 5. Vue backend 运行投影

- Vue backend 从 Canonical field 直接投影 `required` 和 `requiredMessage`。
- `compileRules` 只负责 RuleSet v2 的 schema/refinement 与 custom/compare validator。
- 删除用完整业务 schema 否决 `defaultValue` 的 `diagnoseDefaultRules` 行为；改为仅检查 defaultValue 与 base 的基础类型兼容性。
- Runtime 继续按照字段级 `validateOn` 调度 Required 与普通规则，并保持动态 Required 覆盖静态值。

## 6. Raw Vue 本地校验生成

Generator 内部可以调用 RuleSet parser/compiler做输入预检，但 Raw 文件不得导入它们。每个 Surface 生成本地 `validation.ts`（或等价的项目内模块），为字段输出具名直接函数；`Surface.vue` 只调用这些本地函数。

生成器直接覆盖 string、number、boolean、date、enum、literal、optional、nullable、内建规则与 compare。Required 从字段一级合同生成。错误消息采用用户消息或 Source 自有的稳定默认文案，不依赖 Zod locale。`multipleOf` 使用十进制位数缩放后的整数比较。

Raw 的运行依赖白名单为 `package.json.dependencies` 与应用运行时裸包 import 中的 `vue`、`vue-router` 和 resolver 返回的目标 UI 库。Vite、TypeScript 等构建期 `devDependencies` 合法；任何运行时 `@moluoxixi/*`、`@config-form/*`、`zod` 或内部 Runtime 依赖都属于架构失败。

## 7. 双导出独立结果

拆分 resolver：

```ts
interface SourceComponentResolver { adapter; resolveComponent(...) }
interface SourceConfigFormBindingResolver { resolveConfigFormBinding() }
```

Raw 输入只依赖 component resolver 与 resource reader；binding 输入额外依赖 binding resolver。Workbench snapshot 对每种模式保存判别联合：

```ts
type ExportArtifact<T> =
  | { status: 'ready'; files: T }
  | { status: 'failed'; diagnostics: readonly ModelDiagnostic[] }
```

两种产物仍绑定同一 compilation identity，避免展示不同修订；但 mode-specific 失败不再抹掉另一种成功产物。Workbench、Source 规范与导出 UI 已同步采用独立 `ready | failed` 合同。

## 8. 兼容、回滚与风险

- 这是 pre-1.0 current-contract-only 硬切，不迁移现有 v6 Project 或 RuleSet v1 数据。
- 回滚只能整体回滚版本矩阵和所有消费者，不能保留双 shape。
- 最大风险是跨包 fixture 漏升版、Designer 多选能力投影错误，以及生成校验与 Runtime 语义漂移；分别用严格 Reader 负例、双 Provider 浏览器矩阵和执行式 parity/消费工程测试控制。
- 实现过程中若发现需要 array RuleBase、业务函数或新的动态校验语义，停止扩 scope，记录后续任务。
