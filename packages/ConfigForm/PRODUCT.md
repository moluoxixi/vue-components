# ConfigForm 产品边界

## 产品定位

ConfigForm 是面向 Vue 与 TypeScript 工程师的生产级表单 Runtime。它用可组合的配置描述表单结构、布局、静态属性、基础校验、同步状态规则和数据读取，同时让复杂业务逻辑继续留在宿主代码中。

Runtime 是主产品。Designer 是可选的轻量 Schema 编辑器，Workbench 是仓库内部用于设计、预览、源码导出和集成验证的应用，不是低代码业务平台。

## 目标用户与价值

- 需要在多个页面复用表单结构、校验、组件绑定和数据源能力的 Vue 工程师。
- 需要 Element Plus 或 Ant Design Vue 真实组件，同时不愿放弃 TypeScript、调试器、测试和正常代码审查的团队。
- 需要把可序列化表单配置与业务函数明确分开的工程。

ConfigForm 不要求工程师把复杂逻辑改写为字符串事件名、动作注册表、流程图、表达式 DAG 或 iframe RPC。

## 能力分层

| 层              | 责任                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| Core / Headless | JSON、value reference、reaction、Data Source、字段状态、校验与表单 controller |
| Runtime         | Vue 组件解析、值绑定、布局、readonly、Data 生命周期和宿主 API                 |
| UI adapters     | Element Plus、Ant Design Vue 的组件与值绑定预设                               |
| Designer        | 结构、布局、静态属性、默认值、静态 options 和基础校验的可视化编辑             |
| Workbench       | 内部 Project 编辑、Preview、静态 Source/Config 导出和集成验证                 |

依赖始终向 Runtime 内核收敛。Core、Headless 和 Runtime 不依赖 Designer 或 Workbench；Designer 不拥有业务副作用或通用流程执行；Workbench 只在应用组合根连接公开包。

## 代码态业务逻辑

组件事件使用普通 Vue listener，直接写在宿主运行时 config 的 `props.onX` 中：

```ts
const fields = [
  defineField({
    id: 'save',
    component: 'ElButton',
    props: {
      onClick: () => saveDraft(),
    },
  }),
]
```

字段值事件由 Runtime 先完成写值和校验记账，再调用宿主 listener。Design mode 在 Runtime 内部直接阻断组件交互。不存在中央组件事件、事件名订阅表、参数快照、事件转发、动作注册器或流程调度器。

表单级宿主接口保持明确：`change`、`fieldChange`、`metaChange`、`errorsChange`、`error`、`submit`、`variablesChange`、`dataSourceStateChange`，以及 `getValues`、`setValues`、`validate`、`resetFields`、`submit` 等 expose API。

## Designer 边界

默认 Inspector 只有两个 section：

- `properties`：字段身份、标签、静态组件属性、默认值、静态 options、span 与表单布局。
- `validation`：当前字段的同步基础规则与 `validateOn`。

Designer 不提供事件、底层 bindings、conditions、reactions、动态 option source 或 Automation 作者入口。程序化配置中已有的高级 validation、conditions、reactions、Data Source、option source、value scope 和 bindings 可以继续由 Runtime 消费；Designer 在普通编辑时必须无损保留它们，但不把它们伪装成默认低代码能力。

## 可序列化边界

ProjectDocument、Designer、JSON 导入导出、IndexedDB、Canonical IR、Preview transport 和 Source generator 只处理可序列化数据。函数不进入这些边界，也不要求从宿主代码回写 Designer。

Workbench Source 只生成静态结构配置，不生成 handler stub、字符串 action ref 或待绑定事件元数据。工程师在生成结果之外的宿主 TypeScript 中组合业务函数。

## 非目标

- 可视化事件编辑器、流程图、动作市场或通用 Automation 平台。
- 在配置中执行任意 JavaScript 字符串。
- 通过兼容别名、隐藏开关或 dormant package 保留旧事件体系。
- 把 Workbench 产品化为 SaaS、模板市场、发布平台或多人协作系统。
- 用 Designer 替代 IDE、类型系统、代码审查和业务测试。

## 扩展准入

未来 Rules、Data、Automation 或其他能力只有同时满足以下条件才进入设计：

1. 存在可复现的真实用户任务，且宿主代码方案有明确、重复的成本。
2. 能定义独立职责、输入输出、错误、取消、生命周期和权限边界。
3. 使用独立 package 和稳定公共合同，核心包不反向依赖。
4. 默认未安装时没有运行成本、UI 占位或持久化噪声。
5. 明确直接 API、Preview 与 Source 的适用范围，并有独立测试。
6. 不增加第二事实源、兼容双读或任意脚本执行。

未满足这些条件时，能力留在宿主 Vue/TypeScript 代码中。
