# @moluoxixi/config-form-source

ConfigForm Studio 的单向源码交付包。它提供两种彼此独立的源码文件集：

- `generateVueSource` 默认生成直接使用 Vue、Vue Router 与目标 UI 组件的原始工程源码，
  不依赖 ConfigForm。
- `generateConfigFormBindings` 生成通过公开 ConfigForm adapter、Headless model 与配置绑定
  组合页面的工程源码。

两种产物都不会生成 `src/runtime/**`，也不会复制 Compiler、Prototype Runtime、session
reducer、overlay host、事件注册表或业务函数桩。生成结果是单向交付物，编辑后的源码不
回导 Studio。

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
import {
  generateConfigFormBindings,
  generateVueSource,
} from '@moluoxixi/config-form-source/generator'

const rawSource = await generateVueSource({
  compilation,
  providerResolver,
  resourceReader,
})

const configBindings = await generateConfigFormBindings({
  compilation,
  providerResolver,
  resourceReader,
})
```

`SourceProviderResolver` 由 Studio 组合根根据锁定的 adapter 身份同步提供组件 import、
样式和依赖信息；`SourceResourceReader` 只读取指定 project/resource/hash 的 embedded
bytes。Generator 自己校验长度与 SHA-256，并以 canonical base64 输出 binary 文件。
URL Resource 保持静态引用，不读取 bytes，也不发起网络请求。

成功结果分别是 `RawSourceFileSetV1` 与 `ConfigBindingFileSetV1`。两者都包含稳定排序、
安全项目相对路径的 text/binary 文件，以及指向现有文本文件的 `entry`。任一解析或资源
校验失败都会返回 diagnostics，不会返回部分文件集。

## Viewer

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ConfigFormSourceViewer } from '@moluoxixi/config-form-source/viewer'
import '@moluoxixi/config-form-source/viewer/style'

const selectedPath = ref('src/main.ts')
</script>

<template>
  <ConfigFormSourceViewer
    v-model:selected-path="selectedPath"
    :files="fileSet"
    theme="dark"
  />
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
