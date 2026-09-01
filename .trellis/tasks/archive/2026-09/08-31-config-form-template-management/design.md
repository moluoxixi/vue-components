# ConfigForm 独立模板管理技术设计

## 1. 架构边界

```text
App
  -> WorkbenchViewCoordinator (designer | create)
     -> WorkbenchShell                 # 只负责当前项目编辑
     -> TemplateCreationWorkspace      # 只负责创建来源与目标

TemplateCatalogProvider (readonly, async, JSON-safe)
  -> TemplateCatalogService
     -> manifest/seed validation
     -> search/filter projection
     -> compatibility diagnostics
     -> instantiateProject / instantiatePage
        -> identity remap
        -> Model schema validation

TemplatePreviewService
  -> in-memory candidate ProjectDocument
  -> createProjectSnapshot
  -> compileCanonicalPage
  -> PreviewRuntimeHostFrame

create project -> ProjectRepository.create -> openProject
create page    -> one ProjectCommand -> ProjectDomainEngine -> select page
```

`WorkbenchShell` 不导入模板 feature。App 级协调器只保存 `view`、`target` 和返回焦点句柄；搜索、category/provider filter、selected template、mobile pane、预览 request id 和预览 Runtime state 全部由 `TemplateCreationWorkspace` 或其 feature-local composable 拥有。

## 2. 数据合同

```ts
type TemplateCreationTarget = 'page' | 'project'
type ProjectTemplateCategory = 'blank' | 'starter'

interface ProjectTemplateComponentRequirement {
  key: string
  contractVersion?: string
  fingerprint?: string
}

interface ProjectTemplateManifest {
  id: string
  version: number
  displayName: string
  description: string
  adapter: WorkbenchAdapterId
  category: ProjectTemplateCategory
  order: number
  tags: string[]
  registry: {
    adapter: WorkbenchAdapterId
    components: ProjectTemplateComponentRequirement[]
  }
  preview: {
    preferredViewport: 'desktop' | 'mobile' | 'tablet'
    pageId: string
  }
}

interface ProjectTemplateSeed {
  manifest: ProjectTemplateManifest
  page: ProjectPage
}

interface TemplateCatalogProvider {
  readonly id: string
  list(): Promise<readonly ProjectTemplateSeed[]>
}
```

Provider 只返回可结构化克隆的数据。`createPage`/`createProject` 不再属于 Provider entry；服务在验证 seed 后统一实例化。内置 Provider 直接返回冻结的本地 seed。未来远程 Provider 可实现同一只读接口，但网络、签名和缓存不在本任务内。

所有输入在 catalog 边界做一次 `unknown -> typed` 解析，禁止 UI 层局部 cast。Provider id、template id、category、adapter、版本、危险 key、数组长度和 seed schema 均 fail closed。单个 Provider 最多返回 256 个模板，单个 seed 内任一数组最多包含 4096 项；超过上限作为 Provider 或模板诊断隔离，不进入排序和实例化。目录合并按 `order -> displayName -> id` 稳定排序，跨 Provider 重复 id 是显式诊断而非后者覆盖前者。

## 3. Identity 重映射

新增 project 层纯函数，输入 `ProjectPage seed`、目标 page identity 和 `TemplateIdentityFactory`，输出全新页面及映射表：

```ts
interface TemplateIdentityMap {
  nodes: ReadonlyMap<string, string>
  fields: ReadonlyMap<string, string>
  reactions: ReadonlyMap<string, string>
  flows: ReadonlyMap<string, string>
  flowNodes: ReadonlyMap<string, string>
  flowEdges: ReadonlyMap<string, string>
}
```

默认 factory 使用 `crypto.randomUUID()`；测试注入确定性 nonce。先完整建立映射，再在第二遍重写引用，避免遍历顺序影响结果。覆盖：

- `graph.root`、layout slots、`nodesById` key 与 `node.id`；
- field node 的 `field`；validation compare field；conditions/reaction operands、effect target、reaction id；
- Flow id、trigger field/nodeId、flow node/edge id、edge source/target；
- condition/reaction flow node中的正式 typed config。

Flow 内部 identity 不是页面级全局 key。`flowNodes` 与 `flowEdges` 的映射键必须包含所属 Flow identity；嵌入 condition/reaction 节点的 reaction 映射键还必须包含所属 Flow 与 flow-node identity。这样两个 Flow 可以合法复用 `trigger`、`end`、`reaction` 等局部 id，而不会让后遍历的 Flow 覆盖先前映射。对外返回的映射表使用同一作用域 key，调用方不得再按裸旧 id 查询 Flow 内部映射。

Registry event action、binding source 和 opaque action config 是 Registry/业务字符串，不做猜测式替换。若 Provider 声明了当前合同无法安全表达的 identity 引用，catalog validation 返回 `TEMPLATE_IDENTITY_REFERENCE_UNSUPPORTED`。实例化完成后再次运行 page/project schema，确保没有悬空引用。

## 4. 兼容性与创建事务

### 创建项目

1. 服务取得模板 seed 并加载 manifest adapter。
2. 比较 manifest Registry requirements 与 adapter `componentRegistry`/lock。
3. 实例化全新 page/project identity，使用 adapter 当前 lock 构造项目。
4. `createProjectSnapshot + compileCanonicalPage` 做最终预检。
5. 仅当所有步骤成功时调用 Repository `create`；打开 recovery store、建立 coordination 与 persistence session 后再发布新 adapter/editor session。若持久化后、激活前失败，立即删除本次新建实体作为补偿；补偿删除失败必须明确通知并保留可恢复实体。激活后的项目目录刷新或 recovery draft 列表读取失败只通知，不得删除或回滚已激活项目。

