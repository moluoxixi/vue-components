# 重塑 ConfigForm Demo Studio

## 目标

将 ConfigForm 定型为本地优先的高保真业务界面 Demo 创作体系：Studio 管理项目、界面资产、静态数据集、资源、体验与源码导出；Designer 编辑单个界面；Runtime 继续作为工程师生产应用中的运行底座。Studio 只表达可序列化、可预览的 UI 与本地交互，接口、异步副作用和业务函数由程序员接管源码后实现。

本文描述目标产品合同。仓库当前仍是 Page-only Workbench、双区 Designer 和 Workbench 内置 Source 生成实现；各子任务必须在实现完成时同步更新对应 README，不能把目标能力提前写成当前可用 API。

## 用户价值

- 工程师可以快速搭建可运行的业务界面 Demo，再在正常 Vue/TypeScript 工程中补充真实逻辑。
- UI 设计师经过少量学习即可独立完成页面、浮层、布局、主题、校验、模拟数据和本地交互。
- Demo 与导出源码共享同一合同，交接结果不是静态图片，也不要求双向同步代码。

## 范围

- 正式产品名为 ConfigForm Studio；Workbench 从内部验证台升级为本地优先的完整创作应用。
- 项目资产包含 Page、Dialog、Drawer、Dataset 和静态 Resource。
- Page、Dialog、Drawer 是可独立编辑和复用的 SurfaceAsset；运行时每次打开产生独立 SurfaceInstance。
- Designer 支持属性、校验和交互三个作者区域，包含显隐、禁用、只读、动态必填、受控展示属性和值联动。
- 使用安全表达式、受限语义触发器和单一主要 UI 动作；支持页面导航、返回、打开/关闭浮层、输入参数和具名结果。
- Dataset 是项目级只读 JSON 对象数组，支持表格/JSON 编辑、导入导出、字段路径映射以及本地筛选、排序和分页。
- 扩充业务界面所需的展示、操作、数据和反馈物料，并提供真实 Grid/Flex、响应式布局、Design Token 和受控视觉属性。
- 体验模式执行完整页面历史、浮层实例栈、校验、本地联动和模拟数据行为。
- 独立 Source 包生成并查看可直接运行的 Demo 源码；程序员在导出后单向接管。
- Studio Experience 与生成项目共享同一套原型会话与浮层实例语义；具体公共包名和入口由首个合同子任务定型，不在两端复制实现。
- 项目 JSON 使用版本化 Project transfer，无损组合 metadata-only document 与 embedded
  Resource bytes；Source 分离同步 component resolver 和异步 Resource reader，不隐式
  依赖 adapter 或 Repository。

## 范围外

- Studio 内的 HTTP、请求头、鉴权、远程 Data Source 和运行时数据写入。
- 任意 JavaScript、任意 CSS、原始 DOM 事件、通用动作链、事件编排或 Flow。
- 账号、云存储、多人协作、发布平台和模板市场。
- 修改后源码回导 Designer，或旧 ProjectDocument 的迁移/兼容读取。
- 首版项目级自定义组件、自由绝对定位画布和组件库一键转换。

## 子任务地图

1. 固化产品规范与领域合同。
2. 建立 Surface、Dataset、Interaction 的 Model、持久化、Compiler 与 Runtime 基础。
3. 建立 Studio 项目资产管理与独立设计面。
4. 建立数据集与静态资源管理。
5. 扩充业务物料、主题与响应式样式能力。
6. 实现本地联动、页面导航、浮层实例栈与体验模式。
7. 抽离 Source 生成/查看包并接入 Studio。

## 跨任务验收标准

- [ ] AC1：长期产品文档、任务合同和实际 UI 一致表达 Studio/Designer/Runtime/Source 的责任。
- [ ] AC2：项目可以创建和管理 Page、Dialog、Drawer、Dataset 与 Resource，并以稳定 ID 建立引用。
- [ ] AC3：任意有限深度的用户触发浮层嵌套可运行；重复打开同一资产时实例状态隔离。
- [ ] AC4：UI 设计师能完成必填、校验、状态联动、值联动、页面跳转、浮层参数与结果映射。
- [ ] AC5：Dataset 可供 options、Table 和 List 等物料消费，预览与导出行为一致。
- [ ] AC6：设计模式适合编辑，体验模式能完整运行页面历史、浮层栈和本地数据行为。
- [ ] AC7：导出源码可安装、类型检查和构建，不包含接口占位、事件函数桩或通用事件总线。
- [ ] AC8：Core、Headless、Runtime 不依赖 Studio/Designer/Source；Studio 只在应用组合根连接公开包。
- [ ] AC9：所有受影响合同原子升版，旧、未来、缺失和混合版本 fail closed，不保留兼容层。
- [ ] AC10：Element Plus 与 Ant Design Vue 覆盖共同基础物料和交互合同，项目创建后锁定适配器。
- [ ] AC11：目标合同与当前实现状态在 PRODUCT、ROADMAP、架构 README 和包 README 中明确分层，不把规划中的包或 API 描述成已存在。
- [ ] AC12：完整项目 JSON 的 embedded bytes 无损往返；Source 对 URL 不读 storage、
  不 fetch，对 embedded bytes 读取 exact content version 并在任何错误时不返回部分文件。

## 已确认决策

- Studio 面向工程师，也允许 UI 设计师学习后独立使用。
- Demo 只使用模拟数据和本地表达式；真实接口与业务逻辑由程序员补充。
- SurfaceAsset 与 Material、SurfaceInstance 是不同领域概念。
- 浮层无静态深度上限，可由用户动作重复或循环打开；禁止加载时自动递归打开。
- 一个语义触发器只配置一个主要 UI 动作；字段值动作与状态表达式独立执行。
- 源码交付是单向快照，不支持源码回导。
- Studio 首版纯本地运行，使用 IndexedDB 自动保存和项目 JSON 导入导出。
