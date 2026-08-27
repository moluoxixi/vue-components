# 配置化在线网站工作台

## 目标

构建一个可直接使用的在线网站工作台。用户从受控的 Vue 3 + Vite 模板创建项目，通过 Config、拖拽设计器和 Source 三种编辑形态修改同一个虚拟项目，并实时看到 Page Preview。

Source 必须是完整、可下载、可在标准 Node 环境安装依赖、类型检查和 Vite build 的真实项目源码，而不是仅供展示的代码片段。

## 已确认产品决策

- 产品本体是在线网站，而不是嵌入外部业务项目的 Designer 插件。
- 同一项目提供 Config、拖拽设计器和 Source 三种编辑形态，共同驱动实时 Page Preview。
- 首版只支持平台提供的受控 Vue 3 + Vite 项目模板，不支持导入现有项目。
- 首版不承诺任意 npm 依赖、任意 Vite plugin、在线终端或浏览器内 Node/Vite 运行时。
- `DesignerDocument` 继续作为表单领域 IR，但项目级单一真源是版本化虚拟项目和文件系统。
- Babel / Vue compiler 只用于源码解析、生成和运行，不作为持久化配置协议。
- 无效 Config 或 Source 只保留为 draft；Page Preview 继续显示最后一个成功 revision，并明确标记已落后。
- 模板库、完整源码导出和可构建验证属于本阶段范围。
- 首版采用浏览器 IndexedDB 本地持久化，并通过 repository 抽象隔离存储；不包含账号与服务端项目存储。
- 现有 `08-27-config-form-designer-ux` 作为产品界面子树中的专项任务保留。

## 仓库基础

- 仓库已有 `@vue/repl`、Monaco、多文件内存 store、Vue browser compiler、import map、运行诊断和隔离 Preview：`packages/vitepress-theme-element-plus/src/repl/ElementPlusDocsRepl.vue:137`、`packages/vitepress-theme-element-plus/src/repl/store.ts:77`。
- Vue Playground 已能把仓库构建产物与 CSS 注入 REPL：`playgrounds/vue-playground/src/App.vue:34`。
- ConfigForm Designer 已有稳定 `DesignerDocument`、history、compiler、双 adapter 和真实组件画布，但当前 Playground 只持有单个内存文档：`packages/ConfigForm/playground/src/designer/DesignerExample.vue:42`。
- 当前 REPL 没有完整项目 manifest、`package.json` / Vite config 语义、模板迁移、项目导出或部署能力。
- 当前 Designer JSON 导出只是 `JSON.stringify(document)`，尚无真实项目 Source codec：`packages/ConfigForm/designer/src/composables/use-designer-controller.ts:354`。

## 父任务范围

### P1. 在线项目模型

- 定义版本化 `WorkspaceProject`、`ProjectManifest`、虚拟文件、revision 和事务提交协议。
- 提供至少一个受控 Vue 3 + Vite ConfigForm 项目模板，包含完整源码文件、锁定依赖和模板版本。
- 提供内置模板目录、项目创建、重置和 ZIP 导出。
- 提供内存与 IndexedDB repository；IndexedDB 不可用时必须显式显示临时会话状态，不得静默宣称已持久化。
- 导出项目必须通过仓库自动化在标准 Node 环境完成安装可解析性、TypeScript 和 Vite build 验证。

### P2. 三种编辑形态

- Config 编辑表单 artifact 的规范化 JSON。
- 拖拽设计器复用现有 ConfigForm Designer，并把有效语义命令提交为项目 revision。
- Source 使用 Monaco 编辑虚拟项目完整文件树。
- 三种形态不维护长期分叉状态；通过 base revision、draft、原子提交和显式冲突保持一致。
- Designer 只可视化它支持的表单语义；Source 超出可视化子集时必须进入明确只读/不支持状态，不能静默降级重写。

### P3. 实时 Page Preview

- 每个成功项目 revision 触发异步编译运行；旧 build result 不得覆盖新 revision。
- Page Preview 运行项目浏览器可执行子集，并展示 compile、runtime 和 ConfigForm diagnostics。
- 无效 draft 或失败 build 保留最后一个成功页面并显示 stale 状态。
- 支持 desktop / tablet / mobile 预览尺寸、刷新和运行日志清理。

### P4. 网站产品界面

- 首屏直接进入可用工作台，不制作营销 landing page。
- 提供项目/模板入口、Config / Designer / Source 模式、文件树、Page Preview、diagnostics、导出和重置。
- 桌面优先支持高效分栏；中窄宽度提供可达的模式与 Preview 切换，不发生面板嵌套卡片或多重滚动失控。
- 使用克制、专业、工具型视觉语言，并完成键盘、焦点和基础可访问性。

## 子任务与顺序

1. `08-27-config-form-workbench-project-core`：项目模型、模板、revision 与导出，是其他子任务的协议基础。
2. `08-27-config-form-workbench-three-mode`：依赖项目内核，完成表单 artifact、Config、Designer 与 Source 同步。
3. `08-27-config-form-workbench-live-preview`：依赖项目内核，并消费三模式提交的 project revision。
4. `08-27-config-form-workbench-product-shell`：集成前述能力与网站工作流；其子任务 `08-27-config-form-designer-ux` 负责 Designer 专项体验。

三模式与 Preview 可在项目内核稳定后并行，产品界面最终集成在两者之后。

## 跨子任务验收标准

- [ ] 从内置模板创建项目后，Config、Designer 和 Source 展示同一初始表单与项目。
- [ ] 任一模式的有效提交产生新 project revision，另外两种模式与 Page 在可接受延迟内同步。
- [ ] 无效 JSON/Source 不污染 committed project，Page 保持最后成功版本并显示准确诊断。
- [ ] Source 包含完整 Vue 3 + Vite 项目，可下载为 ZIP，并通过自动化标准构建验证。
- [ ] Designer 不支持的源码语义不会被静默删除或改写，用户能看到明确的 capability 状态。
- [ ] 模板创建、三模式编辑、Preview、诊断、重置和导出构成一条 Chromium 端到端主流程。
- [ ] Firefox 与 WebKit 至少覆盖项目打开、模式切换、Source 编辑、Designer 编辑和 Preview 冒烟流程。
- [ ] 工作台在桌面与 390px 窄屏无不可达命令、非预期横向溢出或内容重叠。

## 不在首版范围内

- 导入已有本地或远程项目。
- 账号、多人协作、权限、评论或云端部署。
- 任意 npm 安装、在线终端、任意 Vite plugin 和 WebContainer。
- React、Svelte 或 Vue 之外的框架模板。
- 任意手写 Vue/TS/JSX 到 Designer 的完整无损反编译。

## 研究依据

- `.trellis/tasks/08-27-config-form-designer-ux/research/online-website-workbench.md`
- `.trellis/tasks/08-27-config-form-designer-ux/research/code-roundtrip-feasibility.md`
