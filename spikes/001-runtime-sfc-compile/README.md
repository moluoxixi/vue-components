# 001: runtime-sfc-compile（对比 spike）

## 问题（Given/When/Then）

Given 一段 AI 生成的、含 `<script setup lang="ts">` 的 Vue SFC 源码字符串，
When 在浏览器运行时编译并动态挂载，
Then 组件能正确渲染、且外部能响应式地改 Props 并看到视图实时更新。

这是「组件AI文档与调试助手」项目的最高技术风险点（PRD 风险节）。验证它能否跑通，直接决定 Web 调试台的架构可行性与分层方式。

## 为什么是对比 spike

浏览器内运行时编译 `<script setup lang="ts">` 有两条可信路线，库选型是真实架构分叉：

| 方案 | 库 | 取舍 |
|---|---|---|
| A 成熟库 | `vue3-sfc-loader@0.9.5` | 一站式封装（SFC 编译 + TS 转译 + 模块解析 + 样式注入），维护中，少造轮子 |
| B 自研管线 | `@vue/compiler-sfc@3.5.33`（项目已装，版本与运行时 vue 严格一致）+ `sucrase`（剥 TS 类型） | 完全控制产物，无额外大依赖，但要自己拼 parse→compileScript→compileTemplate→执行 管线 |

两条路同一组测试 SFC、同一套 Playwright 断言，跑完做 head-to-head。

## 项目真实事实（spike 建立在这些事实上）

- Vue 运行时：`3.5.33`（catalog 锁 `^3.5.13`）
- `@vue/compiler-sfc`：`3.5.33` 已装（与 vue 同版本）
- Vite `^6.2.0`、pnpm `10.29.3`、node `22.22.0`、Playwright `1.60`
- 已有 `playgrounds/components-playground` 可参照工程形态

## 怎么跑

```bash
cd spikes/001-runtime-sfc-compile
pnpm install          # 装 spike 局部依赖（vue3-sfc-loader / sucrase / vite / playwright）
pnpm test             # Playwright 起 dev server + 真实浏览器断言两条路径
```

## 测试用的 SFC（含 TS + Props + defineProps + 响应式）

见 `src/fixtures.ts` 的 `SAMPLE_SFC`：一个带 `lang="ts"` 类型化 `defineProps`、内部 `ref` 计算、模板插值的真实组件，覆盖「类型剥离 + setup 编译 + Props 注入 + 响应式更新」全链路。

## Verdict ✅ 可行（2026-06-13）

**核心结论：浏览器内运行时编译 `<script setup lang="ts">` SFC + 动态挂载 + Props 实时调，两条路线都跑通了。**Web 调试台架构可行，最高技术风险点已消除。

真实 Chromium（Playwright）5/5 全过：

```
ok 1 路线 B（compiler-sfc + sucrase）：渲染 + 类型化 Props + 响应式 (488ms)
ok 2 路线 A（vue3-sfc-loader）：渲染 + 类型化 Props + 响应式 (446ms)
ok 3 外部改 Props → 两条路线视图实时更新（调试台核心能力） (423ms)
ok 4 错误处理：坏 SFC 应抛错而非静默 (380ms)
ok 5 scoped 样式编译不报错（路线 B 注入了 scopeId） (405ms)
5 passed (4.6s)
```

验证覆盖：TS 类型剥离 ✓ / `defineProps`+`withDefaults` 编译宏 ✓ / setup 内 `ref`+`computed` 响应式 ✓ / 外部响应式改 Props 视图实时更新 ✓ / `<style scoped>` ✓ / 坏 SFC 显式抛错（不静默）✓。

### 两条路线对比（head-to-head）

| 维度 | 路线 A：vue3-sfc-loader | 路线 B：@vue/compiler-sfc + sucrase |
|---|---|---|
| 跑通 | ✅ | ✅ |
| 代码量 | 极少（~40 行 options） | 多（~140 行，含手搓 ESM 垫片） |
| 版本一致性 | loader 内部锁自己的 compiler，可能与项目 vue 版本漂移 | 用项目已装的 `@vue/compiler-sfc@3.5.33`，与运行时 vue **严格同版本** |
| 模块解析 | 内置（import 第三方、嵌套 SFC 都支持） | 需自己实现 `__require`，目前只支持 `'vue'` |
| 控制力 / 可观测性 | 黑盒，定制难 | 全透明，可注入 bindingMetadata、自定义错误、按需裁剪 |
| 依赖体积 | +1 个库 | 复用项目已有 compiler，仅 +sucrase |
| 踩坑成本 | 低（开箱即用） | 高（已踩两个，见下） |

### spike 踩到的真实坑（喂给后续架构 / 实现计划）

1. **手搓正则 ESM 垫片很脆**：`compileScript` 产出 `import { ref as _ref }` 别名导入，朴素正则会生成非法解构 `{ref as _ref}`，必须转成 `{ref: _ref}`。→ 真做路线 B 应换 `es-module-lexer` 或 Vite 的 import 分析，别手搓正则。
2. **script/template 分开编译需手工传 bindingMetadata**：`inlineTemplate:false` 时 render 找不到 `props` 等 setup 绑定（报 `Property "props" was accessed but is not defined`）。→ 用 `inlineTemplate:true`（SFC Playground 同款），模板内联进 setup 闭包，免去 metadata 传递。
3. **浏览器里必须用 esm-browser 构建的 compiler-sfc**：默认入口带 Node 依赖。vite alias 指向 `@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js`。

### 架构建议（写入 architecture 环节）

- **MVP / 默认采用路线 A（vue3-sfc-loader）**：开箱即用、模块解析完备、维护成本低，能最快打通端到端。本仓组件预览大多需要 import 本地组件 + 第三方依赖，loader 的模块解析正是刚需，自研垫片要补很久才能追平。
- **路线 B 作为后备/优化项**：当需要严格锁定 compiler 与项目 vue 同版本、或要深度定制编译（注入诊断、裁剪产物、自定义沙箱）时再切。代码留**编译器抽象层**（`compileSfc(source) → Component`），两条实现可热插拔，与 PRD「AI 后端留抽象层」一致的设计哲学。
- **沙箱隔离**（PRD 风险节）：本 spike 直接在主页面 `new Function` 执行，**生产必须隔离**——AI 生成的 SFC 是不可信代码。建议 iframe sandbox 或 Web Worker 执行编译+挂载，避免 XSS / 全局污染。这是下一个该 spike 的点。

### 怎么复现

```bash
cd spikes/001-runtime-sfc-compile
npm install
npx playwright install chromium
npx playwright test --reporter=list
```

