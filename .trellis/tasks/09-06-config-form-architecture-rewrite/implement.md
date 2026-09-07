# 执行计划

1. 建立 CanonicalFieldDescriptor 完整语义投影并替换 Runtime/Designer 重复规范化。
2. 重构 Renderer controller 为同步 model.read/write 端口，宿主 Ref 作为唯一值源。
3. 定义 Designer Runtime Host contract，替换直接 Renderer 依赖。
4. 更新 Workbench 注入、Preview、Canvas 和相关测试。
5. 删除旧兼容路径与重复类型，更新 README/spec。
6. 按依赖拓扑运行全包构建、类型检查、单元测试、架构检查和 E2E。
