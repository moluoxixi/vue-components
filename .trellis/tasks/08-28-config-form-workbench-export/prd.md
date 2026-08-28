# 配置化工作台完整工程导出与源码查看

## 目标

为在线工作台提供两种只读导出物，并让用户能在导出前检查真实文件内容：

1. Config 导出为使用公开 `defineFields()` / `defineField({...})` API 的 TypeScript 配置源码。
2. Source 导出为完全脱离 ConfigForm runtime 的、可安装和构建的 Vue 3 + Vite 完整工程。

导出查看器采用左侧文件树、右侧只读源码编辑器；Source 工程必须包含完整 `package.json`，而不是只展示 `App.vue` 片段。

## 背景与已确认事实

- 父任务已定义 `WorkspaceProject`、受控模板、虚拟文件和 ZIP 基础能力；本子任务负责导出语义和查看体验，不重新定义项目 repository。
- 当前模板的 `src/App.vue` 仍导入 `ElementConfigForm` / `AntdConfigForm` 并消费 `form.config`，不能直接作为“纯 Source”导出物。
- 当前 `formatLowCodePageConfig` 已能生成包含 `defineField({...})` 条目的 `form.config.ts`，应复用其确定性格式化和 Registry 校验。
- Config、Source 只读，不从导出的源码反向更新 Config Model；导出必须由当前已提交的 Model revision 生成。

## 需求

### R1. 导出入口与 revision

- 顶部导出菜单至少提供“导出配置”和“导出源码”两个命令。
- 两个命令先打开只读预览，再提供复制、下载；不得把导出预览变成可编辑 provider。
- 导出内容必须标注来源的 project/model revision；失败时不下载部分文件。
- 导出只消费已提交且通过 Registry 校验的 Config Model。未保存或无效 draft 不得静默覆盖 committed revision。

### R2. Config 源码导出

- 输出 TypeScript 源码，包含真实的 `defineField({...})` 调用；按当前公开 API 需要使用 `defineFields<T>()` 工厂，但不能退化成纯 JSON 或内部 `DesignerDocument` 序列化。
- 保留字段 component、field、label、props、布局、校验、条件/反应式声明和受支持的具名 slot 语义。
- 输出确定、稳定、可复制和可下载，使用 `src/form.config.ts` 作为默认文件名。
- 未注册组件、缺少 source 映射或无法表达的语义必须显示诊断并阻止导出，不得静默丢字段。

### R3. 纯 Vue Source 工程

- 生成可独立运行的 Vue 3 + Vite 工程，至少包含：`package.json`、`index.html`、`vite.config.ts`、`tsconfig.json`、`src/main.ts`、`src/App.vue`、样式和生成所需辅助文件。
- `package.json` 必须是完整 manifest，依赖使用真实版本号，禁止 `workspace:`、`catalog:`、任意用户依赖或隐藏的工作区路径。
- `src/App.vue` 和辅助源码直接使用 Vue 与受控 UI 组件库，不导入 `@moluoxixi/config-form-*`、`ConfigForm`、`ConfigFormRenderer`、`form.config.ts` 或其他 ConfigForm runtime。
- 生成的源码要表达当前 Model 的组件层级、props、布局、初始值、校验及已支持的事件/绑定效果；不支持的动态语义必须在生成前报诊断。
- 纯 Source 工程的运行结果应与当前 Runtime Preview 的静态页面语义保持一致；导出项目在隔离目录中可安装、类型检查并完成 Vite build。

### R4. 文件树与源码查看器

- Source 预览弹窗左侧显示规范化工程文件树，至少能看到 `package.json` 和全部生成文件；右侧显示当前选中文件源码。
- 编辑器只读，保留语法高亮、折叠、搜索/复制能力，不提供保存回 Model 的入口。
- 根据文件扩展名选择 Vue、TypeScript、JSON、CSS、HTML 等语言；切换文件不丢失当前 revision 标识。
- Config 预览复用同一查看器协议，默认打开 `src/form.config.ts`；可复制和下载配置源码。

### R5. 完整工程下载与安全

- “导出源码”下载一个包含文件树全部文件的 ZIP；解压后的文件集合必须与预览完全一致。
- 所有 ZIP entry 使用安全的 POSIX 相对路径和清理后的工程名；不得写入绝对路径、`..`、临时目录或本地 token。
- 浏览器下载失败只反馈错误，不改变项目 revision 或导出内容。

## 验收标准

- [ ] AC1：导出配置预览和下载内容包含 `defineField({`，并能通过现有受控 Config codec 解析。
- [ ] AC2：导出源码的文件树包含 `package.json`、Vite/TS 配置、入口、页面和样式，且与下载 ZIP 解压内容逐文件一致。
- [ ] AC3：纯 Source 工程源码和 `package.json` 不包含 ConfigForm runtime/import；隔离目录安装、TypeScript 检查和 Vite build 通过。
- [ ] AC4：Source 预览支持左侧文件树、右侧只读 Monaco、语法高亮、文件切换、复制和下载；Config 预览复用该只读协议。
- [ ] AC5：导出内容来自指定 committed Model revision；无效组件或不可生成语义显示诊断并阻止下载。
- [ ] AC6：Element Plus 与 Ant Design Vue 模板各至少通过一条 Source/Config 导出和真实构建验证。
- [ ] AC7：桌面与窄屏下文件树、源码区和导出操作可达，不产生横向溢出或文字意外换行。

## 不在范围内

- 不支持导入任意 Vue/TypeScript 项目或从纯 Source 反向生成 Config Model。
- 不允许任意 npm 依赖、任意 Vite plugin、在线终端或浏览器内 Node/WebContainer 执行。
- 不在本子任务实现流程编排执行引擎；流程 IR 只在其独立任务完成后作为可生成语义接入。

## 待确认的产品决策

- 有未保存 draft 时，导出应仅导出最近已提交 revision（推荐，保证导出可复现），还是先自动提交 draft 再导出？
