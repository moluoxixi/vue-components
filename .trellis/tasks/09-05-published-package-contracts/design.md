# 发布包源码与 README 合同收口设计

## 合同模型

对每个非私有工作区包建立三项静态合同：

1. 当根导出声明 `source: "./index.ts"` 时，`files` 必须覆盖 `index.ts` 和 `src`。
2. 发布包必须存在包根 `README.md`。
3. 发布包必须显式声明 `sideEffects`，其值由真实入口副作用决定。

这些检查属于 package architecture collector；packed consumer 验证继续负责确认实际 tarball、运行时入口和声明入口可消费，两者职责互补。

## 元数据修改

- 六个目标包只扩充 `files`，不修改 `exports`、`main`、`module` 或 `types`。
- `hooks` 的根入口及实现没有样式、polyfill、注册或全局修改，声明 `sideEffects: false`。
- `ai-doc-assistant` 的库入口为纯导出，但 CLI 与独立 UI 会执行进程/挂载副作用，因此用源码和发布产物的精确入口模式标记。
- `i18n-tool` CLI 有 `import.meta.url` 主入口守卫，普通模块导入保持纯净；仍显式标记 CLI 源码/发布 bin，并标记无条件挂载的 UI 入口和 CSS，使可执行入口声明与其他 CLI 包一致。
- `vitepress-theme-element-plus` 同时标记既有 CSS/Sass、顶层执行的 CLI adapter 和发布 bin 产物。
- README 示例从各包根 `index.ts` 和 `package.json#exports` 推导，避免记录内部深导入。

## 门禁设计

- collector 从 workspace package 元数据判断发布包，排除明确的 `private: true` 应用。
- 诊断使用稳定、可定位的 rule id，并指向包根 `package.json` 或 README 预期路径。
- fixtures 分别覆盖合法包、缺失 source 文件、缺失 README 和缺失 `sideEffects`，避免把多个错误揉成一个模糊断言。

## 兼容与回滚

- 扩充 `files` 只增加源码文件，不改变默认消费者解析；风险主要是 tarball 体积小幅增加。
- README 和静态门禁无运行时影响。
- `sideEffects` 标记错误可能导致 bundler 错误 tree-shake，因此必须先检查真实入口并通过现有构建与消费验证。
