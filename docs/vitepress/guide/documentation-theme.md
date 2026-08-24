# 文档主题与复用

文档站使用独立包 `@moluoxixi/vitepress-theme-element-plus` 提供完整的 Element Plus 风格 VitePress 主题。主题包在 VitePress 稳定布局运行时之上维护导航、侧栏、移动端菜单、本页目录、暗色模式、文档翻页、NotFound，以及可复用的 Demo、Playground 和 ApiDocs 内容运行时。当前组件库只保留自己的站点配置、组件目录、正文、示例和项目数据。

## 迁移到另一个组件库

1. 安装主题包，并从包根入口导入 `defineElementPlusDocs`。在 `.vitepress/config.ts` 中维护一个配置对象，集中声明品牌、logo、消费方样式、仓库、公开路由和 locale。
2. 在 `.vitepress/theme/index.ts` 直接导出 `elementPlusDocsTheme`。需要注册当前站点专属组件或 Vue 插件时，改用同一根入口的 `createElementPlusDocsTheme({ enhanceApp })`。主题入口与第一步的配置工厂必须配套使用，以便注入消费方样式。
3. 维护目标组件库自己的组件目录和正文。通过主题包的 `createElementPlusDocsContent` 注册 `Demo`、`Playground`、`ApiDocs` 及目录内容组件；通过 `@moluoxixi/vitepress-theme-element-plus/markdown` 启用 Demo 容器。消费方只提供允许的运行时模块、starter source、生成的 API JSON 和项目元数据，仓库元数据同步与 API 提取仍留在消费方。
4. 为每个 locale 分别声明语言标签、VitePress 站点键和 URL 前缀，例如中文使用 `zh-CN`、`root`、空前缀，英文使用 `en-US`、`en`、`/en`。主题不会从语言标签猜测路由。
5. 运行主题包的类型检查、测试、构建和中性 fixture 构建，再运行目标文档站的测试与生产构建。

仓库元数据由可注册的 provider 提供。当前注册 `github`、`local`、`gitlab`、`gitee` 与 `yunxiao`，站点通过 `docsSite.metadataProvider` 严格选择其中一个，生产配置保持为 `github`。主题包导出平台无关的元数据契约、registry、能力裁剪、内容适配器和平台 URL action；站点保留凭据、API client、同步脚本、校验器和生成快照。不存在 `auto`、文件回退或跨源合并，未知 provider 会在读取快照前失败。API、provider snapshot 与自动声明统一生成到被 Git 忽略的 `.generated/{api,repository,types}`，不与 `.vitepress` 源代码混放。

本地调试可在启动时设置 `VITE_DOCS_REPOSITORY_METADATA_PROVIDER`，无需修改源码。例如 PowerShell 使用 `$env:VITE_DOCS_REPOSITORY_METADATA_PROVIDER='gitlab'; pnpm -C docs/vitepress dev`，POSIX shell 使用 `VITE_DOCS_REPOSITORY_METADATA_PROVIDER=gitlab pnpm -C docs/vitepress dev`。变量为空时仍选择 `github`；非法值会直接失败，不会回退到其他快照。该变量是构建时选择，不是浏览器内的运行时切换。

