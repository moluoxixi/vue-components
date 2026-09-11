# vite-plugin-style-scope

构建期给 qiankun 子应用的**全局样式**添加作用域前缀的 Vite 插件，
补齐 `experimentalStyleIsolation` 隔离不到非 scoped 全局样式的缺口。

## 原理

- 构建期通过 PostCSS 给所有选择器加前缀 `:where([data-qiankun="<appName>"])`，
  `:where()` 使权重归零，不会压过子应用自身的 scoped 样式；
- 作用域属性默认复用 qiankun 自己的标记：开启 `experimentalStyleIsolation`
  时 qiankun 会给子应用包裹节点打上 `data-qiankun="<appName>"`，前缀直接
  匹配它，运行时无需重复打属性；带值匹配保证多个子应用互不误伤；
- 运行时兜底：容器祖先链上没有该标记（如未开 experimentalStyleIsolation）
  时才给根容器补打；独立运行时额外给 `body` 兜底打标记（页面上只有子应用
  自己，无污染风险），Teleport 到 body 的弹窗样式照样生效；
- qiankun 环境下额外劫持 `document.head` / `document.body` 的动态插入
  （同 qiankun 沙箱对动态样式的接管，补上 vite ESM 脚本打不到的缺口）：
  - 动态插入 head 的 `<style>` / `<link rel="stylesheet">` → 改挂到子应用的
    `<qiankun-head>`（含对 applyStyleScope 之前已注入的存量前缀样式的收编）；
    卸载时搬回 `document.head` 并被前缀中和（作用域属性已摘，命中不了任何元素），
    保住 dev 模块缓存里的节点引用，二次挂载直接复用；
  - 动态插入 body 的元素（默认 Teleport 到 body 的弹窗等）→ 改挂到子应用
    根容器（`div#app`）内，天然落在作用域标记之下。

## 使用

```ts
// vite.config.ts
import { styleScope } from 'vite-plugin-style-scope'

export default defineConfig({
  plugins: [
    styleScope({ appName: 'sub-b' }), // 需与 qiankun 注册的 name 一致
  ],
})
```

```js
// 子应用入口
import { applyStyleScope } from 'virtual:style-scope'

const scope = applyStyleScope(rootEl)   // mount 时打标记 + 开启 DOM 劫持
scope.dispose()                          // unmount 时还原劫持并清理
```

弹窗组件无需任何特殊配置：`append-to-body` / Teleport 到 body 的弹窗会被
插件的 body 劫持重定向进作用域容器，前缀样式直接命中。

完整的 qiankun 子应用入口（配合 vite-plugin-qiankun）：

```js
// main.js
import { createApp } from 'vue'
import { qiankunWindow, renderWithQiankun } from 'vite-plugin-qiankun/dist/helper'
import { applyStyleScope } from 'virtual:style-scope'
import App from './App.vue'

let app = null
let scope = null

function render(container) {
  const root = container ? container.querySelector('#app') : document.getElementById('app')
  scope = applyStyleScope(root) // qiankun 环境下自动接管 head / body 动态插入
  app = createApp(App)
  app.mount(root)
}

if (qiankunWindow.__POWERED_BY_QIANKUN__) {
  renderWithQiankun({
    bootstrap() {},
    mount(props) { render(props.container) },
    update() {},
    unmount() {
      app?.unmount()
      scope?.dispose()
      app = scope = null
    },
  })
}
else {
  render()
}
```

TypeScript 项目在 `env.d.ts` 中补一行即可获得虚拟模块类型：

```ts
/// <reference types="vite-plugin-style-scope/client" />
```

## 与 `<style scoped>` 配合

插件与 Vue scoped 样式**共存且互补**：scoped 负责组件内部隔离，
本插件负责 scoped 覆盖不到的全局样式（reset、body、第三方覆盖样式等）。

```vue
<template>
  <div class="demo-card">
    <h2 class="title">卡片标题</h2>
  </div>
</template>

<!-- scoped：编译成 .title[data-v-xxx]，再叠加本插件前缀 -->
<style scoped>
.title {
  color: #409eff;
}
</style>

<!-- 非 scoped 全局样式：正是本插件要隔离的对象 -->
<style>
.demo-card {
  border-radius: 8px;
}
</style>
```

转换结果：

```css
/* scoped 块：前缀权重为 0，.title[data-v-xxx] 的优先级不受影响 */
:where([data-qiankun="sub-b"]) .title[data-v-7ba5bd90] { color: #409eff; }

/* 全局块：只在子应用容器内命中，不再泄漏到主应用 */
:where([data-qiankun="sub-b"]) .demo-card { border-radius: 8px; }
```

