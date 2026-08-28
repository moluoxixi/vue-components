# 在线项目内核与模板导出实施计划

## 实施清单

1. [x] 新建 `@config-form/workbench` private app 骨架、测试与类型检查入口，并接入根 dev/build scripts。
2. [x] 先写 ProjectPath、WorkspaceProject、manifest、file、revision 与领域错误测试，再实现 schema 和纯函数。
3. [x] 为 `@moluoxixi/indexed-db` 增加单 transaction `updateItem`，覆盖成功、删除、updater throw、abort 和跨连接 CAS。
4. [x] 定义 repository contract suite，实现 memory adapter、IndexedDB adapter、envelope validation 与显式 volatile fallback。
5. [x] 实现模板 registry 和共享 Vue 3 + Vite 文件生成器，加入 Element Plus 与 Ant Design Vue 两个受控模板。
6. [x] 加入 `fflate`，实现 archive、路径/文件名安全和浏览器下载，并验证解压内容等价。
7. [x] 实现隔离导出项目验证脚本：pack ConfigForm 包、临时依赖替换、install、typecheck、Vite build、dist 断言和清理。
8. [x] 更新 ConfigForm 架构 README 与根 scripts；Pages/CI 产品部署接线由 product-shell 子任务负责。
9. [x] 运行项目内核、IndexedDB、workbench build/typecheck 与导出项目构建验证。

## 验证命令

```powershell
pnpm --filter @moluoxixi/indexed-db test
pnpm --filter @moluoxixi/indexed-db typecheck
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench verify:templates
pnpm test:config-form-packages
```

实现后根据实际新增脚本名称校准命令；不得通过删减 frozen install、typecheck 或 Vite build 来让验证通过。

## 风险文件与回滚点

- `packages/indexed-db/src/IndexedDBManager.ts`：共享存储行为；先以新增 API 保持向后兼容。
- `pnpm-workspace.yaml` / 根 `package.json` / CI：只做新 private app 接线，不改变现有 playground 命令语义。
- 模板精确依赖版本：版本升级必须与 fixture build 同批更新。
- ZIP：生成核心与浏览器 download 分离，下载 UI 失败不影响项目与 archive 单测。

## 最终验证

- [x] Workbench 单元测试：30 passed。
- [x] IndexedDB 单元测试：8 passed。
- [x] Workbench 与 IndexedDB typecheck。
- [x] Workbench production build。
- [x] Scoped ESLint 与 `git diff --check`。
- [x] Element Plus / Ant Design Vue 两套导出项目：tarball install、`vue-tsc`、Vite build。
- [x] `pnpm test:config-form-packages`：公开包边界通过。
- [x] Browser：IndexedDB 创建/刷新恢复、两套模板、ZIP 成功反馈、桌面与窄屏无溢出。
