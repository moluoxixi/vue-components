# 在线项目内核与模板导出技术设计

## 交付边界

该子任务交付项目协议、repository、模板和导出，不实现三模式编辑器或 Page Preview。它同时创建 `@config-form/workbench` private app 骨架，后续子任务只消费 `src/project/index.ts`。

## 目录

```text
packages/ConfigForm/workbench/
  package.json
  index.html
  vite.config.ts
  tsconfig*.json
  src/main.ts
  src/App.vue                    最小启动壳，后续产品任务替换
  src/project/
    index.ts
    types.ts
    schema.ts
    path.ts
    revision.ts
    errors.ts
    repository.ts
    repository-memory.ts
    repository-indexed-db.ts
    templates/
    export/
    __tests__/
  scripts/verify-exported-project.mjs
```

## 项目协议

- 使用 Zod 对持久化和模板生成结果做 runtime validation。
- `WorkspaceProject.revision` 从 1 开始单调递增；create 产生 revision 1，commit 必须提供当前 base revision。
- `WorkspaceFile` 支持 text 与 binary；首版模板全部为 text，但 ZIP 和存储协议不封死资源文件。
- clone、commit 和 repository read 返回隔离副本，不暴露可原地修改的内部对象。
- 时间与 id 由显式依赖注入，测试使用固定 clock/id，确保模板和 revision 测试确定。

## 路径协议

`normalizeProjectPath` 只接受 POSIX 相对文件路径：

- 拒绝空路径、前导 `/`、盘符、UNC、反斜杠、空段、`.`、`..`、尾随 `/` 和 NUL。
- 拒绝 Windows 保留段名和尾随点/空格。
- 创建项目时以小写 canonical key 检查大小写冲突。
- ZIP、落盘验证和 Source 文件树统一使用该函数，不各自实现路径规则。

## Repository

```ts
interface WorkspaceProjectRepository {
  readonly persistence: 'durable' | 'volatile'
  get(id: string): Promise<WorkspaceProject | undefined>
  list(): Promise<WorkspaceProjectSummary[]>
  create(project: WorkspaceProject): Promise<void>
  commit(id: string, baseRevision: number, next: WorkspaceProject): Promise<WorkspaceProject>
  getDraft(id: string): Promise<WorkspaceProjectDraft | undefined>
  saveDraft(id: string, draft?: WorkspaceProjectDraft): Promise<void>
  delete(id: string): Promise<void>
  close(): void
}
```

- Memory adapter 与 IndexedDB adapter 共用 contract tests。
- IndexedDB 使用 `project:<id>` 保存 committed project 与可选 draft 的单一 envelope；list 只扫描 project prefix，不维护跨 key catalog。
- 扩展 `IndexDBStorage.updateItem` / `IndexedDBManager.updateItem`，updater 必须同步，在单个 readwrite transaction 中完成 get、revision 检查和 put/delete。
- updater 抛出的领域 conflict 触发 transaction abort，并原样传播；IDB/DOMException 通过 `cause` 保留底层信息。
- Stored envelope 带 `storageSchemaVersion`，读取后 validation/migration；IDB object store version 首版保持 1。
- composition root 先调用 `isSupported()`：支持时使用 IndexedDB；不支持时显式使用 memory 且暴露 `volatile`。

## 模板协议

```ts
interface WorkspaceTemplate {
  id: string
  version: number
  title: string
  adapter: 'element-plus' | 'antd-vue'
  create(input: TemplateInput): WorkspaceProject
}
```

- Registry 拒绝重复/危险 id，并按显式 order、id 确定排序。
- 两个首版模板共享基础 Vite 文件生成器，只在 adapter、材料、示例业务和样式上分化。
- 模板至少生成：package manifest、Vite/TS config、index、main、App、styles、designer JSON、generated form module。
- 导出 package dependencies 使用真实 registry 版本；模板测试扫描并拒绝 `workspace:` / `catalog:`。

## ZIP 与下载

- `createProjectArchive(project)` 返回 `Uint8Array`，内部使用 `fflate` 异步 zip。
- 所有 text 统一 UTF-8；binary 原样写入；entry 根目录使用安全 project slug。
- `downloadProjectArchive` 只处理 Blob/object URL/anchor，并在下一轮事件循环 revoke URL。
- archive 单测解压并逐文件比较，保证编码、路径和缺失文件可见。

## 真实构建验证

- Node 脚本从模板 registry 生成固定 fixture，写入 `os.tmpdir()` 下的隔离目录。
- 对路径做第二次 resolved-root 校验，使用参数数组与 `shell:false` 运行命令。
- pack 当前 ConfigForm 发布包，临时改写模板依赖为 `file:` tarball。
- 执行 install、typecheck、Vite build，并断言 `dist/index.html`；浏览器模板本身使用精确版本，不伪造 lockfile。
- 清理使用 recursive rm 的 retry/maxRetries，适配 Windows 文件占用。
- 浏览器导出的 registry 版本与 CI tarball 替换是两条明确路径，验证脚本不能把临时 `file:` 写回模板。

## 公共仓库变更

- `@moluoxixi/indexed-db` 新增原子 `updateItem` 与测试；其余 CRUD 兼容不变。
- 根脚本新增 workbench dev/build/test:E2E 入口，并从库构建中过滤 private app。
- `packages/ConfigForm/README.md` 新增 Workbench 私有产品职责。
- `pnpm-workspace.yaml` glob 已覆盖新 app，不需修改。

## 风险与回滚

- IDB transaction callback 若异步会导致事务自动关闭，因此 updater 类型和 runtime 都必须拒绝 Promise。
- 单项目 envelope 可能随文件变大；首版受控模板规模可接受，未来再拆 revision/file stores。
- package 版本更新会产生维护成本；用生成/验证脚本检测漂移，不在运行时动态读取 workspace/catalog 版本。
- 新 app 与现有 playground 完全隔离，项目内核子任务可回滚而不影响 ConfigForm 发布包，仅 IndexedDB 新 API 需独立兼容回滚。
