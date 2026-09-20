# ConfigForm Studio 路线图

目标产品合同以 [PRODUCT.md](./PRODUCT.md) 为准。本页记录仓库当前事实、迁移顺序和
每一阶段的完成定义；“目标”不表示对应 API 已经可以导入。

## 当前实现基线

截至当前版本，仓库同时提供生产 Runtime 与本地优先的 ConfigForm Studio：

- `ProjectDocument v8` 使用 `homeSurfaceId/surfaceOrder/surfacesById`，统一承载
  Page/Dialog/Drawer `SurfaceAsset`，并提供 Dataset、Resource、参数/结果和主题合同。
- `SurfaceGraph v3`、RuleSet v2、Registry snapshot v3、Canonical IR v7、Compiler 8.0.0、
  IndexedDB codec v4、Project/Surface transfer v1 已切换为严格 current-contract-only
  reader。字段 Required 独立于通用 RuleSet；`time` 不映射为 `date` base，Select
  options、已有 enum/literal base 与失效默认值由一个命令原子结算。
- Designer 聚焦单个 Surface，Inspector 提供 `properties`、`validation` 与
  `interactions`；字段 Required、状态/值联动和单一主要 UI 动作均通过 Model 命令保存。
- Studio 已提供项目与 Surface/Dataset/Resource 资产管理、主题、Design/Experience、
  自动保存、JSON 导入导出和 Dataset/Resource 绑定；动态 Runtime Data Source 不进入
  Studio Demo 合同。
- `@moluoxixi/config-form-prototype-runtime` 已提供根、`/session`、`/vue` 和样式入口，
  共享纯 reducer、SurfaceInstance 栈、参数/结果事务与 overlay host。
- `@moluoxixi/config-form-source` 已提供根、`/generator`、`/viewer` 和样式入口；Workbench
  直接消费它的原生 Vue 与 ConfigForm 绑定文件集，不保留旧 generator/Viewer 兼容层。

生产 Runtime、Headless、代码态 `props.onX`、reaction 和 Data Source 仍是当前可用
能力。Studio 持久化产物只包含 JSON-safe 模拟 Demo；复杂业务逻辑由导出项目或宿主
TypeScript 维护。当前实现不保留 pages/surfaces 双模型，也不恢复事件编辑、转发或 Flow。

## 迁移阶段

### 1. 产品与领域合同

固化 Studio、Designer、Runtime、Prototype Runtime 与 Source 的职责，定义 Surface、
Dataset、Prototype Interaction、版本、诊断和依赖方向。

完成定义：长期文档和 `.trellis/spec/` 对目标合同、当前基线与硬切策略没有冲突。

### 2. Surface Foundation

原子切换 Model、Repository、Compiler、Canonical IR、Vue backend、IndexedDB、导入
导出、Runtime Host 和现有生成器读取路径；建立 Prototype Runtime 的纯会话核心与
Vue overlay host，并落地 ProjectTheme v1、结构化 ResponsiveLength、完整 SurfaceGraph
field/layout/element wire shape，以及 Registry snapshot v3 的类型、Reader 校验和现有
基础物料条目迁移；同时固定 Project transfer v1，使无资源项目也从第一版使用最终
envelope，而非裸 ProjectDocument。

完成定义：Page/Dialog/Drawer 使用统一 `SurfaceAsset`，每次打开创建隔离
`SurfaceInstance`；关闭、返回或导航清除浮层后不保留已关闭实例状态；旧、未来、
缺失、混合合同 fail closed；Preview 统一使用 Prototype Runtime，不在其它包复制 reducer。

当前状态：已完成 Model、Repository、IndexedDB、Compiler、Vue backend、Runtime Host
和 Prototype Runtime 的基础合同与质量门禁。

### 3. Studio Assets

将 Workbench 产品化为 Studio 应用壳，提供项目管理、Surface/Resource 资产树、
Surface 创建选择、独立设计面和调用路径上下文。

完成定义：用户可在独立设计面管理和编辑三类 Surface；资产任务不提前实现
Design/Experience 切换，也不发明交互绑定合同。

