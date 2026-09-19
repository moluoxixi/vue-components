---
"@moluoxixi/config-form-source": minor
"@moluoxixi/config-form-compiler": minor
---

发布独立 Source 包：默认生成直接使用 Vue 与目标 UI 组件的原始工程源码，另行提供
ConfigForm adapter 绑定源码，并提供受控只读文件树与源码 Viewer。两种产物均不复制
ConfigForm、Compiler 或 Prototype Runtime 的运行核心。

同时移除 Compiler 中仅服务旧导出方案的 `getConfigFormRuntimeSources` 公共 API，彻底
删除将 Core、Headless 与 Vue Runtime 源码复制到导出项目的实现。
