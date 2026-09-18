# 建立 Surface 与项目领域基础

## 目标

将当前以 Page 为唯一编译和持久化单位的项目模型硬切为统一 Surface 模型，为 Studio、体验模式和 Source 提供稳定底座，同时保持 Runtime 核心不依赖作者工具。

## 前置条件

- `config-form-studio-contracts` 已完成并通过审阅。

## 需求

- R1：以 `surfaceOrder/surfacesById` 取代 `pageOrder/pagesById`，支持 `page/dialog/drawer` 判别联合和独立 presentation，并校验 order/map 双射、map key=id 与 Page route 全局唯一。
- R2：将 `PageGraph` 泛化为 Surface 可复用的图合同，保留 props、form、root/slot placement、field/layout、校验、extensions 和 valueScope，新增不伪造表单 field 的 element 节点；硬切删除旧 bindings/conditions/reactions/page runtime/dynamic optionSource。同步把 Registry snapshot 原子升级到 v3，落地 Material kind、semantic trigger、状态投影属性和 Dataset/Resource binding capability 的类型、Reader 校验，并迁移现有基础物料条目，使 interaction/dataset/resource 字段从第一版即受最终能力合同约束且不双读。
- R3：新增项目级 Dataset、embedded/url Resource 和 Prototype Interaction 引用完整性
  合同及事务操作；embedded metadata 使用独立稳定 fileName、byteLength 与 SHA-256，
  Repository bytes 以 projectId/resourceId/contentHash 寻址。
- R4：Repository、IndexedDB codec、entity revisions、undo/redo、change set 和缓存以 Surface/Dataset 为一等实体。
- R5：Compiler、Canonical IR 与 Vue backend 支持单 Surface 和完整 Project 编译，不递归内联浮层目标。
- R6：Runtime 具备渲染 Surface 内容所需的纯运行合同，但不依赖 Studio 或 Designer。
- R7：所有相关版本原子提升，所有 reader 精确拒绝非当前合同。
- R8：创建 `@moluoxixi/config-form-prototype-runtime`，根入口和 `/session` 保持无 DOM，`/vue` 与 `/vue/style` 提供 Studio Experience 与生成项目共享的 Surface host；生产 Runtime 不依赖它。
- R9：Prototype Runtime v1 在本任务完整拥有页面历史、overlay instance 栈、参数/结果事务、navigate/back/open/closeCurrent/closeAll reducer、焦点返回和 Vue host；`instancesById` 只保留页面历史或浮层栈可达的活实例，close/back/navigate 清除浮层时同步删除已关闭实例并释放实例状态。后续交互任务只接入作者配置与 Experience UI，不修改这套公共会话合同。
- R10：ProjectDocument v6 同步落地完整 `ProjectThemeV1` 与结构化 `ResponsiveLength` Reader；Materials 后续只实现作者 UI、adapter 投影和 Registry v3 物料条目扩充，不扩宽 theme/length 或 Registry capability wire shape，也不再次提升 Registry 版本。
- R11：建立 Project transfer v1 的最终 wire shape（metadata-only ProjectDocument 加
  embeddedContents）；即使初始 resources 为空也只接受精确 v1。后续 Dataset/Resource
  任务只填充并消费该 shape，不再次扩宽 Reader。

## 验收标准

- [ ] AC1：项目必须至少包含一个 Page，home 指向 Page；`open` 只能指向 Dialog/Drawer，`navigate` 只能指向 Page。
- [ ] AC2：Surface、Dataset 的增删改排、复制和引用修改均有可逆事务与精确 change set。
- [ ] AC3：删除被引用资产会返回包含来源 Surface、节点和交互的稳定诊断。
- [ ] AC4：同一 Surface 只编译一次；循环打开引用不会导致递归编译或递归源码结构。
- [ ] AC5：持久化重开后 Surface、Dataset、Resource、引用和顺序无损。
- [ ] AC6：Model、Compiler、Vue backend、Runtime 的类型检查、单测和架构门禁通过。
- [ ] AC7：旧 Page-only、未来、缺失和混合版本均 fail closed，无迁移和兼容层。
- [ ] AC8：Prototype Runtime 的纯会话 reducer 可在 Node 导入，Vue host 可运行重复/循环 Surface 实例；关闭、返回和导航清除浮层后 `instancesById` 不保留已关闭实例或其表单/校验/焦点状态，Studio 与后续 Source 不需要复制实现。
- [ ] AC9：SurfaceGraph 无损保留当前图/表单/placement/validation/valueScope 语义，移除字段会被严格拒绝；Registry snapshot v3、Theme v1 和 ResponsiveLength 的合法/非法边界有 Model 测试，现有基础物料条目已迁移到 v3。
- [ ] AC10：Project transfer v1 可无损往返无 Resource 项目，并对 embedded content
  ID 双射、canonical base64、length/hash 与预算保留完整 Reader 合同；metadata/bytes
  导入必须原子成功或全部失败。

## 范围外

- 不实现 Studio 资产导航、数据集编辑器、扩展物料或体验模式 UI。
- 不在 Runtime 内实现 HTTP 作者配置或通用事件总线。
