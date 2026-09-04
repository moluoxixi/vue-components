# ConfigForm P2 服务职责拆分设计

## Source Page 边界

- `source-page.ts`：页面模板与运行时代码生成外观。
- `source-portability.ts`：registry traversal、节点可移植性校验、初始值相关前置检查。
- `source-libraries.ts`：递归收集页面依赖库。

原调用方继续从稳定的 service barrel 或外观入口消费，不暴露新的包级 API。

## Language Features 边界

- `language-features.ts`：一次性安装、预热和统一 disposal 编排。
- `typescript-language-features.ts`：Vue SFC TypeScript mirror、worker 初始化、completion/hover provider。
- `vue-language-definition.ts`：Vue tokenizer、HTML service 和 Monaco language 注册。

共享状态由最窄 owner 持有；安装幂等和 disposal 顺序必须由现有或新增测试锁定。

## 兼容与回滚

先做机械迁移并保持函数签名，再清理私有重复。任一行为测试失败时回退该服务边界，不同时改另一文件。
