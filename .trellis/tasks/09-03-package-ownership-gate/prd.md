# 全仓入口与组件所有权门禁

## 目标

为 `packages/` 建立可复用的包入口、Feature 目录和 Vue 组件所有权检查，使后续结构迁移能够拒绝新增债务并最终归零。

## 需求

1. 递归识别 `packages/**/package.json`，排除 dist/node_modules/coverage/cache/third-party。
2. 校验包根 `index.ts`、`src/`、构建入口和禁止 `export * from './src'`；支持显式 framework/CLI/private-app 例外。
3. 校验 Feature 根只含入口和约定职责目录，`types/` 无运行时导出，barrel 无业务逻辑或副作用。
4. 解析 Vue/TS 静态 import、动态 import 与本地 barrel re-export，生成组件到生产消费者的引用关系。
5. 定义版本化 ownership manifest：public/dynamic/framework 例外必须有 owner/reason；共享组件必须有两个独立 Feature 消费者。
6. 定义临时 debt 列表记录现有入口/所有权问题；每项包含 path、rule、targetTask 和 reason。门禁禁止新增，父任务完成前必须清空。
7. Collector 使用结构化解析或可靠模块解析，不以简单字符串包含判断 import graph。
8. 提供 fixture 测试覆盖单父、单 Feature、shared、barrel、dynamic、public exception、缺失入口和非法 src/index。

## 验收标准

- [ ] 一条根命令可以扫描全部 packages 并输出稳定、可排序、含 rule/path/owners 的诊断。
- [ ] 当前债务被显式记录，新违规会失败，删除债务会要求同步删除 manifest 项。
- [ ] 测试证明单父组件必须进入 owner/components，shared/public/dynamic 例外不会误报。
- [ ] 测试证明每个普通包的公共源码入口位于包根 index.ts，且根入口显式导出 Feature。
- [ ] 规则写入全局 Trellis spec，并接入根 package scripts/CI 可调用入口。
- [ ] 相关 unit、typecheck、lint、architecture test 和 `git diff --check` 通过。

## 范围外

- 本子任务不移动现有业务组件或拆巨型文件。
- 不改变任何包的业务 API、Runtime 行为或样式。
