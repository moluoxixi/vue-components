# ConfigForm 架构入口

ConfigForm 同时服务两条互不混淆的路径：当前生产 Runtime 让工程师用 Vue/TypeScript
配置运行表单；目标 ConfigForm Studio 让工程师或 UI 设计师创建无真实接口的高保真
业务界面 Demo，再把可运行源码单向交给程序员。

- 目标产品边界见 [PRODUCT.md](./PRODUCT.md)。
- 当前实现、迁移阶段和目标版本见 [ROADMAP.md](./ROADMAP.md)。

## 当前实现

仓库当前仍是 Page-only 实现。`ProjectDocument`、Compiler、Canonical IR、Vue backend、
Workbench persistence/Preview/Source 都以 Page 为主身份；Designer 的默认 Inspector
只有 `properties` 与 `validation`。Surface、Dataset、Prototype Interaction、共享
Prototype Runtime 和独立 Source 包尚未实现。

当前可用分层：

| 层          | 包 / 应用                              | 当前责任                                                  |
| ----------- | -------------------------------------- | --------------------------------------------------------- |
| 纯领域      | `@moluoxixi/config-form-core`          | JSON、value reference、reaction、Data Source 与布局规则   |
| 表单内核    | `@moluoxixi/config-form-headless`      | 字段树、模型读写、状态、校验、提交与 controller           |
| Vue Runtime | `@moluoxixi/config-form`               | 组件解析、值绑定、布局、readonly 与 Data 生命周期         |
| UI 适配     | Element Plus / Ant Design Vue packages | 真实组件、值绑定预设与样式                                |
| Designer    | Designer 与 provider adapters          | 单 Page 的结构、布局、静态属性、options 与基础校验        |
| Workbench   | `@config-form/workbench`               | Project 编辑、iframe Preview、当前内置 Source/Config 导出 |

当前代码依赖方向是：

```text
Core <- Headless <- Runtime <- UI adapters

Model -> Compiler -> Canonical IR -> Vue Backend -> Runtime
  ^                                                  ^
  |                                                  |
Designer                                      host Vue/TypeScript
  ^
  |
Workbench composition root
```

Core、Headless 和 Runtime 不依赖 Designer 或 Workbench；Designer 不拥有业务副作用。
ProjectDocument、Canonical IR、Preview transport 和 Source generator 只处理 JSON-safe
数据，不承载函数。

## 目标架构

目标合同在当前链路之上增加 Studio、Dataset、Prototype Runtime 与独立 Source 所有权：

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

| 目标层            | 责任                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------- |
| Model             | `SurfaceAsset`、Dataset、Resource、引用和 versioned envelope                          |
| Designer          | 聚焦一个 Surface 的结构、布局、属性、校验和交互作者能力                               |
| Studio            | 项目/资产管理、Design/Experience、持久化、导入导出和宿主命令                          |
| Prototype Runtime | 页面历史、SurfaceInstance 栈、参数/结果事务和主要 UI 动作                             |
| Source            | 无 DOM Generator、provider component resolver、异步 Resource reader 和只读源码 Viewer |

`@moluoxixi/config-form-prototype-runtime` 与
`@moluoxixi/config-form-source` 目前只是规划包，没有可导入入口。它们只有在对应阶段
交付真实实现、测试、README、manifest 和 Changeset 后才进入当前架构与发布矩阵。

目标依赖规则：

- Studio 是 private 应用组合根，可以组合公开的 Model、Compiler、Designer、Runtime、
  Prototype Runtime 和 Source 包。
- Prototype Runtime 的根入口和 `/session` 无 DOM；`/vue` 与 `/vue/style` 才拥有
  Surface/overlay host。生产 Runtime、Core 和 Headless 不反向依赖它。
- Source generator 只依赖稳定 compilation、Source 自有 component-resolver/resource-
  reader 合同和纯数据，不依赖 Designer、Workbench、具体 provider UI、Repository 或 DOM。
- Studio 在组合根读取 adapter metadata 与 Repository，并把两个 adapter 分别注入 Source。
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

显式 Dataset raw rows ingestion 是创建当前 v1 Dataset 的命令，不是 envelope Reader
的兼容分支。Reader 收到无版本数组必须拒绝。

## 包内文档

- [Runtime](./runtime/README.md)
- [Headless](./headless/README.md)
- [Core](./core/README.md)
- [Designer](./designer/README.md)
- [Workbench](./workbench/README.md)

Model、Compiler 和 Vue backend 的 README 仍描述当前 Page-only API；它们将在 Surface
Foundation 原子落地时同步更新，不提前声称目标类型已经存在。

## 验证

```bash
pnpm test:config-form-packages
pnpm test:package-architecture
pnpm --filter @moluoxixi/config-form test
pnpm --filter @moluoxixi/config-form typecheck
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @config-form/workbench test --maxWorkers=2
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
```
