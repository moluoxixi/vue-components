# @moluoxixi/eslint-config

基于 `@antfu/eslint-config` 的共享 ESLint 配置工厂。

## 使用

```ts
import createEslintConfig from '@moluoxixi/eslint-config'

export default createEslintConfig({
  ignores: ['fixtures/**'],
})
```

## 设计边界

- 只保留通用工程规则和产物目录 ignore。
- 不读取业务目录、不注入业务全局变量、不依赖旧 `@moluoxixi/utils/_utils`。
- 用户传入的 `rules` 会覆盖默认规则，避免配置包替调用方隐藏真实约束。
