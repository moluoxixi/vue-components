# 抽离 ConfigForm 源码生成与查看包

## 目标

在 Studio 的 Surface、Dataset、Resource 与 Prototype Interaction 合同稳定后，将源码生成和只读源码查看器抽离为独立公共包 `@moluoxixi/config-form-source`，由 Studio 导出源码弹窗直接消费。这里的“源码”默认指程序员可以接手的原始 Vue/TypeScript 工程源码，它直接使用目标 UI 组件，不依赖 ConfigForm；ConfigForm 绑定源码作为第二种独立产物提供，且任一产物都不复制 ConfigForm、Prototype Runtime 或其它运行核心。

## 前置条件

- 其余 ConfigForm Demo Studio 子任务完成，公共编译和运行合同稳定。

## 需求

- R1：Generator 可在无 DOM 的 Node 环境独立导入，接收完整 ProjectCompilation、
  Source 自有的 provider-neutral component resolver 和异步 embedded Resource reader，
  返回 `Promise<ContractResult<SourceFileSetV1>>`；输入合同不引用 Designer、Workbench、
  具体 adapter UI 或 Repository 类型，并从 `registryLock` 接收唯一 adapter 身份。
- R2：默认输出是原始 Vue/TypeScript 工程源码：页面、Dialog/Drawer 组件、路由、静态
  Dataset、Resource 和主题均是可阅读、可修改的独立源码文件；Surface 直接 import
  已发布的 Vue 与目标 UI 组件，不 import ConfigForm，也不输出任何 `src/runtime/**`、
  Prototype Runtime reducer/host 或其源码副本。
- R3：额外提供独立的 ConfigForm 绑定源码导出；它通过公开 ConfigForm adapter 组合
  `fields/components/layout/dataset/theme` 与 `model`，但不包含运行核心、编译器、会话
  状态或 overlay 执行器。原始源码和 ConfigForm 绑定源码必须是两个明确的文件集/入口。
- R4：不生成接口占位、事件函数桩、字符串 action ref、handler registry 或源码回导元数据。
- R5：Viewer 导出 `ConfigFormSourceViewer`，桌面左侧文件树、右侧只读源码；窄屏使用 tree/code 切换。
- R6：`selectedPath` 是必填受控 `v-model`；Viewer 不拥有弹窗、刷新、复制、下载、ZIP、通知或持久化。
- R7：Monaco 只在 Viewer 内异步加载，Generator 和根类型入口不产生 DOM/Monaco 副作用。
- R8：公开根入口以及 `/generator`、`/viewer`、`/viewer/style`，不保留 Workbench 旧名称、wrapper 或 re-export。
- R9：Studio 导出弹窗直接组合 Viewer 和应用级复制/下载等命令。
- R10：Source 包拥有两个分离输入：同步 `SourceProviderResolver` 只按
  adapter/adapterVersion/registryFingerprint 与 component contract identity 解析原生 UI
  import、依赖及 ConfigForm adapter 绑定 import；
  异步 `SourceResourceReader` 按 projectId/resourceId/contentHash 从 Studio 注入的
  Repository adapter 读取 bytes 副本。生成器不反向发现或导入 provider/storage。
- R11：`SourceFileSetV1` 包含既存 text entry 与按 path 稳定排序的 text/binary 判别
  联合；Source 为 embedded Resource 校验 byteLength/SHA-256、从稳定 ID 与 fileName
  派生安全路径并编码 canonical base64。URL Resource 不调用 reader、不 fetch、不生成
  伪文件。Viewer 只把 text 交给 Monaco，binary 显示只读文件状态。

## 验收标准

- [ ] AC1：Node 环境可导入 Generator，并以双 adapter resolver 和异步 Resource reader
  生成确定性的原始源码文件树；相同 compilation/provider/resource snapshot 字节稳定。
- [ ] AC2：默认生成项目只依赖公开 Vue/UI 包即可安装、类型检查、测试和构建，不依赖
  ConfigForm；其 `src` 中不存在 ConfigForm/Prototype Runtime 核心实现副本，页面、
  Dataset 和交互骨架可被程序员直接阅读和修改。
- [ ] AC3：源码文件集同时提供独立的 ConfigForm 配置文件集；配置文件集中不出现 reducer、
  session、overlay host、编译器源码或运行时复制品。
- [ ] AC4：Viewer 在桌面与移动 viewport 中可键盘操作、无溢出重叠，并正确显示空态、缺失选择和长路径。
- [ ] AC5：根入口不会同步加载 Monaco，Generator 依赖图不含 Vue DOM 或 Workbench。
- [ ] AC6：Workbench/Studio 旧源码生成实现被删除，消费者只通过新包公共入口访问。
- [ ] AC7：包初始版本为 `0.0.0`，使用 minor Changeset 首发 `0.1.0`，依赖和 peer range 正确。
- [ ] AC8：生成项目包含可读取的 embedded 资源 bytes，静态 URL 保持引用且未调用
  reader/fetch；缺 bytes、stale hash、长度/hash 不符或 component resolver 失败时返回
  稳定诊断且不返回部分文件集。
- [ ] AC9：输出 entry 指向现有 text 文件，paths 唯一、安全且稳定排序；Viewer 对
  binary 不初始化 Monaco，长路径、空态和缺失选择保持可访问。

## 范围外

- 不实现在线 IDE、代码编辑、completion、保存、ZIP 或部署。
- 不实现源码到 ProjectDocument 的反向转换。
