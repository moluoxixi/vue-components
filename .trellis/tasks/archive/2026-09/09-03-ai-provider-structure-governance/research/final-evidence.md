# AI Provider 结构治理验收证据

## 结构结果

- 本任务 4 条 architecture debt 全部消失，tracked debt 从 118 降至 114；无 unknown/stale diagnostic。
- `src/shared/index.ts` 仅聚合 `types/constants/validation/errors`；`src/server/index.ts` 仅聚合 `types/adapters/services/utils` 与 shared 公共符号。
- 旧 `src/server/{error,model-factory,redact}.ts` 不存在且无 forwarding shim。
- 生产实现最大文件为 `server/adapters/model-factory.ts` 92 行，无 P0/P1/P2 热点。

## 公共与依赖边界

- `.`, `./shared`, `./server` 的 source/types/import 条件及 `dist/{index,shared,server}` 产物名保持不变。
- root/shared exact runtime symbol set 相同；server exact runtime symbol set由 entry test 锁定。
- shared 无 server/SDK/Node 依赖；server-only target/factory/status/cause/redaction 未进入 browser-safe entry。
- AI-doc 与 I18n Tool 继续仅通过公开 `/shared`、`/server` 消费，无 `src` deep import或源码调整。

## 验证结果

- Package unit：4 files / 30 tests；entry/model characterization：2 files / 25 tests。
- Package coverage：statements/branches/functions/lines 均为 100%；纯 types 文件无可执行语句。
- Package typecheck、build 与 AI-doc/I18n consumer build 通过。
- Architecture：11/11，33 packages / 114 tracked debt；path contracts：8/8；verifier unit：18/18；workflow validation 通过。
- 全仓 lint 与 `git diff --check` 通过。
- Packed Node smoke：29 packages / 58 public JavaScript entries。
- Packed browser smoke：23 browser JavaScript entries、3 stylesheets、8 batches 与发布包浏览器应用全部通过。

## 独立复核与门禁修复

- 结构审查与公共入口审查均无阻断项；无 value cycle、shared/server 泄漏、公共 API 漂移或残余 debt。
- packed browser smoke 暴露已提交的 ConfigForm 拆包后 verifier allowlist 仍引用 5 个旧 `@moluoxixi/components` 子路径；已移除旧入口并将覆盖迁至 `@moluoxixi/config-form-antd-vue`、`@moluoxixi/config-form-element` 根入口。
