# 在线网站工作台架构

## 产品定义

产品本体是一个在线网站工作台，不是嵌入其他项目的表单组件，也不是连接外部项目文件的调试面板。

同一个在线项目具有三种编辑形态，并共同驱动实时页面：

```text
Online Workspace Project
  ├─ Config editor
  ├─ Drag designer
  ├─ Source editor
  └─ Live Page preview
```

- Config 是项目中表单领域配置的结构化视图。
- 设计器是同一领域配置的可视化编辑器。
- Source 是可实际导出、构建和部署的项目文件，而不是示例代码片段。
- Page Preview 是当前有效项目 revision 的运行结果，不是第四份业务状态。

## 仓库现有基础

- 仓库已使用 `@vue/repl`，并通过 `@vue/repl/monaco-editor` 提供 Monaco：`packages/vitepress-theme-element-plus/src/repl/ElementPlusDocsRepl.vue:3`。
- 现有 REPL 已支持多文件内存状态、主入口、TypeScript、import map、Vue compiler、实时 Preview、运行时错误与警告：`packages/vitepress-theme-element-plus/src/repl/store.ts:77` 和 `packages/vitepress-theme-element-plus/src/repl/ElementPlusDocsRepl.vue:137`。
- 现有 Vue playground 已将仓库构建产物作为浏览器模块与 CSS 注入 REPL：`playgrounds/vue-playground/src/App.vue:34`。
- 当前 REPL 仍是受控 import-map 环境，不包含 `package.json`、Vite config、任意 npm install、项目导出或部署，因此还不能直接等同于完整 Vite 项目。
- 当前 ConfigForm Designer 的唯一状态是 `DesignerDocument`，Playground 仅通过 `shallowRef` 保存该文档：`packages/ConfigForm/playground/src/designer/DesignerExample.vue:42`。

## 单一真源

下一阶段的单一真源应提升为版本化的虚拟项目，而不是单独的 `DesignerDocument` 或 Source textarea：

```ts
interface WorkspaceProject {
  revision: string
  manifest: ProjectManifest
  files: Record<ProjectPath, ProjectFile>
}
```

项目 manifest 至少描述 framework、entry、designer artifact、config entry、dependencies 和 template version。虚拟文件系统保存真实项目文件、语言与版本。

`DesignerDocument` 继续是表单领域 IR，但只是虚拟项目中的一个受控 artifact。它不承载文件树、源码、依赖、assets、build cache、编辑器草稿、诊断或 Preview runtime 状态。

## 三种编辑形态

### Config

- 编辑或投影 manifest 指向的 designer artifact。
- 无效 JSON 只进入 draft；strict schema 和 registry analysis 成功后才提交 project revision。

### 设计器

- 继续复用现有 Designer controller、history、compiler 和 adapters。
- 一次有效设计命令更新 designer artifact，并作为项目事务产生新 revision。

### Source

- 编辑虚拟项目中的真实文件，包括 `package.json`、`index.html`、Vite config、`src/main.ts`、page、form module 和允许的业务组件。
- Source 的逐字符 undo 属于文件 draft；保存后的项目级变更进入 revision log。
- 修改 designer artifact 的源码只有在可解析且可视化支持时才回投 Config/Designer；超出可视化子集时 Designer 进入只读诊断状态，不能静默重写源码。

## Page Preview

- Preview 消费不可变 project revision，并以 build id 丢弃过期异步编译结果。
- 当前可复用 `@vue/repl` 的浏览器 SFC/TS 编译、Monaco、多文件 store、import map 和隔离 Preview。
- Config、Designer 或 Source 的有效提交立即请求新 Preview；无效 draft 保留最后一次成功页面，并明确显示 Preview revision 已落后。
- Preview 是工作台内部运行面，可以使用 `@vue/repl` 自带的隔离运行容器；不需要为业务概念额外创建一个外部目标项目页面。

## “真实项目”的 MVP 定义

首版确定采用受控的 Vue 3 + Vite 项目模板：

- 虚拟项目包含完整、可下载的真实文件结构和锁定依赖。
- 导出后可在 Node 环境执行标准安装、类型检查和 Vite build。
- 在线 Preview 运行该项目中浏览器可执行的子集，并与导出生成器共享模板与语义测试。
- 不承诺浏览器内执行任意 Vite plugin、Node API、任意 npm install 或任意已有项目。
- 不提供现有项目导入；用户从平台模板创建项目，再通过三种编辑形态持续修改和导出。

只有未来产品明确需要在线终端、任意依赖安装和浏览器内真实 Vite dev server/build 时，才评估 WebContainer。仓库当前已有的 `@vue/repl` 比重新引入 Sandpack 更贴近 MVP。

## 状态与冲突

- 无效文本、编辑器 selection、diagnostics 和运行日志属于 session/draft，不进入 committed project。
- Config/Designer 使用结构化语义 history；Source 使用文件编辑器 history；跨模式提交使用 project revision log。
- 每次提交携带 base revision。并发模式修改同一 artifact 时做三方合并；同一路径双改必须显式冲突，不使用 last-write-wins。
- Preview 只发布当前请求 revision 的成功构建，旧构建结果必须丢弃或 dispose。

## 与当前任务的关系

该在线工作台属于下一阶段独立产品任务。`08-27-config-form-designer-ux` 仍只优化现有表单设计器，但其中央工作区、响应式布局和命令结构不应阻断未来接入 Config / Designer / Source / Preview 工作台。
