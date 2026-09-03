# 全仓包根入口治理

## 目标

统一 packages 全部包的根 index.ts、src、exports、构建与声明入口。

## 需求

- 所有正式包采用包根 `index.ts` 与 `src/`，移除重复的包级 `src/index.ts`。
- 根入口显式导出公开 Feature，不使用 `export * from './src'`。
- `package.json` source、构建入口、声明入口与发布产物字段保持一致。
- 私有应用、CLI 和框架 fixture 只保留最窄的 manifest 例外。
- 保持现有公共 API 与运行时行为；每批按包族验证并删除对应 architecture debt。

## 验收标准

- [ ] 所有 `package.*` architecture debt 清零。
- [ ] 包根入口、exports、构建与声明生成均通过独立 consumer 验证。
- [ ] 包级 test、typecheck、build、全仓 lint 与 architecture tests 通过。

## 约束

- 不保留旧 `src/index.ts` forwarding shim。
- 不在同一批次混入组件所有权或巨型文件拆分。
