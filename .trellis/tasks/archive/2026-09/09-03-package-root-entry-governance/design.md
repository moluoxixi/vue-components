# 全仓包根入口治理技术设计

## 1. 迁移边界

本任务只改变包级源码入口模型，不改变公开符号、运行时行为、依赖方向或发布 subpath。目标分为三类：

| 类别 | 包 | 迁移方式 |
| --- | --- | --- |
| 纯 barrel 的 tsup 包 | `ajax-package`、`excel`、`indexed-db`、`utils`、`vite-config` | 将旧导出表改写到根 `index.ts`，删除 `src/index.ts` |
| 含实现的 tsup 包 | `eslint-config`、`postcss-selector-prefix` | 先把实现移入 `src/services/`，再由根入口显式导出 |
| 已有根入口的镜像包 | `components` 与 12 个 ConfigForm 包 | 根入口直接导出原 `src/index.ts` 的 Feature，删除镜像入口 |

## 2. 入口合同

```text
packages/<package>/
  index.ts                 # 唯一包级源码入口，只声明公开导出
  src/                     # 全部生产实现，不含包级 index.ts
  package.json             # exports["."].source -> ./index.ts
```

- 根入口从 `./src/<feature-or-responsibility>` 显式导出，不从 `./src` 或 `./src/index` 转发。
- 迁移严格复制原公开导出集合，包括 default、具名值、type-only export 和 `.js` specifier。
- `utils` 的 `src/node.ts`、`vite-config` 的 `src/addons/index.ts` 与 addons 文件仍是独立 subpath 构建入口，不被合并进根入口实现。
- Vite 包既有 `build.lib.entry = root/index.ts` 和 source export 不变；tsup 包把主 entry 从 `src/index.ts` 改为 `index.ts`。

## 3. 特殊包处理

### eslint-config

`src/index.ts` 中的 `createEslintConfig` 实现进入 `src/services/create-eslint-config.ts`，`src/services/index.ts` 只导出符号。根入口从 services 导出 named/default，并从现有类型模块导出公开类型。

### postcss-selector-prefix

插件实现进入 `src/services/create-selector-prefix-plugin.ts`，公开选项类型进入 `src/types/index.ts`；两个局部 barrel 分别导出运行时和值类型，根入口只转出这两个职责边界。

### vite-config

根入口直接导出 `src/addons`、`src/config/{app,base,lib}` 和 `src/types`。tsup 仍构建根入口、addons aggregate 和 addons wildcard；TypeScript/Vitest 根 alias 同步到 `./index.ts`。

### Components / ConfigForm

根入口逐条改写旧 `src/index.ts` 的导出路径。测试中 `../src`、`../src/index` 或 `src/__tests__/../index` 改为包根入口；Compiler/Vue Backend 的 architecture 断言改为“src 根无包级 index”。ConfigForm 不增加兼容层。

## 4. 数据流与兼容性

```text
source consumer
  -> package exports["."].source
  -> root index.ts
  -> src feature barrel

published consumer
  -> package exports["."].import/types
  -> dist/index.js + dist/index.d.ts
```

迁移前后 consumer 的 package specifier 和 dist 路径不变。构建入口改变的只是源码起点，因此发布 API 通过现有 package tests、声明 finalize、ConfigForm package smoke 和 `test:pack` 验证。

## 5. 批次与回滚

1. 纯 barrel tsup 包。
2. 含实现的两个 tsup 包。
3. `vite-config` 多入口。
4. `components`。
5. ConfigForm 领域/runtime 包。
6. ConfigForm adapter/plugin/designer/devtools 包。

每组同步代码、测试/alias 和该组 manifest debt 后立即验证。若一组失败，只回滚该组；不恢复已通过的 `src/index.ts` shim，也不改变其他组的公开入口。

## 6. 风险

- 漏改 tsconfig include 会让根入口逃过 typecheck。
- 漏改测试或 Vitest alias 会继续解析已删除的 `src/index.ts`。
- 机械 `export *` 可能意外扩大公开面，必须逐条复刻旧导出。
- `utils/node`、`vite-config/addons` 等多入口若被误改会破坏独立消费者，必须单独 smoke。
