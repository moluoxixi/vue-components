# Moluoxixi Components

基于 Vue 3 的组件集合，Monorepo 结构。

在线入口：

- [统一导航工作台](https://vue-components-hub.knitbatch.chatgpt.site/)
- [组件文档](https://moluoxixi.github.io/vue-components/)
- [ConfigForm 可视化设计器](https://moluoxixi.github.io/vue-components/config-form-playground/designer.html)

ConfigForm 提供两条独立路径：开发者用 Runtime 编写 TypeScript 表单配置；用 Studio 可视化搭建真实组件界面并导出 Vue 源码。Studio 默认交付独立 Vue 工程，也可导出接入已有项目的 ConfigForm 绑定代码。设计 JSON 用于保存和继续设计，源码交付保持单向。人工与 AI 可通过 SDK/MCP 共用设计事务。产品定位与验证见 [ConfigForm 文档](./packages/ConfigForm/docs/README.md)，两种场景的用法见 [ConfigForm 入口](./packages/ConfigForm/README.md)。

## 包

| 包                                                                                             | 说明                                                        |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [`@moluoxixi/components`](./packages/components/)                                              | 通用组件集合入口及 `/auto-loaders` 自动导入预设             |
| [`@moluoxixi/config-form`](./packages/ConfigForm/runtime/)                                     | Runtime/Plugin 配置表单与 Vue DOM Renderer 的唯一根入口     |
| [`@moluoxixi/config-form-headless`](./packages/ConfigForm/headless/)                           | Vue headless 字段协议、Zod 校验、readonly 与表单 controller |
| [`@moluoxixi/config-form-core`](./packages/ConfigForm/core/)                                   | 可独立复用的 JSON、条件与 reaction 纯协议/执行器            |
| [`@moluoxixi/config-form-element`](./packages/ConfigForm/element/)                             | Element Plus 轻量 ConfigForm                                |
| [`@moluoxixi/config-form-antd-vue`](./packages/ConfigForm/antd/)                               | Ant Design Vue 轻量 ConfigForm                              |
| [`@moluoxixi/config-form-devtools-vite-plugin`](./packages/ConfigForm/devtools-vite-plugin/)   | 开发态源码定位 Vite 插件                                    |
| [`@moluoxixi/config-form-designer`](./packages/ConfigForm/designer/)                           | 物料无关的 Surface 设计器与属性/校验检查器                  |
| [`@moluoxixi/config-form-designer-element-plus`](./packages/ConfigForm/designer-element-plus/) | Element Plus 可视化设计器适配                               |
| [`@moluoxixi/config-form-designer-antd-vue`](./packages/ConfigForm/designer-antd-vue/)         | Ant Design Vue 可视化设计器适配                             |
| [`@moluoxixi/config-form-plugin-antd-vue`](./packages/ConfigForm/plugin-antd-vue/)             | Ant Design Vue runtime adapter                              |
| [`@moluoxixi/config-form-plugin-element-plus`](./packages/ConfigForm/plugin-element-plus/)     | Element Plus runtime adapter                                |
| [`components-playground`](./playgrounds/components-playground/)                                | `@moluoxixi/components` 包组件示例                          |
| [`config-form-playground`](./packages/ConfigForm/playground/)                                  | Element Plus、Ant Design Vue 与当前可视化设计器示例和测试   |

ConfigForm runtime adapter 包不单独提供 playground，也不是 Vue `app.use()` 插件；需要接入 adapter 时，由对应 UI 示例或业务入口传给 `runtime.plugins`。

## 开发

```bash
# 安装依赖
pnpm install

# 启动组件聚合 playground
pnpm dev:components

# 启动轻量 ConfigForm playground
pnpm dev:config-form

# 构建核心包
pnpm build

# 运行测试
pnpm test

# 类型检查（含 defineField 推导测试）
pnpm typecheck
```

## 导航站点与部署

导航首页直接复用本仓库的 VitePress 文档主题，并连接仓库内的四个应用入口。组件文档下方的分类、搜索与示例保持可用；中文和英文首页都提供导航。

| 入口              | 站点路径                                          | 源码目录                            |
| ----------------- | ------------------------------------------------- | ----------------------------------- |
| 统一导航          | `/`                                               | `docs/vitepress`                    |
| 组件库文档        | `/components/`                                    | `docs/vitepress` 与各组件原有文档   |
| ConfigForm 设计器 | `/config-form-playground/designer.html#/projects` | `packages/ConfigForm/workbench`     |
| 组件演示          | `/components-playground/`                         | `playgrounds/components-playground` |
| Vue Playground    | `/vue-playground/`                                | `playgrounds/vue-playground`        |

建议使用 Node.js 24 LTS，或 `.node-version` 对应的 Node.js 22 最新补丁版，按仓库的 `packageManager` 安装 pnpm，运行：

```bash
pnpm install --frozen-lockfile
pnpm build:site
pnpm preview:site
```

`build:site` 调用现有 `scripts/build-pages.mjs`，将根路径 `/` 的完整产物写入 `out/`。Sites 的 `.openai/hosting.json` 指向这个目录；任何支持静态文件的托管服务也可以直接部署它。GitHub Pages 继续使用 `pnpm build:pages`，默认前缀为 `/vue-components/`，产物为 `dist/pages/`。

文档构建默认同步 GitHub 仓库信息；在没有 GitHub API 访问的环境，可使用仓库已有的 `VITE_DOCS_REPOSITORY_METADATA_PROVIDER=local` 环境变量，从本地 Git 生成元数据。该选项保留 GitHub 源码链接。

设计器的浏览器独立模式支持项目、模板、设计、预览、导出及 IndexedDB 本地保存。AI 生成、AI 修改和 MCP 功能需要连接原有 `@moluoxixi/config-form-local` 工作区；静态部署不会启动这些本地服务。Vue Playground 使用原有在线依赖加载机制，运行示例时需要访问其配置的模块 CDN。

站点发布使用本仓库的完整源码与锁文件，导航和部署适配也在仓库内维护。更新 GitHub 源码后需要重新构建并发布，当前 Sites 发布不会自动跟随 GitHub 的每次提交。

## License

MIT

<!-- AIRULES:TRELLIS:START -->

## Trellis 工作流

本项目使用 Trellis 管理 AI 辅助开发流程。在本项目中使用 AI 编程助手时，可以直接发送以下提示词：

```text
请使用 Trellis 开始处理这个需求：<描述需求>
请使用 Trellis 继续当前任务。
请使用 Trellis 检查当前改动。
请使用 Trellis 完成本次工作。
```

AI 编程助手会根据当前宿主选择可用的命令或技能。项目的工作流、任务和规范状态位于 `.trellis/`。

将接口文档、业务说明等文本资料放入 `.trellis/knowledge/sources/`。AI 会在每次对话时检查内容差异，把资料按业务域和稳定实体整理到 `.trellis/knowledge/library/`，并更新 `.trellis/knowledge/index.md`；只有遇到会实质影响整理结果的歧义时才会询问。

<!-- AIRULES:TRELLIS:END -->
