# 设计：文档运行时内容树与路由壳生成物收敛

## 作者源与运行时内容

```text
docs/vitepress/
├─ zh/                              # 已提交中文作者源
│  ├─ index.md
│  ├─ guide/*.md
│  ├─ playground.md
│  ├─ components/index.md
│  └─ utils/index.md
├─ en/                              # 已提交英文作者源
│  ├─ index.md
│  ├─ guide/*.md
│  ├─ playground.md
│  ├─ components/index.md
│  └─ utils/index.md
├─ public/logo.svg                  # 已提交静态资源源
├─ CHANGELOG.md                     # 已提交 package changelog，不作为站点页面
└─ .generated/
   ├─ content/                      # VitePress srcDir，全量可再生
   │  ├─ zh/
   │  │  ├─ index.md                # 从 zh/index.md 投影
   │  │  ├─ guide/*.md              # 从 zh/guide 投影
   │  │  ├─ playground.md           # 从 zh 投影
   │  │  ├─ components/{index,*.md} # 概览投影 + prepare 生成页
   │  │  └─ utils/{index,*.md}      # 概览投影 + prepare 生成页
   │  ├─ en/                        # 与 zh 对称的英文内容与生成页
   │  └─ public/logo.svg            # 从 public 投影
   ├─ api/
   ├─ markdown/
   ├─ repository/
   └─ types/
```

作者只修改 `zh/`、`en/` 和 `public/`。`.generated/content` 是 VitePress 唯一运行时物理内容树，components/utils 路由壳从不写回作者源，也不进入 Git。

locale `sourceDirectory` 之间不得相互嵌套，也不得与保留目录 `public` 重叠。`generatedDirectory` 必须是非根、相对 docs root 的目录，其 `content/` 子树不得与任何 locale 或 public 作者源互为祖先/后代；项目配置提前拒绝冲突，同步器在删除和替换前通过 `realpath` 解析现存目标或最近现存祖先，按实体路径再次复核，防止 Windows junction 或目录别名绕过保护。公开 Node API 还必须自行拒绝手工构造的绝对/非规范 `sourceDirectory`、重叠 projection、越界 source event 和越界 destination；不能假设调用者一定经过项目配置解析。全量投影使用系统唯一临时目录，Windows 原子替换只对瞬时 `EPERM`、`EACCES`、`EBUSY` 做有限退避重试。`public/` 可以在启动时不存在，但 dev watcher 始终监听该路径，后续新建的静态资源仍会投影到 runtime content。

## Prepare 数据流

```text
element-plus-docs prepare/dev/build
  -> acquire .generated/prepare.lock
  -> workspace dependency build
  -> rebuild runtime content
       zh/** -> .generated/content/zh/**
       en/** -> .generated/content/en/**
       public/** -> .generated/content/public/**
       inject source Git time into projected Markdown frontmatter
  -> generate component routes into runtime content
  -> generate utility routes into runtime content
  -> API / manifest / provider snapshots
  -> VitePress(root=docs/vitepress, srcDir=.generated/content)
```

runtime content 重建采用 allowlist，只同步 locale 作者源和 public assets，不递归复制 docs root，避免将 `CHANGELOG.md`、`.vitepress`、scripts、node_modules、旧生成物或其他 package 文件暴露为页面。初始同步完成后，route generator 根据 CLI 注入的 `ELEMENT_PLUS_DOCS_CONTENT_ROOT` 写入 staging。

## Locale 与 URL

作者配置继续表达源码位置：

```ts
'zh-CN': { sourceDirectory: 'zh', pathPrefix: '' }
'en-US': { sourceDirectory: 'en', pathPrefix: '/en' }
```

runtime destination 保持 `zh/`、`en/` 对称。VitePress 使用 `'zh/:path*': ':path*'` rewrite 将中文发布到根 URL；英文物理和公开路径均保留 `en/`。不能使用 `'zh/(.*)': '$1'`，VitePress 1.6.4 的对象 rewrite 使用 path-to-regexp 参数语法。

local search 按 rewrite 前物理路径分桶、按 rewrite 后路径生成结果 URL。站点 locale key 仍为 `root` 和 `en`，不增加 `zh` locale key：物理 `zh/**` fallback 到 root 索引，rewrite 后结果链接不含 `/zh`；物理 `en/**` 进入 en 索引。

## VitePress 与主题契约

主题配置 API 扩展并透传 `vitepress.srcDir`。当前站点设置 `srcDir: '.generated/content'`；CLI root 仍是 `docs/vitepress`，所以 `.vitepress/config.ts`、theme、cache 和 dist 位置不变。

VitePress public 目录跟随 `srcDir`，因此 content synchronizer 必须复制 `public/`。作者页的 Git 时间来自作者源文件而不是 ignored staging 副本：投影 Markdown 时查询源文件最近一次 Git 提交时间，并仅在作者没有显式设置 `lastUpdated` 时写入 frontmatter。组件/工具生成壳使用 `lastUpdated: false`。

## Dev 增量同步

CLI 在 `createServer` 后把 `zh/`、`en/`、`public/` 加入 Vite watcher：

- add/change：按 locale destination 增量投影，并刷新源 Git 时间；
- unlink：删除对应 runtime 文件；
- directory changes：只允许 author content allowlist 下路径；
- staging 文件变化由同一 Vite server 触发页面热更新。

组件 package docs/README 仍由生成壳 include，VitePress 继续跟踪 include dependencies；不复制 package 正文到 staging。

## 测试策略

- Node 单测覆盖 staging 全量重建、路径映射、删除、启动后新建 public、源 Git 时间、越界拒绝和对称 zh/en destination。
- 路由测试在临时 staging root 生成 26 个组件页和 14 个工具页，断言 include 相对仓库根正确。
- VitePress fixture 从空 `.generated` 启动，断言 `zh/**` rewrite 后的根中文 URL、`/en` URL、local-search root/en 两个索引、logo 和 lastUpdated。
- Git 路径契约断言 40 个旧壳不再 tracked，作者源仍 tracked，`.generated/content` 被 ignore。

## 风险与回滚

- `srcDir` 改变 public 和 include 解析基准，必须用完整生产 build 验收。
- runtime content 重建失败时 prepare 立即停止，VitePress 不启动；下一次 prepare 从作者源全量重建。
- 回滚需同时恢复默认 srcDir、根中文作者文件和已跟踪路由壳，不能留下双内容树。
