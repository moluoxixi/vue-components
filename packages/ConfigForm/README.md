# ConfigForm

ConfigForm 提供两条独立的开发路径，按任务选择即可：

| 要完成的任务                  | 使用入口                                                                      | 维护的内容                                     |
| ----------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------- |
| 在业务代码中编写配置化表单    | [ElementConfigForm](./element/README.md) / [AntdConfigForm](./antd/README.md) | TypeScript 字段配置、模型、校验与业务函数      |
| 可视化搭建界面并交付 Vue 源码 | [Studio 设计器](./workbench/README.md)                                        | 设计项目 JSON；导出后在普通 Vue 工程中继续开发 |

Runtime 使用者无需安装 Designer、Model、Compiler 或本地工作区。Studio 默认输出不依赖
ConfigForm 的 Vue 工程，也可选择导出用于已有项目的 ConfigForm 绑定代码。
设计 JSON 用于保存和继续设计，不等同于代码态表单配置；源码交付保持单向。

产品、架构、实施与验证统一从 [文档索引](./docs/README.md)进入。
[源码导入研究](./docs/source-import.md)保留为历史分析，不纳入当前收尾范围。

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

启动命令会先构建工作台所需的两个外部工作区依赖。首次使用先执行 `pnpm install --frozen-lockfile`。
进入设计器后可直接“创建表单”，选择模板并开始设计；需要管理多个页面时使用“新建项目”。
跨包、生成消费者和浏览器验证见 [验证文档](./docs/verification.md)。
