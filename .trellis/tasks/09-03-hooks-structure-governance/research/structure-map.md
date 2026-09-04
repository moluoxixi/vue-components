# Hooks 结构调研

## Debt 与规模

- 6 条 `feature.root-file` debt：useBatchOperate、useDetailPage、useFormSubmit、useListPage、useRequestOptions、useRequestTable。
- 生产源 23 个 TS 文件，最大实现 116 行，无 P0/P1/P2。
- 当前包内静态图无循环；生产 consumer 仅 `@moluoxixi/components` 公共根导入。

## 响应式责任

- Batch：selection ref、computed、mutation/query client。
- Detail/Options：computed query key/enabled 与 useQuery。
- FormSubmit：mode ref/computed 与 mutation/query client。
- ListPage：pagination/filter refs、computed 与 query。
- RequestTable：page refs、三个 watch、computed 与 query。
- 唯一独立纯逻辑是 RequestTable 的 `normalizePositiveInteger`。

## 目标矩阵

- 六个 `useX/useX.ts` -> `useX/state/useX.ts`。
- 每个 state 目录新增纯 `index.ts`，feature `index.ts` 改指 state。
- `normalizePositiveInteger` -> `useRequestTable/utils/normalize-positive-integer.ts`，仅由 state 内部使用。

## 发布缺口

- package 仅有根 export，source 指向 `./index.ts`，但 `files` 只有 `dist`。
- 目标是发布 `dist`、`index.ts` 与 `src`，不新增 subpath API。
