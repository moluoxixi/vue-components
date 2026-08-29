# 技术设计

## 模型与解析

在 Workbench project 模块中新增 v2 类型和严格 schema。`WorkspaceApplication.pages` 的数组顺序表示排序，`homePageId` 是唯一首页字段。`WorkspacePage.model` 直接保存 `LowCodePageModel`，不再把 `form.config.ts` 或 designer JSON 当作编辑真源。

读取入口实现 `parseStoredWorkspaceApplication`：先解析 v2；否则严格解析 v1 并调用 `migrateWorkspaceProjectV1`。迁移沿用现有 Config/Designer artifact 解析链提取最后有效模型，完整保留旧文件，并仅在 v2 校验成功后原子写回。v1 parser 和 fixture 保留兼容测试。

## Repository 与 revision

Repository 公共契约改为 Application 语义，Memory 与 IndexedDB 共用 parser/migration。revision 仍为应用级乐观锁，一次 commit 原子保存页面元数据、所有 Page Model 和共享文件。Draft 标识 application revision 和 active page，但页面内容不拆成第二套持久化结构。

## Application operations

定义 `add-page`、`rename-page`、`duplicate-page`、`remove-page`、`move-page`、`set-page-route`、`set-home-page`。Reducer 在返回前统一 parse，保证操作原子性。复制构造旧节点 ID 到新节点 ID 的映射，并同步页面内事件、bindings、slots、children 和 Flow 引用。

## Workbench 状态

`currentApplication` 与 `currentPageId` 替代 `currentProject` 列表切换。当前 `configHistory` 只由选中 Page 的 model 初始化；页面内容更新回写到 Application 中对应 Page。页面切换走同一 guard，完成后清理 Designer selection、预览 revision 和 transient drag。

左侧 Pages 使用应用内 `pages[]`，管理按钮打开独立全屏/大对话框 Page Manager。顶部仅显示当前 Application/Page 文本。管理器通过 operations 工作，不直接修改响应式对象。

## 导出适配

Source generator 输入为冻结的 Application clone，为每页生成稳定的 `src/pages/<page-slug>.vue`，并生成 router 和入口。Config 查看按当前页生成 defineField Source；完整 Config 下载可按 pages 目录输出，但仍为生成视图。

## 风险控制

- 接入 UI 前先让 schema、migration、repository round-trip 全绿。
- 默认写 v2 前必须完成 legacy fixture 测试。
- 页面复制必须覆盖嵌套节点和 Flow 引用，无法解析的引用应阻止复制并给出诊断。

