# 实施计划

## 1. 导入领域核心

- [x] 定义 import types、稳定 diagnostic codes、migration/summary/prepared contracts。
- [x] 实现 2 MiB/64 depth/4096 array/100000 entry/128 page/4096 node 的迭代式 guard。
- [x] 实现 Project v4/current Page v2 严格识别与 Project v3、Page Model v1 显式迁移。
- [x] 将页面 identity remapper 泛化并补齐 Project pageOrder/homePage 同步。
- [x] 实现 Registry 分析、支持的组件 migration、lock 重建与全项目 compiler preflight。
- [x] 提取模板/导入共享的 isolated project preview helper。

回滚点：本阶段只新增纯函数与测试，不接 UI/Repository。

## 2. Controller 原子创建

- [x] 从模板创建函数抽取通用 prepared project/page 创建合同。
- [x] Project 创建覆盖 Repository create、activate-before-publish、delete compensation 和 stale capture。
- [x] Page 创建覆盖完整候选 compile、单个 `page.add` Command、selection 与一次 Undo。
- [x] 保持模板现有 API 行为与 fixture identity 兼容。

回滚点：controller helper 必须先通过现有模板 controller tests，再接 import。

## 3. 对称 Export

- [x] ExportDialog JSON/Tree 增加 Project/Current Page scope。
- [x] copy/download/tree 读取同一 immutable snapshot value；页面文件名稳定且安全。
- [x] 补 current page 缺失、stale snapshot、locale 与移动端测试。

## 4. 创建工作区 UI

- [x] 建立统一 CreationWorkspace 与 TemplateCatalogPane，迁移现有模板行为和焦点合同。
- [x] 实现 JsonImportPane 的 paste/File.text、分析、清空、retry、diagnostics、migration summary 与创建确认。
- [x] 接入 isolated preview、request sequence、captured project hash 和资源清理。
- [x] 完成 1440/900/390、Light/Dark、zh-CN/en-US 样式和文案；无横向滚动、文本截断或控件遮挡。
- [x] 增加导入 E2E 与 accessibility 覆盖。

## 5. 文档与质量门禁

- [x] 更新 `packages/ConfigForm/README.md` 的 JSON import/export、版本支持与安全限制。
- [x] 把 import ingress、迁移窗口、预算、原子创建和 raw JSON 禁止进入 Runtime 写入状态规范。
- [x] 自我质疑：检查是否把旧兼容层带回运行时、是否遗漏引用 remap、是否以窄测试支撑宽结论、是否有看似成功但 session/revision 已改变的 race。

## 验证命令

```powershell
pnpm --filter @moluoxixi/config-form-model test
pnpm --filter @moluoxixi/config-form-model typecheck
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench test:e2e -- e2e/json-import.spec.ts
pnpm --filter @config-form/workbench test:e2e
pnpm lint
pnpm test:config-form-packages
git diff --check
python ./.trellis/scripts/task.py validate 08-31-config-form-json-import-lifecycle
```

## 高风险文件

- `packages/ConfigForm/workbench/src/app/workbench-controller.ts`
- `packages/ConfigForm/workbench/src/App.vue`
- `packages/ConfigForm/workbench/src/features/templates/TemplateCreationWorkspace.vue`
- `packages/ConfigForm/workbench/src/features/export/ExportDialog.vue`
- `packages/ConfigForm/workbench/src/project/identity-remap.ts`
- `packages/ConfigForm/workbench/src/project/import/**`
- `packages/ConfigForm/workbench/src/locale/catalog.ts`
- `packages/ConfigForm/workbench/src/styles/templates.css`

不得编辑、暂存或还原只有既有行尾状态且无内容 diff 的 `packages/ConfigForm/designer/src/registry/types.ts`。
