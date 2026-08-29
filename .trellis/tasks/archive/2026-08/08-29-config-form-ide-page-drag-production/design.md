# 技术设计

## 总体边界

```text
Component Registry
        |
WorkspaceApplication (revisioned persistence)
        |
        +-- pages[] -> WorkspacePage -> LowCodePageModel
        |                              |
        |                              +-> Designer / Runtime Preview
        |
        +-- Source Generator -> immutable ExportSnapshot
                                      +-> File Tree / Monaco / ZIP
```

Designer 只接收当前 Page 的 `LowCodePageModel`，Workbench 负责 Application、页面管理、导出快照和页面切换。Runtime/Core 不感知 Application 或 Page Manager。

## 多页面模型

新增 v2 Application 契约，页面数组顺序即用户可见顺序：

```ts
interface WorkspaceApplication {
  schemaVersion: 2
  id: string
  name: string
  revision: number
  createdAt: string
  updatedAt: string
  homePageId: string
  manifest: WorkspaceApplicationManifest
  template: { id: string; version: number }
  files: Record<ProjectPath, WorkspaceFile>
  pages: WorkspacePage[]
}

interface WorkspacePage {
  id: string
  name: string
  route: string
  model: LowCodePageModel
}
```

`files` 只保存模板支持文件和应用级资源；页面内容以 `pages[].model` 为唯一真源，生成的 Config/Designer/Source 文件不得反向成为页面状态。`homePageId` 是唯一首页真源，不在 Page 上重复 `isHome`。

Application schema 负责以下不变量：至少一个 Page、Page ID 唯一、路由唯一且规范化、`homePageId` 存在、每个 `LowCodePageModel` 可解析、应用文件路径合法。页面复制通过现有 Model/Designer ID 工具深拷贝并重建所有节点 ID。

## Operation 与历史

- 当前页面内容继续使用 `ConfigModelHistory` 和 `ModelOperation`，Undo/Redo 不跨页面。
- 页面新建、重命名、复制、删除、移动、更新路由、设置首页定义为纯 `ApplicationOperation`，由一个 reducer 校验并返回新 Application。
- 页面切换不是 Model Operation。切换前先走未保存保护，切换后以目标 Page Model 重建当前 history。
- 保存使用 Application revision 做乐观并发控制；一次提交原子保存 Application 元数据和全部页面模型。

## v1 到 v2 迁移

存储读取先按 v2 解析，失败后才尝试严格的 v1 schema。v1 转换规则：

- Application 继承原 Project 的 id、name、adapter、template、时间戳和 revision。
- 使用确定性 Page ID 和路由 `/` 创建唯一默认页，并设为 `homePageId`。
- Page Model 通过现有 designer artifact/config 解析链获得，不能通过格式脆弱的字符串替换生成。
- 原虚拟文件完整保留，页面生成文件在下一次规范化保存/导出时再按 v2 规则重建，保证迁移不丢数据。
- 只有 v2 校验成功后才写回；失败返回明确错误且保留 v1 记录。迁移函数必须幂等。

Memory 与 IndexedDB repository 共享同一 parse/migrate 函数，避免不同存储产生不同模型。每个旧 Project 独立迁移，不推断应用归属。

## Page Manager

Page Manager 是 Workbench 管理态界面，通过受控 props/operations 访问同一 Application reducer。左侧 Pages 只展示快速列表和管理入口；顶部只显示文本上下文。

管理界面使用稳定行高的列表/表格而非卡片墙，操作按钮使用图标和 tooltip；路由、名称采用单行编辑/侧栏或对话框，不能因 Inspector 宽度产生标签换行。删除为确认对话框，首页和最后页面约束由 reducer 与 UI 双层表达。

## 多页面导出

Generator 输入改为一次克隆的 `WorkspaceApplication` revision。Source 生成完整 Vue 工程：应用入口、路由表、每页独立 Vue 组件、共享样式和 `package.json`。生成源码不导入 ConfigForm 包；页面路由来自 Page metadata，首页使用明确 redirect/route 规则。

Config 导出继续以 `defineField` 生成页面配置，只读展示。若导出整个 Application，则每个页面生成稳定路径，不能把页面重新序列化为可编辑 Source 真源。

## 拖拽双层反馈

现有 `projectedDocument -> RuntimeSurface` candidate 仍是落点权威。drag session 增加最新 viewport 指针坐标、指针相对源节点的偏移和 candidate identity。

Overlay 持续挂载在 Canvas 滚动容器之外，使用 `position: fixed`、`pointer-events: none`、`aria-hidden`。内容取自已注册的真实 candidate DOM 的受控视觉副本，尺寸取 `ResizeObserver` 实测矩形；candidate 因容器宽度或插入位置变化后，同一动画帧更新 Overlay。这样不会为虚影再次挂载业务组件，也不会触发副作用。

未形成合法落点前，物料拖拽使用 Palette 中同一 Registry material 的真实预览节点作为视觉来源；一旦 candidate 注册即切换到 candidate 快照。所有 exit path 汇聚到一个 teardown，清除投影、Overlay、raf、observer 和事件监听。

## Source 文件树

从 `ExportSnapshot.files` 纯构造不可变树：directory 与 file 使用判别联合，目录由规范化 path segment 生成，目录优先、同层按稳定名称排序。目录展开、DOM focus、当前文件 selection 三种状态分离。

独立 `ProjectFileTree` 组件实现 WAI-ARIA Tree：可见节点扁平化用于 roving tabindex 和键盘导航，DOM 仍按 `treeitem/group` 层级输出。文件消失时选择确定性回退到入口文件或第一文本文件，不能留下失效 Monaco model。

弹窗打开时创建 `ExportSnapshot { applicationId, revision, files }`；直到关闭前，树、Monaco 和下载都只读取该对象。设计继续变化时显示快照已过期状态，但不能静默替换用户正在浏览或下载的内容。

## 兼容与回滚

- 保留 v1 parser 与 fixtures，至少跨一个发布周期；写路径只写 v2。
- 不改变 Core、Runtime 公共 API；Designer 新增的 Overlay 类型保持包内或以可选接口暴露。
- 子任务按模型、文件树、Overlay 分别提交，任何一块可独立回滚；v2 写入前必须完成迁移 fixture 和 repository round-trip 测试。
- 若多页面导出尚未通过构建验证，不得让 v2 数据写入成为默认路径。

## 主要风险

- v1 数据中 designer artifact 与 config source 不一致：迁移必须沿用 Workbench 当前“最后有效模型”解析优先级，并记录诊断。
- 页面复制后节点 ID 冲突会污染选择、事件和 Flow 引用：复制必须整体重映射，不能只换 Page ID。
- DOM 视觉副本中的 canvas、teleport 或异步图片可能无法直接复制：Overlay 应提供稳定占位和尺寸兜底，并通过真实组件矩阵做浏览器测试。
- 快照过期时下载错误 revision：下载入口必须捕获 snapshot，而不是重新读取 reactive computed。

