# 文档主题与复用

文档站使用独立包 `@moluoxixi/vitepress-theme-element-plus` 提供完整的 Element Plus 风格 VitePress 主题。主题包在 VitePress 稳定布局运行时之上维护导航、侧栏、移动端菜单、本页目录、暗色模式、文档翻页、NotFound，以及可复用的 Demo、Playground 和 ApiDocs 内容运行时。当前组件库只保留自己的站点配置、组件目录、正文、示例和项目数据。

## 迁移到另一个组件库

1. 安装 `@moluoxixi/vitepress-theme-element-plus`，在文档根目录创建唯一的 `element-plus-docs.config.ts`。使用 `defineElementPlusDocsProject` 声明 repository、documentation locales、package profiles 和组件清单；普通组件只维护展示字段，API 入口、文档路径、仓库路径、运行时模块和样式由 package profile 推导。
2. 在 `.vitepress/config.ts` 中使用 `defineElementPlusDocs` 声明品牌、logo、公开路由和 locale；在 `.vitepress/theme/index.ts` 导出 `elementPlusDocsTheme`，或使用 `createElementPlusDocsTheme({ enhanceApp })` 注册站点专属插件。
3. 通过 `createElementPlusDocsContent` 注册 Demo、Playground、ApiDocs 和目录内容，并用 `elementPlusDocsProjectMarkdownPlugin` 注册项目 Markdown 能力。主题自动生成精准源码行链接以及 CodeSandbox/StackBlitz 的最小子路径、依赖和样式；消费项目不实现 resolver callback。
4. 将文档脚本接到 `element-plus-docs dev`、`element-plus-docs build` 和 `element-plus-docs prepare`。CLI 会加载同一项目配置、生成 selected provider 快照、严格校验后再启动或构建 VitePress。
5. 在项目配置的 `documentation.locales` 中声明语言标签、VitePress 站点键、URL 前缀、内容目录和源码文档文件。需要最小子路径 Playground 的 package profile 通过 `loadPlaygroundManifest: () => import('<package>/playground-manifest')` 延迟加载组件包构建生成的 manifest。CLI 会先构建 workspace 依赖再调用 loader，因此不要在配置顶层静态导入尚未生成的 manifest。

文档作者只维护 locale 源目录，例如中文 `zh/` 与英文 `en/`。`element-plus-docs prepare/dev/build` 会把它们投影到 Git 忽略的 `.generated/content/{zh,en}`，再在每个 locale 的 `components/`、`utils/` 中生成可搜索路由页。VitePress 只消费这棵 runtime content tree；生成页、投影副本和 public 副本都不提交 Git。中文物理页通过 `zh/:path* -> :path*` 发布到根 URL，英文保持 `/en/...`。

仓库元数据由主题包内置的 `github`、`local`、`gitlab`、`gitee` 与 `yunxiao` provider 提供。消费项目通常只配置 `repository: { provider, url }`；GitHub/Gitee 从 URL 推导 owner 和 repository，GitLab 推导项目路径与实例地址，local 推导 Git 根、remote 和默认分支，云效只额外要求无法从 URL 得到的 `repositoryId`。需要在一个项目中调试多平台时才配置 `repositoryProviders`，环境变量只能切换到已显式配置的平台。不存在 `auto`、本地兜底、文件回退或跨源合并。Runtime content、API、provider snapshot、Playground manifest snapshot 与自动声明统一生成到 Git 忽略的 `.generated/{content,api,repository,markdown,types}`。

本地调试可在启动时设置 `VITE_DOCS_REPOSITORY_METADATA_PROVIDER`，无需修改源码。例如 PowerShell 使用 `$env:VITE_DOCS_REPOSITORY_METADATA_PROVIDER='gitlab'; pnpm -C docs/vitepress dev`，POSIX shell 使用 `VITE_DOCS_REPOSITORY_METADATA_PROVIDER=gitlab pnpm -C docs/vitepress dev`。变量为空时选择 `element-plus-docs.config.ts` 中的 `repository.provider`，本项目配置为 `github`；非法值会直接失败，不会回退到其他快照。该变量是构建时选择，不是浏览器内的运行时切换。

