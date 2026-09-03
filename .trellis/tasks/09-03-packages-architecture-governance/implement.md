# Packages 全仓结构治理实施计划

## 1. 基础设施

- [ ] 完成 `09-03-package-ownership-gate`：包清单、入口规则、所有权 collector、manifest、债务基线与架构测试。
- [ ] 将全局目录和 ownership 规则写入 `.trellis/spec/`，使后续任务共享同一合同。

## 2. ConfigForm

- [ ] Designer/Canvas：先拆 Camera、Geometry、Drag、Resize、Overlay、Menu，再治理 Surface/Inspector/Palette。
- [ ] Workbench：先迁移 Feature 私有组件，再拆 Source export、App controller、Flow、Monaco、RuntimeHost。
- [ ] Model/Compiler/Runtime/Headless：按 validation/operations/rendering/controller 边界拆高风险服务。
- [ ] Adapter/Plugin/Playground/Devtools：下沉私有 setter 组件，提取真正共享算法，拆大型示例与 Devtools renderer。

## 3. 其他 Packages

- [ ] 按 dependency/consumer 关系分组创建子任务，优先处理 P0/P1，再处理入口和 ownership 债务。
- [ ] 每个包更新 README、exports、build entry 和独立 consumer 验证。

## 4. 每批门禁

- [ ] owning package test/typecheck/build。
- [ ] `pnpm lint` 与全仓 architecture tests。
- [ ] 适用的集成、模板、浏览器或视觉测试。
- [ ] `git diff --check`，独立只读 review，按批次 commit，不 push。

## 5. 最终审计

- [ ] ownership debt 为零，P0/P1 行为热点均有单一职责证据。
- [ ] 全仓公开入口、README/spec/exports 一致。
- [ ] 根级全量 test/typecheck/build 与 ConfigForm 专项门禁全部通过。
