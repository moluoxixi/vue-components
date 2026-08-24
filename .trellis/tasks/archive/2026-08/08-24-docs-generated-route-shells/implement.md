# 实施计划：文档路由壳生成物收敛

## 1. 建立作者源与 runtime staging

- [x] 将中文首页、guide、playground、组件概览、工具概览移动到 `docs/vitepress/zh/`。
- [x] 将 `zh-CN.sourceDirectory` 改为 `zh`，保留 `pathPrefix: ''`。
- [x] 在主题 Node lifecycle 实现 content staging：中文/英文分别投影到 `content/zh`、`content/en`，public 投影到 staging public。
- [x] 扩展主题配置透传 `srcDir`，站点使用 `.generated/content`。
- [x] 增加 `zh/:path* -> :path*` rewrite，保持英文 `en/` 路径不变。
- [x] 投影时注入作者源 Git 时间并保持作者页 lastUpdated。
- [x] dev server 监听作者源与可缺省的 public 目录，并增量同步到 staging。

## 2. 收敛生成路由壳

- [x] 从 Git 删除 40 个生成壳，作者目录不再包含生成路由文件。
- [x] route generator 写入 `.generated/content/{zh,en}/{components,utils}`。
- [x] utility 路由壳与组件路由壳统一关闭 lastUpdated。
- [x] 确认 staging 重建和 stale 清理保留四个人工概览页。

## 3. 测试与文档

- [x] 让生成路由测试自行生成输入，不依赖 Git 中预置路由壳。
- [x] 增加 tracked/ignored、staging、中文根 URL、英文 `/en` URL、public、lastUpdated 和搜索别名契约测试。
- [x] 更新中英文主题复用文档与 docs quality code-spec。

## 4. 验证

- [x] 清空生成壳后运行 docs 测试与 typecheck。
- [x] 运行 local provider 的 prepare/build，核验 26 个组件页与 14 个工具页。
- [x] 运行默认 GitHub 文档生产 build，核验根中文 URL、英文 URL 和 local search。
- [x] 运行全仓 lint、typecheck、test、release/path contract。
- [x] 检查 runtime 文件全部位于 `.generated/content`，并核验 `git ls-files`、`git status --ignored`、空目录和 `git diff --check`。

## 回滚点

- 中文作者文件移动、runtime srcDir 与 staging lifecycle 必须同批回滚，禁止保留半套内容树。
- 生成壳只在完整构建验收通过后从 Git 索引删除。
