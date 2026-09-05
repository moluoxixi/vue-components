# AI 文档组件发现服务拆分

## 目标

拆分组件发现服务中的工作区/路径解析、TypeScript AST export 遍历和发现策略编排，使每层可独立测试且保持现有发现结果不变。

## 需求

- `component-discovery.ts` 保留公开调度器和 entries/globs/auto 策略选择。
- 工作区 package 枚举、入口推断、文件与模块解析迁入 `workspace-resolution.ts`。
- TypeScript import/export 递归遍历迁入 `component-export-resolution.ts`。
- 保持 `discoverComponentSources` 的公开签名、顺序、去重、错误和路径规范化语义稳定。
- 新服务仍归 `core/discovery` feature 所有，不新增包级公共导出或深导入。

## 验收标准

- [x] 三层职责通过明确 service 边界组合，原公开入口不变。
- [x] entries、globs、auto、workspace package、barrel/re-export、循环 export 和缺失模块测试通过。
- [x] `ai-doc-assistant` lint、typecheck、unit、build 通过。
- [x] package architecture 与 `git diff --check` 通过。
- [x] 现有服务端消费者无需改用新的公共入口。

## 范围外

- 不改变组件文档抽取、provider 或 server context 协议。
- 不引入新的 glob、AST 或 workspace 依赖。
- 不重写发现算法或扩大默认扫描范围。

## 阻塞问题

无。
