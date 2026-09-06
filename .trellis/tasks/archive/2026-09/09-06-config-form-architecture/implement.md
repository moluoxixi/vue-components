# 执行计划

1. 检查 Core/Designer 现有 JSON clone 工具与包入口。
2. 实现单一 clone 入口并替换 Designer 重复实现。
3. 增加 Designer Runtime 依赖边界测试。
4. 增加 material defaultValue 与 preview model 的行为测试。
5. 运行 Designer、Core、Headless、Runtime 相关测试和类型检查。
6. 运行 `pnpm test:config-form-packages` 与包架构检查。
