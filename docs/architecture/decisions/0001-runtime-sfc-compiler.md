# ADR-0001 运行时 SFC 编译器选型

## 状态

proposed（待开发者确认；技术可行性已由 Spike 001 验证）

## 背景

Web 调试台需在浏览器内把 AI 生成的 `<script setup lang="ts">` Vue SFC 源码字符串运行时编译并动态挂载，支持实时调 Props。这是项目最高技术风险点（PRD 风险节）。需要选定运行时编译方案。

## 决策

**MVP 采用 `vue3-sfc-loader`，并在代码中保留 `compileSfc(source) → Component` 抽象层，使 `@vue/compiler-sfc + sucrase` 自研管线可热插拔切换。**

依据 Spike 001（`spikes/001-runtime-sfc-compile/`，真实 Chromium / Playwright 5/5 通过）：

- 两条路线都验证可行（TS 剥离 / `defineProps`+`withDefaults` / setup 响应式 / 外部改 Props 实时更新 / scoped 样式 / 坏 SFC 显式抛错全过）。
- `vue3-sfc-loader` 开箱即用、内置模块解析（import 本地组件 + 第三方依赖），是本仓组件预览的刚需，维护成本低。
- `@vue/compiler-sfc` 与项目 vue 严格同版本、可深度定制，但需自研 ESM 模块垫片（手搓正则易错）与 bindingMetadata 传递，成本高。

## 替代方案

- 纯 `@vue/compiler-sfc + sucrase` 自研管线：控制力强、版本严格一致，但 Spike 已暴露两个坑（别名导入正则、bindingMetadata），MVP 阶段成本不划算，降级为后备实现。
- 构建期预编译所有示例：无法支持「AI 现场生成的任意 SFC」实时预览，与 PRD 路线 B（查询时按需生成）冲突，否决。

## 影响

- 新增依赖 `vue3-sfc-loader`；浏览器内 `@vue/compiler-sfc` 须用 `esm-browser` 构建（vite alias）。
- 必须设计编译器抽象接口 `compileSfc(source, options) → Component`，两实现遵循同一契约。
- 切换实现不影响 `ui` 层调用方。

## 后续约束

- 编译执行必须置于沙箱（见 ADR-0003），本 ADR 不解决安全隔离。
- 真正落地 `@vue/compiler-sfc` 实现时，ESM 模块解析须改用 `es-module-lexer` 或 Vite import 分析，禁止手搓正则垫片（Spike 001 教训）。