各平台使用独立命令：`sync-github-metadata`、`sync-gitlab-metadata`、`sync-gitee-metadata`、`sync-yunxiao-metadata` 和 `sync-local-metadata`；对应的 `validate-*-metadata` 命令校验 `.generated/repository/<provider>.json`。受支持的 `pnpm -C docs/vitepress dev` 和 `build` 会先运行统一 prepare 流水线，依次构建工作区依赖、生成路由、提取 API、同步并校验 selected provider；每步通过 `[docs:prepare] START / OK / FAIL` 显示名称、耗时、provider、输出目录和失败码。五个平台的 schema、normalizer、capability 与 selection 测试使用提交的合成 fixture，不依赖真实快照或外部平台；required CI 只在生产文档构建时使用 workflow token 同步默认 GitHub，不实时请求 GitLab、Gitee 或云效。GitLab 支持显式 web/API base URL、安装子路径和含 subgroup 的完整项目路径；私有项目通过运行时 `GITLAB_TOKEN` 使用 `PRIVATE-TOKEN` 或 Bearer 认证。自签名证书与代理由运行 Node 的受信任 CA/网络环境负责，采集器不会绕过 TLS 校验。Gitee 以公共云 REST v5 为基线，web/API base URL 可配置，但企业版必须按实例核验，使用可选 `GITEE_TOKEN`；Markdown Demo 源码通过 `/blame/...#Lx` 精确定位起始行。Gitee 提交 API 返回的数字账号 ID 和 login 必须与同一 login 的用户 API 完全一致，不会把另一个 Gitee 账号当作别名。云效同时表达中央站和地域租户 API，实时同步必须提供拥有代码仓库、提交、分支和成员四项只读权限的短期运行时 `YUNXIAO_TOKEN`。Codeup 提交姓名和邮箱只生成隐私安全的映射键，`contributorAccounts` 显式选择经过审核的精确在线 username；同仓库 `/members` API 必须唯一返回该 active 账号，并提供贡献者列表和改动记录共同使用的当前登录名、名称和受信任头像。映射缺失、成员查询为空或歧义、账号字段缺失/冲突/非法或头像越出云效受信任域时同步直接失败并保留旧快照，不会从邮箱猜账号、退回配置资料或使用首字母。Codeup 实仓已经验证组件目录、文件和单行锚点路由；由于非 README Markdown 默认进入没有行号的预览视图，主题包会为 Markdown Demo 链接添加 Codeup 的 `README.md` 源码视图兼容参数，再用 `#Lx` 定位起始行。Issues、在线编辑和未经验证的个人主页链接仍保持关闭。所有 collector 都不会把作者邮箱或 token 写入快照，分页也只能留在配置的 API origin 与路径范围内。

GitLab 组件提交 API 是贡献历史的唯一来源，组件级贡献次数由各组件路径下的提交计算。提交姓名和邮箱只用于生成不会泄露原值的稳定 `gitlab:<sha256>` 身份，不能据此猜测账号。先同步一次取得该 ID，再在 `contributorProfiles` 中显式映射到经过审核的 GitLab username；下一次同步必须通过精确 `GET /users?username=` 唯一解析出同一账号的登录名、名称、头像和主页，并把该原子 profile 同时用于 contributor 与所有匹配 commit author。映射缺失、查询为空或歧义、用户名不一致、接口不可用、URL 越出配置实例以及任何认证、网络、分页或格式错误都会中止同步并保留旧快照，不存在首字母或其他来源兜底。映射、快照和日志均不保存邮箱。不同 GitLab 版本可能返回 `/-/issues/:iid` 或 `/-/work_items/:iid`，校验器接受二者；项目禁用或隐藏 Issues 时则关闭 Issue 数据和动作，而项目自身的认证失败仍会直接报错。

能力以 provider 声明为上限，快照只能关闭能力，不能开启未声明能力。GitLab/Gitee 项目关闭 Issues 时会同时隐藏 Issue 数据和动作。云效没有仓库级 Issues，因此 `issues` 与 `issueActions` 恒为关闭；`sourceLinks` 使用真实租户已验证的 `/tree`、`/blob` 路由，Markdown 链接先激活 Codeup 源码视图，再通过 `#Lx` 定位到 Demo 起始行。`editLinks` 仍关闭，也不会把 Projex 工作项或变更请求伪装为 Issue。

Husky `pre-commit` 不生成、不刷新也不暂存 metadata；ignored snapshot 只由文档 dev/build prepare 或显式 `sync-*-metadata` 命令生成。GitHub Actions/Pages 在文档构建步骤使用最小只读 workflow token 同步 GitHub；npm 包构建和发布不触发文档 metadata 同步。源码管理 provider 支持不会隐式创建 GitLab CI、Gitee Go 或云效 Flow。

组件 API 名称、类型和描述来自源码契约，不在 Markdown 中重复维护。主题操作文案和生成页面框架完整支持中英文；组件正文和源码 JSDoc 的翻译由 locale 源文档与组件作者逐步补齐。

## 维护边界

主题包是布局、Element Plus 安装、基础样式、Demo/Playground/ApiDocs 内容运行时和通用交互的唯一来源；消费方负责站点身份、组件内容和项目数据。第一版固定复制自 Element Plus 文档主题的已记录 commit，后续修改直接在独立包中维护，不自动跟踪上游，也不在每个文档站复制一套主题源码。
