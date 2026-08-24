# 文档生成产物与主题边界重构

## 目标

让 `docs/vitepress/.vitepress/` 只承载可维护的站点源代码，把 API 合约、仓库平台快照和自动声明等可再生产物统一输出到 `docs/vitepress/.generated/`，并从 Git 中移除。生产文档在构建前严格生成所选 provider 的数据，测试使用稳定 fixture，不再把真实平台快照当作源码或测试夹具。

## 背景

- 当前五份 `*-metadata.json` 与站点 TS 源码平铺在 `.vitepress/`，虽然由同步脚本生成，却被 Git 跟踪。
- `.vitepress/api/*.json` 已被忽略，但生成产物仍分散在 `.vitepress/api`、`.vitepress/*.json`、`.vitepress/*.d.ts`。
- 文档构建通过虚拟模块静态读取所选 provider 快照；直接删除快照会让全新 clone、CI 和 Pages 构建失败。
- 两组测试直接导入真实快照，造成确定性测试依赖生产数据和历史状态。
- `theme/repository-content.ts` 只做通用 capability/action 映射，适合由主题包拥有。
- 父任务原先要求提交离线快照；本任务以用户最新决策替换该约束。

## 需求

### R1. 统一生成目录

- 使用唯一生成根目录 `docs/vitepress/.generated/`。
- API 合约输出到 `.generated/api/*.json`。
- provider 快照输出到 `.generated/repository/<provider>.json`。
- package Playground manifest snapshot 输出到 `.generated/markdown/playground-manifests.json`。
- 自动导入和全局组件声明输出到 `.generated/types/*.d.ts`。
- 整个 `.generated/` 必须被 Git 忽略，生成器自行创建所需目录，不依赖 `.gitkeep`。
- VitePress 自身的 `.vitepress/cache`、`.vitepress/dist` 继续遵循框架默认位置和忽略规则，不复制到项目生成目录。

### R2. 生成物不进入 Git

- 从 Git 索引删除现有五份真实 provider metadata JSON 和两份自动生成声明。
- 同步命令不得执行 `git add`，pre-commit 不得刷新并暂存 ignored 产物。
- 生成 JSON 不包含 token、作者邮箱或其他凭据；现有严格 provider 身份规则保持不变。
- 同步成功前继续使用原子写；失败时保留同一生成目录中已有快照，若无快照则明确失败。

### R3. 严格的构建前生成

- 增加统一的 selected-provider 同步入口，读取 `VITE_DOCS_REPOSITORY_METADATA_PROVIDER`，不提供 `auto` 或跨 provider 回退。
- `pnpm -C docs/vitepress dev` 与 `pnpm -C docs/vitepress build` 是受支持入口；它们调用主题包的 `element-plus-docs dev/build`，由 CLI 创建或刷新 API 合约和当前所选 provider 快照，再校验后消费。VitePress 插件在同次 dev/build 中创建或刷新自动声明。
- 根级 `pnpm build:docs` 和 Pages 构建必须走同一 docs package lifecycle；普通 packages build/release 不生成文档数据，直接调用底层 `vitepress build` 不承诺补齐生成步骤。
- 默认生产 provider 仍为 GitHub；GitHub CI 和 Pages 显式提供 `${{ github.token }}` 作为 `GITHUB_TOKEN`，降低匿名 API 限流风险。
- 选择 GitLab、Gitee、Yunxiao 或 local 时，只生成该 provider；缺少必要凭据或平台请求失败时，命令和构建必须失败，不改用 GitHub/local 数据。
- npm package 构建与发布不因未构建文档而依赖 provider 网络。

### R4. 测试与生产数据解耦

- 五个平台的 validator、normalizer、capability、selection 测试改用 `docs/vitepress/scripts/__tests__/fixtures/repository-metadata/` 下的小型合成 fixture。
- fixture 是稳定测试输入，可以提交 Git，但不得复制真实生产快照或依赖当前仓库提交历史。
- fixture 固定使用两个虚构组件和虚构平台身份，不导入生产 `docsSite`、manifest 或 expectation；真实 CLI 子进程覆盖默认 provider、显式 provider 和非法 provider。
- required CI 不连接 GitLab、Gitee 或 Yunxiao；仅生产文档的默认 GitHub 快照在构建时同步。
- CI 删除“校验五份已提交生产快照”的步骤，改为离线 provider fixture 测试和生成后校验 selected snapshot。

