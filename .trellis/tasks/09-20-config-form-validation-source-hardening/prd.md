# 修正校验合同、属性稳定性与原生源码导出

## 目标

修复属性面板在编辑校验等配置时导致整个设计面卸载的稳定性问题；将必填从通用校验规则中提升为字段级独立能力；让 Raw Vue 源码成为可由程序员直接接管、无需 ConfigForm 或其他内部包即可运行的原生 Vue 项目。

## 用户价值

- 设计者连续编辑文本、布尔、数字等不同字段的属性与校验时，设计器保持可用，不因暂时无效的中间状态消失或报 DOM 错误。
- UI 设计师能直接理解并配置“是否必填”和必填提示，不需要在通用规则列表里寻找。
- 程序员拿到 Raw Vue 产物后，只需面对 Vue、路由和所选 UI 库的常规代码，不必理解或安装 ConfigForm、Zod 转换器等内部实现。

## 已确认事实

- 当前布尔字段启用校验时，设计器固定写入字符串基础规则；编译失败会清空 design runtime，Workbench 随后卸载整个 DesignSurface，并在 Switch 点击过程中触发 `Cannot set properties of null (setting 'checked')`。
- 当前文本字段添加 Required 时，空默认值会被 Vue backend 当成致命编译错误；业务校验尚未通过不应阻止设计和运行时产物生成。
- 当前修改字段默认值还可能触发 `RUNTIME_RENDER_FAILED: Failed to execute 'structuredClone'`；Runtime Host 使用深响应式 `ref` 将 JSON 模型重新包装成 Vue Proxy，再把 Proxy 越过边界交给框架无关 Core。
- 当前属性命令被拒绝时，属性控件的本地值不会回滚到真实模型；例如清空 Field 后模型拒绝 unset，但输入框仍显示空白。
- 当前修改或删除 options 不处理已引用的默认值，Designer 又关闭了相关默认值诊断，可能留下画布空白但无提示的悬空引用。
- 当前 options 允许空字符串和 boolean，但默认值 setter 会把空字符串误当作清除，部分 Provider 组件又会静默过滤 boolean，编辑合同与渲染能力不一致。
- 当前 Raw Vue 在存在校验时会生成 `@moluoxixi/zod3-to-rule` 导入，并通过消费工程软链接仓库内部包掩盖该依赖。
- 当前产品定位是高保真、全模拟数据的交互 Demo；真实接口和复杂业务函数由程序员在导出后实现。
- 用户明确要求不恢复旧事件编排，不保留旧校验合同兼容层；后续能力扩展另行设计。

## 范围内

### R1 属性编辑稳定性

- 校验编辑器必须按字段值类型生成合法的初始校验合同，不能给布尔、数字等字段写入字符串规则。
- 业务值暂时不满足 Required、长度、范围等规则时，不得被视为编译失败；校验应在配置的 change、blur 或 submit 时机执行。字段值与声明基础类型不兼容仍应产生可定位诊断。
- 属性命令产生暂时无效配置或编译失败时，Designer 外壳、设计面和 Inspector 不能被卸载；必须保留最后一次可用运行结果并呈现可定位的诊断。
- Runtime Host 传给 Core 的 JSON 模型必须保持 plain data，不能把 Vue Proxy 传入 `structuredClone` 或框架无关服务。
- 属性命令被 Model 拒绝后，本地控件必须回滚到当前真实值并保留可见诊断，不能形成“输入框已改、模型未改”的假状态。
- Options、默认值与 Provider 可渲染 value 类型必须使用同一物料能力合同；空字符串等合法值不能被隐式当作删除，删除动作必须显式表达。
- 修改或删除已被默认值引用的 option 时，必须在同一个 Project command 中原子清除受影响默认值并给出明确提示；一次 Undo 同时恢复 option 与默认值，不能留下静默悬空值。
- Rule 选择器必须按 base 限制可用规则；regex、日期、数字等可产生非法中间态的编辑器必须使用本地 draft，在合法提交点才写入 Model。
- Element Plus 与 Ant Design Vue 下，文本、布尔、数字和可选择字段的常用属性、Required、校验规则、默认值等连续编辑必须稳定。

### R2 Required 一级合同