当前状态：已完成项目管理、三类 Surface 资产树、独立设计面、真实 Dialog/Drawer
外壳、自动保存、刷新重开和响应式入口。

### 4. Studio Datasets

建立 Dataset v1、项目级编辑、JSON 导入导出、options 保存为 Dataset，以及共享的
projection/filter/sort/pagination 纯查询服务；同时建立 embedded/url Resource 与单
Resource transfer v1，并在既有 Project transfer v1 中填充/校验 embedded contents。

完成定义：Dataset versioned envelope 只接受精确 v1；显式 raw rows ingestion 只把
JSON 对象数组创建为 v1 Dataset，两条入口不互相兼容；运行期数据只读。

当前状态：已完成 Dataset/Resource 管理、JSON 导入导出、共享本地查询、物料绑定、
options 保存为 Dataset 和解除引用后的内联快照。

### 5. Studio Materials

扩充业务展示、操作、Table/List、响应式 Grid/Flex、Design Token 和受控视觉属性，
保持 Element Plus 与 Ant Design Vue 的基础能力一致；只扩充 Registry v3 物料条目、
编辑 UI 和 adapter 映射，不再次升版或发明能力字段。

完成定义：数据物料只消费共享 Dataset view，不复制查询器；选择状态属于物料，不写
回 Dataset；Designer adapter 仍不拥有业务副作用。

当前状态：已完成双 Provider 业务物料、Table/List/Select 数据视图与选择、主题、
响应式 Grid/Flex 和受控视觉属性。

### 6. Studio Interactions

提供 Design/Experience 模式切换，以及状态投影、`set/copy/clear` 值动作和单一主要
UI 动作的作者体验，包括页面跳转、返回、Dialog/Drawer 打开关闭、参数、具名结果和
可选校验。

完成定义：初始化只执行状态投影；值动作只由用户/结果变化触发；一个语义触发器最多
一个主要 UI 动作；非法表达式或循环使用稳定诊断阻止 Experience 和 Source。

当前状态：已完成 Surface 级联动总览、字段状态和值联动、页面与浮层动作、参数、
结果回写、Design/Experience 切换和持久化恢复。

### 7. 独立 Source 包

将最终生成器与只读 Viewer 移入 `@moluoxixi/config-form-source`。Generator 保持无
DOM；Viewer 桌面为左文件树/右源码，窄屏为 tree/code 切换，Monaco 只在 Viewer 内
异步加载。

完成定义：Source 不依赖 Designer/Workbench、具体 provider UI 或 Repository；Studio
在组合根分别注入同步 provider component resolver、ConfigForm binding resolver 与
异步 Resource reader。Raw 不接收 binding resolver。生成器
返回含 entry 的稳定排序 SourceFileSet，不保留 Workbench wrapper、旧名称或 re-export；
生成项目安装、类型检查、测试和构建通过，embedded 资源以 binary/base64 文件项无损
输出，URL 不调用 reader 或 fetch。

当前状态：已完成。默认 `RawSourceFileSetV1` 的 `package.json.dependencies` 与应用运行
时代码中的裸包 import 严格限定为 Vue、Vue Router 与目标 UI 包，Required 与 RuleSet v2 生成为工程
内可读校验代码；这些位置不含 ConfigForm、Zod、`@moluoxixi/*`、`@config-form/*` 或
内部 Runtime，Vite、TypeScript 等构建工具可作为 `devDependencies`。
`ConfigBindingFileSetV1` 只组合公开 ConfigForm adapter/model/config。两种文件集都不生成
`src/runtime/**`，不复制 Compiler、Prototype Runtime、session reducer 或 overlay host。
Workbench 只保留弹窗、刷新、复制、下载、ZIP 与通知等应用命令。
其内存快照固定为 `ExportSnapshot { compilation, rawSource, configBindings }`，两个 mode
分别是 `ready | failed`，基于同一 compilation 独立生成、独立失败。过期判定只比较
完整 compilation key 与 committed/draft origin；文件集合同版本由
`SourceFileSetV1.version` 持有，不再维护 Workbench generator 版本。

## 目标合同版本

