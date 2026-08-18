# 文档主题与复用

文档站使用独立包 `@moluoxixi/vitepress-theme-element-plus` 提供完整的 Element Plus 风格 VitePress 主题。主题包在 VitePress 稳定布局运行时之上维护导航、侧栏、移动端菜单、本页目录、暗色模式、文档翻页、NotFound，以及可复用的 Demo、Playground 和 ApiDocs 内容运行时。当前组件库只保留自己的站点配置、组件目录、正文、示例和项目数据。

## 迁移到另一个组件库

1. 安装主题包，并从包根入口导入 `defineElementPlusDocs`。在 `.vitepress/config.ts` 中维护一个配置对象，集中声明品牌、logo、消费方样式、仓库、公开路由和 locale。
2. 在 `.vitepress/theme/index.ts` 直接导出 `elementPlusDocsTheme`。需要注册当前站点专属组件或 Vue 插件时，改用同一根入口的 `createElementPlusDocsTheme({ enhanceApp })`。主题入口与第一步的配置工厂必须配套使用，以便注入消费方样式。
3. 维护目标组件库自己的组件目录和正文。通过主题包的 `createElementPlusDocsContent` 注册 `Demo`、`Playground`、`ApiDocs` 及目录内容组件；通过 `@moluoxixi/vitepress-theme-element-plus/markdown` 启用 Demo 容器。消费方只提供允许的运行时模块、starter source、生成的 API JSON 和项目元数据，GitHub 同步与 API 提取仍留在消费方。
4. 为每个 locale 分别声明语言标签、VitePress 站点键和 URL 前缀，例如中文使用 `zh-CN`、`root`、空前缀，英文使用 `en-US`、`en`、`/en`。主题不会从语言标签猜测路由。
5. 运行主题包的类型检查、测试、构建和中性 fixture 构建，再运行目标文档站的测试与生产构建。

仓库元数据有两个严格独立的已提交快照：`.vitepress/github-metadata.json` 与 `.vitepress/git-local-metadata.json`。站点必须通过 `docsSite.metadataSource` 显式选择 `github` 或 `git-local`，不存在 `auto`、文件回退或跨源合并；普通 `dev` 和 `build` 只校验并消费选中的快照，也不会访问网络。`pnpm --filter @moluoxixi/docs sync-github-metadata` 使用 GitHub API 刷新 issue、profile 和提交信息；`pnpm --filter @moluoxixi/docs sync-git-local-metadata` 从完整本地 Git 历史中的配置默认分支刷新提交与贡献者，拒绝 shallow clone，且不把作者邮箱写入快照。

现有 Husky `pre-commit` 会刷新本地 Git 快照并只暂存 `.vitepress/git-local-metadata.json`，不会把其他工作区文件加入暂存区。扫描器解析配置的默认分支，而不是任意检出分支的 `HEAD`。由于待创建提交的 SHA 在 hook 结束后才存在，在默认分支上创建的提交会写入截至 hook 执行前的分支历史；新提交会在下一次刷新时进入历史。需要单独核验时可运行 `validate-github-metadata`、`validate-git-local-metadata` 或按配置执行的 `validate-selected-metadata`。

组件 API 名称、类型和描述来自源码契约，不在 Markdown 中重复维护。主题操作文案和生成页面框架完整支持中英文；组件正文和源码 JSDoc 的翻译由 locale 源文档与组件作者逐步补齐。

## 维护边界

主题包是布局、Element Plus 安装、基础样式、Demo/Playground/ApiDocs 内容运行时和通用交互的唯一来源；消费方负责站点身份、组件内容和项目数据。第一版固定复制自 Element Plus 文档主题的已记录 commit，后续修改直接在独立包中维护，不自动跟踪上游，也不在每个文档站复制一套主题源码。
