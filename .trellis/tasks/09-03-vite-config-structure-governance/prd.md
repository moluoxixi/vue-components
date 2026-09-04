# Vite Config 结构治理

## 目标

治理 vite-config 的配置工厂、addons、解析与适配职责。

## 背景

- 当前 manifest 有 35 条本任务债务：15 个公开 addon helper 平铺文件、18 个 base addon 实现平铺文件，以及 2 个包含业务逻辑的 `index.ts`。
- 稳定公开入口为 `.`, `./addons`, `./addons/*`；`dist/addons/<name>.{js,d.ts}` 的输出路径和全部 `define*AddonOptions` 符号不得改变。
- 插件启用顺序、consumer-root 动态导入、依赖探测、错误文本、addon 默认值合并和用户插件覆盖均已有行为测试，目录迁移必须保持这些合同。
- 当前无模块 cycle；`src/types.ts` 是纯类型，config app/lib/base 是配置工厂，适合在同一任务中归入责任目录。

## 需求

- 清零 manifest 中归属本任务的目录职责债务。
- 将公开 addon option helper 归入 `src/addons/services`，保持根和所有 addon subpath 的精确运行时/类型导出与 dist 路径。
- 将 app/lib/base 配置工厂归入各自 `services`，所有 feature/责任 `index.ts` 只导出。
- 将 base addon 拆为 `types`、`adapters`、`defaults`、`utils` 和 `services`；插件 feature 定义留在 services，registry 顺序不变。
- 将纯类型根文件归入 `src/types/index.ts`，不增加兼容转发文件。
- 补公开 addon subpath 与 concrete registry characterization，更新 README/DESIGN 为最终目录和扩展用法。
- 保持所有公开配置 API 与生成的 Vite 行为不变。

## 验收标准

- [x] 35 条目标 debt 全部删除且没有新增 unknown/stale 诊断。
- [x] `.`, `./addons`, `./addons/*` 的符号、声明、JS 产物路径和 helper identity 不变。
- [x] concrete registry 的顺序、triggers、requires、依赖检查与错误文本保持不变。
- [x] consumer-root dynamic import、feature inspection、addon merge、user plugin precedence 和真实 fixture 输出保持不变。
- [x] `index.ts` 均为纯导出，types 只含类型；没有旧路径 shim、deep import 或 cycle。
- [x] 包级 test/coverage/typecheck/build/browser fixture 与全仓 architecture/path/packed/lint 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
- 不新增、删除或重命名 addon，不升级 Vite/插件依赖，不改变默认配置值。
