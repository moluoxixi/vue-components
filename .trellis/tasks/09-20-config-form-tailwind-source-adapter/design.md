# ConfigForm Source Tailwind v4 输出后端技术设计

## 当前差距

Source 目前把 CSS、主题、壳层 class、Vite 配置和依赖直接散落在 emitter 中；两个公开生成 API 没有样式目标参数，Binding 的主题文件也没有稳定的本地样式入口。Workbench 导出弹窗因此无法在不改变项目文档的前提下选择 CSS 或 Tailwind v4。

## 边界与所有权

- `SourceStyleTarget` 是 Source 输入合同，只允许 `css | tailwind-v4`；默认值为 `css`，不进入 ProjectDocument、Canonical IR、Runtime 或 Registry。
- Source 内部 style backend 负责依赖、Vite 插件、公共样式、主题投影和生成器自有容器 class。emitter 只消费后端结果，不判断具体目标。
- Raw Vue 的 Tailwind 工程可以依赖 `tailwindcss` 与 `@tailwindcss/vite` 作为开发依赖；运行时依赖白名单仍只有 Vue、Vue Router 和目标 UI Provider。
- ConfigForm binding 只通过公开 attrs 和生成器自有样式入口使用 Tailwind，不改变 ConfigForm Runtime 或 Provider adapter 的依赖。
- Provider 内部 DOM 不由 Tailwind 接管；连续长度、运行期值和无法静态枚举的样式继续使用 CSS 变量或受控 inline style。

## 输入与失败语义

两个公开 API 的输入新增可选 `styleTarget`。入口先归一化并校验，再执行 resolver、validation、Resource 和 emitter；非法目标返回稳定的 `source_input_invalid` 诊断且不产生文件。省略目标和显式 `css` 必须调用同一后端并生成字节完全相同的文件集合。

## 后端合同

内部 `SourceStyleBackend` 至少提供：

- 样式目标标识和生成文件路径；
- Raw/Binding 的 package 与 Vite 增量；
- 应用壳层、Surface、表单、字段和布局的完整字面量 class；
- 从完整 `ProjectTheme` 生成的确定性 token/style 文件；
- 仍需 inline style 的受控变量投影。

Tailwind v4 后端生成 `@import "tailwindcss"` 的本地样式入口，并在 Vite 中安装官方插件。所有 utility 必须出现在生成文本的完整字面量中，不使用运行期字符串拼接或动态 class 名。

## Workbench 集成

导出弹窗持有会话级 `styleTarget`，使用分段控件切换 CSS/Tailwind v4；切换后从同一 pinned compilation 重新生成 Raw 与 Binding，两个产物仍独立表示 `ready | failed`。关闭弹窗后不持久化该选择到项目。

## 验证与回滚

测试覆盖默认/显式 CSS 字节一致、非法目标 fail closed、两种后端确定性、Tailwind 依赖与插件、静态 utility、Binding 样式入口、双 Provider Raw 真实安装/类型检查/构建和至少一套 Binding library build。若后端无法表达某个结构化语义，应保留受控 CSS 变量，不扩展 Model 或引入任意 class。
