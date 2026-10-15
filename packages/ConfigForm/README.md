# ConfigForm

ConfigForm 包含独立的生产表单 Runtime，以及使用真实 Vue 组件、可以持续在线编辑的
Studio UI 设计工具。Studio 配置是设计源文档，设计、体验和源码交付共享同一模型；
复杂生产业务逻辑继续使用普通 Vue/TypeScript。

产品、架构、实施与验证统一从 [文档索引](./docs/README.md)进入。
未来部分源码导入属于[未实现的边界提案](./docs/source-import.md)，当前源码交付是单向的。

## 包与用法

| 包 / 应用                                                                 | 用法                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------ |
| [Core](./core/README.md)                                                  | JSON、值引用、reaction、Data Source 和布局规则   |
| [Headless](./headless/README.md)                                          | 字段模型、状态、校验与提交                       |
| [Runtime](./runtime/README.md)                                            | Vue 配置表单与 Renderer                          |
| [Element Plus](./element/README.md) / [Ant Design Vue](./antd/README.md)  | 生产 UI 适配                                     |
| [Model](./model/README.md)                                                | 项目文档、资产、事务与 Repository                |
| [Compiler](./compiler/README.md) / [Vue backend](./vue-backend/README.md) | Canonical IR 与 Runtime 投影                     |
| [Designer](./designer/README.md)                                          | 单 Surface 设计器与物料注册                      |
| [Prototype Runtime](./prototype-runtime/README.md)                        | 本地体验会话与浮层实例                           |
| [Source](./source/README.md)                                              | 原生 Vue / ConfigForm 绑定生成与只读 Viewer      |
| [Studio SDK](./studio/README.md)                                          | 配置创作、纯数据 preset 与 Node / 浏览器源码生成 |
| [Local](./local/README.md)                                                | 文件工作区、服务、CLI 与 MCP                     |
| [Workbench](./workbench/README.md)                                        | 仓库内设计应用与集成验证                         |

## 开发

```powershell
pnpm dev:config-form-workbench
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
```

跨包、生成消费者和浏览器验证见 [验证文档](./docs/verification.md)。
