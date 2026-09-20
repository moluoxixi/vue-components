# ConfigForm 架构入口

ConfigForm 同时服务两条互不混淆的路径：当前生产 Runtime 让工程师用 Vue/TypeScript
配置运行表单；目标 ConfigForm Studio 让工程师或 UI 设计师创建无真实接口的高保真
业务界面 Demo，再把可运行源码单向交给程序员。

- 目标产品边界见 [PRODUCT.md](./PRODUCT.md)。
- 当前实现、迁移阶段和目标版本见 [ROADMAP.md](./ROADMAP.md)。

## 当前实现

Surface Foundation 已落地，校验与源码合同也已完成硬切。`ProjectDocument v7`、
`SurfaceGraph v2`、RuleSet v2、Canonical IR v6、Compiler 7.0.0、Vue backend、
Workbench persistence/Preview 和 Source generator 都以 `SurfaceAsset` 为身份；Page/Dialog/Drawer
共享 `SurfaceGraph`，每次 Experience 打开由 Prototype Runtime 创建隔离的
`SurfaceInstance`。Designer 仍聚焦一个 Surface，默认 Inspector 只有 `properties` 与
`validation`；独立 Source 包已经落地，完整 Studio 资产 UI、Dataset 编辑 UI 和
Interactions Inspector 仍是后续任务。

当前可用分层：

| 层          | 包 / 应用                                  | 当前责任                                                                     |
| ----------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| 纯领域      | `@moluoxixi/config-form-core`              | JSON、value reference、reaction、Data Source 与布局规则                      |
| 表单内核    | `@moluoxixi/config-form-headless`          | 字段树、模型读写、状态、校验、提交与 controller                              |
| Vue Runtime | `@moluoxixi/config-form`                   | 组件解析、值绑定、布局、readonly 与 Data 生命周期                            |
| UI 适配     | Element Plus / Ant Design Vue packages     | 真实组件、值绑定预设与样式                                                   |
| Designer    | Designer 与 provider adapters              | 单 Surface 的结构、布局、静态属性、options、字段 Required 与 RuleSet v2 校验 |
| Model       | `@moluoxixi/config-form-model`             | Surface/Dataset/Resource、事务、Repository 与 transfer                       |
| Prototype   | `@moluoxixi/config-form-prototype-runtime` | DOM-free session、SurfaceInstance 与 Vue overlay host                        |
| Source      | `@moluoxixi/config-form-source`            | 原生 Vue/ConfigForm 绑定生成器与只读源码 Viewer                              |
| Workbench   | `@config-form/workbench`                   | Project 编辑、iframe Preview 与源码导出宿主                                  |

当前代码依赖方向是：

```text
Core <- Headless <- Runtime <- UI adapters
  ^                    ^
  |                    |
Model -> Compiler -> Vue Backend
  ^          |
  |          v
Designer  Prototype Runtime
  ^          ^
  |          |
  +-- Workbench composition root ----> Source
```

Core、Headless 和 Runtime 不依赖 Designer 或 Workbench；Designer 不拥有业务副作用。
Prototype Runtime 依赖 Compiler/Core 的纯合同，但生产 Runtime 不反向依赖它；Workbench
作为私有组合根连接编译 artifact、Prototype session、provider adapter 与 Source。
ProjectDocument、Canonical IR、Preview transport 和 Source generator 只处理 JSON-safe
数据，不承载函数。

## 目标架构

当前合同在生产链路之上增加 Surface、Dataset 基础合同、Prototype Runtime 与 Source；
Studio 资产、Dataset 作者 UI 和 Interactions 作者 UI 仍按后续阶段交付：

```text
Core <- Headless <- Runtime <- UI adapters

Model -> Compiler -> Canonical IR -> Vue Backend -> Runtime
  ^                                      |
  |                                      v
Designer                         Prototype Runtime
  ^                                      ^
  |                                      |
Studio ----------------------------------+
  |
  +---- injects provider/resource adapters ----> Source generator / viewer
```

| 目标层            | 责任                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Model             | `SurfaceAsset`、Dataset、Resource、引用和 versioned envelope                                              |
| Designer          | 聚焦一个 Surface 的结构、布局、属性、校验和交互作者能力                                                   |
| Studio            | 项目/资产管理、Design/Experience、持久化、导入导出和宿主命令                                              |
| Prototype Runtime | 页面历史、SurfaceInstance 栈、参数/结果事务和主要 UI 动作                                                 |
| Source            | 无 DOM Generator、component resolver、ConfigForm binding resolver、异步 Resource reader 和只读源码 Viewer |

