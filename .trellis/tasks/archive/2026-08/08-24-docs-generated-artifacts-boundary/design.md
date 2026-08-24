# 设计：文档生成产物与主题边界重构

## 目录边界

```text
docs/vitepress/
├─ element-plus-docs.config.ts            # 单一项目、package catalog 与 repository 配置
├─ .generated/                         # 全量忽略，可删除、可再生
│  ├─ api/<Component>.json
│  ├─ repository/<provider>.json
│  ├─ markdown/playground-manifests.json
│  └─ types/{auto-imports,components}.d.ts
├─ .vitepress/
│  ├─ config.ts                        # VitePress 约定入口
│  ├─ site/                            # 站点身份、locale、自动加载配置
│  ├─ catalog/                         # 组件/工具 manifest 与翻译
│  └─ theme/                           # 站点内容集成与主题入口
└─ scripts/                            # 当前站点的路由与 API 内容生成器
```

`.generated/` 是唯一项目生成根。fixture 是测试源码，必须与生成物分离。

## 生成和消费流程

```text
VITE_DOCS_REPOSITORY_METADATA_PROVIDER
  -> element-plus-docs prepare/dev/build
  -> 对应 provider collector
  -> schema 校验
  -> 原子写 .generated/repository/<provider>.json
  -> selected snapshot 再校验
  -> CLI 环境注入 + 主题 Vite plugin 绑定 selected snapshot
  -> repository normalizer
  -> 主题内容
```

API extraction 和自动声明同样只写 `.generated/`。所有消费者通过单一 generated-path helper 或显式配置读取，禁止重复拼接物理路径。

## 生命周期

- `predev` / `prebuild`：monorepo 内只先构建主题 CLI；发布包消费者不需要该 workspace 步骤。
- `element-plus-docs dev/build`：执行同一严格 prepare，保证全新 clone 可生成内容、同步并校验 selected snapshot；随后启动或构建 VitePress。
- CI/Pages：默认 provider 为 GitHub，在文档构建步骤注入 `GITHUB_TOKEN: ${{ github.token }}`。
- package release：只构建和发布 packages，不触发文档 metadata 同步。
- 平台调试通过 `VITE_DOCS_REPOSITORY_METADATA_PROVIDER=<provider> element-plus-docs prepare`，不公开 provider 专用 sync/validate 命令。

同步不做 provider fallback。已有快照只作为同 provider 原子写失败时的原文件保留，不作为其他 provider 的兜底。

准备阶段由一个跨平台 Node orchestrator 顺序执行现有 package scripts。每个步骤输出稳定的 `[docs:prepare] START|OK|FAIL` 记录；`OK`/`FAIL` 包含毫秒或秒级耗时，metadata 步骤包含 selected provider 和 `.generated/repository` 路径。子进程使用继承的 stdio，失败时先保留原始错误，再输出汇总行并以同一非零退出码终止。整个 `.generated/` 使用 `prepare.lock` 做跨进程互斥；锁冲突本身输出 `FAIL` 并停止，不观察半写产物。

## 测试边界

provider fixture 位于主题包 `test/repository/fixtures/`，每个平台使用两个固定虚构组件、固定虚构仓库身份和最小 commit/contributor 数据；支持 issues 的 provider 包含 issue 状态，GitHub 包含 profile join 数据。fixture 不导入生产 manifest、expectation 或 site 配置，防止生产配置漂移同步掩盖 schema 回归。测试直接覆盖 validator、normalizer、capability downgrade、selection 和仅 selected token 读取。

真实平台验收通过 provider 环境覆盖运行 `element-plus-docs prepare`，真实输出不进入 Git，也不作为 required CI 的测试输入。

## 主题边界

主题包继续拥有：

- platform-neutral repository contract；
- provider registry 和 capability 判断；
- GitHub/GitLab/Gitee/Yunxiao Web URL actions；
- normalized metadata 到主题 component meta/contributors 的纯适配器。

文档站继续拥有当前仓库的品牌、组件/package catalog、repository URL、不可推导 provider 身份字段、运行时 token 环境和当前组件包 playground manifest。provider schema、normalization、collectors、selected snapshot、生成路径、同步/校验和 prepare orchestration 由主题包的 Node tooling 接管。

主题包发布边界：

```text
@moluoxixi/vitepress-theme-element-plus
├─ .                         # browser-safe theme/runtime/content
├─ ./markdown                # Node/VitePress Markdown 项目插件与 Demo/Playground 解析
├─ ./repository              # browser-safe types/providers/validators/actions
├─ ./repository/node         # collectors/local Git/atomic generated files
└─ bin/element-plus-docs.mjs # prepare/dev/build CLI
```

