# 配置与真实代码双向转换可行性

## 结论

配置与真实代码可以互相转换，但不应直接把 Babel AST 作为表单配置或持久化协议。

推荐的数据流是：

```text
Vue SFC / TypeScript / JSX source
  -> Vue SFC parser（仅 SFC）
  -> Babel parser
  -> 受限源码语义提取
  -> DesignerDocument
  -> 设计器、历史、诊断与 Runtime compiler

DesignerDocument
  -> 确定性代码生成器
  -> TypeScript / Vue source
```

`DesignerDocument` 继续作为唯一稳定领域 IR。Babel AST 只在一次解析或生成过程中使用，不进入业务存储、历史或公开配置协议。

## 仓库事实

- `DesignerDocument` 是版本化、严格、纯 JSON 的 `{ version, form, nodes }` 协议：`packages/ConfigForm/designer/src/document/types.ts:49`。
- 节点保留稳定 `id`、`kind`、`material`、声明式 conditions、validation 与 reactions；这正是代码往返所需的领域语义：`packages/ConfigForm/designer/src/document/types.ts:20`。
- 当前导入只接受 JSON 并调用 `parseDesignerDocument`，当前导出是 `JSON.stringify(document)`：`packages/ConfigForm/designer/src/composables/use-designer-controller.ts:331` 和 `packages/ConfigForm/designer/src/composables/use-designer-controller.ts:354`。
- Runtime 编译会把 material 变成真实 component、把条件 AST 变成函数、把 validation 变成 Zod/validator，因此 Runtime 节点无法一般性反编译回设计器文档：`packages/ConfigForm/designer/src/compiler/compile.ts:120`。
- 仓库已有 `@babel/parser`、`@vue/compiler-sfc` 与 `magic-string`。现有 devtools 使用 Babel 解析 TypeScript/JSX，再基于源码 range 做局部改写：`packages/ConfigForm/devtools-vite-plugin/src/source-inject/ast.ts:49`。

## 为什么不能直接使用 Babel AST

- Babel 输出的是 `File -> Program -> Node` 语法树，不是业务配置。
- AST 包含位置、注释、parser 元数据和大量语法节点，体积与版本耦合都高于领域文档。
- “语法可解析”不等于“无需执行即可求值”。变量引用、函数调用、spread、computed key、条件表达式和跨模块 import 都不能安全静态还原为纯 JSON。
- AST 不提供材料注册、slot 约束、字段唯一性、reaction 引用和文档迁移等 ConfigForm 领域规则。

## 推荐的首版能力边界

- 代码生成：从 `DesignerDocument` 确定性生成一个声明式 TypeScript 模块，并保留稳定 node id、material key、文档版本和生成器版本。
- 代码导入：只承诺读取本生成器产物，以及符合相同受限语法的手写对象字面量。
- 安全语法子集：静态 object/array、string/boolean/null/有限 number、静态 key，以及可透明剥离的 `as const` / `satisfies DesignerDocument`。
- 明确拒绝：函数调用、spread、computed key、任意 identifier/member 引用、函数、class、`new`、动态 import、带插值模板、条件/逻辑表达式、跨模块求值和赋值后 mutation。
- 所有提取结果仍必须经过 `parseDesignerDocument`、文档诊断和材料注册分析。
- 业务函数通过 registry key 或 code reference 接入，不把函数字符串写入 JSON，也不执行用户源码。

## 往返与冲突策略

- 首版目标是“配置语义等价”，不是逐字符保留源码格式。
- 生成区域应携带 provenance，包括 document version、generator version、IR hash 和稳定 node id。
- 用户自定义 imports、hooks 和函数放在生成器所有权区域之外，或通过受控引用注册表连接。
- 若后续允许设计器与代码同时修改，应使用 `base IR / designer IR / parsed code IR` 三方合并；同一路径双改、删除与修改冲突或越过生成边界时显式报冲突，不静默覆盖。
- 若必须保留不支持的源码片段，应存放在文档之外的 sidecar/source range 中；当前 strict `DesignerDocument` 不应承载任意 AST 或函数。

## Designer 产品边界

- 源码解析、生成和诊断只属于 Designer；Core、Headless、Renderer 和 Runtime 不依赖 Babel、Vue compiler 或代码编辑器。
- Designer 后续提供“设计 / Config / Source”三种工作视图。Config 显示规范化 JSON，Source 显示由同一 `DesignerDocument` 生成的声明式 TypeScript；切换视图不复制或分叉业务状态。
- 设计器操作成功提交后，Config 与 Source 同步刷新。若允许编辑文本，文本先进入独立 draft，不应在每次未完成的键入时修改文档和 history。
- 文本只有在解析、strict schema、registry analysis 和 diagnostics 全部通过后才能原子应用为新的 `DesignerDocument`；失败时保留最后一个有效画布并定位源码错误。
- Config / Source 的复制、下载、格式化和错误反馈可以共享工作区命令，但代码视图不应进入 Runtime 公共 API。

## 与当前任务的关系

本研究不改变 `08-27-config-form-designer-ux` 的实现范围。当前任务只需避免让工作区结构阻断下一阶段加入设计 / Config / Source 视图、模板库和保存入口；代码生成、源码解析、冲突合并和协议扩展应建立独立任务。
