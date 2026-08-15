# ViteConfig 设计契约

`@moluoxixi/vite-config` 是一个有明确取舍的 Vite preset。它的目标不是替代
`vite.config.ts`，而是把固定技术栈中重复、稳定、依赖驱动的配置收敛为可复用工厂。

## 设计定位

- 依赖图只能用于推断常见意图，不能成为不可覆盖的黑盒决策。
- 自动启用只覆盖高确定性的插件装配；业务语义、产物策略和性能优化默认交给调用方。
- 所有缺失依赖、插件导出异常和配置解析异常都必须显式失败，不允许静默降级。
- `createAppConfig` 和 `createLibConfig` 只承载各自场景的默认值，`getBaseConfig` 保持中性。

## 决策优先级

1. 显式 `false`：无论依赖是否存在，都关闭对应 addon。
2. 显式 `true` 或对象配置：启用 addon，并检查必需运行时依赖。
3. 依赖触发：当目标项目 `package.json` 命中 addon triggers 时自动启用。
4. 未命中依赖：不加载插件，不伪造空配置。

## 依赖语义

- addon 启用与依赖校验使用 `addonDeps`：`dependencies`、`devDependencies`、
  `peerDependencies` 和 `optionalDependencies` 都算作“项目已声明该构建能力”。
- 库模式 external 使用发布语义：只 external `dependencies`、`peerDependencies`
  和 `optionalDependencies`，避免把纯开发工具误写进库的运行时契约。
- 调用方 Rollup external 规则与默认依赖规则取并集，不能关闭库模式的依赖 external。
- `runtimeDeps` 只表达真实运行时依赖，不用于 Vite 插件自动启用判断。

## 可观测性

使用 `inspectViteFeatures(options)` 检查 addon 决策。它只读取目标 root 的依赖图，
不动态导入任何插件模块，适合在调试和脚手架输出中展示结果。

返回字段含义：

- `reason`：说明启用或关闭来自显式配置还是依赖推断。
- `matchedTriggers`：当前项目命中的触发依赖。
- `missingRequires`：启用后还缺少的必需运行时依赖。

## 类型边界

主入口 `BaseViteConfigOptions` 和 addon helper 都必须使用对应插件的真实配置类型，
不得把配置压成宽 `object` 或手写镜像类型。`@moluoxixi/vite-config` 是常规唯一导入入口，
必须导出所有 addon helper/type；`@moluoxixi/vite-config/addons` 和
`@moluoxixi/vite-config/addons/*` 只作为按 addon 拆分导入的辅助入口保留。
这样调用方直接在 `createAppConfig` 中传入 addon 配置，或从根入口导入 helper 时，
都能感知当前依赖版本支持的参数。

`AppViteConfigOptions` 与通用配置保持一致；`LibViteConfigOptions` 只增加 `entry`。
两个工厂使用各自的配置导出类型，避免在类型层接受
运行时会被忽略的场景专属字段。旧的 `ViteConfigOptions` / `ViteConfigExport` 名称只作为
Library 兼容别名保留。

`pages` 使用插件公开的原生 options 类型。默认扫描目录为
`src/pages`，并排除 `**/components/**` 与 `**/__tests__/**`；检测到纯 React 工具链时默认使用
`resolver: 'react'` 和 `.tsx` 扩展，Vue 工具链默认使用 `.vue` 扩展。

这意味着启用或配置某个 addon 的项目必须安装对应 optional peer；缺失依赖时，
TypeScript 解析或运行时动态导入都会暴露失败，不提供静默 fallback。`pwa` 的源码类型
直接来自 `vite-plugin-pwa` 官方导出；本仓库只把它作为 devDependency 用于开发期类型检查
和构建声明文件，消费者安装 `@moluoxixi/vite-config` 时不会因为该 devDependency 自动安装
PWA 插件，运行时仍按 optional peer 契约由目标项目自行声明。

Tailwind CSS 的自动启用只绑定官方集成入口 `@tailwindcss/vite` 或
`@tailwindcss/postcss`。裸 `tailwindcss` 包只代表样式运行时/配置来源，
不能被当成 Vite 或 PostCSS 插件工厂。

## 场景边界

- `getBaseConfig`：只提供路径别名和 addon 合并能力，不改变运行时代码语义。
- `createAppConfig`：面向 Web App；Vite 原生配置通过 `viteConfig` 传入，应用身份和部署策略由调用方或具体 addon 负责。
- `createLibConfig`：面向库构建，始终 external 掉依赖包和依赖子路径，避免打包业务依赖；库入口可通过顶层 `entry` 覆盖，默认值仍为 `src/index.ts`。
- `pwa`：只提供中性的注册策略默认值，不内置应用名、图标、静态资源路径等业务语义配置。
- `viteSsg`：`vite-ssg` 本身即可启用 SSG 基础配置；`vite-ssg-sitemap` 仅作为存在时追加的增强能力，不应反向阻塞 SSG。
- `pages`：文件系统路由插件由 `vite-plugin-pages` 提供；默认值只复用脚手架的页面目录、扩展名和排除规则，调用方仍可传入完整原生 options。
- Sentry 等业务观测插件：由消费项目安装并通过 `viteConfig.plugins` 注入；本包不声明相关 addon、依赖、环境变量、release 或 source-map 策略。

## Addon 执行顺序

Addon feature 不使用全局数值 `order`。registry 声明顺序是无依赖 addon 的稳定顺序；
需要先加载其他 addon 时使用 `dependsOn` 声明，运行时对 feature 做稳定拓扑排序。
未知依赖、重复 feature 名称和循环依赖都必须直接失败。`requires` 只表示 npm 包依赖，
不承担 addon 之间的执行顺序。

## 失败语义

- 找不到目标 root 的 `package.json` 时直接抛错。
- addon 被启用但缺少必需包时直接抛错，并报告缺失包名和检查路径。
- 动态导入失败时保留原始 `cause`，并补充 addon 名称、specifier 和 root。