关键点：前缀是 `:where()` 包裹的，权重恒为 0——即使全局块和 scoped 块
选择器相同，两者的优先级关系与不加插件时完全一致，不会出现
「加了隔离反而压过 scoped 样式」的问题。

## Vite 兼容性

| 场景 | 是否支持 | 说明 |
| --- | --- | --- |
| Vite 4 / 5 / 6 / 7 | ✅ | 只用 `config` / `resolveId` / `load` 三个稳定钩子与 `css.postcss` 注入 |
| `vite dev`（开发态） | ✅ | PostCSS 在 serve 阶段同样生效；HMR 更新的样式已带前缀 |
| `vite build`（生产态） | ✅ | 抽取出的 CSS 文件同样带前缀 |
| vite-plugin-qiankun | ✅ | 插件顺序无要求；`useDevMode: true` 下动态注入的 `<style>` 会被劫持进 `<qiankun-head>` |
| 子应用独立运行 | ✅ | 检测不到 `<qiankun-head>` 时自动跳过 DOM 劫持，改为给 body 兜底打标记，前缀样式正常命中 |

## DOM 动态插入劫持（patchDom）

vite-plugin-qiankun 的 ESM 脚本不经过 import-html-entry，qiankun 沙箱
对动态样式/弹窗的接管打不到它们。本插件在 `applyStyleScope()` 时补上同款劫持：

| 原本挂载位置 | 劫持后挂载位置 | 收益 |
| --- | --- | --- |
| `document.head`（动态 `<style>` / `<link rel="stylesheet">`） | 子应用 `<qiankun-head>` | 挂载期间归属清晰；卸载时搬回 head 并被前缀中和，二次挂载直接复用 |
| `document.body`（Teleport 弹窗等元素） | 子应用根容器 `div#app` | 弹窗 DOM 落在作用域标记内，前缀样式直接命中 |

- 存量收编：`applyStyleScope()` 之前由模块求值注入的本应用前缀样式
  （凭样式文本里的 `[data-qiankun="<appName>"]` 识别）会被一并搬进
  `<qiankun-head>`；未加前缀的 node_modules 样式可能与主应用共享，不动；

- 仅当检测到 `<qiankun-head>`（即运行在 qiankun 内）时才开启，独立运行零开销
  （此时改为给 body 兜底打作用域标记，Teleport 到 body 的弹窗同样命中）；
- 只覆盖 `document.head` / `document.body` 的**实例方法**，不污染 `Node.prototype`；
- `dispose()` 时完整还原，主应用与其他子应用不受影响；
- `<script>` 不重定向；
- 关闭方式：插件级 `styleScope({ appName, patchDom: false })`，
  或调用级 `applyStyleScope(root, { patchDom: false })`。

> 注意：劫持生效期间，主应用往 `document.body` 动态追加的**元素**也会被
> 重定向进子应用容器（与 qiankun 沙箱的单实例劫持行为一致）。若主应用在
> 子应用存活期间有此类操作，请用 `patchDom: false` 关闭。

## 选项

| 选项 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `appName` | `string` | 必填 | 子应用名，作为作用域属性的值，需与 qiankun 注册的 name 一致 |
| `includeDeps` | `boolean` | `false` | 是否给 node_modules 里的样式也加前缀（组件库冲突建议用 namespace / prefixCls 根治） |
| `patchDom` | `boolean` | `true` | qiankun 环境下是否劫持 head / body 动态插入（详见上文） |
| `scopeAttr` | `string` | `'data-qiankun'` | 扩展选项：自定义作用域属性名。默认复用 qiankun `experimentalStyleIsolation` 打在包裹节点上的 `data-qiankun` 属性，仅在需要避开 qiankun 语义时才自定义 |

> 本插件不提供逃逸出口（如 `:global` / 跳过前缀的注释）：它的定位是
> 兜住子应用**全部**全局样式不外泄。真正需要全局生效的样式（如引导层、
> 全局 loading）应由主应用统一提供，而不是从子应用里逃逸出去。

## 已处理的坑

1. `@keyframes` 内的 `from / to / 50%` 不加前缀，避免动画静默失效；
2. `:root` / `html` / `body` 映射到容器本身（保留 `0,1,0` 权重，CSS 变量不丢作用域）；
   `:root .foo`、`body .foo`、`html.dark .foo` 等打头写法也已正确处理；
3. node_modules 样式默认不动，交给组件库 namespace 方案；
4. 注意：本插件通过 `css.postcss` 注入内联 PostCSS 配置，会使项目根目录的
   `postcss.config.js` 文件被 Vite 忽略，如有自定义 PostCSS 插件请通过
   Vite 配置的 `css.postcss.plugins` 合并。
