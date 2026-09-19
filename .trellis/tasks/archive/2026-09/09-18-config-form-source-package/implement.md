# ConfigForm Source 包实施计划

## 执行门禁

- [ ] Surface Foundation、Studio Assets/Datasets/Materials/Interactions 与
      Prototype Runtime 的公开合同已完成；Workbench typecheck 不再有旧 Page、
      v6、旧 Preview expose 或临时 reducer 错误。
- [ ] 运行 `trellis-before-dev`，复核 Source、Workbench、Core 规范和本任务
      `design.md`；门禁未通过前不创建生产包目录。
- [ ] 每个阶段先补 rejection/happy-path 测试，再实现；不保留 alias、wrapper、
      migration reader 或兼容导出。

## 阶段 1：包骨架和纯数据合同

- [ ] 创建 `packages/ConfigForm/source`，版本 `0.0.0`，公开根入口、`/generator`、
      `/viewer`、`/viewer/style`，并加入正确的 package graph/architecture allowlist。
- [ ] 建立 Source 类型、diagnostics、SourceFileSet v1 reader 和 JSON-safe/path
      validators；测试 lower/higher/missing/malformed version、duplicate/unsafe
      path、missing/non-text entry、unsorted files 和 binary/text 交叉拒绝。
- [ ] Node smoke test 只导入根与 `/generator`，断言不触碰 DOM、Vue、Monaco。

## 阶段 2：Generator 最小确定性流水线

- [ ] 实现 input/registryLock/resolver identity 校验；resolver 请求必须包含
      component key、contractVersion、contractFingerprint，失败返回稳定诊断。
- [ ] 将稳定 `ProjectCompilation` 投影为原始 Vue/TypeScript 文件：Page route、
      Dialog/Drawer 组件、Dataset、Resource 与 Theme；Surface 直接使用 Vue/UI 组件，
      默认工程不依赖 ConfigForm，不生成 `src/runtime/**`、Prototype
      Runtime context/session/reducer 或 overlay host。
- [ ] 同时提供独立 ConfigForm binding file set；它通过公开 adapter 绑定 model 与
      fields/components/layout/dataset/theme，不把运行核心或编译器源码混入配置导出。
- [ ] 添加相同 compilation/provider snapshot 的 byte-stable fixture；检查 import
      与 style 顺序、entry、paths 和文件排序。

## 阶段 3：embedded Resource 读取和完整性

- [ ] 注入异步 `SourceResourceReader`，按 projectId/resourceId/contentHash 精确
      读取；测试 fresh byte copy、missing reader result、stale hash、byteLength/hash
      mismatch、reader throw 和失败时零 partial files。
- [ ] 从稳定 resourceId/fileName 派生安全 assets 路径并 canonical base64 编码；
      URL Resource 不调用 reader、不 fetch、不生成 binary 文件。
- [ ] 将 Source generator 与 Workbench Repository adapter 的边界测试固定在组合根，
      Source 不导入 Repository 类型或 storage 实现。

## 阶段 4：只读 Viewer

- [ ] 实现受控 `ConfigFormSourceViewer`：`selectedPath` 必填、`v-model` 更新、
      空态/缺失选择/长路径/binary 状态、桌面 tree/code split 和窄屏 tree/code switch。
- [ ] Monaco 仅在 Viewer 异步加载；binary selection 不初始化 Monaco，卸载释放模型与
      listener；键盘导航、焦点、ARIA 和无水平溢出测试覆盖 desktop/mobile viewport。
- [ ] `/viewer/style` 独立样式入口；不导出 Workbench 旧组件名称或编辑行为。

## 阶段 5：Workbench 组合根迁移

- [ ] Source 导出弹窗直接消费 Generator/Viewer；Studio 自己保留 regenerate/copy/
      download/ZIP/notice/persistence 命令。
- [ ] 删除旧 Workbench generator/source-page/source-libraries/source-registry、
      ProjectFileTree 与 WorkspaceCodeEditor 的生产入口；同步删除旧 wrapper、alias、
      re-export 和不再使用的依赖。
- [ ] 增加生成项目的 install/typecheck/test/build 与 raw-source/config-binding parity
      fixture，覆盖 Page route、重复/循环 overlay、Dataset 和 local demo binding；
      检查生成项目 `src` 不包含运行核心源码或 Prototype Runtime source copy。

## 阶段 6：发布和全范围门禁

- [ ] 添加 handwritten minor Changeset，确认包初始 `0.0.0`、首发 `0.1.0`，peer/
      dependency range 正确。
- [ ] 更新 Source/Workbench/ConfigForm README、ROADMAP、架构 allowlist、root test
      filter、lockfile 和发布验证脚本；目标包才可出现在 current install/import 示例。
- [ ] 运行定向验证：

```powershell
pnpm --filter @moluoxixi/config-form-source test
pnpm --filter @moluoxixi/config-form-source typecheck
pnpm --filter @moluoxixi/config-form-source build
node -e "import('@moluoxixi/config-form-source'); import('@moluoxixi/config-form-source/generator')"
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench test -- export-dialog source
pnpm test:package-architecture
pnpm test:release
git diff --check
```

- [ ] 最后由 `trellis-check` 复核 spec compliance、依赖方向、DOM/Monaco 隔离、
      Source/Experience parity 和旧实现删除；通过后再运行 `trellis-update-spec`，
      归档任务并记录 Changeset。

## 回滚点

- 阶段 1 未接入 Workbench，可整体删除新包目录和 manifest 条目；
- 阶段 2–4 只要 Studio 尚未切换，可回滚 Source 实现和 fixtures；
- 阶段 5 必须与旧实现删除、消费者切换和 package graph 原子回滚，禁止留下半套
  wrapper 或双入口。

