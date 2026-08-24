# 实施计划：文档生成产物与主题边界重构

## 1. 建立生成目录契约

- [x] 增加统一 generated-path helper 与 `.gitignore` 规则。
- [x] 将 API extractor、metadata sync/validate、Vite alias、auto-loader dts 输出切换到 `.generated/`。
- [x] 增加 selected-provider 同步入口，保持严格失败和原子写。

## 2. 解耦测试和生产快照

- [x] 为五个平台建立最小合成 fixture 与 expectation。
- [x] 移除测试对真实 `.vitepress/*-metadata.json` 的导入。
- [x] 将 selected snapshot CLI 的核心提取为可注入路径的可测试函数。

## 3. 调整生命周期和流水线

- [x] 更新 docs `predev`、`prebuild`、sync/validate scripts。
- [x] 移除 pre-commit 的 metadata stage 行为。
- [x] CI/Pages 文档步骤注入 GitHub token，删除五份生产快照聚合校验。
- [x] 确认 npm package release 不触发文档网络同步。

## 4. 整理源目录与主题归属

- [x] 将站点源文件迁入 `site/`、`catalog/`、`repository/` 并修复 import 和相对路径语义。
- [x] 将 `repository-content.ts`、类型和单元测试迁入主题包公开入口。
- [x] 保留 `.vitepress/config.ts`、`theme/index.ts`、`markdown/` 的 VitePress/站点职责。
- [x] 扩展组件 manifest 的 package/docs/repository source 配置，消除 RichTextEditor 名称特判。

## 5. 删除 RichTextEditor 兼容桥

- [x] 删除 components 根导出、subpath、library entry、auto-loader、workspace dependency 和兼容测试。
- [x] 保留 docs/playground 对独立包的直接依赖，并修正文档 import statement、API/metadata/source 路径。
- [x] 更新 lockfile，增加 `@moluoxixi/components` 的 pre-1.0 minor changeset。

## 6. 删除旧生成物并更新文档

- [x] 从 Git 索引删除五份 metadata JSON 和两份自动声明。
- [x] 确认旧输出路径不再被任何脚本、测试、配置或文档引用。
- [x] 更新中英文主题文档中的同步、构建、pre-commit 和 snapshot 说明。

## 7. 验证

- [x] 在清空 `.generated/` 的条件下运行 docs tests、typecheck 和 build。
- [x] 运行主题包 tests、typecheck、build 和发布产物校验。
- [x] 运行全仓 lint、typecheck、tests 与 GitHub Actions 等价检查。
- [x] 验证 default GitHub 生成和至少一次显式 local 生成；确认不存在跨 provider fallback。
- [x] 断言 components 发布内容和类型声明不再包含 RichTextEditor，独立包文档/demo/playground 仍可用。
- [x] 捕获准备流水线成功和故意失败输出，断言关键节点、provider、生成目录、耗时与退出码可见且 token 不可见。
- [x] 检查 `git status` 仅包含预期源代码删除/修改，不包含 `.generated/`。

## 8. 修复全仓类型检查

- [x] 修正 headless readonly render context 的异构组件边界。
- [x] 增加具体 Vue 组件嵌套 slot 的精确字段值类型回归。
- [x] 运行 headless/element 检查及全仓 `pnpm typecheck`。

## 9. 仓库能力开箱即用

- [x] 在主题包建立 browser-safe `repository` 与 Node-only `repository/node` 公开入口，迁移五 provider schema/normalizer/collector 和 API trust policy。
- [x] 增加发布 CLI `element-plus-docs prepare|dev|build`，迁移锁、日志、原子生成和 selected-provider orchestration。
- [x] 定义单一项目配置 API，自动推导 repository/provider 默认值并仅校验 selected provider 的关键字段。
- [x] 将组件 manifest 收敛为 package profiles + 最小 component items，统一驱动路由、API、metadata、import statement 和 browser compiler runtime。
- [x] 删除消费站 `.vitepress/repository/` 和 metadata/prepare 脚本，docs package scripts 改为主题 CLI。
- [x] 增加无复制源码的独立消费 fixture，覆盖 GitHub 最小配置、local、GitLab/Gitee/Yunxiao 配置校验和 npm packed CLI。
- [x] 更新中英文复用文档和 package release metadata，运行 fresh-fixture、docs、theme、全仓与 pack 校验。

## 10. 全量迁移最新 Markdown 契约

- [x] 扩展 project documentation/package profile，校验 locale 路径、组件 route 和 playground manifest。
- [x] 将源码行链接与多 package 外部 Playground resolver 迁入主题 `./markdown`，移除旧 callback 公共契约。
- [x] CLI 注入 project/docs root；版本解析严格锚定消费项目，主题直接声明 SFC parser 依赖。
- [x] 当前 docs 只注册项目 Markdown 插件，删除 `.vitepress/markdown` 实现。
- [x] 将 `.vitepress/plugins` 契约测试和全仓 Demo 集成测试迁入 `scripts/__tests__`，删除历史目录。
- [x] 更新 fixture、发布验证、中英文文档和 code-spec，运行全仓与 packed consumer 验收。
