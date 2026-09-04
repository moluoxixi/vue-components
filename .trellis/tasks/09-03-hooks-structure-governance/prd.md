# Hooks 包结构治理

## 目标

治理 `packages/hooks` 的六个 Vue Query composable 状态边界与纯工具归属，使每个 feature 可按职责定位，同时保持单一根入口、全部公开 hook/type/utils、查询 key、watch、mutation、分页与错误行为不变。

## 背景

- Architecture manifest 有 6 条本任务精确 debt，均为 `src/composables/useX/useX.ts` 位于 feature 根。
- 六个实现均拥有 Vue ref/computed/watch 或 Vue Query injection，应继续作为 composable/state owner；不存在 `useUpdate`，update 语义由 `useFormSubmit` 的 id 判断承担。
- 生产文件最大 116 行，无 P0/P1/P2；只需按责任归位，不做机械逻辑拆分。
- 包仅公开 `@moluoxixi/hooks` 根入口；运行时表面为六个 hook 与 `normalizeQueryKey`/`invalidateQueryKeys`，类型由 `src/types` 显式导出。
- `@moluoxixi/components` 是唯一生产 consumer，无 deep import 或动态 import。
- `package.json` 声明 `source: ./index.ts`，但发布 `files` 只有 `dist`，tarball 缺 source entry 与可达 `src`。

## 需求

1. 清零 6 条 architecture debt，不新增 unknown/stale diagnostic，不保留旧私有路径 forwarding shim。
2. 将六个 hook 实现移入各自 feature 的 `state/`，每个 `state/index.ts` 为纯 barrel；feature `index.ts` 继续只导出公开 hook。
3. 将 `useRequestTable` 的纯 `normalizePositiveInteger` 迁入该 feature 私有 `utils/`，不通过包级 utils 或根入口新增公共符号。
4. 保持 query keys、Vue Query options、watch reset、mutation invalidation/callback 顺序、selection/pagination/filter 状态和 error 传播不变。
5. 保持根入口公开运行时/类型集合、`dist/index.js` 与声明入口不变；`files` 增加 `index.ts` 与 `src` 以兑现 source condition。
6. 在移动前补根入口 exact runtime characterization、分页归一化边界与 RequestTable ref/watch 行为测试。
7. 新增默认中文 README，说明六个 hook 的用途、Vue Query 安装要求、调用示例与公共 utils。
8. 运行 package test/typecheck/coverage/build、components consumer test/typecheck/build、architecture、packed Node/browser smoke 与全仓 lint。

## 验收标准

- [ ] 6 条目标 debt 删除，architecture unknown/stale 为零。
- [ ] 每个 hook feature 根只含纯 `index.ts` 与责任目录；旧实现路径不存在。
- [ ] 六个 hook 仍有真实响应式状态证据；纯分页归一化位于私有 utils，公共 API 未扩大。
- [ ] 根运行时导出仍精确为六个 hook与两个 query-key utils，公开类型集合不变。
- [ ] 查询、watch、mutation、selection、分页、error 与 callback 顺序测试通过。
- [ ] README、package exports、Vite entry、声明与 packed source files 一致。
- [ ] package/consumer/full repository gates与独立 review 通过，提交但不 push；归档时仅允许用户的无关改动留在工作树。

## 范围外

- 不新增 hook、子路径 exports、请求取消、重试策略或新的 Vue Query abstraction。
- 不改变组件包的 request adapter 行为或公共类型。
- 不因未覆盖边界重写既有 hook 语义；仅添加 characterization。
- 不修改用户正在编辑的 ConfigForm Designer 文件。

## 关键决策

- 有 Vue/Vue Query state 的实现进入 feature `state/`；只有可独立执行的纯归一化函数进入 feature `utils/`。
- feature 私有 utils 不从包级 `src/utils` 转发，避免结构重构扩大 package API。
- 父任务 standing approval 覆盖内部结构与 phase transition；只有公共行为/API 或跨包依赖方向变化才重新确认。