`element-plus-docs prepare` 是唯一同步/校验入口，`dev` 与 `build` 自动先执行它。每个关键节点通过 `[docs:prepare] START / OK / FAIL` 展示名称、耗时、provider、输出目录和失败码；锁文件阻止并发 prepare 读取半写数据。CLI 仅动态加载 selected collector，并且只读取对应的 `GITHUB_TOKEN`、`GITLAB_TOKEN`、`GITEE_TOKEN` 或 `YUNXIAO_TOKEN`。五个平台的 schema、normalizer、capability 与 selection 使用主题包内的合成 fixture 离线测试；required CI 只在生产文档构建时同步默认 GitHub。

GitLab 支持显式 web/API base URL、安装子路径和 subgroup；私有项目通过运行时 `GITLAB_TOKEN` 使用 `PRIVATE-TOKEN` 或 Bearer。Gitee 公共云默认使用 REST v5，可选 `GITEE_TOKEN`，Markdown Demo 链接使用 `/blame/...#Lx`。云效需要拥有仓库、提交、分支和成员只读权限的 `YUNXIAO_TOKEN`。GitLab 与云效的提交身份只生成隐私安全映射键，必须由 `contributorProfiles` 或 `contributorAccounts` 显式映射到审核过的在线账号，不能从姓名或邮箱猜测。任何认证、网络、映射、分页、URL 信任或数据格式错误都会中止同步并原样保留旧快照。

GitLab 组件提交 API 是贡献历史的唯一来源，组件级贡献次数由各组件路径下的提交计算。提交姓名和邮箱只用于生成不会泄露原值的稳定 `gitlab:<sha256>` 身份，不能据此猜测账号。先同步一次取得该 ID，再在 `contributorProfiles` 中显式映射到经过审核的 GitLab username；下一次同步必须通过精确 `GET /users?username=` 唯一解析出同一账号的登录名、名称、头像和主页，并把该原子 profile 同时用于 contributor 与所有匹配 commit author。映射缺失、查询为空或歧义、用户名不一致、接口不可用、URL 越出配置实例以及任何认证、网络、分页或格式错误都会中止同步并保留旧快照，不存在首字母或其他来源兜底。映射、快照和日志均不保存邮箱。不同 GitLab 版本可能返回 `/-/issues/:iid` 或 `/-/work_items/:iid`，校验器接受二者；项目禁用或隐藏 Issues 时则关闭 Issue 数据和动作，而项目自身的认证失败仍会直接报错。

能力以 provider 声明为上限，快照只能关闭能力，不能开启未声明能力。GitLab/Gitee 项目关闭 Issues 时会同时隐藏 Issue 数据和动作。云效没有仓库级 Issues，因此 `issues` 与 `issueActions` 恒为关闭；`sourceLinks` 使用真实租户已验证的 `/tree`、`/blob` 路由，Markdown 链接先激活 Codeup 源码视图，再通过 `#Lx` 定位到 Demo 起始行。`editLinks` 仍关闭，也不会把 Projex 工作项或变更请求伪装为 Issue。

Husky `pre-commit` 不生成、不刷新也不暂存 metadata；ignored snapshot 只由 `element-plus-docs prepare/dev/build` 生成。GitHub Actions/Pages 在文档构建步骤使用最小只读 workflow token 同步 GitHub；npm 包构建和发布不触发文档 metadata 同步。源码管理 provider 支持不会隐式创建 GitLab CI、Gitee Go 或云效 Flow。

组件 API 名称、类型和描述来自源码契约，不在 Markdown 中重复维护。主题操作文案和生成页面框架完整支持中英文；组件正文和源码 JSDoc 的翻译由 locale 源文档与组件作者逐步补齐。

## 维护边界

主题包是布局、Element Plus 安装、基础样式、Demo/Playground/ApiDocs 内容运行时和通用交互的唯一来源；消费方负责站点身份、组件内容和项目数据。第一版固定复制自 Element Plus 文档主题的已记录 commit，后续修改直接在独立包中维护，不自动跟踪上游，也不在每个文档站复制一套主题源码。
