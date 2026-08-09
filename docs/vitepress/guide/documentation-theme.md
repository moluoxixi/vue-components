# 文档主题与复用

文档站使用独立包 `@moluoxixi/vitepress-theme-element-plus` 提供完整的 Element Plus 风格 VitePress 主题。主题包在 VitePress 稳定布局运行时之上维护导航、侧栏、移动端菜单、本页目录、暗色模式、文档翻页、NotFound，以及可复用的 Demo、Playground 和 ApiDocs 内容运行时。当前组件库只保留自己的站点配置、组件目录、正文、示例和项目数据。

## 迁移到另一个组件库

1. 安装主题包，并从包根入口导入 `defineElementPlusDocs`。在 `.vitepress/config.ts` 中维护一个配置对象，集中声明品牌、logo、消费方样式、仓库、公开路由和 locale。
2. 在 `.vitepress/theme/index.ts` 直接导出 `elementPlusDocsTheme`。需要注册当前站点专属组件或 Vue 插件时，改用同一根入口的 `createElementPlusDocsTheme({ enhanceApp })`。主题入口与第一步的配置工厂必须配套使用，以便注入消费方样式。
3. 维护目标组件库自己的组件目录和正文。通过主题包的 `createElementPlusDocsContent` 注册 `Demo`、`Playground`、`ApiDocs` 及目录内容组件；通过 `@moluoxixi/vitepress-theme-element-plus/markdown` 启用 Demo 容器。消费方只提供允许的运行时模块、starter source、生成的 API JSON 和项目元数据，GitHub 同步与 API 提取仍留在消费方。
4. 为每个 locale 分别声明语言标签、VitePress 站点键和 URL 前缀，例如中文使用 `zh-CN`、`root`、空前缀，英文使用 `en-US`、`en`、`/en`。主题不会从语言标签猜测路由。
5. 运行主题包的类型检查、测试、构建和中性 fixture 构建，再运行目标文档站的测试与生产构建。

普通 `dev` 和 `build` 不访问 GitHub，只读取已提交的 `.vitepress/github-metadata.json`；但会先校验仓库身份、manifest 覆盖、组件路径和数据结构，不会把缺失数据静默显示为 0。同步命令支持 `GITHUB_TOKEN`，会固定配置分支的 head、处理分页、排除 Pull Request，并在完整成功后替换旧快照。

组件 API 名称、类型和描述来自源码契约，不在 Markdown 中重复维护。主题操作文案和生成页面框架完整支持中英文；组件正文和源码 JSDoc 的翻译由 locale 源文档与组件作者逐步补齐。

## 维护边界

主题包是布局、Element Plus 安装、基础样式、Demo/Playground/ApiDocs 内容运行时和通用交互的唯一来源；消费方负责站点身份、组件内容和项目数据。第一版固定复制自 Element Plus 文档主题的已记录 commit，后续修改直接在独立包中维护，不自动跟踪上游，也不在每个文档站复制一套主题源码。
