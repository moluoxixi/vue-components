# @moluoxixi/config-form-source

ConfigForm Studio 的单向源码交付包。它提供两种彼此独立的源码文件集：

- `generateVueSource` 默认生成直接使用 Vue、Vue Router 与目标 UI 组件的原始工程源码，
  不依赖 ConfigForm；页面、Dialog/Drawer、校验和本地 Demo 交互都是可直接修改的应用代码。
- `generateConfigFormBindings` 生成通过公开 ConfigForm adapter、Headless model 与配置绑定
  组合 Surface 的配置源码，入口是 `src/bindings.ts`。它不生成 App、main、router、页面
  历史、浮层宿主或 session reducer，应用编排由接手代码的程序员负责。

两种产物都不会生成 `src/runtime/**`，也不会复制 Compiler、Prototype Runtime、session
reducer、通用 overlay host、事件注册表或业务函数桩。生成结果是单向交付物，编辑后的
源码不回导 Studio。

## 安装

```bash
pnpm add @moluoxixi/config-form-source
```

只使用 Generator 时不需要浏览器或 DOM。使用 Viewer 的应用还需提供 Vue 3：

```bash
pnpm add vue
```

## Generator

```ts
import { generateConfigFormBindings, generateVueSource } from '@moluoxixi/config-form-source/generator'

const rawSource = await generateVueSource({
  compilation,
  componentResolver,
  resourceReader,
})

const configBindings = await generateConfigFormBindings({
  compilation,
  componentResolver,
  bindingResolver,
  resourceReader,
})
```

`SourceComponentResolver` 由 Studio 组合根根据锁定的 adapter 身份提供组件 import、
目标 UI 包、样式，以及 Material 语义触发器到 provider 事件/listener prop 的固定投影。
Raw 输入只接收这个 resolver，不感知 ConfigForm binding。`SourceConfigFormBindingResolver`
独立提供公开 ConfigForm adapter 与 model import，仅在调用 `generateConfigFormBindings` 时
传入；两者不保留合并 resolver 或兼容别名。语义投影只用于生成代码，不是事件编辑或
事件转发：普通激活不携带组件参数，row/item 激活只读取 provider 明确声明的一个 item
参数。

resolver 返回的组件、Binding 与样式裸包导入都必须在对应 `dependencies` 中声明可发布
版本；缺失声明会在生成阶段 fail closed，而不是把错误推迟到导出工程安装时。Raw 项目
的运行依赖严格限制为 `vue`、`vue-router` 和当前 resolver 的一个目标 UI 包，全部生成
源码与清单都禁止 `@moluoxixi/*`、`@config-form/*` 和 Zod。
`SourceResourceReader` 只读取指定 project/resource/hash 的 embedded bytes。Generator
自己校验长度与 SHA-256，并以 canonical base64 输出 binary 文件。URL Resource 保持
静态引用，不读取 bytes，也不发起网络请求。

Generator 会在组装文件前严格解析并预编译每个 Canonical RuleSet v2。Raw 为每个
Surface 生成一个可读的 `validation.ts`，其中是字段级直接校验函数，不包含 RuleSet
解释器、Zod、ConfigForm Runtime 或内部包 import。Required/Required message 来自字段
一级合同，动态 Required 在 Surface 中覆盖静态基线；`validateOn` 继续控制 change、blur
和 submit 调度。非法规则、非法正则/日期/类型或 custom validator 会让对应 API fail
closed，不返回部分文件集。ConfigForm binding 则保留 RuleSet v2 配置编译以及字段级
Required，不复制运行核心。初始值只从
Canonical scoped fields/value scopes 建立，不猜测空值或 provider 默认值。嵌套 scope 的
初始值和字段渲染会保留；如果交互需要当前生成器尚未提供的 address-scoped 联动、投影或
结果写回，生成同样 fail closed，避免把不同数组行错误地合并到 root values。

成功结果分别是 `RawSourceFileSetV1` 与 `ConfigBindingFileSetV1`。两者都包含稳定排序、
安全项目相对路径的 text/binary 文件，以及指向现有文本文件的 `entry`。任一解析或资源
校验失败都会返回 diagnostics，不会返回部分文件集。

## Viewer

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ConfigFormSourceViewer } from '@moluoxixi/config-form-source/viewer'
import '@moluoxixi/config-form-source/viewer/style'

const selectedPath = ref(fileSet.entry)
</script>

<template>
  <ConfigFormSourceViewer v-model:selected-path="selectedPath" :files="fileSet" theme="dark" />
</template>
```

Viewer 只负责左侧文件树和右侧只读源码展示；窄屏使用 tree/code 切换。`selectedPath`
是必填受控状态，binary 文件不会初始化 Monaco。弹窗、刷新、复制、下载、ZIP、通知和
持久化由宿主应用负责。

## 公开入口

- `@moluoxixi/config-form-source`：DOM-free Generator 合同与实现。
- `@moluoxixi/config-form-source/generator`：显式 Generator 入口。
- `@moluoxixi/config-form-source/viewer`：只读 Vue Viewer。
- `@moluoxixi/config-form-source/viewer/style`：Viewer 样式。

## 验证

```bash
pnpm --filter @moluoxixi/config-form-source test
pnpm --filter @moluoxixi/config-form-source typecheck
pnpm --filter @moluoxixi/config-form-source build
```
