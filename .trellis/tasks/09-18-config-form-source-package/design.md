# ConfigForm Source 包技术设计

## 1. 目标与前置条件

本任务把 Workbench 当前混合在导出弹窗中的源码生成、文件树和 Monaco 查看
职责硬切到 `@moluoxixi/config-form-source`。Source 是 Studio 到工程代码的
单向快照边界：默认产物是程序员接手的原始 Vue/TypeScript 源码，源码直接使用
目标 UI 组件且不依赖 ConfigForm；Source 只接受稳定的 `ProjectCompilation` 与
两个由 Studio 组合根注入的 provider-neutral adapter，不反向发现 Designer、
Workbench、具体组件库 adapter 或 Repository。ConfigForm 配置文件集是第二种明确
产物，不把任何运行核心源码写入任一产物。

实现必须等 Surface、Dataset、Resource、Prototype Runtime 以及 Workbench
generator 5 合同完成并通过定向门禁后开始。当前任务可以先完成设计和测试夹具
规划，但不能通过临时 Page alias、旧 generator wrapper 或本地 reducer 绕过前置
合同。

## 2. 责任边界

```text
Studio composition root
  ├─ ProjectCompilation + registryLock
  ├─ SourceProviderResolver       (同步、provider-neutral)
  ├─ SourceResourceReader         (异步、Repository adapter 的 bytes 副本)
  ├─ generateVueSource()        -> RawSourceFileSetV1
  ├─ generateConfigFormBindings() -> ConfigBindingFileSetV1
  └─ ConfigFormSourceViewer       (受控只读树/代码组件)
      └─ Monaco lazy boundary
```

Source 拥有：

- 编译结果到可安装 Demo 项目原始文件的确定性生成；
- ConfigForm adapter 的字段/组件/布局绑定配置文件生成；
- component import/style 解析请求及失败诊断；
- embedded Resource 的 exact hash/长度校验、安全路径派生和 canonical base64；
- `SourceFileSetV1` 读取、路径/entry 校验和文件树投影；
- 只读 Viewer 的文件选择、桌面 split 和窄屏 tree/code 切换。

Studio 保留：

- Dialog、刷新/重新生成、复制、单文件下载、ZIP、通知和持久化；
- 从 `ProjectDocumentV6.registryLock` 构造 resolver 身份；
- 将 Repository 的 `readEmbedded` 适配成 SourceResourceReader；
- Experience/生成项目的运行命令及错误展示。

Source 明确不拥有弹窗、编辑、保存、网络请求、ZIP、回导、事件编排、handler
registry、字符串 action ref、接口/函数桩、ConfigForm reducer、Prototype session、
overlay host 或其它运行核心实现。生成源码只 import 这些能力的公开 npm 包。

## 3. 公共合同

Generator 根入口与 `/generator` 仅暴露纯数据合同，并且可在没有 `window`、
`document`、Vue DOM 或 Monaco 的 Node 进程中导入：

```ts
interface SourceProviderResolver {
  readonly adapter: SourceAdapterIdentity
  resolveComponent(
    request: SourceComponentRequest,
  ): SourceResolutionResult<SourceComponentResolution>
  resolveConfigFormBinding(): SourceResolutionResult<SourceConfigFormBindingResolution>
}

interface SourceResourceReader {
  readEmbedded(request: {
    projectId: ProjectId
    resourceId: ResourceId
    contentHash: string
  }): Promise<ContractResult<Uint8Array>>
}

interface GenerateSourceInput {
  compilation: ProjectCompilation
  providerResolver: SourceProviderResolver
  resourceReader: SourceResourceReader
}
```

`RawSourceFileSetV1` 和 `ConfigBindingFileSetV1` 都使用严格的 text/binary 判别联合；
前者的 `entry` 指向可运行源码入口，后者的 `entry` 指向配置入口：

```ts
interface SourceFileSetV1 {
  version: 1
  entry: string
  files: readonly SourceFile[]
}

type RawSourceFileSetV1 = SourceFileSetV1 & { kind: 'raw-source' }
type ConfigBindingFileSetV1 = SourceFileSetV1 & { kind: 'config-bindings' }
```

Raw source 的最小文件形态为：

```text
src/main.ts
src/App.vue
src/router.ts
src/surfaces/<surface>/Surface.vue
src/data/datasets.ts                   # static demo rows only
src/assets/*                           # embedded Resource bytes, when present
package.json                            # public Vue/UI dependencies only
```

