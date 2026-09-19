# @moluoxixi/config-form-prototype-runtime

ConfigForm 可交互 Demo 的共享执行层。包根入口和 `/session` 提供无 DOM 的严格合同、
Safe Expression 求值和纯会话 reducer；`/vue` 提供按实例隔离的 Surface/overlay host。

## 安装

```bash
pnpm add @moluoxixi/config-form-prototype-runtime
```

## 入口

```ts
import { PROTOTYPE_SESSION_VERSION } from '@moluoxixi/config-form-prototype-runtime'
import {
  initializePrototypeSession,
  reducePrototypeSession,
} from '@moluoxixi/config-form-prototype-runtime/session'
import { PrototypeSurfaceHost } from '@moluoxixi/config-form-prototype-runtime/vue'
import '@moluoxixi/config-form-prototype-runtime/vue/style'
```

生产 Runtime 的 Data Source 与 `props.onX` listener 不属于本包。本包只执行 JSON-safe、
确定性的 Demo 交互，不提供 HTTP、事件转发、脚本或业务函数。

## 验证

```bash
pnpm --filter @moluoxixi/config-form-prototype-runtime test
pnpm --filter @moluoxixi/config-form-prototype-runtime typecheck
pnpm --filter @moluoxixi/config-form-prototype-runtime build
```
