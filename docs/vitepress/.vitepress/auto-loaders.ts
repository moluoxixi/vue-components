import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { autoComponent, autoImport } from '@moluoxixi/components-auto-loaders'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const docsSourceRootPattern = resolve(__dirname, '..')
  .split(/[\\/]+/)
  .map(segment => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('[\\\\/]')

const autoImportIncludes = [new RegExp(`${docsSourceRootPattern}[\\\\/].*(?:\\.[jt]sx?|\\.vue(?:\\?vue.*)?|\\.md(?:\\?.*)?)$`)]
const componentIncludes = [new RegExp(`${docsSourceRootPattern}[\\\\/].*(?:\\.vue(?:\\?vue.*)?|\\.md(?:\\?.*)?)$`)]

export function createComponentAutoLoadPlugins() {
  return [
    AutoImport({
      dts: resolve(__dirname, 'auto-imports.d.ts'),
      imports: [autoImport],
      include: autoImportIncludes,
    }),
    Components({
      dts: resolve(__dirname, 'components.d.ts'),
      include: componentIncludes,
      resolvers: [autoComponent, ElementPlusResolver()],
    }),
  ]
}
