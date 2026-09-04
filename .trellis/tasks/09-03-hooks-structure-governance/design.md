# Hooks 包结构治理技术设计

## 1. 稳定公共边界

`@moluoxixi/hooks` 继续只有根入口，显式导出六个 hook、全部既有类型与两个 query-key utils。`package.json` export key、Vite root entry 和 `dist/index.{js,d.ts}` 不调整。

## 2. Feature 结构

```text
src/composables/
  useBatchOperate/{index.ts,state/{index.ts,useBatchOperate.ts}}
  useDetailPage/{index.ts,state/{index.ts,useDetailPage.ts}}
  useFormSubmit/{index.ts,state/{index.ts,useFormSubmit.ts}}
  useListPage/{index.ts,state/{index.ts,useListPage.ts}}
  useRequestOptions/{index.ts,state/{index.ts,useRequestOptions.ts}}
  useRequestTable/
    index.ts
    state/{index.ts,useRequestTable.ts}
    utils/{index.ts,normalize-positive-integer.ts}
```

六个 hook 均保留唯一响应式状态 owner；不额外拆出无独立责任的 services。包级 `src/composables/index.ts` 继续聚合 feature，根入口显式导出原表面。

## 3. 数据与依赖方向

```text
root index -> composable feature barrels + types + public utils
feature index -> state
feature state -> package types + public query-key utils
useRequestTable state -> feature-private normalization utils
public utils -> type-only common contracts
```

types/utils 不反向依赖 feature。feature 私有 utils 不由 feature root或 package root导出。

## 4. Characterization

- 新增 root runtime exact-key 测试，锁定 8 个 runtime exports。
- 锁定 `normalizePositiveInteger` 对 NaN/Infinity/0/负数/小数与 fallback 的当前语义。
- 锁定 `useRequestTable` 接收外部 Ref 时写回同一 ref、非 Ref 时持有内部 ref，以及 params/pageSize watch 的同步 reset 行为。
- 复用既有 29 个 hook tests锁定 query/mutation/error/selection/filter 行为。

## 5. 发布与验证

- `files` 增加 `index.ts`、`src`，使 `exports["."].source` 在 tarball 中可达。
- package build 后运行 components consumer test/typecheck/build。
- packed Node/browser smoke 验证根入口解析与浏览器 bundle；architecture 对账删除精确 6 条 debt。

## 6. 回滚

characterization、feature move、README/manifest/source files 分批提交。任一 runtime export、query key、watch reset 或 mutation 顺序漂移即回滚对应批次；旧私有路径不以 shim 恢复。