如果当前项目处于保存冲突或不可安全切换状态，步骤 1-4 可用于浏览/预览，但步骤 5 被 controller 拒绝，并保留当前会话。

### 创建页面

1. 目标 adapter 固定为当前项目 Registry lock adapter。
2. 不兼容模板保持可浏览但创建禁用。
3. 使用 `nextProjectPageId/Route` 和 identity remap 生成页面。
4. 以一个 `operation.apply(page.add)` Project Command 提交。
5. 成功后选择新页并退出工作区；失败不改变工作区和当前编辑状态。

Controller 暴露显式 `createProjectFromTemplate` / `createPageFromTemplate`，不再保留 `selectTemplate` 的隐式分支。busy/request token 防止双击与过期异步完成；Repository 仍是项目创建唯一持久化入口。

## 5. 预览数据流

`TemplatePreviewService.prepare(templateId)` 每次生成独立 candidate identity，并返回：

- `PageCompilation`；
- adapter/namespace；
- 从 graph defaults 生成的 `{ values, touched: [], validation: {} }`；
- 初始空 reaction projection `{ values, props: {}, states: {}, validate: [] }`；
- `revision` 与 `runtimeSessionKey`，均包含 template/version/request identity；
- compatibility/compiler diagnostics。

Workspace 使用递增 request token；只有 token 与当前选中 template 一致时发布结果。组件卸载或切换时丢弃过期结果。模板 Runtime 值只留在 Workspace 局部状态，绝不调用 controller 的 active `PreviewSession`。

## 6. UI 与视觉方向

### 主题

对象：高频使用 ConfigForm Workbench 的开发者/配置人员。单一任务：选择一个可信的创建来源并检查它将生成什么。

- `Workbench ink`：`#111214` / `#f5f7fa`，标题与关键状态。
- `Workbench paper`：`#f8f9fb` / `#1a1b1f`，目录与详情表面。
- `Registry blue`：`#1769d2` / `#4c9ffe`，选中、焦点和兼容 rail。
- `Contract green`：`#237a4b` / `#78d6a3`，兼容状态。
- `Diagnostic red`：`#b4232d` / `#ff7b72`，阻断诊断。
- `Utility gray`：`#626873` / `#a9adb7`，元数据。

字体继续使用现有 Inter/system UI；manifest id、版本和 Registry key 使用 `ui-monospace`。不新增字体资源，避免与嵌入式 Workbench 宿主冲突。

### 布局

```text
1440 / 900
+-------------------------------------------------------------+
| Back | Create project/page            locale theme          |
+----------------------+--------------------------------------+
| Search               | Template title         [Create]      |
| Category / Provider  | compatibility + manifest metadata    |
|----------------------|--------------------------------------|
| template list        | real RuntimeHost preview             |
| selected rail        |                                      |
|                      |                                      |
+----------------------+--------------------------------------+

390
+----------------------+
| Back  Create page    |
| [Catalog] [Details]  |
+----------------------+
| one active pane      |
| stable bottom action |
+----------------------+
```

目录是连续列表而非装饰卡片墙；selected rail 将 Registry 合同状态编码为结构信息，是本视图唯一强调元素。右侧预览是实际产品内容，不使用插画或氛围背景。圆角不超过 6px，不嵌套卡片，不使用渐变或装饰光斑。

## 7. 可访问性与焦点

- 创建工作区顶层为命名 `main`，目录是单选 listbox 或语义列表；实现 roving tabindex 与 ArrowUp/Down/Home/End。
- 搜索和筛选使用 Element Plus 输入/segmented/select 等成熟控件；命令按钮使用 Lucide 图标与文本/tooltip。
- 进入时焦点落到搜索；从入口进入时记录可稳定重定位的 trigger key。返回后 `nextTick` 恢复该控件；首启无返回目标。
- 390px 详情返回目录后恢复到先前 template item；Escape 只在存在合法返回目标时退出。
- 兼容性加载用 `role=status`，阻断诊断用 `role=alert`；disabled 按钮旁保留可见原因，不能只依赖 tooltip。
- `prefers-reduced-motion` 下取消 pane transition。所有固定工具栏、筛选、Runtime 区和底部 action 使用稳定 grid 轨道，加载文案不会推动布局。

## 8. 兼容、迁移与回滚

- 保留 `createBuiltInProject`/`createBuiltInProjectPage` 兼容导出作为薄包装，现有 export/fixture 测试无需一次性迁移；内部委托新 catalog service。
- 旧 `TemplateDialog.vue` 和 `templatePickerOpen` 在所有调用方迁移后删除，不保留双入口。
- 不改 `ProjectDocument`、Registry wire/snapshot、RuntimeHost protocol 或自定义 Designer slot scope。
- 回滚时可以恢复旧 App 视图装配，但新 manifest/identity 服务保持向后兼容，不需要数据迁移。

## 9. 风险与控制

- **identity 引用漏改**：两遍映射、schema 再验证、包含 reaction/flow 的专门 fixture 与属性测试。
- **预览污染当前会话**：服务无 controller PreviewSession 依赖；E2E 比较创建工作区前后 history/revision/active preview。
- **异步切换竞态**：request token + unmount guard；用可控 Promise 单测反序完成。
- **移动端操作被遮挡**：固定轨道、长文本和 390px Playwright 几何断言。
- **兼容检查与 compiler 漂移**：兼容检查用于解释，compiler 作为最终权威；测试要求两者对同一缺失组件同时拒绝。
- **架构回流**：architecture-boundary 测试禁止 `WorkbenchShell` 引用 templates feature 或 catalog browse state。
