# ConfigForm Workbench UI 优化

## 目标

在不改变 ConfigForm 核心业务、Runtime 和画布几何合同的前提下，把模板创建与表单设计两条主工作流统一精修为适合持续高频使用的专业 IDE：层级清楚、信息紧凑、控件成熟、响应式稳定，并提供可持久化的非蓝色多主题外观设置。

## 用户价值

- 用户可以在桌面和移动端更快找到高频命令、扫描模板信息并理解异常状态。
- 用户可以独立选择系统/浅色/深色模式与四套社区高采用配色，且偏好跨项目保持。
- 视觉优化不会改变真实 Element Plus / Ant Design Vue Runtime 的表现，也不会污染项目数据。

## 背景与确认事实

- 范围覆盖整个 Workbench，包含模板创建首屏和设计器工作台。
- Workbench chrome 已使用 Element Plus，表单 Runtime 同时支持 Element Plus 与 Ant Design Vue；依赖见 `packages/ConfigForm/workbench/package.json:13`。
- 既有任务已经完成 Element Plus 组件化、统一 `#workbench-overlays`、响应式命令收纳、Tooltip、焦点恢复与无障碍收口，本任务在该底座上精修，不重复迁移。
- Workbench 已有桌面/移动、深浅主题和中英文视觉回归；现有 12 组场景见 `packages/ConfigForm/workbench/e2e/interaction.spec.ts:358`。
- 当前主要缺陷是：900 像素编辑入口不够自解释；390 像素顶栏依赖图标；Dark 壳层与白色 Runtime sheet 反差过强；部分导航/元数据仅 9 像素；900 像素模板目录固定 300 像素并挤压预览；目录加载失败与筛选无结果共用空态；无选择时详情区空白。
- form-create 可作为稳定分区、组件分类、12–13 像素排版和数据类型控件选择的竞品参考，但不复制其品牌、商业入口、物料目录或具体视觉资产。
- 社区高采用但蓝/青主导的 GitHub Theme、One Dark Pro、Dracula、Tokyo Night、Nord 不符合用户偏好。非蓝色候选中，Catppuccin VS Code 约 138 万安装且评分 4.965，Gruvbox VS Code 约 105 万安装且主题仓库约 1.57 万 stars，Kanagawa 仓库约 6368 stars，Rosé Pine VS Code 约 33 万安装；数据于 2026-09-02 核验，仅作为采用信号。
- Catppuccin、Kanagawa、Gruvbox Material、Rosé Pine 的 Light/Dark 原始调色板需要产品化语义映射。相邻 surface 色不能直接承担控件边界，若干 Light accent/status 也不能直接承担小号文字。
- 当前主题由全局 UI store 拥有，仅有内存中的 `dark | light`；Locale 的 localStorage 容错模式可作为应用偏好参考。Workbench 根、模板页和 overlay 共用主题标记，Design/Preview Runtime 位于独立 iframe，现有合同要求其样式不受壳主题影响。

## 需求

### R1. 统一视觉与组件策略

1. 两条工作流采用同一套语义色、排版、间距、边界、焦点与状态语言，同时保留各自的任务重点。
2. 视觉方向为“专业 IDE 精修”：以 12–13 像素紧凑排版、克制边界、稳定分区和明确操作优先级为核心，不采用营销式大标题、大留白、装饰性卡片堆叠或单色主题。
3. Workbench chrome 的选择、输入、下拉、菜单、弹层等优先使用 Element Plus；图标优先使用现有 Lucide。不新增第三套通用 UI 库，也不创建 `BaseButton` 等二次 UI 框架。
4. 属性控件按数据类型选择成熟组件：少量互斥枚举优先 `ElSegmented` / Radio，较多选项使用 `ElSelect` / `ElSelectV2`，布尔使用 Switch，数值使用 InputNumber/Stepper。
5. Designer 核心保持 UI 库无关；Ant Design Vue 继续仅属于对应 Runtime/material adapter。

### R2. 应用级外观设置

1. 明暗模式支持 `system | light | dark`，配色家族支持 Catppuccin、Kanagawa、Gruvbox、Rosé Pine；默认 `system + catppuccin`。
2. Light/Dark 配对分别为 Latte/Mocha、Lotus/Wave、Light Medium Material/Dark Medium Material、Dawn/Main，并通过产品化 semantic foreground、filled action、focus 和 visible border token 满足高密度产品 UI 对比要求。
3. `system` 实时响应 `prefers-color-scheme`；显式 Light/Dark 不响应系统变化。
4. 偏好是全 Workbench 共用的浏览器级状态，选择后即时应用并持久化；不得进入 ProjectDocument、历史、导出或恢复草稿。
5. 桌面使用顶栏齿轮 + `ElPopover`，移动端使用 More 菜单 + `ElDrawer`；模式使用 `ElSegmented`，配色使用带色板预览和可访问名称的单选列表，不提供保存按钮，也不保留重复的单一主题切换入口。
6. 合法存储优先；缺失、未知、损坏或 storage 不可用时回退 `system + catppuccin`。首绘前解析偏好和系统模式，避免固定 Dark 或错误配色闪烁。
7. Workbench 根、模板页和 `#workbench-overlays` 使用同一 `resolvedTheme` 与 `paletteFamily`；Runtime iframe 不接收 Workbench 主题。

