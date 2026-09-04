# ConfigForm Model

`@moluoxixi/config-form-model` 是 ConfigForm 的项目文档与编辑事务领域层。它负责当前版本的 `ProjectDocument` / `PageGraph` 契约、Registry 锁定、语义命令、原子事务、撤销历史和项目仓库，不包含 Vue UI 或渲染逻辑。

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
  operations: [{ type: 'page.rename', pageId: document.homePageId, name: '工作台' }],
})

if (!result.success) {
  console.error(result.diagnostics)
  throw new Error('项目事务失败')
}

console.log(result.document, result.inverse, result.changedPageIds)
```

批量 operation 在一个 Immer draft 中执行。任一步失败都不会泄漏中间状态；inverse 按反向执行顺序生成。Command draft 允许跨 operation 的暂时无效中间态，但公开 draft transaction 和最终 transaction 必须通过完整文档验证。

## 主要入口

- `schemas/`：当前版本文档、PageGraph、Registry snapshot 和 transfer 格式的解析/断言。
- `services/transactions/`：事务编排、project/page/node/flow operation、图变更、校验和 change-set。
- `services/commands.ts`：把语义编辑命令解析为 transaction。
- `services/engine.ts`、`history.ts`：编辑快照、undo/redo 与命令时间线。
- `services/repository.ts`：项目持久化接口、内存仓库和提交元数据。
- `registries/`：组件契约与 Registry snapshot 构造。

这些是源码职责位置，不是 package subpath。消费者始终从 `@moluoxixi/config-form-model` 根入口导入公开符号。

## 当前合同

- 只接受当前 `version`，不迁移旧文档或保留兼容别名。
- `editVersion` 表示本地编辑进度；repository revision 表示持久化 CAS 状态，两者不能混用。
- Registry adapter、版本、fingerprint、组件 key 和组件合同必须精确匹配。
- `ProjectSnapshot` 才能进入历史和持久化；`ProjectDraftSnapshot` 只用于候选编译与预览。

完整跨包架构见 [ConfigForm README](../README.md)。
