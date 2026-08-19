# 文档主题与复用

文档站使用独立包 `@moluoxixi/vitepress-theme-element-plus` 提供完整的 Element Plus 风格 VitePress 主题。主题包在 VitePress 稳定布局运行时之上维护导航、侧栏、移动端菜单、本页目录、暗色模式、文档翻页、NotFound，以及可复用的 Demo、Playground 和 ApiDocs 内容运行时。当前组件库只保留自己的站点配置、组件目录、正文、示例和项目数据。

## 迁移到另一个组件库

1. 安装主题包，并从包根入口导入 `defineElementPlusDocs`。在 `.vitepress/config.ts` 中维护一个配置对象，集中声明品牌、logo、消费方样式、仓库、公开路由和 locale。
2. 在 `.vitepress/theme/index.ts` 直接导出 `elementPlusDocsTheme`。需要注册当前站点专属组件或 Vue 插件时，改用同一根入口的 `createElementPlusDocsTheme({ enhanceApp })`。主题入口与第一步的配置工厂必须配套使用，以便注入消费方样式。
3. 维护目标组件库自己的组件目录和正文。通过主题包的 `createElementPlusDocsContent` 注册 `Demo`、`Playground`、`ApiDocs` 及目录内容组件；通过 `@moluoxixi/vitepress-theme-element-plus/markdown` 启用 Demo 容器。消费方只提供允许的运行时模块、starter source、生成的 API JSON 和项目元数据，仓库元数据同步与 API 提取仍留在消费方。
4. 为每个 locale 分别声明语言标签、VitePress 站点键和 URL 前缀，例如中文使用 `zh-CN`、`root`、空前缀，英文使用 `en-US`、`en`、`/en`。主题不会从语言标签猜测路由。
5. 运行主题包的类型检查、测试、构建和中性 fixture 构建，再运行目标文档站的测试与生产构建。

仓库元数据由可注册的 provider 提供。当前注册 `github`、`local`、`gitlab`、`gitee` 与 `yunxiao`，站点通过 `docsSite.metadataProvider` 严格选择其中一个，生产配置保持为 `github`。主题包导出平台无关的元数据契约、registry、能力裁剪和平台 URL action；站点保留凭据、API client、同步脚本、校验器和独立 JSON 快照。不存在 `auto`、文件回退或跨源合并，未知 provider 会在读取快照前失败。普通 `dev` 和 `build` 只校验并消费所选快照，不访问平台 API。

各平台使用独立命令：`sync-github-metadata`、`sync-gitlab-metadata`、`sync-gitee-metadata`、`sync-yunxiao-metadata` 和 `sync-local-metadata`；对应的 `validate-*-metadata` 命令可离线校验已提交快照。`validate-repository-metadata` 是 CI 的离线聚合入口，只验证已经拥有真实快照的 GitHub、GitLab、Gitee 和 local，不调用任何网络同步。GitLab 支持显式 web/API base URL、安装子路径和含 subgroup 的完整项目路径；私有项目通过运行时 `GITLAB_TOKEN` 使用 `PRIVATE-TOKEN` 或 Bearer 认证。自签名证书与代理由运行 Node 的受信任 CA/网络环境负责，采集器不会绕过 TLS 校验。Gitee 以公共云 REST v5 为基线，web/API base URL 可配置，但企业版必须按实例核验，使用可选 `GITEE_TOKEN`。云效同时表达中央站和地域租户 API，实时同步必须提供 `YUNXIAO_TOKEN`；当前仓库尚未配置真实租户，跟踪的云效快照是明确的配置占位，`validate-yunxiao-metadata` 会拒绝它，不能视为远端验收。所有 collector 都不会把作者邮箱或 token 写入快照，分页也只能留在配置的 API origin 与路径范围内。

GitLab 的 commit API 不提供可验证的账号关联，不能根据提交姓名或邮箱猜测用户。先同步一次取得隐私安全的 `gitlab:<sha256>` contributor ID，再在 `contributorProfiles` 中显式映射到经过审核的 GitLab username；下一次同步会通过精确 `GET /users?username=` 查询补充登录名、头像和主页。查询为空、歧义、用户名不一致、接口不可用或 URL 越出配置实例时，该贡献者继续显示首字母头像。映射、快照和日志均不保存邮箱。不同 GitLab 版本可能返回 `/-/issues/:iid` 或 `/-/work_items/:iid`，校验器接受二者；项目禁用或隐藏 Issues 时则关闭 Issue 数据和动作，而项目自身的认证失败仍会直接报错。

能力以 provider 声明为上限，快照只能关闭能力，不能开启未声明能力。GitLab/Gitee 项目关闭 Issues 时会同时隐藏 Issue 数据和动作。云效没有仓库级 Issues，因此 `issues` 与 `issueActions` 恒为关闭；在真实租户证明精确源码、行锚和编辑路由前，`sourceLinks` 与 `editLinks` 也保持关闭，不会把 Projex 工作项或变更请求伪装为 Issue。

现有 Husky `pre-commit` 只自动刷新并暂存 `.vitepress/local-metadata.json`；网络 provider 不进入提交 hook，避免提交受外部平台可用性、token 或限流影响。扫描器解析配置的默认分支，而不是任意检出分支的 `HEAD`。由于待创建提交的 SHA 在 hook 结束后才存在，在默认分支上创建的提交会写入截至 hook 执行前的分支历史；新提交会在下一次刷新时进入历史。GitHub Actions/Pages 和 npm 发布仍由现有 GitHub 流水线负责，源码管理 provider 不会隐式创建 GitLab CI、Gitee Go 或云效 Flow。

组件 API 名称、类型和描述来自源码契约，不在 Markdown 中重复维护。主题操作文案和生成页面框架完整支持中英文；组件正文和源码 JSDoc 的翻译由 locale 源文档与组件作者逐步补齐。

## 维护边界

主题包是布局、Element Plus 安装、基础样式、Demo/Playground/ApiDocs 内容运行时和通用交互的唯一来源；消费方负责站点身份、组件内容和项目数据。第一版固定复制自 Element Plus 文档主题的已记录 commit，后续修改直接在独立包中维护，不自动跟踪上游，也不在每个文档站复制一套主题源码。
