export const elementPlusDocsReplAppFile = 'src/App.vue'
export const elementPlusDocsReplDeclarationsFile = 'src/component-library.d.ts'
export const elementPlusDocsReplImportMapFile = 'import-map.json'
export const elementPlusDocsReplMainFile = 'src/PlaygroundMain.vue'
export const elementPlusDocsReplSetupFile = 'src/element-plus.js'
export const elementPlusDocsReplTsconfigFile = 'tsconfig.json'

export const elementPlusDocsReplMainSource = `<script setup>
import App from './App.vue'
import { setupElementPlus } from './element-plus.js'

setupElementPlus()
<\/script>

<template>
  <App />
</template>
`

export const elementPlusDocsReplSetupSource = `import { install as installElementPlus } from 'element-plus'
import { getCurrentInstance } from 'vue'

let installed = false

export function setupElementPlus() {
  if (installed)
    return
  const instance = getCurrentInstance()
  if (!instance)
    return
  const app = instance.appContext.app
  if (typeof installElementPlus !== 'function')
    throw new TypeError('The configured Element Plus module does not export install().')
  app.use({ install: installElementPlus })
  installed = true
}
`

export const elementPlusDocsReplTsconfigSource = `{
  "compilerOptions": {
    "allowJs": true,
    "allowImportingTsExtensions": true,
    "checkJs": true,
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ESNext",
    "types": ["element-plus/global"]
  },
  "vueCompilerOptions": {
    "target": 3.5
  }
}
`

export function createElementPlusDocsReplDeclarations(packageName: string): string {
  return `declare module ${JSON.stringify(packageName)}\n`
}