CLI 加载消费方单一 `element-plus-docs.config.ts`（同时支持 `.mts/.js/.mjs`），根据 selected provider 延迟加载一个 collector，只读取该 provider 的 token。CLI 直接执行 prepare 后的 VitePress dev/build，不依赖消费 package 的 `predev`/`prebuild` 复制脚本。

最小消费配置：

```ts
export default defineElementPlusDocsProject({
  repository: {
    provider: 'github',
    url: 'https://github.com/acme/components',
  },
  packages: {
    components: defineComponentPackage({
      name: '@acme/components',
      root: 'packages/components',
      componentSource: name => `packages/components/src/${name}`,
      load: () => import('@acme/components'),
      styles: ['@acme/components/styles'],
    }),
  },
  components: componentGroups,
})
```

普通 component item 只提供 `name/sidebarText/description/icon`；`slug`、package、API entry、source/docs/repository paths 由 package profile 推导并允许显式覆盖。

## 最新 Markdown 项目契约

`element-plus-docs.config.ts` 的 documentation 配置是源码布局唯一来源：

```ts
documentation: {
  componentsRoute: 'components',
  defaultLocale: 'zh-CN',
  locales: {
    'zh-CN': { sourceDirectory: '', sourceDoc: 'docs/index.md' },
    'en-US': { sourceDirectory: 'en', sourceDoc: 'docs/index.en.md' },
  },
}
```

package profile 通过延迟 loader 提供组件包构建生成的 manifest：

```ts
components: defineComponentPackage({
  name: '@acme/components',
  root: 'packages/components',
  componentSource: name => `packages/components/src/${name}`,
  load: () => import('@acme/components'),
  loadPlaygroundManifest: () => import('@acme/components/playground-manifest'),
})
```

loader 是最新生命周期契约，不是旧格式兼容层。配置加载时 workspace package 可能尚未构建，因此 CLI 必须先完成 prepare commands，再调用 loader、校验 ESM default export，并把规范化结果原子写入 `.generated/markdown/playground-manifests.json`。VitePress 只读取 snapshot，不在配置加载阶段直接导入组件包的构建产物。

`elementPlusDocsProjectMarkdownPlugin` 是公开的唯一 Demo Markdown 项目插件。它内部组合通用 Demo parser、精准源码链接和外部项目解析，不公开旧的 `resolveSourceHref` / `resolveExternalProjectSource` callback 配置。CLI 在同一进程注入 project root、documentation package root、selected snapshot 和 resolved default branch；版本解析只接受 documentation package 直接声明且从该 package Node 解析路径可安装的依赖，并读取安装产物的精确版本，不从主题包位置或仅因 workspace hoist 可见就接受依赖。

纯 AST、manifest、source-link 和错误矩阵测试归主题包；扫描当前仓库全部 Markdown/SFC 的契约测试归 docs `scripts/__tests__`。`.vitepress/plugins` 和 `.vitepress/markdown` 不再作为目录边界。

## RichTextEditor 独立包边界

组件 manifest 为每个组件提供明确的 authoring package、docs source path 和 repository source path。普通组件仍属于 `@moluoxixi/components`，RichTextEditor 属于 `@moluoxixi/rich-text-editor`。路由生成、API 提取、import statement、metadata expectation、源码和编辑链接都消费这份显式配置，不通过兼容目录或散落名称特判推导。

`@moluoxixi/components` 删除 RichTextEditor 根导出、subpath、构建 entry、auto-loader、workspace dependency 与兼容测试。独立 package、docs package 和 components playground 保留直接依赖。由于已发布的 `0.x` components package 删除公开出口，使用 minor changeset 记录该 breaking change；用户已明确不存在需迁移的旧消费者，因此不保留 deprecated alias 或过渡版本。

## 迁移与回滚

迁移先建立新目录和路径 helper，再切换写入者和消费者，随后迁移测试，最后从 Git 索引删除旧生成物。任何阶段不得同时允许新旧路径自动回退，否则会掩盖缺失生成步骤。

生成目录迁移回滚时可恢复旧路径接线和已提交快照；不需要改变 provider API 或 UI 契约。RichTextEditor 兼容桥删除是用户确认的公开 API 收敛，不设置运行时回退；如实施阶段发现仓库内部仍有消费者，应改为独立包导入而非恢复桥接。
