# 全仓包根入口治理

## 目标

让 `packages/` 中每个正式包都能在包根立即找到唯一源码入口 `index.ts`，全部生产实现保留在 `src/`，并使源码入口、构建、声明和发布元数据使用同一模型。

## 背景

- 架构门禁当前识别 33 个包，其中 20 个包共有 54 条 `package.*` debt。
- 13 个 Vite 包已经从根 `index.ts` 构建，但仍通过重复 `src/index.ts` 暴露 API。
- 7 个 tsup 包直接从 `src/index.ts` 构建且缺少根入口；其中 5 个是纯 barrel，`eslint-config` 和 `postcss-selector-prefix` 的入口含运行时实现。
- 未发现生产消费者深导入这些待删除的 `src/index.ts`；本地测试、两个 Vitest alias 和 `vite-config` 的 TypeScript/Vitest alias 需要同步。

## 需求

1. 20 个入口债务包统一采用包根 `index.ts`，删除重复的包级 `src/index.ts`。
2. 根入口逐项导出既有公开 Feature/职责边界，不使用 `export * from './src'` 或 `./src/index`。
3. 纯 barrel 包原样迁移导出表；`eslint-config` 和 `postcss-selector-prefix` 的运行时实现下沉到 `src/services/`，根入口只负责编排导出。
4. 7 个 tsup 包的 `exports["."].source`、build entry、tsconfig include 和测试入口切换到根 `index.ts`；`vite-config` 保留 `./addons` 与 `./addons/*` 多入口，`utils` 保留 `./node`。
5. 13 个已有根入口的包直接导出原 `src/index.ts` 所列符号，保留具名导出、default、type-only export 和 `.js` 后缀语义，不扩大或缩小公开面。
6. 同步所有测试、alias、README/设计文档中确实引用旧入口的路径，不保留 forwarding shim。
7. 每完成一个稳定包组即运行包级验证并删除对应 manifest debt；最终 54 条 debt 全部清零。
8. 保持现有公共 API、运行时行为、ConfigForm current-contract-only 和发布 subpath 不变。

## 验收标准

- [ ] 20 个目标包均存在根 `index.ts` 且不存在包级 `src/index.ts`，根入口无 `./src` 总转发。
- [ ] `package-root-entry-governance` 的 54 条 architecture debt 全部删除，未知和 stale 诊断均为零。
- [ ] 迁移前后的公开值、类型、default export、`utils/node`、`vite-config/addons` 和 ConfigForm package surface 一致。
- [ ] 目标包 test/typecheck/build、`pnpm test:config-form-packages`、`pnpm test:pack`、全仓 lint/typecheck/architecture tests 和 `git diff --check` 通过。

## 范围外

- 不处理组件所有权、Feature 私有组件位置或巨型文件拆分。
- 不重命名公开符号、发布 subpath 或改变跨包依赖方向。
- 除两个入口含实现的包外，不在本任务中重组内部职责目录。

## 关键决策

- 根 `index.ts` 是唯一包级源码入口，不能承载运行时实现。
- 入口迁移按包组验证，但作为一个“公共入口模型”子任务统一收口和提交。
- 没有需要用户补充的产品、兼容性或风险决策。
