# ViteConfig 最佳实践

设计契约见 [DESIGN.md](https://github.com/moluoxixi/vue-components/blob/main/packages/vite-config/DESIGN.md)。该包定位为 opinionated Vite preset：
通过依赖图推断高确定性的插件配置，但保留显式关闭、显式覆盖和严格失败语义。

## API

- `createAppConfig()`：生成应用项目的 Vite 配置。
- `createLibConfig()`：生成库项目的 Vite 配置，并默认 external 化运行时依赖与 peer 依赖。
- `getBaseConfig()`：只解析基础别名与自动装配的 addon 配置。
- `inspectViteFeatures()`：只做 feature 决策分析，不加载任何插件模块。

`createAppConfig` 使用 `AppViteConfigOptions`，`createLibConfig` 使用
`LibViteConfigOptions`。库入口只属于 Library 配置，避免不同场景静默接收无效字段。

## 依赖检测约定

- 自动启用依据目标项目 `package.json` 中真实声明的 addon 依赖图。
- `dependencies`、`devDependencies`、`peerDependencies` 与 `optionalDependencies` 都可以触发 addon 自动启用。
- Vite 插件、测试框架和构建工具通常属于 build-time addon，放在 `devDependencies` 也必须能被识别。
- 显式传入 `true` 或对象配置时，仍会严格校验对应 addon 依赖；缺失时直接失败，不做回退。

## Typings 输出约定

- `auto-import`、`components`、`vue-router` 的默认 `dts` 输出路径都会基于 `viteConfig.root` 解析到 `src/typings/` 目录。
- 调用方未显式覆盖时，不依赖当前 shell 的工作目录。

- `createLibConfig()` 默认把 `dependencies`、`optionalDependencies` 与 `peerDependencies` external 化。
- `devDependencies` 不会自动 external，避免把仅用于开发或测试的包错误带入发布契约。
- `createLibConfig({ entry })` 可直接声明库入口；相对路径会基于 `viteConfig.root` 解析，默认仍为 `src/index.ts`。
- 调用方的 `build.rollupOptions.external` 会与默认依赖 external 规则取并集，不会覆盖默认规则。

## 业务插件边界

依赖图自动装配只用于跨项目稳定且高确定性的 addon。Sentry 等涉及鉴权、组织、项目、release
和 source map 策略的业务插件不进入本包的 addon registry、peerDependencies 或环境变量约定，
由消费项目安装并通过原生 `viteConfig.plugins` 注入：

```ts
import { createAppConfig } from '@moluoxixi/vite-config'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default createAppConfig(({ mode }) => ({
  viteConfig: {
    plugins:
      mode === 'production'
        ? [
            sentryVitePlugin({
              authToken: process.env.SENTRY_AUTH_TOKEN,
              org: process.env.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT,
            }),
          ]
        : [],
  },
}))
```

调用方插件排在自动 addon 之后；当插件 `name` 与自动插件相同时，调用方插件按既有合并契约
覆盖自动插件。

## 页面路由

`vite-plugin-pages` 属于可选 addon。目标项目声明依赖后会自动启用，
也可以用 `pages: true` 显式启用；启用时仍会严格校验依赖是否可加载。
配置字段直接使用插件原生类型：

```ts
export default createAppConfig({
  pages: {
    dirs: 'src/pages',
    extensions: ['vue'],
    exclude: ['**/components/**', '**/__tests__/**'],
  },
})
```

未覆盖时，`pages` 会按已安装的 Vue/React 工具链选择 `.vue` 或 `.tsx`，React 项目同时设置
`resolver: 'react'`，并沿用脚手架的 `src/pages`、组件目录和测试目录默认规则。

## Addon 执行顺序

Addon registry 不使用全局数值优先级。没有依赖关系的 addon 按 registry 声明顺序合并；
确实需要先后关系时，在 feature 中声明 `dependsOn`，系统会做稳定拓扑排序，并对未知依赖和
循环依赖直接报错。Addon 依赖不是 npm 包依赖，后者仍由 `requires` 负责校验。

## typed addon options

`BaseViteConfigOptions` 的每个 addon 字段都绑定对应插件的真实配置类型；直接在
`createAppConfig` 里写配置，也能获得和依赖版本一致的参数提示。所有 addon helper/type
都从唯一入口导出，常规使用直接从 `@moluoxixi/vite-config` 导入：

```ts
import { createAppConfig, defineVueAddonOptions } from '@moluoxixi/vite-config'

export default createAppConfig({
  vue: defineVueAddonOptions({
    features: {
      propsDestructure: true,
    },
  }),
})
```

当前提供 `addons/vue`、`addons/react`、`addons/auto-import`、`addons/components`、
`addons/vue-router`、`addons/markdown`、`addons/i18n`、`addons/devtools`、
`addons/layouts`、`addons/pwa`、`addons/tailwindcss`、`addons/unocss` 与
`addons/vite-ssg`、`addons/vitest` 与 `addons/pages`。这些子入口继续保留给需要按 addon 拆分导入的场景；也可以从
`@moluoxixi/vite-config/addons` 一次性导入所有 addon helper/type。

源码中，公开 helper 位于 `src/addons/services`，但构建会显式保持
`dist/addons/<name>.{js,d.ts}`。`src/config/base/addons` 按 `adapters`、`defaults`、
`services`、`types` 和 `utils` 分工；这些是包内实现目录，不是新的公开 subpath。

主入口和 `addons/pwa` 的 PWA 类型都来自 `vite-plugin-pwa` 官方导出。本仓库只把它作为
devDependency 用于开发期类型检查和声明文件构建；发布包不会把 devDependency 安装到
消费者项目里。运行时仍由 PWA addon 动态加载该插件，如果项目没有安装对应 addon 依赖，
TypeScript 解析或运行时启用都会直接暴露失败，不提供宽类型回退。
Tailwind CSS 只会在安装 `@tailwindcss/vite` 或 `@tailwindcss/postcss` 时自动接入；
仅安装裸 `tailwindcss` 包不会被当成 Vite/PostCSS 插件入口。

## 1. 自动化的依赖侦测（Read Package）

- **实践方法**：放弃手动配置每个特性开关，利用读取并解析 `viteConfig.root` 下的 `package.json`，自动侦测项目中是否使用 `vue`、`react`、`@tailwindcss/vite`、`@tailwindcss/postcss`、`unocss` 等常用前端技术栈。
- **优势**：减少模板化项目初始化的心智负担，开发者一旦安装对应依赖该功能自动就绪。

## 2. 动态按需加载配置模块

- **实践方法**：根据上一步依赖检测的结果，利用动态 `import()` 加载相关的 Vite 插件。如果不包含某个依赖，则完全不要去进行该环境配置的解析和插件实例化。
- **优势**：大幅提升 Vite Server 的启动速度，并防止未安装依赖抛出不必要的错误。

插件解析始终以调用方 `viteConfig.root` 的 `package.json` 创建 resolver，不能改为从
`@moluoxixi/vite-config` 自身的安装位置解析。这样 monorepo 子项目、条件导出和插件 subpath
都会使用目标项目实际安装的版本。

## 3. 模块化与配置合并（Merge Config）

- **实践方法**：不要编写一个庞大的、成百上千行的单文件 `vite.config.ts`。应把基础配置（如别名、打包产出、服务器端口等）提取出来，与各个插件模块生成的配置独立化。最后利用 Vite 提供的 `mergeConfig` API 将最终侦测启用的多个配置块安全合并。
- **优势**：保证了底层能力的可维护与高内聚，使得这个公共能力包可以横跨多个不同技术栈的子项目无缝使用。
