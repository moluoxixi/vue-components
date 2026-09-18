# ConfigForm Studio 产品边界

## 产品定位

ConfigForm Studio 是一个本地优先、高保真、表单驱动的业务界面 Demo
创作应用。它帮助工程师，以及经过少量学习的 UI 设计师，完成交互、布局、
视觉、校验、模拟数据和本地页面流程，并把可运行源码单向交给程序员继续开发。

Studio 的产物是一个不调用真实接口、可以完整演示用户路径的 Demo。HTTP、鉴权、
异步副作用、复杂业务函数和生产数据接入不进入 Studio；程序员在导出源码后使用
正常的 Vue/TypeScript、调试器、测试和代码审查完成这些逻辑。

这不是通用低代码平台、流程编排器或自由画布。ConfigForm Runtime 仍是生产运行
底座，代码态配置仍是正式集成方式之一。

## 目标用户与核心价值

- 主要用户是需要快速搭建、评审和交接业务界面 Demo 的 Vue/TypeScript 工程师。
- UI 设计师可以在理解字段、数据路径和安全表达式后独立完成高保真 Demo。
- 团队可以用真实 Element Plus 或 Ant Design Vue 组件验证表单、列表、浮层和页面
  跳转，而不需要先搭建后端或把业务函数塞进设计器。
- 程序员收到的是可运行、可阅读、可继续维护的源码，不需要在另一套事件运行时中
  实现生产逻辑，也不需要把修改后的源码回导 Studio。

## 产品资产

一个 Studio 项目包含以下独立资产：

| 资产     | 责任                                                               |
| -------- | ------------------------------------------------------------------ |
| Page     | 有路由语义的页面 Surface，可作为项目首页和导航目标                 |
| Dialog   | 可复用的模态 Surface，拥有独立设计、参数、具名结果和 presentation  |
| Drawer   | 可复用的侧滑 Surface，拥有独立设计、参数、具名结果和 presentation  |
| Dataset  | 项目级、运行期只读的 JSON 对象数组，可驱动 options、Table 和 List  |
| Resource | 本地嵌入图片或静态 URL 等资源；metadata/bytes 分离并由稳定 ID 引用 |

Page、Dialog、Drawer 都是可持久化的 `SurfaceAsset`，不是组件物料。组件物料
`Material` 描述可以放进 Surface 的组件类型、setter 和语义能力。每次进入页面或
打开浮层都会创建独立 `SurfaceInstance`；同一资产可同时存在多个互不共享值、
校验和参数的实例。

Dialog/Drawer 不嵌进调用方的图中。设计模式始终聚焦一个 Surface，体验模式才执行
页面历史与浮层实例栈。用户动作可以形成任意有限深度的 A -> B -> A 调用，但项目
加载时不得自动递归打开 Surface。

## 创作能力

### UI、布局与校验

- 使用响应式 Grid/Flex 和受控布局属性，不提供绝对定位自由画布。
- 提供项目 Design Token、组件白名单视觉属性和业务展示、操作、数据物料。
- 支持基础校验以及表达式驱动的动态 `required`；Demo 中的校验必须可确定执行。
- 首版不提供任意 CSS、任意脚本或项目内自定义组件编译。

### 模拟数据

Dataset 的根值必须是 JSON 对象数组，行内允许嵌套对象和数组。Dataset 可以导入、
导出、编辑，也可以由现有静态 options 保存而来。

组件通过稳定的 `datasetId + projection` 引用 Dataset。共享数据层统一负责字段路径、
投影、本地搜索、筛选、排序和分页；物料只负责渲染、选择状态和语义激活。字段值
仍保存 string/number 等明确标量，不把整行对象隐式写进表单值。

Dataset 与 Runtime Data Source 是两个合同：Dataset 是 Studio 的静态 Demo 数据，
运行期只读；Data Source 是工程师在生产 Runtime 中使用的 HTTP、缓存、取消和宿主
数据接入能力。两者不共享引用类型，也不互相伪装。

### Prototype Interaction

Studio 只提供封闭、JSON-safe、可确定执行的原型交互：

- 状态投影：根据安全表达式计算 `visible`、`disabled`、`readonly`、`required` 和
  Material 白名单展示属性；初始化和依赖变化时持续计算。
- 值动作：在声明的依赖字段发生用户输入或结果事务变化后执行 `set`、`copy`、
  `clear`；初始化时不执行。
- 主要 UI 动作：导航 Page、返回、打开 Dialog/Drawer、关闭当前浮层或关闭全部
  浮层，可选择先执行校验，并支持参数和具名结果映射。

