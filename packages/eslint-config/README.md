# @moluoxixi/eslint-config

基于 `@antfu/eslint-config` 的共享 ESLint 配置工厂。

## 使用

```ts
import createEslintConfig from '@moluoxixi/eslint-config'

export default createEslintConfig({
  ignores: ['fixtures/**'],
})
```

Vue 和 React 能力由 `@antfu/eslint-config` 根据当前项目依赖自动探测，调用方无需显式声明框架开关。

启用 React 配置时，项目需要安装 `@antfu/eslint-config` 声明的可选 peer dependencies：
`@eslint-react/eslint-plugin` 和 `eslint-plugin-react-refresh`。其中 `@eslint-react/eslint-plugin@3`
要求 ESLint 10；Vue 项目仍可使用 ESLint 9。

## 设计边界

- 只保留通用工程规则和产物目录 ignore。
- `vue/block-order` 仅匹配 `.vue` 文件，React 项目不会引用未注册的 Vue plugin。
- 不读取业务目录、不注入业务全局变量，也不依赖业务包运行时。
- 用户传入的 `rules` 会覆盖默认规则，避免配置包替调用方隐藏真实约束。
