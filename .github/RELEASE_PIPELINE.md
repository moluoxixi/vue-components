# CI 与发布触发

- 每次分支 push 都运行 CI；PR、每日定时和手动 CI 入口保留。push 不设路径过滤，因此只改文档也会检查。
- Release packages 和 Pages 接受本仓库 main 上成功的 push、schedule、workflow_dispatch CI；PR、其他分支、失败或取消的 CI 不会自动发布。
- 发布保留当前 main 与已验证 SHA 的新鲜度检查和 npm 串行锁。过期 CI 不发布旧代码，等待最新 main 的验证完成。
- npm 根据 Changesets 判断变更并生成版本。没有源码变更不会为了“每次提交”重复升级版本；每次有效发布运行仍检查 npm 缺失的版本，恢复版本元数据已提交但 npm 发布失败的情况。
- .changeset/README.md 不是待发布 changeset。Changesets publish 跳过 npm 中已存在的版本。
- main 的定时或手动 CI 成功后也会尝试恢复 npm 发布并更新 Pages。直接手动运行发布工作流的入口仍保留。
- PR 里的工作流变更只有合并后才成为默认分支上的发布规则；合并本 PR 会触发 CI，成功后按以上规则自动发布/部署。

## 边界

“有提交就检查”指推送到 GitHub 的分支提交，不包括只在本地提交。
GitHub 原生跳过标记（如 [skip ci]）、Actions 被禁用或额度/平台故障仍可能阻止 push CI。
GITHUB_TOKEN 产生的自动版本提交不会递归触发 push 工作流；同一次发布继续处理 npm，定时 CI 提供后续恢复入口，避免发布循环。
新提交可能使旧发布运行过期；这不是发布失败。实际错误在 Actions 对应步骤查看，不应把 skipped 当作已发布。
