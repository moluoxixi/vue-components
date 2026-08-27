# 国际化 JSON 适配与翻译核心实施计划

- [x] 建立 core 类型、诊断、adapter registry 和纯内存 filesystem fixtures。
- [x] 实现 JSON parser/walker、format metadata 与结构化 unit identity。
- [x] 实现 Vue I18n adapter 及 flat/nested/冲突 fixtures。
- [x] 实现 i18next adapter 及 namespace/plural/context fixtures。
- [x] 实现 generic locale-per-file/locale-first adapter，并复用仓库现有 JSON 形状 fixture。
- [x] 实现 missing/overwrite 分析、protected token tokenizer 与 family 校验。
- [x] 实现 AI batch/prompt/runtime schema/partial retry/AbortSignal 编排。
- [x] 实现 operation 生成、serialize 与 semantic round-trip validator。
- [x] 覆盖非法叶值、坏模型输出、占位符/tag/family 漂移和取消测试。
- [x] 运行包级 test/typecheck/build 与 declaration 验证。

## 回滚点

- 每个 adapter 独立注册；未通过完整 fixture 矩阵的 adapter 不进入默认 registry。
- round-trip 未通过时只返回诊断，禁止生成 operation。