`@moluoxixi/config-form-prototype-runtime` 已提供根、`/session`、`/vue` 和
`/vue/style` 入口。`@moluoxixi/config-form-source` 已提供根、`/generator`、`/viewer`
和 `/viewer/style` 入口；两者都进入当前发布矩阵。

目标依赖规则：

- Studio 是 private 应用组合根，可以组合公开的 Model、Compiler、Designer、Runtime、
  Prototype Runtime 和 Source 包。
- Prototype Runtime 的根入口和 `/session` 无 DOM；`/vue` 与 `/vue/style` 才拥有
  Surface/overlay host。生产 Runtime、Core 和 Headless 不反向依赖它。
- Source generator 只依赖稳定 compilation、Source 自有 component resolver、ConfigForm
  binding resolver、Resource reader 合同和纯数据，不依赖 Designer、Workbench、具体
  provider UI、Repository 或 DOM。Raw 只接收 component resolver 与 Resource reader。
- Studio 在组合根读取 adapter metadata 与 Repository，并把三项职责分别注入 Source。
- 默认 Raw 工程的 `package.json.dependencies` 与应用运行时代码中的裸包 import 严格限定为 Vue、
  Vue Router 与目标 UI 包；不得包含 ConfigForm、Zod、`@moluoxixi/*`、
  `@config-form/*` 或内部 Runtime。Vite、TypeScript 等构建工具可作为 `devDependencies`。
  Required 与 RuleSet v2 编译为工程内可读校验代码。ConfigForm 绑定工程只 import 已
  发布公开包并保留配置，不内嵌执行核心。两者都不生成 `src/runtime/**`。
- Raw 与 ConfigForm binding 基于同一 compilation 独立生成、独立失败；一个 mode 的
  diagnostics 不会抹掉另一个 mode 的可用文件集。
- Dataset 查询只在共享数据服务实现一次；Material 只拥有渲染、选择和语义激活。

## Runtime 与代码态组件事件

生产 Runtime 继续允许工程师直接传入普通 Vue listener：

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

值/blur 触发时，Runtime 先完成绑定、模型写入和校验记账，再调用宿主 listener。
Design mode 在 Renderer 内部阻断交互。`props.onX` 只存在于宿主内存配置，不序列化、
不转换成 Studio 交互，也不通过 Preview iframe 转发。

全产品禁止恢复任意事件编辑、事件总线、动作链、handler registry 或 Flow。目标
Prototype Interaction 仅包含安全表达式状态投影、`set/copy/clear` 和一个主要 UI
动作，详细合同见产品文档。

## 合同与版本

持久化、Registry、Canonical IR、Compiler、Runtime Host、Source generator 与新增
Dataset/Prototype session 都遵循 current-contract-only：writer 和 reader 原子切换，
旧、未来、缺失、畸形或混合版本 fail closed。不提供迁移器、兼容别名、deprecated
wrapper、双模型或联合 peer range。

当前校验链路使用 RuleSet v2、ProjectDocument v7、SurfaceGraph v2、Canonical IR v6
与 Compiler 7.0.0。字段 Required 由 `required` / `requiredMessage` 独立表达，RuleSet
不再接受 `kind: 'required'`，也没有 `time` base；时间物料只提供 Required 与
`validateOn`。Select options 变化会在同一命令中同步已有 enum/literal base、清除失效
默认值，无法表达时清除 validation；一次 Undo 整体恢复。动态 Required 只在运行态
覆盖字段静态基线。

显式 Dataset raw rows ingestion 是创建当前 v1 Dataset 的命令，不是 envelope Reader
的兼容分支。Reader 收到无版本数组必须拒绝。

## 包内文档

- [Runtime](./runtime/README.md)
- [Headless](./headless/README.md)
- [Core](./core/README.md)
- [Designer](./designer/README.md)
- [Source](./source/README.md)
- [Workbench](./workbench/README.md)

Model、Compiler、Vue backend、Prototype Runtime 和 Source 的 README 已同步当前
Surface Foundation 与源码交付入口；Studio 资产和 Dataset/Interaction 作者 UI 仍只在
路线图中描述。

## 验证

```bash
pnpm test:config-form-packages
pnpm test:package-architecture
pnpm --filter @moluoxixi/config-form test
pnpm --filter @moluoxixi/config-form typecheck
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-source test
pnpm --filter @moluoxixi/config-form-source typecheck
pnpm --filter @moluoxixi/config-form-source build
pnpm --filter @config-form/workbench test --maxWorkers=2
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
```
