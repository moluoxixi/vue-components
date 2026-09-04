# ConfigForm Compiler

`@moluoxixi/config-form-compiler` 将当前 ConfigForm 项目快照与 Registry 契约编译为不可变 Canonical IR。它负责完整项目编译、单页增量编译、Registry/能力诊断和 committed/draft 缓存协调，不负责编辑事务、Vue 渲染或 Workbench 状态。

## 安装

```bash
pnpm add @moluoxixi/config-form-compiler
```

## 完整项目编译

所有公开能力从包根导入。编译结果是成功/失败判别联合；失败时读取结构化 `diagnostics`，不要依赖异常字符串。

```ts
import type { ProjectCompilationSnapshot, RegistryContractSnapshot } from '@moluoxixi/config-form-model'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'

declare const snapshot: ProjectCompilationSnapshot
declare const registry: RegistryContractSnapshot

const result = compileCanonicalProject({ snapshot, registry })

if (!result.success) {
  console.error(result.diagnostics)
  throw new Error('项目编译失败')
}

console.log(result.compilation.ir, result.compilation.key)
```

`compileCanonicalPage` 用于一次性单页编译。持续编辑场景使用 coordinator，让 committed 与 draft cache 保持隔离：

```ts
import { createCompileCoordinator } from '@moluoxixi/config-form-compiler'

const coordinator = createCompileCoordinator({
  registry,
  maxCachedPages: 8,
})

if (!('kind' in snapshot)) {
  coordinator.acceptSnapshot(snapshot)
  const page = coordinator.compilePage(snapshot.document.homePageId)
  if (!page.success) {
    console.error(page.diagnostics)
    throw new Error('页面编译失败')
  }
  console.log(page.compilation.page)
}
```

## 主要入口

- `services/compile/services/project.ts`：完整项目与单页公开编译 facade。
- `services/compile/services/page.ts`：完整/增量 page compilation 与结构共享。
- `services/compile/services/node.ts`：节点递归和 Canonical placement。
- `services/compile/services/flows.ts`：Flow plan 与组件事件能力诊断。
- `services/compile/services/coordinator.ts`：committed/draft cache、LRU、change-set 与 rebind。
- `services/compile/validation/`：Registry lock 精确校验。

这些是源码职责位置，不是 package subpath。消费者始终从 `@moluoxixi/config-form-compiler` 根入口导入公开符号。

## 当前合同

- 输入必须是当前 `ProjectSnapshot` 或 `ProjectDraftSnapshot`，以及当前 Registry snapshot。
- committed 与 draft 使用不同 identity/cache key；draft 不能进入 committed history 或 persistence。
- Canonical IR、page compilation 和诊断顺序保持确定性。
- coordinator 的 LRU 命中会刷新最近使用顺序；`maxCachedPages` 必须是正整数。
- Registry lock 或组件 capability 不匹配时编译失败，不静默修复输入。

完整跨包架构见 [ConfigForm README](../README.md)。