### R3. 设计器视觉精修

1. 保持 Canvas 为视觉中心和现有四区职责，不改变 Project Model、Command、History、RuntimeHost、拖拽、selection、camera 或 geometry。
2. 修正 9 像素文字，统一面板、工具条、属性控件、Canvas framing、选中和焦点层级；文字不随 viewport 宽度缩放，字距为 0。
3. 只调整父文档壳层对 Runtime sheet 的 framing；不得向 iframe 注入主题，Canvas 几何偏差超过 1 像素即视为回归。
4. 900 像素下保存、导出、组件、属性显示图标与本地化短文字；其余命令沿用图标、Tooltip 或 More 菜单。
5. 390 像素顶栏保持图标，五项底栏保留文字；粗指针关键触控目标不小于 44×44 像素。
6. 响应式重排必须复用既有 emit、快捷键、`aria-label`、disabled reason、焦点恢复和 overlay 合同。

### R4. 模板创建页精修

1. 宽屏使用紧凑目录 + 详情/真实预览；641–1000 像素使用窄分类栏 + 按需目录，以详情和预览为主；640 像素及以下使用成熟分段控件切换目录/详情，默认进入目录。
2. 目录使用紧凑列表行表达名称、类别、adapter/provider 和资格状态，保留搜索、筛选、roving keyboard、选择与移动返回行为；不改成模板市场卡片网格。
3. 目录加载失败、筛选无结果、尚未选择、资格失败、预览失败和创建中必须分别表达，并提供与状态匹配的下一步动作。
4. 详情保留模板身份、资格信息、真实 Runtime iframe 和 sticky 创建区域；900 像素预览不得被目录挤压或遮挡。
5. 不改变模板数据契约、筛选语义、adapter 加载、Provider 资格校验、预览 race 防护、创建禁用条件和重复提交防护。

## 子任务地图与顺序

| 顺序 | 子任务 | 交付物 | 依赖 |
| --- | --- | --- | --- |
| 1 | `09-02-config-form-workbench-theme-settings` | 外观状态、持久化、8 套 token、设置入口、首绘保护 | 无 |
| 2 | `09-02-config-form-workbench-designer-polish` | 设计器排版、Canvas framing、900/390 命令呈现 | 使用主题子任务的语义 token |
| 3 | `09-02-config-form-workbench-template-polish` | 模板页主从布局、紧凑目录、分离状态 | 使用主题子任务的语义 token |

父任务不承载产品代码，只拥有来源需求、跨子任务合同和最终集成验收。每个子任务独立启动、检查和归档；顺序由文档显式约束，不依赖任务树隐式推断。

## 验收标准

- [x] 1440×900、900 像素和 390 像素下，模板创建与设计器主要区域无错位、遮挡、截断、非预期横向滚动或重复入口。
- [x] 中英文与 Light/Dark 下，工具栏、面板标题、选择器、菜单和主要动作完整可用，键盘焦点可见；粗指针关键命中区满足 44×44 像素。
- [x] 设置界面可独立选择三种模式和四套配色，桌面 Popover 与移动 Drawer 共享状态；打开、选择、Escape、关闭和焦点恢复通过测试。
- [x] 首次访问解析系统主题并使用 Catppuccin；合法偏好刷新后恢复，系统变化只影响 `system` 模式，损坏偏好安全回退且无错误主题首绘闪烁。
- [x] 四配色 × 两 resolved scheme 共 8 个视觉状态通过文本、控件边界、焦点、状态和主要操作对比度门禁。
- [x] Workbench 根、模板页和 overlay 属性同步；项目切换不改变偏好，项目文档、历史、导出和恢复数据中没有主题字段。
- [x] 两套 Provider 的 Design/Preview computed-style 指纹在全部壳主题切换前后保持不变。
- [x] 900 像素的四个指定设计器入口有短文字且 Canvas 保持可见；390 像素顶栏图标、带文字底栏和工具条无截断或遮挡。
- [x] 模板页在宽屏、900 和 390 像素分别呈现主从、窄栏/按需目录、单窗格布局；错误恢复、搜索、筛选、键盘选择、资格检查、预览和创建流程保持可用。
- [x] Workbench 中的常规选择场景使用 Element Plus `ElSelect` / `ElSelectV2` 或仓库已有适配封装；两套表单物料功能对等。
- [x] 单元测试、类型检查、build、bundle guard、E2E、axe、lint 和 `git diff --check` 通过；Canvas 几何偏差不超过 1 像素。
- [x] 视觉测试覆盖 8 个实际主题状态，并仅用少量 900/390、中英文响应式哨兵补充，不生成 72/96 张重复笛卡尔截图。

## 范围外

- 修改 ConfigForm JSON/Flow/RuntimeHost 契约、项目数据语义或源码生成协议。
- 重做表单渲染、拖拽、selection、camera、Command、History 或状态管理架构。
- 自定义取色器、任意 token 编辑、主题导入导出、云同步、项目级主题或 Runtime Provider 主题。
- 远程模板市场、下载、评分、付费、缩略图生成或新的模板数据字段。
- 引入 Element Plus、Ant Design Vue、Lucide 之外的第三套通用 UI 组件库。
- 复制 form-create 的品牌、文案、商业入口或具体视觉资产。
