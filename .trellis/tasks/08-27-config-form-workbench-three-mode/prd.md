# Config、设计器与 Source 同步

## 目标

让 Config、拖拽设计器和完整项目 Source 编辑同一个虚拟项目，并通过 draft、revision 和 capability diagnostics 保持一致。

## 范围

- 表单 artifact 的 Config JSON codec 与声明式 TypeScript codec。
- Source 文件树与 Monaco 状态接入。
- Designer command/history 到 project transaction 的适配。
- 无效 draft、原子 Apply、模式切换、三方合并与冲突反馈。
- 可视化支持能力检测：支持、只读、不支持、无效。

## 验收标准

- [ ] 三种模式从同一 revision 初始化，任一有效提交同步另外两种投影。
- [ ] 无效文本不进入 committed project，也不清空编辑器草稿或最后有效 Designer。
- [ ] Source 中不受 Designer 管理的项目文件不会因 Designer 操作而丢失。
- [ ] 超出 Designer 子集的源码不会被静默重写。

## 依赖与非目标

- 依赖 `08-27-config-form-workbench-project-core` 的项目协议。
- 不负责项目运行容器、模板 UI、云端协作或任意源码反编译。