一个语义触发器最多绑定一个主要 UI 动作。触发器来自物料声明的“激活”“提交”或
“行激活”等语义，不来自任意 DOM 事件名、函数名或事件参数转发。

表达式使用安全 AST 与白名单纯函数。赋值、任意 JavaScript、HTTP、延时、重试、
并行、动作链、事件编排和 Flow 全部不属于 Studio。

## 代码态业务逻辑

生产 Runtime 继续接受普通 Vue listener。工程师可以在内存态 config 的 `props.onX`
中维护复杂业务函数：

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

Runtime 会先完成自身的值绑定和校验记账，再调用同一触发上的宿主 listener。
`props.onX` 不序列化，不转换为 Prototype Interaction，也不通过 Preview iframe
转发。Studio 不提供 handler registry、事件总线、动作注册器或函数占位符。

## 产品分层

| 层                             | 目标责任                                                            |
| ------------------------------ | ------------------------------------------------------------------- |
| Core / Headless / Runtime      | 生产表单协议、状态、校验、组件解析、值绑定和宿主 API                |
| UI adapters                    | Element Plus、Ant Design Vue 的真实组件和值绑定预设                 |
| Model / Compiler / Vue backend | Studio 资产、当前合同校验、Canonical IR 和 Runtime 投影             |
| Designer                       | 聚焦一个 Surface 的结构、布局、属性、校验和交互作者能力             |
| Studio                         | 项目/资产管理、Design/Experience、持久化、导入导出和应用命令        |
| Prototype Runtime              | 页面历史、Surface 实例栈、参数/结果事务和主要 UI 动作               |
| Source                         | 无 DOM 的源码生成与只读源码 Viewer；复制/下载等命令仍由 Studio 负责 |

规划中的共享体验包名为 `@moluoxixi/config-form-prototype-runtime`。其根入口和
`/session` 必须无 DOM；Vue Surface/overlay host 位于 `/vue`，样式位于
`/vue/style`。Studio Experience 与生成项目消费同一实现，生产 Runtime 不反向
依赖它。

规划中的源码包名为 `@moluoxixi/config-form-source`。Generator 接受稳定编译结果、
Source 自己拥有的同步 provider component resolver，以及异步 embedded Resource
reader；Studio 只在应用组合根读取 adapter metadata 与 Repository 并分别注入。
Source 自己校验 bytes、决定输出路径，URL 不由 generator 发起 fetch。Viewer 只显示
文件树和只读源码，不拥有弹窗、刷新、复制、下载、ZIP、通知或持久化。

## 本地优先与单向交付

- Studio 使用 IndexedDB 自动保存，支持版本化项目 JSON 导入导出；项目 JSON 同时
  携带 metadata-only document 与 embedded Resource 内容，不能静默丢失本地资源。
  产品不提供云端和多人协作。
- Component adapter 在创建项目时锁定；Element Plus 与 Ant Design Vue 维护共同基础
  能力，但各自的组件解析由组合根注入。
- Source 必须保留 Demo 的 Surface、Dataset、校验和 Prototype Interaction 行为，
  生成结果可直接安装运行。
- Source 不生成 HTTP 占位、handler stub、字符串 action ref 或待绑定事件元数据。
- 源码是单向交接结果。修改后的源码不支持回导 Designer。

## 明确非目标

- 可视化事件编辑、原始事件转发、事件参数映射、动作链、流程图或通用 Automation。
- 在 Studio 配置中执行任意 JavaScript、HTTP、鉴权或生产副作用。
- 绝对定位自由画布、任意 CSS、首版自定义组件、云端发布或多人协作。
- 通过兼容别名、隐藏开关、迁移 Reader、旧 wrapper 或 dormant package 保留旧合同。
- 让 Dataset 冒充 Runtime Data Source，或让 Prototype Interaction 冒充代码态函数。
- 让 Studio 取代 IDE、类型系统、代码审查和业务测试。

## 扩展准入

未来扩展能力需要重新讨论并同时满足：

1. 有可复现的真实用户任务，且当前 Demo/代码交接方式存在明确重复成本。
2. 能定义独立职责、输入输出、错误、取消、生命周期和权限边界。
3. 有明确的包所有权和单向依赖，不让生产 Runtime 反向依赖 Studio。
4. 默认未安装时没有运行成本、UI 占位或持久化噪声。
5. 明确 Design、Experience、Source 和生产 Runtime 的适用范围，并提供行为测试。
6. 不增加第二事实源、兼容双读、任意脚本执行或隐式事件域。

未满足这些条件时，能力留在导出后的 Vue/TypeScript 代码中。
