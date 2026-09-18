# ConfigForm 架构入口

ConfigForm 是面向 Vue 与 TypeScript 工程师的生产级表单 Runtime。它用可组合配置描述表单结构、布局、静态属性、基础校验、同步状态规则和数据读取；复杂业务逻辑继续由工程师在宿主代码中维护。

长期产品边界与扩展准入规则见 [PRODUCT.md](./PRODUCT.md)，近期投入方向见 [ROADMAP.md](./ROADMAP.md)。

## 产品分层

| 层             | 包 / 应用                              | 责任                                                     |
| -------------- | -------------------------------------- | -------------------------------------------------------- |
| 纯领域         | `@moluoxixi/config-form-core`          | JSON、value reference、reaction、Data Source 与布局规则  |
| 表单内核       | `@moluoxixi/config-form-headless`      | 字段树、模型读写、状态、校验、提交与表单 controller      |
| Vue Runtime    | `@moluoxixi/config-form`               | 组件解析、值绑定、布局、readonly 与 Data 生命周期        |
| UI 适配        | Element Plus / Ant Design Vue packages | 真实组件、值绑定预设与样式                               |
| 可选 Designer  | Designer 与对应 Provider adapter       | 结构、布局、静态属性、默认值、静态 options 与基础校验    |
| 内部 Workbench | `@config-form/workbench`               | Project 编辑、Preview、静态 Source/Config 导出与集成验证 |

Runtime 是主产品，Designer 是可选的轻量 Schema 编辑器，Workbench 是仓库内部验证应用。Workbench 不是公开低代码平台，也不是 Runtime 的依赖。

## 依赖方向

```text
Model -> Compiler -> Canonical IR -> Vue Backend -> Runtime
  ^                                                  ^
  |                                                  |
Designer                                      宿主 Vue/TypeScript

Core <- Headless <- Runtime <- UI adapters
                    ^
                    |
             Designer / Workbench 组合使用
```

- Core、Headless 和 Runtime 不依赖 Designer 或 Workbench。
- Designer 不拥有业务副作用、请求调度或通用流程执行。
- Workbench 只在应用组合根连接公开包。
- ProjectDocument、Canonical IR、Preview transport 和 Source generator 只处理可序列化数据，不承载函数。

## 编译与运行

Designer 或代码生成的可序列化 ProjectDocument 经 Model 校验后，由 Compiler 生成 Canonical IR，再由 Vue Backend 投影成 Runtime 配置。Runtime 使用 Headless controller 执行字段状态、校验、reaction 和提交，并通过 UI adapter 解析真实组件。

编译链只处理结构和数据合同。源码导出只生成静态配置，不生成 handler stub、字符串 action ref 或待绑定事件元数据。

## 代码态组件事件

复杂组件事件直接写在宿主运行时 config 的 `props.onX` 中：

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

字段值事件由 Runtime 先完成写值和校验记账，再调用同一事件上的宿主 listener。Design mode 在 Renderer 内部直接阻断组件交互。

主产品不提供事件编辑、事件转发、事件编排、动作注册器、handler registry 或组件事件总线。函数不会写入 Designer JSON、ProjectDocument、IndexedDB、Preview RPC 或生成源码；工程师在宿主 Vue/TypeScript 中组合静态配置和 listener。

## Designer Lite

默认 Inspector 只有两个 section：

- `properties`：字段身份、标签、静态组件属性、默认值、静态 options、span 与表单布局。
- `validation`：当前字段的同步基础规则与 `validateOn`。

Designer 不提供 events、底层 bindings、conditions、reactions、动态 option source 或 Automation 作者入口。Runtime 仍可消费工程师以代码维护的高级 validation、conditions、reactions、Data Source、option source、value scope 和 bindings；Designer 普通编辑必须无损保留这些配置。

## 合同与版本

持久化、Registry、Canonical IR、Compiler、Runtime Host 和 Source generator 都使用各自的显式版本常量与 fail-closed 校验。仓库只维护当前合同：旧、未来、缺失或混合 shape 必须被拒绝，不提供兼容别名、迁移器、deprecated wrapper 或双读分支。

删除公开合同必须通过手写 breaking Changeset 原子发布，并同步受影响 adapter、plugin、devtools 的版本与 peer range。

## 包内文档

- [Runtime](./runtime/README.md)
- [Headless](./headless/README.md)
- [Core](./core/README.md)
- [Designer](./designer/README.md)
- [Workbench](./workbench/README.md)

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

未来若要引入 Automation，必须基于真实需求重新立项并使用独立 package 和公共合同；本目录不预留旧实现、隐藏入口或占位抽象。