### R5. 源文件目录和主题边界

- `.vitepress/config.ts` 与 `.vitepress/theme/index.ts` 保留在 VitePress 约定位置。
- 其余根级站点 TS 按职责整理为 `site/`、`catalog/`、`repository/`；现有 `theme/`、`markdown/` 保持明确边界。
- 将通用 `repository-content.ts` 实现和测试迁入 `@moluoxixi/vitepress-theme-element-plus`，从主题包公开导出；站点只保留仓库 URL、路径、分支和 issue 前缀的组装。
- 文档站只拥有品牌、组件/package catalog、repository URL、不可推导 provider 字段和运行时 token 环境；provider schema、normalizer、collector、snapshot 生命周期、同步/校验与 prepare CLI 由主题包拥有。凭据与项目配置值不写入主题包源码。

### R6. 删除 RichTextEditor 兼容桥

- `RichTextEditor` 只从 `@moluoxixi/rich-text-editor` 导出、发布、演示和生成 API；`@moluoxixi/components` 不再导出或依赖它。
- 删除 `packages/components/src/RichTextEditor/`、components 根入口导出、`./RichTextEditor` package subpath、Vite library entry、auto-loader 注册和对应兼容/懒加载隔离测试。
- 删除 `@moluoxixi/components` 对 `@moluoxixi/rich-text-editor` 的 workspace dependency，并更新 lockfile 和 package release metadata。
- 组件文档清单必须显式表达组件所属 package、文档源路径和 repository source path；文档 import statement、更新记录、贡献者和源码链接均指向独立包，不保留按名称散落的兼容特判。
- Playground 和文档运行时继续直接依赖 `@moluoxixi/rich-text-editor`，其样式和 Tiptap peer dependencies 不转移回 components 包。

### R7. 可观察的准备流水线

- 文档 `dev` 和 `build` 的准备阶段使用统一日志格式展示每个关键节点的开始、成功或失败状态。
- 节点至少包含：工作区依赖构建、组件路由生成、工具路由生成、API 提取、selected provider 同步、selected snapshot 校验和准备完成。
- 日志必须显示稳定前缀、步骤名称和耗时；metadata 节点额外显示 provider ID 与生成目录，且不得输出 token。
- 任一步骤失败时显示失败节点和子进程退出码，保留原始错误输出，并立即停止后续步骤。
- prepare 使用 `.generated/prepare.lock` 做跨进程互斥；并发 dev/build 在锁节点明确失败，不读取半写生成物。

### R8. 清除全仓类型检查阻断

- 修复 ConfigForm headless 异构 slot 中具体组件字段的 `readonlyRender` 回调逆变问题，不使用 `any` 或类型断言。
- `readonlyRender.value` 继续精确推导为模型字段类型；回调 context 的 `field.component` 只承诺异构 renderer 的 `Component | string` 边界。
- 增加编译期回归测试，并让全仓 `pnpm typecheck` 通过。

### R9. 仓库能力开箱即用

- 消费组件库不得复制 `.vitepress/repository/`、provider schema/normalizer、`*metadata.mts`、sync/validate 或 prepare orchestration 源码。
- `@moluoxixi/vitepress-theme-element-plus` 内置 GitHub、GitLab、Gitee、Yunxiao 和 local 的通用 provider、validators、collectors、严格身份策略、原子写、selected-provider 同步/校验和 prepare CLI。
- 主题包使用 browser-safe repository core、Node-only repository tooling 和 CLI 三个物理入口；Node/CLI 不从主题根入口或浏览器 bundle 导出。
- 消费方只声明当前 provider 的关键配置；未选择的平台不需要配置、token 或网络。
- GitHub/Gitee 的 owner、repository、web/API base URL 优先从 repository URL 推导；GitLab 的 project path/web/API root 从 URL 与可选安装 base 推导；local 的 repository root 自动解析。
- 默认 branch 由远端 repository API 或 local Git remote/symbolic ref 解析，允许显式覆盖；issue 前缀、user agent、bot 排除等使用稳定默认值。
- Yunxiao 仅额外要求无法从 repository URL 推导的 `repositoryId` 与 `YUNXIAO_TOKEN`；GitLab/Yunxiao 贡献者存在歧义时要求显式的 privacy-safe identity-to-username 映射，不从邮箱或姓名猜账号。
- 组件 catalog 使用 package-level profile 推导 package name、API entry、source/docs/repository path 和 browser runtime loader；普通组件项只保留展示字段，独立包组件只选择 package profile。
- 提供可发布的 `element-plus-docs dev` / `build` / `prepare` CLI；受支持入口自动完成生成、selected provider 同步、校验、日志和 VitePress 启动/构建。

