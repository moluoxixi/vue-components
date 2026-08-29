# Workbench 多页面应用与页面管理

## 目标

把现有“多个单页 Project 伪装成 Pages”的状态升级为一个 Application 内含多个一等 Page 的持久化模型，并用左侧 Pages 与独立 Page Manager 提供统一、可预测的页面工作流。

## 需求

- 新增 schema v2 `WorkspaceApplication`，包含稳定应用身份、revision、manifest、共享文件、`homePageId` 和有序 `pages[]`。
- 每个 Page 包含稳定 id、名称、唯一规范化 route 和唯一页面内容真源 `LowCodePageModel`。
- 旧 v1 `WorkspaceProject` 逐条迁移为单页 Application；迁移必须幂等、失败不覆盖旧记录，不合并不同旧 Project。
- Memory、IndexedDB、revision、draft、template、upgrade 和 export 全部使用同一 v2 parse/migrate 边界。
- 页面集合变更通过纯 `ApplicationOperation` 完成；页面 Config Model 的 Undo/Redo 保持逐页隔离。
- 删除顶部页面 `<select>`；左侧 Pages 是唯一快速切换入口，并保留未保存变更保护。
- 提供独立 Page Manager，支持搜索、新建、重命名、复制、删除、排序、route 和首页设置。
- 拒绝空页面集合、重复 id/route、失效首页和删除最后页面；复制时重建 Page 及所有节点标识。
- Source generator 能接收完整 Application 并为全部页面生成路由和独立页面源码；生成工程不依赖 ConfigForm 包。

## 范围外

- 不实现页面分组、跨应用复制、服务端协作、权限和发布。
- 不改变 Flow 产品定位或新增 Flow Action。
- 不恢复 Source/Config 编辑能力。

## 验收标准

- [x] AC1 v2 schema 与 operations 覆盖全部不变量，非法操作不产生部分状态。
- [x] AC2 v1 fixture 在 Memory/IndexedDB 中迁移、保存、重开后内容一致；迁移失败保留旧数据并返回诊断。
- [x] AC3 顶部没有页面选择控件，左侧 Pages 可切换全部页面且未保存保护有效。
- [x] AC4 当前页 Undo/Redo 不影响其他页，切换后选择、预览和 history 均指向目标页。
- [x] AC5 Page Manager 完成搜索、新建、重命名、复制、删除、排序、route、首页全流程，并正确处理最后页面与重复路由。
- [x] AC6 多页面 Source 输出包含所有页面、应用路由与 `package.json`，可通过类型检查和生产构建。
