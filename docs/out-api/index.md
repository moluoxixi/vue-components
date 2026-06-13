# 对外接口文档索引

> 提供方：组件 AI 文档与调试助手 BFF（`@moluoxixi/ai-doc-assistant`）。

## 来源快照

| 字段 | 值 |
|---|---|
| sourceCommit | `edacb6ea67919bb5f3654f989283fac32a011cae` |
| sourceState | dirty；未提交内容为初始化规则、docs（PRD/架构/out-api）输出，`git status --porcelain` 未显示 `packages/` 源码文件修改。 |
| generatedBy | `api-docs` provider mode |
| sourceRoots | （接口尚未实现）契约来源 = `docs/prds/组件AI文档与调试助手.md`、`docs/architecture/overview.md`、ADR-0002/0004/0005 |
| sourceFiles | `docs/prds/组件AI文档与调试助手.md`、`docs/architecture/overview.md`、`docs/architecture/decisions/0002-bff-secret-isolation.md`、`docs/architecture/decisions/0005-bff-vite-plugin-stack.md` |

## 全局协议

- [全局接口协议](_protocol.md)

## 接口文档清单

| 业务域 | 文档 | 接口数 | 状态 |
|---|---|---|---|
| AI 文档与调试助手 | [ai-debug-assistant](ai-debug-assistant.md) | 5 | planned（契约设计，未实现） |

## 说明

- 本目录记录当前项目（BFF）**提供给浏览器调试台 UI** 的 HTTP 接口契约。
- 接口尚未编码，全部标 `planned`；实现期校验真实路由后转 `confirmed`，并将 sourceFiles 更新为后端路由/handler 源码路径。
- 当前项目消费的**外部大模型 / embedding** 接口属消费方契约，应记于 `docs/api/`（后续按需补充），不写入本目录。
