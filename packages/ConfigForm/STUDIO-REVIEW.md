# ConfigForm 工作流升级审核指南

分支：`codex/config-form-studio-upgrade`。本轮直接按研发阶段合同演进，不添加旧代码或旧模板
兼容层。目标是让字段创作、规则验证、数据模拟、体验检查和源码交接形成完整的工作流。

## 启动与入口

在仓库根目录执行：

```powershell
pnpm test:config-form-packages
pnpm --filter @config-form/workbench dev --host 127.0.0.1 --port 4331 --strictPort
```

打开 <http://127.0.0.1:4331/>，创建一个项目，再创建审批或问卷页面。项目创建时选择
Element Plus 或 Ant Design Vue，页面模板和组件解析受该 adapter 约束。顶部语言按钮可以
切换中文；设计、体验、交付分别对应作者工作区、实际运行和源码查看。

## 建议审核的五个场景

| 场景         | 操作                                                                                                            | 预期结果                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 字段创作     | `Ctrl/Cmd+K` 搜索并插入输入框；收藏物料；搜索大纲；点击选择路径中的祖先；拖动侧栏分隔线                         | 插入可撤销，选择与属性面板同步；面板宽度保存为本地偏好；窄屏仍可访问侧栏                                 |
| 规则验证     | 设置 Required/长度/邮箱等规则；在校验实验室输入样例及其他字段值；在交互页构造嵌套条件并运行表达式样例           | 使用真实校验与安全求值器；显示规则结果；样例不会修改默认值或项目数据；复杂原表达式不会被模式切换覆盖     |
| 模拟数据     | 新建 Dataset，导入 CSV；修改表格单元格；切换数据集或关闭后重开；保存；编辑 options/table/list 映射与查询        | 未保存草稿可继续编辑；保存一次产生一个历史项；类型保留；映射/查询预览可检查实际输出和诊断                |
| 响应式与体验 | 对照桌面/平板/手机；将某断点布局复制到另一断点后撤销；进入体验并修改字段；打开浮层；查看实例状态并重置          | 三个实际 iframe 使用相同编译结果；布局复制可整体撤销；实例值与状态实时更新；重置创建新的体验会话         |
| 生成与交付   | 命令中心打开 JSON Schema 生成；审核字段/规则映射后应用并撤销；交付页查看 CSS/Tailwind、原生 Vue/ConfigForm 产物 | 不支持项明确显示；整批插入可撤销；两种交付模式独立生成/失败；问题面板可定位；原生 Vue 项目可独立安装运行 |

可额外检查：说明、帮助、警告文本在设计、体验和生成源码中一致；选择紧凑密度时采用 8px
默认间距，舒适密度采用 16px；用户显式设置的 `gap` 优先。

## Runtime 宿主能力

以下 API 由生产宿主配置，Studio 当前没有全部提供可持久化编辑入口：

| API                                  | 行为                                                              |
| ------------------------------------ | ----------------------------------------------------------------- |
| `errorSummary` / `errorSummaryLabel` | 展示校验问题摘要，点击可定位具体字段实例                          |
| `focusFirstError`                    | 提交存在校验问题时滚动并聚焦首次错误，可关闭；重复字段按实例定位  |
| `scrollToFirstError()`               | 主动揭示首次错误实例                                              |
| `loadingText` / `validatingText`     | 提供可访问的加载和校验状态文本                                    |
| `stickyActions` + `actions` 插槽     | 固定长表单操作区；插槽提供值、状态、`submit()` 和 `resetFields()` |

Element Plus 与 Ant Design Vue 包会转发 `actions` 插槽。字段支持文本使用
`aria-describedby` 关联控件。源码生成同步保留字段文本和表单布局，宿主的上述额外展示
策略需要程序员在交付代码中配置。说明、帮助和警告中的 HTML 字符与 `{{…}}` 保持为
字面文本，不会作为生成模板的标记或表达式执行。

## 实现边界

- 项目、Surface 和规则仍通过严格的当前合同 Reader 校验；所有正式作者变更通过
  command/transaction/history，编辑器样例、搜索、弹窗和草稿不写入 ProjectDocument。
- Dataset 单元格草稿仅保留在当前会话，刷新前应保存。表格一次只渲染当前页；数字、布尔、
  对象沿用现有类型，新增文本列保持字符串，嵌套值以 JSON 编辑。
- CSV 支持引号、逗号及换行；导入保留字符串值以保护 `001` 等标识符。当前不支持 Excel。
- JSON Schema 只导入平面对象中的 primitive 字段，支持 nullable、枚举、默认值、Required
  和受支持的校验。`$ref`、嵌套对象/数组、组合 schema 等会报告不支持，不会静默降级。
- 条件树支持字段值路径、比较和 AND/OR/NOT，编辑深度上限为 6；其余安全 AST 用高级
  JSON 编辑。执行安全边界由已有白名单 schema/求值器控制。
- 布局复制只复制表单列数、默认跨度与标签宽度，不复制每个字段的独立 placement。
- Studio 使用本地静态数据，没有增加 HTTP、任意 JavaScript/CSS、Flow 或多人协作。
  Designer、Prototype Runtime 和 Source 保持独立职责；原生 Vue 交付不依赖内部解释器。

## 验证记录

验证日期：2026-10-09。以下检查均已通过：

| 检查                                             | 结果                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| ConfigForm 全包单测与类型检查（不含 playground） | 53 个任务全部成功；188 个测试文件、1,729 项测试通过，包含 Model/Compiler 性能用例         |
| Source 文案字面值回归与生成消费者                | 完整 101 项测试及类型检查通过；CSS/Tailwind、双组件库和 ConfigForm 绑定消费者独立构建通过 |
| 正式包构建与公开包边界                           | 16 个构建任务成功；`PASS ConfigForm public package boundaries`                            |
| Workbench 模板消费者                             | 6 项集成测试通过，覆盖双 adapter、Tailwind、ConfigForm 绑定和嵌套浮层                     |
| Workbench 生产构建                               | 通过                                                                                      |
| Chromium 浏览器回归                              | 89 项全部通过；包含键盘访问、主题视觉基线和 390px 窄屏检查                                |
| 架构、导入与代码风格                             | 37 个包、0 项架构欠账；Element Plus 导入检查通过；改动的 TS、Vue、CSS/SCSS 与文档检查通过 |

可复跑的主要命令：

```powershell
pnpm exec turbo run test typecheck --filter='./packages/ConfigForm/**' --filter='!@config-form/playground' --concurrency=2
pnpm test:config-form-packages
pnpm --filter @moluoxixi/config-form-source test
pnpm --filter @moluoxixi/config-form-source typecheck
pnpm --filter @config-form/workbench verify:templates
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench test:e2e
pnpm check:package-architecture
node scripts/check-element-plus-imports.mjs
```

截图来自真实浏览器工作流，保存在 `./review/studio-upgrade/`：

- [桌面设计](./review/studio-upgrade/design.png)
- [体验与实例状态](./review/studio-upgrade/experience.png)
- [手机布局](./review/studio-upgrade/mobile.png)