- 字段节点提供独立的 `required?: boolean` 和 `requiredMessage?: string` 合同；触发时机继续由独立的校验触发合同控制。
- Required 在 Validation 区域独立、显眼呈现，不再作为通用 RuleSet 的规则种类。
- 动态 `required` 继续由原型状态投影覆盖静态基线。
- Model、Compiler、Canonical IR、Vue backend、Designer、Runtime、两个 Provider adapter 与 Source 同步采用新合同并原子升版。
- 旧 `rules: [{ kind: 'required' }]`、混合版本和缺失版本严格拒绝，不增加兼容读取或迁移分支。

### R3 Raw Vue 原生源码

- Raw Vue 产物只可依赖 Vue、Vue Router 和所选目标 UI 库；不得导入任何 `@moluoxixi/*`、ConfigForm、Zod 或校验转换包。
- 校验逻辑生成为项目内可读、可编辑的 TypeScript/Vue 代码，保留 Required、消息和触发时机语义。
- ConfigForm binding 继续作为独立可选产物，只生成绑定 ConfigForm 配置的消费代码，不内嵌运行核心。
- Raw Vue 与 ConfigForm binding 独立生成、独立报告错误；一方失败不得阻断另一方可用产物。
- 消费工程测试必须从真实生成文件安装、类型检查和构建，不能通过软链接内部包满足 Raw Vue 依赖。

## 范围外

- 恢复事件编辑器、事件转发、通用动作链或任意 JavaScript。
- 引入网络请求、异步副作用、真实业务校验函数或运行时接口桩。
- 兼容或迁移旧 ProjectDocument、旧 Canonical IR 或旧 Required rule。
- 将 ConfigForm binding 伪装成 Raw Vue，或在生成项目中复制 ConfigForm 运行核心。

## 验收标准

- [x] AC1：在 Element Plus 与 Ant Design Vue 项目中，对文本、布尔、数字和选择字段连续切换属性页、编辑默认值、Required、提示和通用校验，设计面与 Inspector 始终存在，控制台无未处理异常。
- [x] AC2：故意构造编译失败的中间状态时，Designer 保留最后一次可用画面，显示稳定诊断；修正配置后能原地恢复，不需要重载页面；成功命令的空诊断不会覆盖同步产生的编译诊断。
- [x] AC3：Required 以字段级独立配置贯穿 Model、Compiler、Canonical IR、Vue backend、Runtime、两个 Provider adapter、Designer 与 Source，通用规则选择器中不存在 `required`。
- [x] AC4：当前合同版本全部原子升级，旧 Required rule、旧版本、混合版本和缺失版本均 fail closed。
- [x] AC5：带 Required 和至少两类通用规则的 Raw Vue 生成项目中，源码与 `package.json` 均无 `@moluoxixi/*`、ConfigForm、Zod 或转换器依赖，且可独立执行 typecheck 与 build。
- [x] AC6：ConfigForm binding 仅引用公开 ConfigForm 包并绑定生成配置；其失败不会阻止 Raw Vue 文件集返回，反之亦然。
- [x] AC7：E2E 使用当前模板中真实存在的控件和可访问名称，不依赖陈旧的 `Submit preview form` 断言；测试同时断言 `pageerror`、console error 和设计面存活。
- [x] AC8：连续修改默认值、切换 Properties/Validation、等待自动保存并重载后，主页面与 Runtime iframe 均无 `RUNTIME_RENDER_FAILED`、`DataCloneError` 或 DOM 错误，且可继续编辑。
- [x] AC9：受影响包的单元测试、类型检查、架构边界测试、双 Provider 浏览器回归和生成消费工程构建全部通过。
- [x] AC10：属性命令被拒绝后控件回滚到真实模型；空字符串 option 可作为默认值；Provider 不接受的 option 类型无法创建；增删改 options 不会留下无诊断的悬空默认值。

## 风险与约束

- 这是 current-contract-only 的破坏性变更，版本常量、Reader、fixtures 与测试必须在同一提交范围内同步，不能留下半兼容状态。
- 设计器稳定性不能依赖“永远不会产生无效中间状态”；编译错误必须是正常可恢复状态。
- Vue 响应式对象不能越过 Runtime Host 到 Core 的 JSON 边界；修复应留在组合边界，不能让 Core 感知 `toRaw` 或依赖 Vue。
- Raw Vue 的本地校验实现应保持可读和可接管，不能把现有运行时或编译器整段复制进生成项目。
