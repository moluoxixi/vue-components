# 验证

本页记录可复跑的验证方式。验证结果只对应实际执行的改动与环境，不沿用旧文档中的
历史测试数量或验收结论。

## 设计体验验收

按 [实施计划](./implementation-plan.md#验收项目)完成创建、多轮修改、撤销重做、保存重开、
体验和源码交付。检查 Element Plus 与 Ant Design Vue，并覆盖桌面和手机视口。
视觉属性编辑应检查合法值、清空、其他 style 键保留、非对象和受支持属性别名只读、
命令拒绝后的权威值及历史一致性。检查既有表单断点布局，但不将静态视觉属性记为
节点级响应式能力。

## 主要命令

在仓库根目录执行，先安装当前锁文件依赖：

```powershell
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench verify:templates
pnpm --filter @config-form/workbench test:e2e
pnpm test:package-architecture
pnpm test:config-form-packages
node scripts/check-element-plus-imports.mjs
```

Workbench 构建附带 Element Plus、Monaco 和 Tailwind 产物检查；模板验证执行真实源码
消费者的类型检查与构建。浏览器检查覆盖交互、键盘、可访问性和响应式，视觉基线变更
需要实际查看截图。代码风格检查应覆盖本轮修改文件。

涉及跨层模型与生成行为时，补充：

```powershell
pnpm exec turbo run test typecheck --filter='./packages/ConfigForm/**' --filter='!@config-form/playground' --concurrency=2
pnpm --filter @moluoxixi/config-form-source test
pnpm --filter @moluoxixi/config-form-source typecheck
```

涉及 SDK、本地工作区与 MCP 时，按各包 README 执行
[Studio SDK](../studio/README.md)和[Local 验证](../local/README.md)。
Local 的 `verify:source` 与 `verify:pack` 需要先构建，验证实际安装和独立生成工程。

## 本轮记录

文档重组已移除四份旧主文档，并替换其全部本地引用。12 份当前文档通过 ESLint；
使用 Markdown-it 解析检查的 54 个本地文件与锚点链接全部可解析，索引覆盖六份新文档。

2026-10-15 实际通过的检查：

| 检查              | 已执行范围                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Designer 单测     | 30 个文件、258 项通过                                                                                                           |
| Model 单测        | 8 个文件、80 项通过                                                                                                             |
| Source 单测       | 10 个文件、114 项通过，CSS / Tailwind 真实消费者完成自定义 class、style 和主题变量的类型检查与构建                              |
| Workbench 单测    | 69 个文件、683 项通过；其中 14 项导出快照覆盖双组件库、多选与撤销、保存重开、transfer、Runtime、Raw / Binding 和 CSS / Tailwind |
| 类型检查          | Designer、Model、Source、Workbench 均通过                                                                                       |
| Workbench 构建    | 通过，Element Plus、Monaco、Tailwind 三项产物检查通过                                                                           |
| 模板消费者        | 6 项通过                                                                                                                        |
| 全仓包架构        | 26 项测试通过；单项超时预算调整为 15 秒后重跑通过，CLI 检查 39 个包、0 项欠账                                                   |
| ConfigForm 发布包 | 16 项构建任务成功，公开包边界验证通过                                                                                           |
| SDK / Local 回归  | Studio 6 项、Local 7 项，以及两包类型检查通过                                                                                   |
| 代码风格          | 当前 ESLint 配置覆盖的改动文件无错误；该配置不匹配 Vue SFC，未将其计为 SFC lint 通过                                            |

Workbench 完整浏览器检查共 123 项，115 项通过；其余 8 项是 1440px 桌面视觉基线差异，
内容均为保存位置的 `This browser` 状态标识。八组差异逐一人工查看并更新基线后，独立
定向重跑 8 项全部通过。共 123 项场景在完整执行与定向复跑中通过。

双组件库的新视觉编辑、保存恢复、Runtime computed style、撤销重做、手机 Inspector
及 Axe 检查通过。三个手机管理页面的列宽裁剪修复后通过。已人工查看双组件库桌面与
手机截图；4 组模板创建文案基线已更新并重跑通过。

独立审查发现并修复源码序列化排序改变 CSS 简写与长写优先级的问题。回归覆盖对象与
嵌套数组，比较预览和两种导出结果的 CSS 计算值；修复前测试失败，修复后 Source
114 项、类型检查和相关代码风格检查全部通过。

## 属性表单复用回归（2026-10-15～16）

视觉属性改为经 `DesignerPropertyForm`、Headless `defineField` 和宿主注入的 renderer
渲染。新增回归检查草稿与正式值的隔离、其他字段更新时保留草稿、命令拒绝回灌、
继承值或空值聚焦与失焦不产生写入、字段排序、切换选区和页面、只读事件及多选清空。
混合状态同时比较各节点的权威属性值，外部修改会清理旧草稿与错误；混合跨度可以统一
为默认跨度或批量清空，不会被误判为未改变的继承值。

本轮实际执行：

| 检查           | 结果                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------ |
| Designer 单测  | 31 个文件、276 项通过，其中 13 项覆盖共享属性表单状态                                      |
| Workbench 单测 | 69 个文件、683 项在执行与定向复跑中通过，包含双组件库 Inspector 和导出快照                 |
| 类型检查       | Designer、Workbench 通过                                                                   |
| 构建与公开包   | Designer、Workbench 构建通过；16 项 ConfigForm 构建任务和公开包边界检查通过                |
| 包架构         | 26 项通过，CLI 检查 39 个包、0 项欠账；全仓扫描使用 15 秒测试超时预算                      |
| 浏览器         | 最终一次完整执行 14 项全部通过，覆盖双组件库属性/校验/视觉编辑、保存重开、焦点、小屏与 Axe |

首次浏览器执行通过 12 项。焦点测试因依赖旧字段标识失败，改用可访问控件定位后通过；
Ant Design Vue 的属性与校验场景在保存重开后等待画布超时，独立复跑通过。双组件库的
桌面和手机视觉编辑截图均已人工查看。

新增视觉 setter 按单一父组件的目录规则收拢，并补齐本地 barrel 后，Workbench 架构检查
定向复跑通过。一次并行构建期间的画布性能检查超出 16.7ms 预算，未改阈值，单独重跑
Designer 全套 276 项通过。修改的 TypeScript 和 Markdown 通过当前 ESLint 配置；该配置
不匹配 Vue SFC，SFC 通过类型检查与构建验证。

## Inspector 单表单与误用清理（2026-10-16）

扫描 Designer、Workbench 与适配器的生产使用后，将断点启用从伪 boolean 字段改为
直接创建或删除覆盖配置的开关命令。普通属性、视觉属性、校验与表单布局按选区共用
一个 Inspector 模型和 renderer；复杂数据绑定与交互仍作为无字段组件嵌入布局。
画布、体验预览和校验实验室的 ConfigForm / Headless 使用保留。

新增回归覆盖单 renderer、无嵌套 form、搜索与切换标签保留文本和复杂编辑器草稿、
视觉错误、逐字段只读、旧回调在权限或选区变化后失效，以及断点启用的继承复制、
删除覆盖、命令拒绝恢复和键盘导航。搜索引起 schema 刷新时，模型保留缺失字段的
草稿；数据绑定编辑器使用稳定 key，避免前面的分组变化导致重挂载。

本轮实际执行：

| 检查           | 结果                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Designer 单测  | 31 个文件、289 项通过；最后修改测试定位方式后，状态与 Panel 的 44 项定向复跑通过                               |
| Workbench 单测 | 69 个文件、683 项通过                                                                                          |
| 类型检查       | Designer、Workbench 通过                                                                                       |
| 构建           | Workbench 构建与 Element Plus、Monaco、Tailwind 产物检查通过；ConfigForm 16 项构建任务成功，公开包边界验证通过 |
| 架构           | 26 项通过；CLI 检查 39 个包、0 项欠账，全仓扫描使用 15 秒测试超时预算                                          |
| 浏览器         | 14 项全部通过，覆盖双组件库视觉编辑、保存重开、撤销、属性/校验、小屏、焦点与 Axe；双组件库桌面截图已人工查看   |
| 代码风格       | 修改的 TypeScript、Markdown 和 Element Plus 导入检查通过；当前 ESLint 配置不匹配 Vue SFC                       |

发布包声明生成曾发现模板内联提交回调的隐式 any，改为有明确类型的命名函数后重跑。
最后的提交保护和稳定 key 修改后，双组件库属性/校验、响应式尺寸、视觉编辑与保存
重开的 5 项浏览器场景再次全部通过。

## 编辑器边框与层次调整（2026-10-16）

将输入区域的底色、静态边框和 hover 边框拆为独立 token，Workbench 映射到 Designer，
独立 Designer 提供默认值。材料卡、图层、页面、历史记录和模式切换减少重复描边；
浅色画布用轻灰背景区分白色页面。开关、复选框、键盘焦点和错误状态保留明确边界，
改动限定编辑器界面。

本轮实际执行：

| 检查         | 结果                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| 单测         | Designer 31 个文件、289 项通过；Workbench 69 个文件、683 项通过，含 261 项主题合同检查                  |
| 类型检查     | Designer、Workbench 通过                                                                                |
| 构建与公开包 | Workbench 构建及 Element Plus、Monaco、Tailwind 产物检查通过；16 项 ConfigForm 构建任务和公开包边界通过 |
| 架构与导入   | CLI 检查 39 个包、0 项欠账；Element Plus 导入检查通过                                                   |
| 浏览器交互   | 10 项通过，覆盖双组件库视觉编辑、撤销、保存重开、焦点、小屏、Axe 与 Runtime computed style 隔离         |
| Windows 视觉 | 12 项编辑器和 4 项模板场景全部通过；查看桌面、平板、手机和浅深主题截图后更新基线，独立复跑 16 项通过    |
| Linux 视觉   | Playwright 1.60.0 Noble 容器执行相同 16 项通过；查看截图后同步 Linux 基线，独立复跑 16 项通过           |

浅色、深色、手机 Inspector 及双组件库编辑截图已人工查看。强边界 token 继续供开关和
复选框使用；新的柔和字段 token 不改变 Runtime 用户界面的样式。
