# ADR-0003 AI 生成代码沙箱隔离执行

## 状态

accepted（2026-06-13；隔离方案已由 Spike 002 验证）

## 背景

Web 调试台会把 AI 现场生成的 Vue SFC 运行时编译并挂载（ADR-0001）。AI 生成的代码是**不可信代码**：可能包含恶意脚本、访问 `window`/`document`、读取父页面状态、发起越权请求或 XSS。Spike 001 为验证可行性，直接在主页面用 `new Function` 执行编译产物——这在生产中不可接受。

## 决策

**AI 生成的 SFC 编译产物必须在 iframe sandbox 中执行挂载，禁止在主应用上下文直接运行。** 隔离方案已由 Spike 002（`spikes/002-iframe-sandbox/`，真实 Chromium 5/5 通过）验证确定：

- iframe `sandbox="allow-scripts"`，**故意省略 `allow-same-origin`** → iframe 处于 opaque origin，沙箱内访问 `parent.document` / cookie / location 一律抛 `SecurityError`（实测三项越权全部 BLOCKED，宿主未被篡改）。
- 沙箱脚本（Vue + 编译器 + loader）用 esbuild 打包成自包含 IIFE，经 `?raw` 内联进 iframe `srcdoc`，零跨源网络依赖。
- 宿主↔沙箱用 postMessage 结构化协议通信：`host→iframe`(mount/update-props)、`iframe→host`(ready/mounted/event/error)。Props 双向同步、emit 事件回传、样式隔离均实测成立。

## 替代方案

- 不隔离、信任 AI 输出：安全不可接受，否决。
- 仅静态扫描 AI 代码后在主上下文执行：扫描无法覆盖所有攻击面，不可靠，否决。
- 服务端渲染示例返回 HTML：失去「实时调 Props 看效果」的交互能力，与 PRD 冲突，否决。

## 影响

- `runtime/sfc-compiler` 只负责编译，执行容器由 `ui` 层注入；编译与执行解耦。
- 需设计宿主↔沙箱的 Props 同步协议（可参考复用 `config-form-devtools-vite-plugin` 的 client-plugin postMessage 协议）。
- 增加一次 Spike（002）作为实现前置。

## 后续约束

- Spike 002 未给出可行隔离方案前，调试台的「实时挂载执行」功能不得进入生产实现。
- 沙箱内不得获得宿主密钥、cookie、同源凭证。