`Surface.vue` 直接组合目标 UI 组件、Vue 状态、静态 Dataset 和可执行的 Demo 跳转/浮层
交互；它不 import ConfigForm。不得生成 `src/runtime/**`、Prototype Runtime
context/session/reducer、编译器源码或等价复制品。`ConfigBindingFileSetV1` 单独输出
`Surface.vue`、`config.ts`、dataset/theme 等公开 ConfigForm adapter 绑定示例，但不能
被误命名为默认原始源码工程，也不能复制 ConfigForm 实现。

文件路径是唯一、规范化的项目相对 POSIX 路径，禁止绝对路径、盘符、`..` 和
NUL；`files` 按 path 排序；entry 必须指向现有 text 文件。Source 对 embedded
Resource 只按 `projectId/resourceId/contentHash` 调 reader，验证 byteLength 与
SHA-256 后生成 `assets/<resourceId>.<extension>` binary 文件。URL Resource 直接
保留已校验 URL，不调用 reader、不 fetch、不产生伪文件。

失败时返回稳定 diagnostics 且不返回部分文件集：resolver 失败使用
`source_resolution_failed`，读取失败使用 `source_resource_read_failed`，内容
不匹配使用 `resource_content_invalid`。生成顺序、import 顺序、资源访问顺序和
文件排序都必须由稳定 ID/路径决定。

## 4. 生成器分层

`generator/` 内部按单向流水组织，避免复制 Prototype Runtime：

1. `validate-input`：验证 compilation、registryLock 和 resolver adapter 身份；
2. `collect-surfaces`：按 surface order 生成 Page route 与 flat Dialog/Drawer
   definitions；
3. `resolve-components`：按 component contract version/fingerprint 调同步
   resolver，收集 import/style；
4. `collect-datasets` / `collect-theme`：输出 JSON-safe 静态 Dataset 与主题；
5. `collect-resources`：按 resourceId 读取并编码 embedded bytes，URL 仅保留引用；
6. `emit-source`：生成直接使用 Vue/UI 组件的原始工程；`emit-bindings` 另行生成依赖
   公开 ConfigForm adapter 的绑定工程；两者都不生成 Prototype Runtime、reducer、
   query 或 overlay host；
7. `assemble-file-set`：规范化、去重、排序并校验 entry。

各阶段只返回内部 immutable records；最终只在全部阶段成功后构造
`SourceFileSetV1`，从而保证异常不会泄露 partial output。

## 5. Viewer 设计

`/viewer` 只导出 `ConfigFormSourceViewer` 和必要的受控类型，props 至少包括：

- `files: SourceFileSetV1 | undefined`；
- 必填 `selectedPath`；
- `update:selectedPath`；
- 可选 loading/diagnostics 展示输入，但不承载应用命令。

桌面 viewport 使用左树右代码 split；窄屏只显示一个 pane，并提供可键盘操作的
tree/code switch。缺失选择、空文件集、长路径和 binary 文件都有明确无障碍空态。
binary 选择只显示只读文件状态，不创建 Monaco model。Monaco 仅在 Viewer 内通过
异步边界加载，Viewer 卸载时释放 model/subscription；根入口与 Generator 的静态
依赖图不能触达 Monaco、Vue DOM 或 Workbench。

`/viewer/style` 是唯一的 Source Viewer 样式入口。Viewer 不拥有 Dialog、复制、
下载、ZIP、通知或持久化，也不保留旧 `WorkspaceCodeEditor`/`ProjectFileTree`
名称的 wrapper/re-export。

## 6. Studio 接入与删除策略

Workbench 导出弹窗直接导入 Source 根 `/generator` 与 `/viewer`，在应用组合根
创建 resolver/resourceReader。旧 `project/export/source-*` 生成器、Workbench
文件树和可编辑 Monaco 入口在同一变更中删除；保留的 archive/download/command
逻辑只消费新的 RawSourceFileSet/ConfigBindingFileSet，不再内嵌或复制运行核心。

包初始版本为 `0.0.0`，首发使用 handwritten minor Changeset（`0.1.0`）。新增
包、根 README、package architecture allowlist、root test filter、lockfile 和
Workbench 当前状态文档必须原子更新；不在包不存在时提前把目标 API 写成当前
可用示例。

## 7. 明确不做

- 不实现 Source 到 ProjectDocument 的反向导入；
- 不实现在线 IDE、代码编辑、completion、保存或部署；
- 不把事件函数、handler registry、接口占位或 action ref 生成到源码；
- 不为旧 Page-only generator 添加兼容读取或别名；
- 不在 Source 包内引入 Designer、Workbench、具体 Element/Ant UI adapter、
  Repository 或 Prototype Runtime 的私有实现。

