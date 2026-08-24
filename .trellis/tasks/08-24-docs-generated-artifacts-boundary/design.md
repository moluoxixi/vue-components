# 设计：文档生成产物与主题边界重构

## 目录边界

```text
docs/vitepress/
├─ .generated/                         # 全量忽略，可删除、可再生
│  ├─ api/<Component>.json
│  ├─ repository/<provider>.json
│  └─ types/{auto-imports,components}.d.ts
├─ .vitepress/
│  ├─ config.ts                        # VitePress 约定入口
│  ├─ site/                            # 站点身份、locale、自动加载配置
│  ├─ catalog/                         # 组件/工具 manifest 与翻译
│  ├─ repository/                      # provider 选择、expectation、schema、运行接线
│  ├─ markdown/                        # 当前项目的 demo 源码与外部工程解析
│  └─ theme/                           # 站点内容集成与主题入口
└─ scripts/
   └─ __tests__/fixtures/repository-metadata/
```

`.generated/` 是唯一项目生成根。fixture 是测试源码，必须与生成物分离。

## 生成和消费流程

```text
VITE_DOCS_REPOSITORY_METADATA_PROVIDER
  -> sync-selected-metadata
  -> 对应 provider collector
  -> schema 校验
  -> 原子写 .generated/repository/<provider>.json
  -> validate-selected-metadata
  -> Vite alias 绑定 selected snapshot
  -> repository normalizer
  -> 主题内容
```

API extraction 和自动声明同样只写 `.generated/`。所有消费者通过单一 generated-path helper 或显式配置读取，禁止重复拼接物理路径。

## 生命周期

- `predev`：构建工作区依赖、生成内容路由、提取 API、同步 selected provider、校验 selected snapshot；Vite 插件随后更新自动声明。
- `prebuild`：执行同一严格流程，保证全新 clone 可构建；VitePress build 随后更新自动声明。
- CI/Pages：默认 provider 为 GitHub，在文档构建步骤注入 `GITHUB_TOKEN: ${{ github.token }}`。
- package release：只构建和发布 packages，不触发文档 metadata 同步。
- 显式 `sync-<provider>-metadata` 命令保留，用于平台调试和验收，但输出统一进入 `.generated/repository/`。

同步不做 provider fallback。已有快照只作为同 provider 原子写失败时的原文件保留，不作为其他 provider 的兜底。

准备阶段由一个跨平台 Node orchestrator 顺序执行现有 package scripts。每个步骤输出稳定的 `[docs:prepare] START|OK|FAIL` 记录；`OK`/`FAIL` 包含毫秒或秒级耗时，metadata 步骤包含 selected provider 和 `.generated/repository` 路径。子进程使用继承的 stdio，失败时先保留原始错误，再输出汇总行并以同一非零退出码终止。整个 `.generated/` 使用 `prepare.lock` 做跨进程互斥；锁冲突本身输出 `FAIL` 并停止，不观察半写产物。

## 测试边界

provider fixture 位于 `scripts/__tests__/fixtures/repository-metadata/`，每个平台使用两个固定虚构组件、固定虚构仓库身份和最小 commit/contributor 数据；支持 issues 的 provider 包含 issue 状态，GitHub 包含 profile join 数据。fixture 不导入生产 manifest、expectation 或 site 配置，防止生产配置漂移同步掩盖 schema 回归。测试直接覆盖 validator、normalizer、capability downgrade 和 selection，并用真实 CLI 子进程覆盖默认/非法 provider 选择。

真实平台验收仍可通过显式 sync 命令进行，但真实输出不进入 Git，也不作为 required CI 的测试输入。

## 主题边界

主题包继续拥有：

- platform-neutral repository contract；
- provider registry 和 capability 判断；
- GitHub/GitLab/Gitee/Yunxiao Web URL actions；
- normalized metadata 到主题 component meta/contributors 的纯适配器。

文档站继续拥有：

- 当前仓库和组件清单；
- provider API 配置、凭据读取与 collectors；
- provider snapshot schema/normalization；
- selected provider、生成文件路径和 Vite alias；
- demo Markdown 扫描与当前组件包 playground manifest。

## RichTextEditor 独立包边界

组件 manifest 为每个组件提供明确的 authoring package、docs source path 和 repository source path。普通组件仍属于 `@moluoxixi/components`，RichTextEditor 属于 `@moluoxixi/rich-text-editor`。路由生成、API 提取、import statement、metadata expectation、源码和编辑链接都消费这份显式配置，不通过兼容目录或散落名称特判推导。

`@moluoxixi/components` 删除 RichTextEditor 根导出、subpath、构建 entry、auto-loader、workspace dependency 与兼容测试。独立 package、docs package 和 components playground 保留直接依赖。由于已发布的 `0.x` components package 删除公开出口，使用 minor changeset 记录该 breaking change；用户已明确不存在需迁移的旧消费者，因此不保留 deprecated alias 或过渡版本。

## 迁移与回滚

迁移先建立新目录和路径 helper，再切换写入者和消费者，随后迁移测试，最后从 Git 索引删除旧生成物。任何阶段不得同时允许新旧路径自动回退，否则会掩盖缺失生成步骤。

生成目录迁移回滚时可恢复旧路径接线和已提交快照；不需要改变 provider API 或 UI 契约。RichTextEditor 兼容桥删除是用户确认的公开 API 收敛，不设置运行时回退；如实施阶段发现仓库内部仍有消费者，应改为独立包导入而非恢复桥接。