版本号由拥有相应 Reader 的阶段一次性切换：

| 合同                             | 基线     | 当前        | 所属阶段                                                  |
| -------------------------------- | -------- | ----------- | --------------------------------------------------------- |
| RuleSet                          | `1`      | `2`         | 校验与源码合同硬化                                        |
| ProjectDocument                  | `7`      | `8`         | Studio Datasets：Dataset view query 硬切                  |
| SurfaceGraph                     | `2`      | `3`         | Studio Datasets：节点 Dataset query 硬切                  |
| Project theme                    | 不存在   | `1`         | Surface Foundation；Studio Materials 只消费，不扩宽 shape |
| Registry snapshot                | `2`      | `3`         | Surface Foundation；Studio Materials 只扩充条目和作者映射 |
| Canonical Project IR             | `6`      | `7`         | Studio Datasets：查询投影                                 |
| Compiler                         | `7.0.0`  | `8.0.0`     | Studio Datasets：查询投影                                 |
| IndexedDB manifest/entity codec  | `3`      | `4`         | Surface Foundation                                        |
| Page transfer / Surface transfer | `Page 2` | `Surface 1` | Surface Foundation                                        |
| Runtime Host protocol            | `6`      | `7`         | Surface Foundation                                        |
| Project transfer                 | 不存在   | `1`         | Surface Foundation；Studio Datasets 提供 embedded content |
| Dataset transfer                 | 不存在   | `1`         | Studio Datasets                                           |
| Resource transfer                | 不存在   | `1`         | Studio Datasets                                           |
| Prototype session                | 不存在   | `1`         | Surface Foundation                                        |
| SourceFileSet                    | 不存在   | `1`         | Source 包                                                 |

目标版本不是兼容范围。每个 Reader 只接受精确当前版本；低版本、高版本、缺失、畸形
和混合版本均拒绝。后续阶段若需要再次改变同一 shape，必须回到合同审阅，不能私自
叠加版本或临时兼容 Reader。

## 已终止方向

- 可视化原始事件编辑、事件转发和 iframe 组件参数 RPC。
- 多动作清单、动作注册表、handler registry、异步 Flow、trace 面板和流程图。
- Source handler stub、字符串 action binding 或 Flow runtime。
- pages/surfaces 双读、旧导出 wrapper、deprecated alias 和迁移链。

Prototype Interaction 不是上述事件域的改名。它只处理封闭的状态投影、值动作和单一
主要 UI 动作；生产组件函数继续直接写在宿主 config 的 `props.onX` 中。

## 已知风险与门禁

- Surface 身份目前贯穿持久化、编译缓存、Preview 协议和生成器，Foundation 必须原子
  切换，不能只改 Model。
- Preview/Experience 必须统一执行 Prototype Runtime；Source 产物不得复制该运行核心。
  生成工程的 SFC 编译、类型检查和真实 Vite build 不能由字符串快照替代。
- 同一 Surface 重复打开、A -> B -> A、返回、关闭、参数和结果事务必须覆盖实例隔离。
- Dataset raw rows ingestion 与 versioned envelope reader 必须有相反失败用例，避免无
  版本数组被 Reader 静默接受。
- 两套 provider adapter 必须共享基础语义，但 Source component resolver、ConfigForm
  binding resolver 与 Resource reader 由 Studio 组合根分别注入，不能让 Source 反向
  依赖 adapter metadata 或 Repository，也不能重新合并 resolver。
- Raw/Binding 的独立失败必须覆盖两个方向；Raw 生成消费门禁必须使用真实文件、无内部
  workspace 软链，并扫描 `package.json.dependencies` 与应用运行时代码中的裸包 import；构建期
  `devDependencies` 单独校验，不得误按运行依赖白名单拒绝。
- Designer 门禁必须覆盖时间物料无 RuleSet base，以及 Select options、enum/literal
  validation、失效默认值的一次命令/一次 Undo 原子性。
- CI 需要持续覆盖 package architecture、合同版本、生成项目、Workbench build/E2E 和
  可访问性；尚未实现的规划包不得进入发布矩阵。