### R10. Markdown 项目能力全量内置

- 项目尚未投入使用，不保留旧 resolver callback、旧站点适配器、deprecated 导出或兼容目录；全仓调用方一次性迁移到最新契约。
- `element-plus-docs.config.ts` 统一声明文档 locale 的源码文件/内容目录、组件路由和 package playground manifest；站点不重复维护 `sourceDoc`、`sourceDirectory` 或固定组件包 manifest import。
- `@moluoxixi/vitepress-theme-element-plus/markdown` 内置 Demo 精准源码链接解析，直接消费 resolved project、selected provider、CLI 注入的 project root/default branch 和 Markdown environment。
- `@moluoxixi/vitepress-theme-element-plus/markdown` 内置外部 Playground 项目解析，支持多个 package profile、根导入最小 subpath 重写、entry dependencies/styles 合并，以及从消费项目根解析直接依赖版本。
- package profile 可显式携带同步 playground manifest；未提供 manifest 的 package 保留普通裸包 import，并在使用时按 profile 自动补充样式与安装版本。
- 文档站删除 `.vitepress/markdown/` 的两份实现；真实文档扫描保留为站点集成测试，纯转换与错误矩阵测试迁入主题包。
- `.vitepress/plugins/` 不作为 VitePress 自动加载边界；其中有效契约测试迁入 `scripts/__tests__/` 后删除整个历史目录。

## 验收标准

- [x] 全新 clone 中不存在已提交的 `.generated/` 内容，执行文档 dev/build 可先生成所选 provider 快照和 API 合约并成功运行。
- [x] `git ls-files docs/vitepress/.generated` 为空，旧 `.vitepress/*-metadata.json`、`auto-imports.d.ts`、`components.d.ts` 不再被跟踪。
- [x] `.generated/` 下只包含受控的 `api/`、`repository/`、`markdown/`、`types/` 生成物，生成脚本没有继续写入旧路径。
- [x] 默认 GitHub 的 CI、Pages 和文档构建成功；其他 provider 未被选择时不需要其 token 或网络。
- [x] 显式选择任一 provider 时只读取对应生成文件，缺失/失败直接报错且不存在 fallback。
- [x] 五个平台的 validators、normalizers、capabilities 和 selection 由合成 fixture 确定性覆盖。
- [x] `.vitepress` 根级源文件按职责收敛，`repository-content` 的通用实现和测试归属主题包。
- [x] `@moluoxixi/components` 的根入口、子路径、构建产物、auto-loader、依赖和测试均不存在 RichTextEditor 兼容桥；文档和 Playground 仍通过独立包正常运行。
- [x] 文档 dev/build 的终端输出能清晰观察每个准备节点的 `START / OK / FAIL`、耗时、selected provider 和生成目录；失败步骤不会被后续日志掩盖。
- [x] 中英文主题文档更新为“生成目录 + selected-provider 构建同步”模型，不再描述提交或暂存生产快照。
- [x] 一个全新消费 fixture 只安装主题包并提供单一配置文件，即可运行 docs dev/build；fixture 中不存在复制的 repository/provider/metadata scripts。
- [x] GitHub 最小配置只需 repository URL 与组件 catalog；GitLab/Gitee/local/Yunxiao 只增加各自不可推导的关键字段。
- [x] 文档站不存在 `demo-source-links.ts`、`playground-external.ts` 或手写 resolver callback，主题 Markdown 项目插件通过单一 project config 工作。
- [x] 多 package profile 的源码链接、manifest 子路径重写、直接依赖版本、样式和 TS/JS 投影由主题单测与本站全量 Demo 集成测试覆盖。
- [x] `.vitepress/plugins/` 与 `.vitepress/markdown/` 历史实现目录被删除，未保留旧 API 或兼容导出。

## 不在本任务范围

- 移动 VitePress 的 `cache`、`dist` 等框架控制目录。
- 把生成的组件/工具路由 Markdown 移出 VitePress 内容树；它们依赖文件路由，后续如需处理应单独设计内容根或动态路由方案。
- 在 required CI 中实时请求 GitLab、Gitee 或 Yunxiao。
