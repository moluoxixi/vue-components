# Getting Started

## Install

```bash
pnpm add @moluoxixi/components element-plus
```

## Use a component

```ts
import { CopyText } from '@moluoxixi/components'
import '@moluoxixi/components/styles'
```

Component pages combine optional handwritten examples with generated API contracts. When an English source fragment is unavailable, the English route still provides the component description, API, component contributors, and a changelog dialog from the fixed page metadata.

## Automatic imports

```bash
pnpm add -D unplugin-auto-import unplugin-vue-components
```

```ts
// vite.config.ts
import { autoComponent, autoImport } from '@moluoxixi/components/auto-loaders'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

export default {
  plugins: [
    AutoImport({ imports: [autoImport] }),
    Components({ resolvers: [autoComponent] }),
  ],
}
```

`autoComponent` resolves public components and their shared stylesheet. `autoImport` covers runtime helpers such as `defineFields`, `copyText`, and `useHeadlessTable`; TypeScript types remain explicit `import type` declarations.
