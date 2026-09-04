# ConfigForm P2 服务职责拆分

## 目标

在保持 Workbench 导出结果和 Monaco 编辑体验不变的前提下，拆分两个超过 500 行且混合独立职责的服务文件。

## 需求

- `project/export/services/source-page.ts` 保留页面源码生成外观，迁出可移植性校验和依赖库收集职责。
- `WorkspaceCodeEditor/services/language-features.ts` 保留安装/卸载编排，迁出 TypeScript/Vue mirror 与 worker/provider、Vue language definition/HTML service 职责。
- 保持所有现有调用方入口、错误语义、disposer 顺序、幂等注册和生成源码字节语义稳定。
- 新文件按唯一 feature owner 放在当前 service 目录，不提升为包级公共模块。
- 先以现有行为测试锁定边界，再移动实现；不新增兼容 forwarding shim。

## 验收标准

- [ ] 两个入口文件只承担外观编排，独立职责位于命名清晰的同 owner service 模块。
- [ ] 导出源码、可移植性错误、依赖收集、补全、hover、Vue mirror、provider disposal 行为测试通过。
- [ ] Workbench unit、typecheck、build 和 E2E 通过。
- [ ] package architecture、lint 与 `git diff --check` 通过。
- [ ] 公共 API、页面协议和 UI 无可观察变化。

## 范围外

- 不拆分 locale 数据表、Project schema 或 Workbench 根 shell。
- 不更换 Monaco/TypeScript/Vue language service 技术栈。
- 不改变导出源码格式或组件 registry 协议。

## 阻塞问题

无。
