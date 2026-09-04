# @moluoxixi/config-form-vue-backend

ConfigForm Canonical IR 的 Vue 运行时后端。它把 Compiler 产出的不可变页面编译结果绑定到 Vue 组件、校验器和只读渲染协议，生成 `ConfigFormRenderer` 可直接消费的渲染配置。

本包不读取或修复 `ProjectDocument`，也不负责 UI 库物料注册；调用方必须传入同一快照生成的 `PageCompilation`/`ProjectCompilation` 和与 registry identity 匹配的 binding resolver。

## 安装

```bash
pnpm add @moluoxixi/config-form-vue-backend @moluoxixi/config-form @moluoxixi/config-form-compiler @moluoxixi/config-form-core @moluoxixi/zod3-to-rule vue zod
```

## 使用

```ts
import type { CompileCanonicalPageRuntimeInput, VueRuntimeBindingResolver } from '@moluoxixi/config-form-vue-backend'
import { compileCanonicalPageRuntime } from '@moluoxixi/config-form-vue-backend'

export function compileVueRuntime(input: CompileCanonicalPageRuntimeInput, resolver: VueRuntimeBindingResolver) {
  const result = compileCanonicalPageRuntime(input, resolver)
  if (!result.success) {
    throw new Error(result.diagnostics.map(item => item.message).join('\n'))
  }

  return result.artifact.plan.renderer
}
```

`resolver.resolveBinding(component)` 必须返回与 Canonical IR 中组件版本和 fingerprint 一致的 Vue binding。页面节点、placement、循环、组件类型或 identity 不一致时，结果为 `{ success: false, diagnostics }`，不会生成部分可用的 artifact。

## 公开入口

- `compileCanonicalPageRuntime`：把页面级或项目级 compilation 转为 Vue runtime artifact。
- `VueRuntimeBindingResolver`：组件、validator 与只读渲染解析合同。
- `VueRuntimeCompileResult`、`VueRuntimeArtifact`、`VueRuntimeRendererConfig`：编译结果与渲染配置类型。

## 开发验证

```bash
pnpm --filter @moluoxixi/config-form-vue-backend test
pnpm --filter @moluoxixi/config-form-vue-backend typecheck
pnpm --filter @moluoxixi/config-form-vue-backend build
```

## License

MIT
