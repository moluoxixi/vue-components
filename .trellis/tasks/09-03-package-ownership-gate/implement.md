# 全仓入口与组件所有权门禁实施计划

1. [x] 盘点根 scripts/test 约定、package manager scripts、现有 architecture-boundary collector 和可复用 AST 依赖。
2. [x] 定义 manifest schema、诊断类型、稳定路径规范和例外/债务匹配规则。
3. [x] 实现 package inventory 与根入口/Feature 目录检查。
4. [x] 实现 TS/Vue import graph 与 component ownership 检查。
5. [x] 增加 fixture 单测和真实仓库 smoke，生成首个显式债务清单。
6. [x] 接入根 package script，更新全局目录 spec 与使用说明。
7. [x] 运行定向测试、根 lint/typecheck、现有 architecture tests 和 `git diff --check`。
8. [x] 独立只读 review；修复后重新验证并创建首批独立提交，不 push。
