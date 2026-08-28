# 配置化在线网站工作台总体设计

## 架构目标

- 让完整虚拟项目成为 Config、Designer、Source 与 Page Preview 的唯一项目级真源。
- 复用现有 ConfigForm Designer 与 Vue REPL 基础，但不让两者反向拥有项目状态。
- 用受控模板和依赖白名单交付真实可导出项目，不引入任意项目执行与 WebContainer 风险。
- 先完成浏览器本地单用户产品，repository 边界为未来服务端存储保留替换点。

## 包与职责

新建 private workspace app：

```text
packages/ConfigForm/workbench/          @config-form/workbench
  src/project/                          项目协议、路径、revision、模板、repository、ZIP
  src/modes/                            Config / Designer / Source 同步
  src/preview/                          WorkspaceProject -> @vue/repl 投影与运行
  src/workbench/                        产品状态、布局与命令
  src/components/                       网站 UI
  e2e/                                  产品端到端测试
```

- 现有 `packages/ConfigForm/playground` 继续负责 ConfigForm 包集成验证，不承载产品持久化状态。
- 项目内核首版保持 workbench app-local，以 `src/project/index.ts` 作为唯一内部入口；出现第二个真实消费者后再提取 workspace 包。
- Workbench 直接依赖 `@vue/repl` / `@vue/repl/core`，不依赖 `@moluoxixi/vitepress-theme-element-plus/repl`。文档 wrapper 的 Element Plus 模板、URL hash 和 header 状态不属于产品协议。
- 新 private app 需要更新 `packages/ConfigForm/README.md` 的职责说明，但不加入公开包发布边界。

## 核心数据模型

```ts
interface WorkspaceProject {
  schemaVersion: 1
  id: string
  name: string
  revision: number
  template: { id: string; version: number }
  manifest: ProjectManifest
  files: Record<ProjectPath, WorkspaceFile>
  createdAt: string
  updatedAt: string
}

interface WorkspaceFile {
  kind: 'text' | 'binary'
  language?: string
  content: string | Uint8Array
}

interface ProjectManifest {
  framework: 'vue'
  entry: ProjectPath
  designerArtifact: ProjectPath
  generatedFormModule: ProjectPath
  dependencies: Record<string, string>
  adapter: 'element-plus' | 'antd-vue'
}
```

- `schemaVersion`、template version、project revision 与 storage schema version 独立演进。
- ProjectPath 是规范化 POSIX 相对路径，拒绝绝对路径、盘符、UNC、反斜杠、`.` / `..`、空段、大小写冲突和 Windows 保留名。
- 项目数据只包含 structured-clone-safe 值；AST、Vue proxy、组件、函数、Blob URL、diagnostics、editor selection 和运行日志不持久化。

## Revision 与草稿

```text
committed WorkspaceProject revision N
  ├─ Config draft
  ├─ Source file drafts
  ├─ Designer session history
  └─ last successful preview artifact
```

- 模式内键入只更新 draft；通过解析和领域校验后，以 `baseRevision` 原子提交为 N+1。
- repository 使用 compare-and-swap；过期 base revision 返回显式 conflict。
- Designer 内部 history 继续处理表单语义命令；外层 project revision log 处理跨模式提交。
- Preview 只消费 immutable committed revision。失败时保留 last successful artifact，并标出 requested/successful revision 差异。

## 本地持久化

定义领域接口 `WorkspaceProjectRepository`，提供 `get/list/create/commit/saveDraft/delete/close`，并为 memory 与 IndexedDB adapter 运行同一 contract suite。

- 扩展 `@moluoxixi/indexed-db`：增加单 key read-modify-write 的原子 `updateItem`，在同一个 readwrite transaction 内读取、执行同步 updater 并提交。
- 一项目一条 committed envelope：`project:<id>`；draft 使用独立 key，不污染 committed snapshot。
- `list()` 通过 `project:` keys 读取 summary，首版不维护需要跨 key 原子更新的 catalog。
- Envelope 在读取时执行 Zod schema 校验和应用级 migration；数据库 object store 保持稳定，避免首版引入复杂 IDB schema migration。
- IndexedDB 不可用时 composition root 显式选择 memory repository，并向 UI 暴露 `volatile` 状态；不在底层静默 fallback。

## 模板与真实项目

- 首版至少提供两个内置模板，分别覆盖 Element Plus 与 Ant Design Vue，并使用真实 ConfigForm Renderer/DesignerDocument 语义。
- 模板生成器输出确定性的 `Record<ProjectPath, WorkspaceFile>`，包含 `package.json`、`pnpm-lock.yaml`、Vite config、tsconfig、`index.html`、入口、页面、样式、designer JSON 和声明式 form module。
- 模板依赖写真实 registry 版本，禁止把 `workspace:*` 或 `catalog:*` 泄漏到导出项目。
- 工作台隐藏的 REPL bootstrap、runtime declarations 与 import map projection 不进入 ZIP。

## ZIP 与构建真实性

- 使用 `fflate` 把虚拟文件映射编码为 ZIP；浏览器下载沿用仓库 `Blob -> object URL -> download` 模式。
- ZIP entry 统一 `/`，下载根目录与文件名经过跨平台安全清理。
- Node 验证脚本调用同一模板生成核心，把项目写入临时目录，再执行 frozen install、TypeScript 和 Vite build。
- CI 验证 workspace 开发版本时，先 pack 所需 ConfigForm 包并在临时项目中用 `file:` tarball 替换 registry 依赖，避免 workspace symlink 假通过。
- 验证 ZIP 解压后与生成文件映射逐文件一致。

## 三模式与 Preview 边界

- Config 和 Designer 编辑 manifest 指定的 designer artifact。
- Source 编辑整个虚拟文件树；只有受控 form module / artifact 可双向投影到 Designer。
- `@vue/repl` store 是 project revision 的运行投影，不是项目 store。
- import map 由受控 manifest dependencies 生成；browser preview 不解释任意 Vite plugin 或 Node API。
- Workbench 独立维护 requested/successful build revision，旧异步结果不得覆盖新状态。

## 产品界面

- 首屏进入最近项目；无项目时显示紧凑模板选择并立即创建，不制作营销 landing page。
- 桌面使用文件/模式区、主编辑区与 Page Preview 的工作台布局；窄屏使用清晰的 Edit / Preview 视图切换。
- Config / Designer / Source 使用 tabs；Source 模式显示文件树和 Monaco，Preview 始终展示 revision、状态和 viewport。
- 保存、重置、导出等明确命令使用图标按钮、tooltip 和可访问名称。

## 子任务集成顺序

1. Project Core 固化项目、repository、模板与 ZIP 协议。
2. Three Mode 与 Live Preview 在 Project Core 完成后并行开发。
3. Designer 拖拽回归子任务在 Three Mode 的 Designer 投影稳定后执行，独立验证双适配器物料和布局落点。
4. Product Shell 集成前述能力，并纳入 Designer UX 子任务。
5. 父任务执行跨子任务 E2E、真实导出 build 与架构文档复核。

## 风险与回滚

- `@vue/repl` API 漂移：锁定版本并为 projector/store init/hidden entry 建立 contract tests。
- IndexedDB 多标签冲突：依靠 transaction 内 CAS，不使用 last-write-wins。
- 模板与在线 Preview 语义漂移：共享 manifest、依赖版本和生成器，并把导出项目标准 build 纳入 CI。
- ZIP/路径跨平台：纯函数级路径契约与解压等价测试先于 UI。
- 每个子任务保持独立边界；父任务不直接实现业务代码，失败时可回滚某个子任务而不迁移 DesignerDocument。
