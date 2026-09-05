# ConfigForm Sass 入口与默认值控件收口执行计划

- [x] 删除无意义 `style/index.ts` 与空 `styles/index.ts`，修正私有应用 SCSS 导入。
- [x] 将 Workbench 动态 Element Plus 样式加载模块归入 adapter services。
- [x] 更新 Designer 样式入口测试、`sideEffects` 与全局目录合同。
- [x] 将注册 default value control 接入统一 property field，并保留 fallback/custom 路径。
- [x] 为 Element Plus 真实控件 `id` 透传、提交事件和 focus frame 增加回归断言。
- [x] 运行相关 unit、typecheck、build、Workbench E2E、lint、package architecture 与 `git diff --check`。

## 验证记录

- Designer unit：19 个文件、84 个测试通过；Element Plus Designer unit：5 个文件、29 个测试通过。
- Workbench unit：52 个文件、475 个测试通过；最终 adapter/style 定向回归：180 个测试通过。
- Workbench E2E：79 个测试通过，默认值与普通属性输入的几何和单层 focus frame 均受真实浏览器覆盖。
- Designer、Element Plus Designer、Playground、Workbench typecheck 通过。
- Designer、Element Plus Designer、Playground、Workbench build 通过；Workbench Element Plus/Monaco bundle verifier 通过。
- 根 lint、package architecture（15 个测试、33 个包、0 debt）与 `git diff --check` 通过。
