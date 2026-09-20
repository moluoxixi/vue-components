# ConfigForm Compiler

`@moluoxixi/config-form-compiler` 将当前 ConfigForm 项目快照与 Registry 契约编译为不可变 Canonical IR。它负责完整项目编译、单 Surface 增量编译、Registry/能力诊断和 committed/draft 缓存协调，不负责编辑事务、Vue 渲染或 Workbench 状态。

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

`compileCanonicalSurface` 用于一次性单 Surface 编译。持续编辑场景使用 coordinator，让 committed 与 draft cache 保持隔离：

```ts
import { createCompileCoordinator } from '@moluoxixi/config-form-compiler'

const coordinator = createCompileCoordinator({
  registry,
  maxCachedSurfaces: 8,
})

if (!('kind' in snapshot)) {
  coordinator.acceptSnapshot(snapshot)
  const surface = coordinator.compileSurface(snapshot.document.homeSurfaceId)
  if (!surface.success) {
    console.error(surface.diagnostics)
    throw new Error('Surface 编译失败')
  }
  console.log(surface.compilation.surface)
}
```

## 主要入口

- `services/compile/services/project.ts`：完整项目与单 Surface 公开编译 facade。
- `services/compile/services/surface.ts`：完整/增量 Surface compilation 与结构共享。
- `services/compile/services/node.ts`：节点递归和 Canonical placement。
- `services/compile/services/coordinator.ts`：committed/draft cache、LRU、change-set 与 rebind。
- `services/compile/validation/`：Registry lock 精确校验。

这些是源码职责位置，不是 package subpath。消费者始终从 `@moluoxixi/config-form-compiler` 根入口导入公开符号。

## 当前合同

- 输入必须是当前 `ProjectSnapshot` 或 `ProjectDraftSnapshot`，以及当前 Registry snapshot。
- committed 与 draft 使用不同 identity/cache key；draft 不能进入 committed history 或 persistence。
- Canonical IR、Surface compilation 和诊断顺序保持确定性；浮层只通过 flat Surface table 引用，不递归内联。
- Canonical 字段将 `required` / `requiredMessage` 作为字段一级基线投影，通用 `validation` 只接受 RuleSet v2；旧 `kind: 'required'` 不迁移。动态 Required 状态仍在运行时覆盖静态基线。
- Canonical IR 只包含结构、属性、Dataset/Resource 引用、字段 Required、RuleSet v2 validation、Prototype Interaction 投影和布局，不包含宿主函数、事件转发或 Flow plan。
- coordinator 的 LRU 命中会刷新最近使用顺序；`maxCachedSurfaces` 必须是正整数。
- Registry lock 或组件 capability 不匹配时编译失败，不静默修复输入。

完整跨包架构见 [ConfigForm README](../README.md)。

## Source 边界

Compiler 只产出 Canonical IR，不收集、打包或导出 Core、Headless、Vue Runtime 源码。
`@moluoxixi/config-form-source` 直接消费 `ProjectCompilation`：默认生成 Vue 与目标 UI
组件源码，另行生成只引用公开 ConfigForm 包的绑定源码；两种产物都不会写入
`src/runtime` 或复制运行核心。Raw 的运行依赖只允许 Vue、Vue Router 与目标 UI 包，
Required/RuleSet v2 生成工程内校验代码；Raw 与 Binding 各自预检、独立失败。

代码态组件 listener 由宿主直接写入 Runtime config 的 `props.onX`，不进入 Canonical IR
或 Source 序列化。当前 Canonical IR 版本为 `6`，编译器版本为 `7.0.0`。
