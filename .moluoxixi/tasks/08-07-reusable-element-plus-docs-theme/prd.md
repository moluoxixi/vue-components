# 可复用 Element Plus 文档主题包

## Goal

将 Element Plus 官方文档站的自定义 VitePress 主题源码移植为仓库内独立、可发布、可复用的主题包，并让当前组件文档站改为消费该主题包。后续搭建其他组件库文档时，应能安装主题包并通过配置接入，而不必再次复制整套主题源码。

## Background

- 当前文档主题在 `docs/vitepress/.vitepress/theme/index.ts` 中继承 VitePress `DefaultTheme`，再叠加项目自定义布局、组件和样式。
- 当前文档主题样式在 `docs/vitepress/.vitepress/theme/styles/index.css` 中同时覆盖 VitePress 布局、文档内容、Demo、API 表格和项目专属页面。
- Element Plus 官方文档使用 `@element-plus/docs` 私有 monorepo 包。其主题不是已发布的可安装包，而是 `docs/.vitepress` 下的自定义布局、样式和组件，并直接引用 Element Plus 仓库内部的 `packages/theme-chalk` 源码。
- Element Plus 源码采用 MIT 许可证；移植的实质性代码需要保留版权和许可证声明，并记录上游来源。
- 现有 `08-03-vitepress-component-docs` 任务已交付 API 提取、动态路由、示例运行、Playground、GitHub 元数据和中英文能力；本任务必须保留这些功能，但用户明确要求替换其“继续扩展 DefaultTheme”的主题决策。

## Requirements

- R1: 新增可发布 workspace 包 `@moluoxixi/vitepress-theme-element-plus`；当前文档站只能通过该包的公开入口消费主题，不再持有一份平行的主题布局源码。
- R2: 主题包以 Element Plus 官方文档主题源码为基线进行移植，不以视觉仿制或重新设计替代源码迁移。
- R3: 主题包拥有自定义 VitePress Layout、导航、侧栏、移动端抽屉、页面目录、暗色模式、文档翻页、NotFound、代码块和响应式视觉样式，不再 `extends: DefaultTheme`。
- R4: 移除上游对 Element Plus monorepo 内部相对路径、内部 workspace 包、官方站点内容和品牌身份的硬依赖，改为稳定的 npm/workspace 依赖和主题配置契约。
- R5: Element Plus 组件基础样式、暗色变量、Normalize、图标和其他运行时依赖由主题包明确声明，消费者不需要依赖隐式导入顺序。
- R6: 主题包提供品牌、导航、侧栏、locale、搜索、仓库链接和页面扩展点；组件库专属数据通过配置、slots 或公开组件接口接入。
- R6a: 对外采用单包单 JavaScript 公开入口；主题运行时、VitePress 配置组装、路由 helpers 和公开类型均从根入口提供，内部仍按职责模块化。消费方专属的 Markdown/Vite 插件、Demo/API/Playground/GitHub 数据流程不属于主题包，不得静态进入浏览器主题依赖图。
- R6b: 消费方只维护一个统一的 `defineElementPlusDocs(options)` 主题配置对象；主题包从同一公开入口导出主题对象、主题扩展工厂和 VitePress 配置组装能力。
- R6c: 公共配置只声明主题实际消费并验证的字段。站点专属组件、插件和数据流程通过 `createElementPlusDocsTheme({ enhanceApp })`、VitePress pass-through 或 Markdown 插件显式接入，不以无实现的 feature 开关伪装成主题能力。
- R7: 当前文档站迁移为主题包消费者，同时通过公开扩展点保留现有组件概览、动态组件路由、API 表格、Demo、Playground、GitHub 元数据、贡献者、变更日志和中英文路由。
- R8: 主题包内的上游移植代码必须记录来源仓库、固定 commit、MIT 许可证和本地修改边界；第一版不实现自动上游同步或跟踪 `dev` 分支。
- R9: 主题包应具备独立的类型检查、单元测试、构建产物和包导出验证，并能够被至少一个与当前文档身份无关的最小 fixture 消费。

## Acceptance Criteria

- [x] 仓库存在一个不依赖当前文档目录内部源码的独立主题包，包含主题入口、Layout、样式、公开类型和许可证归属信息。
- [x] 主题入口不再继承 `vitepress/theme` 的 `DefaultTheme`，核心文档布局由移植后的主题包实现。
- [x] 消费方可以从主题包单一公开入口获得主题对象和 VitePress 配置/插件组装能力，不需要从主题包内部路径导入能力。
- [x] 当前文档站的站点身份、消费方样式、locale、公开路由和 GitHub 仓库配置集中到一个消费方主题配置对象。
- [x] 当前文档站通过主题包公开 API 完成配置和扩展，没有复制主题包内部布局或全局样式。
- [x] 当前文档站既有路由和功能在迁移后继续工作，桌面/移动端与亮色/暗色模式无阻塞性样式或交互回归。
- [x] 基础 fixture 可以仅依赖 Vue、VitePress、Element Plus 和主题包，构建具有导航、侧栏、目录、搜索和暗色模式的文档站。
- [x] 当前文档站通过主题公开扩展点接入站点专属能力，并通过配置、生成、构建和浏览器验证。
- [x] 主题包构建、类型检查、单元测试、当前文档测试和 VitePress 生产构建全部通过。
- [x] Playwright 视觉和交互检查覆盖代表性组件页的桌面、移动端、亮色和暗色状态。
- [x] 上游来源、固定 commit、MIT 声明和本地修改边界有可审计记录；发布包包含明确的 MIT package metadata、许可证和第三方声明，第一版不要求自动同步脚本。

## Out Of Scope

- 修改组件库运行时组件的公开 API。
- 将当前文档站专属的 API 提取、Demo、Playground、GitHub 同步/校验或内容组件迁入通用主题包。
- 将 Element Plus 官方品牌、Logo、文档正文或站点统计数据作为主题包默认内容分发。
- 在本任务中发布 npm 包或部署文档站。
