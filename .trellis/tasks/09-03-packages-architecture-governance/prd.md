# Packages 全仓结构治理

## 目标

持续治理 `packages/` 下所有发布包与内部应用包，使公共入口固定、Feature 职责清晰、组件所有权可验证、巨型行为文件得到拆分，并在不改变既有可观察行为的前提下形成可长期执行的自动化架构门禁。

## 背景

- 既有目录治理已经建立部分 `components/services/types/utils` 目录，但仍存在根入口转发、单父组件位于共享目录和多个 800–1600 行行为热点。
- `packages/ConfigForm` 已有较强的目录与公开边界测试，但当前门禁只检查目录形状，不检查静态引用图和组件 owner。
- 本任务覆盖整个 `packages/`，不是 ConfigForm 专项任务；ConfigForm 继续遵守 current-contract-only，其他稳定发布包不得未经确认破坏公共 API。

## 需求

1. 每个包根固定使用 `index.ts` 作为唯一公共源码入口，生产实现进入 `src/`；根入口显式导出公开 Feature，不使用 `export * from './src'`，不保留重复 `src/index.ts` 总入口。
2. Feature 根只保留入口与职责目录；`types/` 无运行时代码，barrel 无业务逻辑或副作用。
3. 单父组件进入 `<Parent>/components/`，单 Feature 组件进入 `<feature>/components/`；包级共享组件必须有至少两个独立 Feature 消费，或存在可审计的 public/dynamic/framework 例外。
4. composable 必须拥有响应式状态、注入、监听器或生命周期；纯解析、转换、序列化和算法进入 services/utils。
5. 建立全仓 package entry、Feature root、component ownership、public/dynamic exception 和架构债务的 collector、manifest 与自动化测试。
6. 按 P0/P1/P2 热点分批重构；不以行数机械拆分，不为迁移保留 forwarding shim，不覆盖用户并行改动。
7. 每批先锁定行为测试，完成后运行包级 test/typecheck/build、全仓 lint、架构门禁和适用的 E2E；通过后独立提交，不 push。

## 子任务地图

1. 全仓入口与组件所有权门禁。
2. 全仓包根入口治理。
3. ConfigForm Designer、Runtime/Domain 与 Workbench 分组治理。
4. AI 文档助手、AI Provider、Hooks、I18n Tool 与富文本编辑器分组治理。
5. 通用 Components、Vite Config 与 VitePress Element Plus 主题分组治理。
6. 无现存债务包的独立复核与最终全仓归零审计。

Manifest 中每个 `targetTask` 均对应父任务下的真实子任务。子任务激活前仍需结合 CodeGraph 调研补齐各自 design 与 implement，不以当前 debt 分组替代具体技术设计。

## 验收标准

- [ ] `packages/**/package.json` 对应包均满足根 `index.ts` + `src/` 合同，例外均有可执行 manifest 证据。
- [ ] 不存在 `export * from './src'` 或重复包级 `src/index.ts`。
- [ ] 组件所有权门禁覆盖静态 import、动态 import、barrel 和显式例外；未解决债务归零。
- [ ] P0/P1 巨型行为文件完成职责拆分，公开 API 和用户可观察行为保持不变。
- [ ] README、Trellis spec、package exports、声明与实际目录一致。
- [ ] 全仓 lint/typecheck/unit/build/architecture tests 通过；ConfigForm package smoke、Workbench templates/build/E2E 通过。
- [ ] 所有批次已提交但未 push，最终工作树干净。

## 范围外

- `packages/` 之外的 docs、playgrounds 和应用，除非它们是包移动后的必要消费者或验证入口。
- 与目录治理无关的 UI 重设计、业务功能和协议扩展。
- 直接维护 `dist/`、coverage、缓存和其他生成产物。
