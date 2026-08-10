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
- `runtimeDeps` 只表达真实运行时依赖，不用于 Vite 插件自动启用判断。

## 可观测性

使用 `inspectViteFeatures(options)` 检查 addon 决策。它只读取目标 root 的依赖图，
不动态导入任何插件模块，适合在调试和脚手架输出中展示结果。

返回字段含义：

- `reason`：说明启用或关闭来自显式配置还是依赖推断。
- `matchedTriggers`：当前项目命中的触发依赖。
- `missingRequires`：启用后还缺少的必需运行时依赖。

## 类型边界

主入口 `ViteConfigOptions` 和 addon helper 都必须使用对应插件的真实配置类型，
不得把配置压成宽 `object` 或手写镜像类型。`@moluoxixi/vite-config` 是常规唯一导入入口，
必须导出所有 addon helper/type；`@moluoxixi/vite-config/addons` 和
`@moluoxixi/vite-config/addons/*` 只作为按 addon 拆分导入的辅助入口保留。
这样调用方直接在 `createAppConfig` 中传入 addon 配置，或从根入口导入 helper 时，
都能感知当前依赖版本支持的参数。

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
- `createAppConfig`：面向 Web App，本身不注入业务语义默认值，应用层策略由调用方通过 `viteConfig` 覆盖。
- `createLibConfig`：面向库构建，默认 external 掉依赖包和依赖子路径，避免打包业务依赖；库入口可通过顶层 `entry` 覆盖，默认值仍为 `src/index.ts`。
- `pwa`：只提供中性的注册策略默认值，不内置应用名、图标、静态资源路径等业务语义配置。
- `viteSsg`：`vite-ssg` 本身即可启用 SSG 基础配置；`vite-ssg-sitemap` 仅作为存在时追加的增强能力，不应反向阻塞 SSG。

## 失败语义

- 找不到目标 root 的 `package.json` 时直接抛错。
- addon 被启用但缺少必需包时直接抛错，并报告缺失包名和检查路径。
- 动态导入失败时保留原始 `cause`，并补充 addon 名称、specifier 和 root。
