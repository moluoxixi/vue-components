# ConfigForm 独立模板管理

## 目标与用户价值

把模板选择、浏览和管理从单页 Designer 的主编辑壳中拆出，形成独立的应用级模板功能。设计器只负责编辑当前页面，用户在创建项目/页面时再进入模板目录并明确创建目标。

## 已确认事实

- 当前 `WorkbenchShell` 直接装配 `TemplateDialog`，`workbench-ui-store` 直接持有 `templatePickerOpen`。
- 内置模板只有 Element Plus/Ant Design Vue 的 profile fixture；`profile` 是示例内容，不应成为模板管理领域或用户 Profile。
- `ProjectDocument` 和 Registry lock 已提供创建模板实例所需的稳定模型边界；模板目录、筛选和展示状态不应写入 Project Model。
- 页面管理已经是独立 dialog/feature，可作为应用功能边界参考，但模板管理需要独立页面/工作区，而不是继续塞进 Designer dialog。

## 需求

- 新建独立 Template Management 页面/工作区，包含模板目录、搜索、category/provider 筛选、详情预览和“创建项目/创建页面”命令。
- Designer 主编辑区不直接渲染模板列表，也不持有模板浏览状态；顶部或 Pages 的“新建”只导航到统一创建流程。
- 建立模板 manifest/service 合同，管理 id、version、displayName、description、adapter、Registry requirements、preview metadata 和创建工厂。
- 模板实例化必须生成新的 project/page/node/field identity，不共享可变对象；创建前验证 Registry lock 和 schema。
- profile 只保留为内置模板 fixture，UI 以“Element Plus 资料表单”等 displayName 展示，不暴露 `profile` 为管理概念。
- 模板详情预览复用只读 RuntimeHost；预览值和模板浏览状态不得污染当前编辑 session。
- 为将来远程模板源预留只读 provider interface，但本任务只实现内置本地模板，不引入网络服务。

## 验收标准

- [ ] Workbench Designer 壳不再直接装配 `TemplateDialog` 或持有模板目录状态；新建命令进入独立模板工作区。
- [ ] 用户可从空白、Element Plus 模板、Ant Design Vue 模板创建项目或页面，并返回 Designer 编辑新实例。
- [ ] 连续两次从同一模板创建的所有 identity 独立，修改一个实例不会改变模板或另一实例。
- [ ] adapter/Registry 不兼容模板不可创建，并显示可操作诊断。
- [ ] 模板搜索、筛选、详情、返回与创建在 1440/900/390、Light/Dark、zh-CN/en-US 下可用且焦点正确。
- [ ] manifest/service 单测、实例化测试、Runtime preview、navigation Playwright、typecheck 和 build 通过。

## 范围外

- 不建设远程模板市场、账户 Profile、付费、评分、发布审核或云同步。
- 不允许模板携带任意 JavaScript 函数、未注册组件或远程脚本。
- 不把模板管理重新放回 Designer Inspector、Canvas 或 Profile 菜单。
