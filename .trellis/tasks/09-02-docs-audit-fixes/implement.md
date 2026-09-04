# 实施计划

1. [x] 修复主题 CLI 和文档包的 preview 生命周期，并添加命令级回归测试。
2. [x] 修复 HeadlessTable 中英文动态组件 Demo，并添加浏览器控制台回归断言。
3. [x] 迁移 consumer fixture 作者内容，强化真实路由、Demo、Playground、ApiDocs E2E。
4. [x] 更新失效的响应式目录断言和必要截图基线。
5. [x] 将主题 E2E 接入根命令和 GitHub CI，纳入诊断产物。
6. [x] 为 Utilities 建立显式 locale 内容可用性并修复英文路由/侧栏。
7. [x] 修复 provider 仓库入口标识及其单测。
8. [x] 按职责重整主题包 Node/Markdown 与文档 `.vitepress` 项目代码，补齐 feature/职责 barrel、更新内部导入并增加目录结构门禁；不改变公开 API 与运行语义。
9. [x] 运行主题和文档类型检查、单测、构建、preview 烟测及完整主题 E2E；确认生成文件未进入 Git。

## 风险文件

- `packages/vitepress-theme-element-plus/src/node/cli.ts`：共享生命周期入口，改动后必须覆盖 `dev/build/prepare/preview`。
- `docs/vitepress/.vitepress/catalog/*`：路由、侧栏和搜索必须消费同一 locale 过滤结果。
- `.github/workflows/ci.yml`：容器、服务端口和报告路径必须与 Playwright 配置一致。

## 验证命令

```text
pnpm -C packages/vitepress-theme-element-plus typecheck
pnpm -C packages/vitepress-theme-element-plus test
pnpm -C packages/vitepress-theme-element-plus test:e2e
pnpm -C docs/vitepress typecheck
pnpm -C docs/vitepress test
pnpm -C docs/vitepress build
pnpm -C docs/vitepress preview --port 5322
pnpm test:e2e
git status --short
```
