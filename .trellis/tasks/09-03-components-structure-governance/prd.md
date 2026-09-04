# 通用组件包结构治理

## 目标

治理 components 包的组件边界、共享所有权与按需入口。

## 背景

- 当前 manifest 有 20 条本任务债务：9 个公开 SFC 的 feature owner、10 个含 `withInstall` 业务逻辑的 feature `index.ts`、1 个 HeadlessTable renderer 平铺文件。
- 稳定公开面为根入口、10 个组件 subpath、`./auto-loaders`、`./playground-manifest` 和 `./styles`；Vite 多入口、自动加载器与 playground manifest 必须保持一致。
- 10 个 feature 仍使用 `<Feature>/src/{types,composables,...}` 的冗余嵌套。本任务按全局责任目录合同将其直接归入 `<Feature>/{components,composables,services,types,utils}`。
- 现有生产代码另有 1 条 SFC 私有 deep import 和 3 条 HeadlessTable types 私有 deep import，需在移动时改走 feature barrel。

## 需求

- 清零 manifest 中归属本任务的目录和组件所有权债务。
- 单父和单 Feature 组件下沉到 owner/components，共享组件保留可核验消费者。
- 10 个公开组件统一由 `<Feature>/components/<Feature>` 拥有，`withInstall` 组合进入 `<Feature>/services/component.ts`；feature `index.ts` 只导出。
- 移除 feature 内冗余 `src/`，将 composables/types/utils 直接归入 feature 责任目录；私有子组件进入公开组件的 `components/`。
- 将 HeadlessTable renderer registry/injection/plugin 归入 `HeadlessTable/services`，保持其公开 API 与 ConfigTable 消费不变。
- 补 10 个 root/leaf/default/named/install identity characterization，并保持 auto-loader、Vite entry、styles 与 playground manifest 合同。
- 保持组件公开 API、样式按需入口与交互行为不变。

## 验收标准

- [ ] 20 条目标 debt 全部删除且没有新增 unknown/stale 诊断。
- [ ] 10 个 feature `index.ts` 与责任 barrel 均只导出，feature 内不存在冗余 `src/`。
- [ ] 根/10 个 leaf 的 named/default/install 对象身份、组件名和公开工具/type API 不变。
- [ ] 10 个 package exports、Vite entries、auto-loader names、playground manifest 与 styles entry 保持一致。
- [ ] HeadlessTable renderer precedence、registry reactivity/plugin injection 与 ConfigTable 复用保持不变。
- [ ] 组件单测、类型检查、构建、playground E2E、packed browser 与全仓 architecture/path/lint 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
- 不重写组件 UI、请求/表格状态、键盘行为、Element Plus props/event 或样式。
