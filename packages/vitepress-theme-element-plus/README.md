# @moluoxixi/vitepress-theme-element-plus

可复用的 Element Plus 风格 VitePress 文档主题。包内包含响应式布局、导航、侧栏、暗色模式、Demo、Playground、ApiDocs、组件目录、仓库元数据和文档准备 CLI；组件库项目只维护自己的品牌、内容与 package profile。

## 安装

```bash
pnpm add @moluoxixi/vitepress-theme-element-plus element-plus vitepress vue
```

需要完整的项目准备、组件页面生成和 Playground manifest 时，还应按项目功能安装相应 Markdown、Vue SFC 与 AI 文档依赖。

## 基础主题

在 `.vitepress/config.ts` 中声明站点：

```ts
import { defineElementPlusDocs } from '@moluoxixi/vitepress-theme-element-plus'

export default defineElementPlusDocs({
  site: {
    title: 'Acme Components',
    defaultLocale: 'zh-CN',
    locales: {
      'zh-CN': {
        label: '简体中文',
        lang: 'zh-CN',
        pathPrefix: '',
      },
    },
  },
})
```

在 `.vitepress/theme/index.ts` 中启用主题：

```ts
export { elementPlusDocsTheme as default } from '@moluoxixi/vitepress-theme-element-plus'
```

需要注册站点插件时使用 `createElementPlusDocsTheme({ enhanceApp })`。

## 样式边界

主题布局和文档工具由 scoped Vue 组件组成。Tailwind 4 仅扫描主题源码，使用 `epdocs:` 前缀、关闭 Preflight，并预编译到发布 CSS，消费项目无需配置 Tailwind。主题变量使用 `--ep-docs-*`；主题 Element Plus 控件和浮层使用独立的 `epd-*` 命名空间，Demo 与 Playground 恢复消费项目原有的 namespace。

正文及生成的工具类排除 `.vp-raw` 全部后代；字体和文字颜色不放在与示例共享的父容器。直接嵌入 Markdown 的组件也可用 `.vp-raw`。示例应显式加载自身依赖的 CSS，并优先使用 `<style scoped>`。此边界不是 DOM 沙箱；消费项目全局 CSS 和共享的 `html.dark` 状态仍按项目配置生效。

## 完整文档工程

- `defineElementPlusDocsProject`：声明仓库、语言、组件 package profile 与组件目录。
- `defineComponentPackage`：声明组件包源码、API、样式和 Playground 入口。
- `createElementPlusDocsContent`：安装 Demo、Playground、ApiDocs 与目录运行时。
- `@moluoxixi/vitepress-theme-element-plus/markdown`：安装 Markdown Demo 与源码解析插件。
- `element-plus-docs prepare|dev|build|preview`：准备生成内容并执行 VitePress 生命周期。

完整配置说明见仓库中的 `docs/vitepress/zh/guide/documentation-theme.md`。

## 公开子路径

- `.`：浏览器主题、内容组件、项目配置和通用类型。
- `./markdown`：Markdown 插件与 Demo 解析。
- `./node`：Node 生命周期与生成服务。
- `./repository`、`./repository/node`：仓库元数据公共合同与 Node collector。
- `./repl`、`./repl.css`：可复用 Vue REPL 运行时与样式。

## 开发验证

```bash
pnpm --filter @moluoxixi/vitepress-theme-element-plus test
pnpm --filter @moluoxixi/vitepress-theme-element-plus typecheck
pnpm --filter @moluoxixi/vitepress-theme-element-plus build
pnpm --filter @moluoxixi/vitepress-theme-element-plus test:e2e:functional
```

## 来源与许可证

主题包含基于 Element Plus 文档站和 Element Plus Playground 固定提交改造的源码。详情见 `UPSTREAM.md` 与 `THIRD_PARTY_NOTICES.md`。项目许可证为 MIT。
