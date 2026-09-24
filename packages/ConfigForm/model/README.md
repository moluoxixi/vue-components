# ConfigForm Model

`@moluoxixi/config-form-model` 是 ConfigForm 的项目文档与编辑事务领域层。它负责当前版本的 `ProjectDocument` / `SurfaceGraph` 契约、Registry 锁定、Dataset/Resource 引用、语义命令、原子事务、撤销历史、项目仓库和 transfer envelope，不包含 Vue UI 或渲染逻辑。

## 安装

```bash
pnpm add @moluoxixi/config-form-model
```

## 事务用法

所有公开能力从包根导入。事务以不可变方式应用，成功结果包含新文档、反向事务和变更集合；失败结果保留原文档并返回结构化诊断。

```ts
import type { ProjectDocument } from '@moluoxixi/config-form-model'
import { applyProjectTransaction } from '@moluoxixi/config-form-model'

declare const document: ProjectDocument

const result = applyProjectTransaction(document, {
  id: 'rename-home',
  label: '重命名首页',
  operations: [{ type: 'surface.rename', surfaceId: document.homeSurfaceId, name: '工作台' }],
})

if (!result.success) {
  console.error(result.diagnostics)
  throw new Error('项目事务失败')
}

console.log(result.document, result.inverse, result.changeSet.surfaceIds)
```

批量 operation 在一个 Immer draft 中执行。任一步失败都不会泄漏中间状态；inverse 按反向执行顺序生成。Command draft 允许跨 operation 的暂时无效中间态，但公开 draft transaction 和最终 transaction 必须通过完整文档验证。

## 主要入口

- `schemas/`：当前版本文档、SurfaceGraph、Registry snapshot 和 transfer 格式的解析/断言。
- `services/transactions/`：事务编排、project/surface/dataset/resource/node operation、图变更、校验和 change-set。
- `services/commands.ts`：把语义编辑命令解析为 transaction。
- `services/engine.ts`、`history.ts`：编辑快照、undo/redo 与命令时间线。
- `services/repository.ts`：项目持久化接口、内存仓库、独立 entity revision 和 embedded bytes。
- `services/transfer.ts`：Project transfer v1 与 flat Surface transfer v1 的严格异步读写。
- `registries/`：组件契约与 Registry snapshot 构造。

这些是源码职责位置，不是 package subpath。消费者始终从 `@moluoxixi/config-form-model` 根入口导入公开符号。

## 当前合同

- 只接受当前 `version`，不迁移旧文档或保留兼容别名。
- 当前版本为 `ProjectDocument 8`、`SurfaceGraph 3`、`Registry snapshot 3`；旧、未来、缺失或混合版本全部 fail closed。
- 字段级 `required` / `requiredMessage` 独立于 RuleSet；动态 Required 状态在运行时覆盖该静态基线。
- Surface 节点不保存事件编排、Flow、动态 option source 或宿主函数；Prototype Interaction 只保留 JSON-safe 的状态投影、值动作和单一主要 UI 动作。
- Page/Dialog/Drawer 都是 `SurfaceAsset`；Project 仍要求至少一个 Page 作为 `homeSurfaceId`，浮层通过 Surface ID 引用而不递归内联。
- Dataset 是项目级 JSON 对象行集合；`DatasetReference` 携带用途投影与可选的结构化
  filter/sort/page query，统一由共享纯服务执行。Resource metadata 与 embedded bytes
  分离保存；删除被引用资产会返回稳定来源诊断。
- `editVersion` 表示本地编辑进度；repository revision 表示持久化 CAS 状态，两者不能混用。
- Registry adapter、版本、fingerprint、组件 key 和组件合同必须精确匹配。
- `ProjectSnapshot` 才能进入历史和持久化；`ProjectDraftSnapshot` 只用于候选编译与预览。

完整跨包架构见 [ConfigForm README](../README.md)。
