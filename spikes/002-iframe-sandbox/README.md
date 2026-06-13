# 002: iframe-sandbox（沙箱隔离执行 AI 生成 SFC）

## 问题（Given/When/Then）

Given 一段 AI 生成的、不可信的 Vue SFC 源码，
When 在 `sandbox` iframe 内运行时编译并挂载，宿主通过 postMessage 下发 Props、沙箱回传事件，
Then 组件正常渲染且 Props 双向同步有效，**同时**沙箱内代码无法访问父页面（DOM/cookie/全局），样式不污染宿主。

这是 ADR-0003 的验证目标——架构唯一卡生产实现的遗留点。Spike 001 证明了「能编译挂载」，但用的是主页面 `new Function`，不安全；002 验证「能否在隔离容器里安全地做同样的事 + 双向通信」。

## 方案

- 宿主页面挂一个 `<iframe sandbox="allow-scripts">`（**故意不加 `allow-same-origin`**）。
  - 缺 `allow-same-origin` → iframe 处于 opaque origin，访问 `window.parent.document`、父页 cookie、localStorage 一律抛 `SecurityError`。这是隔离的核心保证。
  - 保留 `allow-scripts` → 沙箱内能跑编译 + 挂载脚本。
- iframe 内容用 `srcdoc` 注入，引入 Spike 001 验证过的编译器（vue3-sfc-loader 路线）。
- 通信协议（postMessage，结构化消息 `{type, payload}`）：
  - `iframe → host`：`ready`（沙箱脚本就绪）、`mounted`（组件挂载成功）、`event`（组件 emit 透传）、`error`（编译/运行错误）。
  - `host → iframe`：`mount`（下发 SFC 源码 + 初始 props）、`update-props`（实时改 props）。
- 隔离强度断言：沙箱内主动尝试 `parent.document.title = 'HACKED'`、读 `parent.location`，断言宿主未被篡改 + 沙箱捕获到 SecurityError。

## 断言点（Playwright 真实浏览器）

1. 沙箱 iframe 内 SFC 能编译并挂载，宿主收到 `mounted`。
2. 宿主下发 `update-props` → 沙箱内组件视图实时更新（双向同步生效）。
3. 沙箱内组件 emit 事件 → 宿主收到 `event`。
4. **隔离**：沙箱内尝试改 `parent.document` 抛 SecurityError，宿主 DOM 未被篡改。
5. **样式隔离**：沙箱内 `<style>` 不影响宿主页面元素。

## Verdict ✅ 可行（2026-06-13）

**核心结论：iframe sandbox（`allow-scripts` 无 `allow-same-origin`）能安全隔离执行 AI 生成的 SFC，且宿主↔沙箱 Props 双向同步、事件回传、样式隔离全部成立。ADR-0003 的隔离方案确定为 iframe sandbox，架构最后一个遗留点消除。**

真实 Chromium（Playwright）5/5 全过：

```
ok 1 沙箱内 SFC 编译并挂载成功
ok 2 隔离：沙箱无法访问父页面（DOM/location），宿主未被篡改
ok 3 双向同步：宿主下发 update-props → 沙箱组件接收
ok 4 事件回传：沙箱组件 emit(ping) → 宿主收到 event
ok 5 样式隔离：沙箱 scoped 样式不污染宿主
5 passed
```

隔离探测（沙箱内主动越权，全部被浏览器拦截）：

```
readParentDoc:      BLOCKED: SecurityError
writeParentDoc:     BLOCKED: SecurityError   (宿主 title 未被篡改为 'HACKED')
readParentLocation: BLOCKED: SecurityError
```

### 关键发现 / 落地约束（喂给实现计划）

1. **隔离核心 = 省略 `allow-same-origin`**：`sandbox="allow-scripts"` 让 iframe 处于 opaque origin，沙箱内访问 `parent.document` / cookie / location 一律抛 `SecurityError`。这是隔离的根本机制，绝不能为图方便加回 `allow-same-origin`。
2. **沙箱必须自包含**：opaque origin 下跨源加载模块会失败。方案是用 esbuild 把沙箱入口（含 Vue + vue3-sfc-loader）打包成单个 IIFE，经 `?raw` 内联进 iframe `srcdoc`，零网络依赖。产物 2.8mb（含完整 Vue 运行时 + 编译器）——可接受，但生产应评估按需懒加载或 gzip。
3. **通信协议 = postMessage 结构化消息**：`host→iframe`（mount/update-props）、`iframe→host`（ready/mounted/event/error/isolation-probe）。targetOrigin 用 `*`（沙箱无法得知父 origin，opaque）。
4. **Props 双向同步**：宿主 postMessage 下发 → 沙箱内写入 `reactive` state → 组件实时更新；emit 经 `onXxx` 透传 postMessage 回宿主。
5. **测试穿透注意**：opaque origin iframe 内容，web 代码无法访问（正确），但 Playwright 经 CDP 调试通道能 `frameLocator` 操作沙箱内元素——这是调试通道，不破坏运行时安全模型。
6. **样式天然隔离**：`addStyle` 注入 iframe 自身 `<head>`，scoped 样式不泄漏到宿主。

### 与 ADR 的关系

- ADR-0003 状态可从「隔离强度待验证」更新为「已验证，方案 = iframe sandbox srcdoc + 自包含 IIFE + postMessage 协议」。
- 与 ADR-0001（编译器 vue3-sfc-loader）兼容：沙箱内就是跑的 loader 路线。

## 复现

```bash
cd spikes/002-iframe-sandbox
npm install
npm test   # 自动 build:sandbox + playwright
```

