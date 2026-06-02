import type { Plugin } from 'vite'
import type { ConfigFormDevtoolsPluginOptions } from './types'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createOpenInEditorMiddleware } from './openInEditor'
import { transformDefineFieldSource } from './sourceInject'

const VIRTUAL_CLIENT_ID = 'virtual:config-form-devtools/client'
const RESOLVED_VIRTUAL_CLIENT_ID = `\0${VIRTUAL_CLIENT_ID}`
const VIRTUAL_CONFIG_FORM_ID = 'virtual:config-form-devtools/config-form'
const RESOLVED_VIRTUAL_CONFIG_FORM_ID = `\0${VIRTUAL_CONFIG_FORM_ID}`
const PUBLIC_CLIENT_ID = `/@id/__x00__${VIRTUAL_CLIENT_ID}`

/** 将 Windows 路径分隔符转换为 Vite 模块 id 使用的 POSIX 形式。 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

/**
 * 解析插件运行时入口文件。
 *
 * 源码运行时指向 `.ts`，构建产物运行时指向 `.js`，保证本地和发布包都能加载。
 */
function resolvePackageEntry(metaUrl: string, baseName: string): string {
  const modulePath = fileURLToPath(metaUrl)
  const moduleDir = dirname(modulePath)
  const extension = normalizePath(modulePath).endsWith('/src/index.ts') ? 'ts' : 'js'
  return normalizePath(resolve(moduleDir, `${baseName}.${extension}`))
}

const CLIENT_ENTRY = resolvePackageEntry(import.meta.url, 'client')
const ADAPTER_ENTRY = resolvePackageEntry(import.meta.url, 'adapter')

/**
 * 判断模块是否需要注入 defineField 源码信息。
 *
 * 只处理项目源码中的 JS/TS/Vue 文件，跳过 query 模块和 node_modules。
 */
function shouldTransform(id: string): boolean {
  if (id.includes('?'))
    return false

  const cleanId = normalizePath(id.split('?')[0])
  return !cleanId.includes('/node_modules/')
    && /\.(?:[cm]?[jt]sx?|vue)$/.test(cleanId)
}

/**
 * 创建 ConfigForm devtools Vite 插件。
 *
 * 开发服务模式下会注入浏览器 overlay、把 ConfigForm import 重写到 devtools adapter、
 * 记录 defineField(...) 源码位置，并暴露 open-in-editor middleware。
 */
export function configFormDevtools(options: ConfigFormDevtoolsPluginOptions = {}): Plugin {
  const corePackageName = options.packageNames?.[0] ?? '@moluoxixi/config-form'

  return {
    apply: 'serve',
    enforce: 'pre',
    name: 'moluoxixi:config-form-devtools',
    /**
     * 注册 open-in-editor middleware。
     *
     * 路径固定在 devtools 私有端点，访问控制由 middleware 内部校验。
     */
    configureServer(server) {
      server.middlewares.use(
        '/__config-form-devtools/open',
        createOpenInEditorMiddleware({
          allowRoots: options.allowRoots,
          editor: options.editor,
          root: server.config.root,
        }),
      )
    },
    /**
     * 加载 devtools 虚拟模块。
     *
     * client 模块安装 overlay，config-form 模块把核心组件替换为 adapter 包装版本。
     */
    load(id) {
      if (id === RESOLVED_VIRTUAL_CLIENT_ID)
        return `import { installConfigFormDevtools } from ${JSON.stringify(CLIENT_ENTRY)};\ninstallConfigFormDevtools();`

      if (id === RESOLVED_VIRTUAL_CONFIG_FORM_ID) {
        return [
          `import { ConfigForm as CoreConfigForm } from ${JSON.stringify(corePackageName)};`,
          `import { collectFieldConfigs } from ${JSON.stringify(`${corePackageName}/plugins`)};`,
          `import { createDevtoolsConfigFormAdapter } from ${JSON.stringify(ADAPTER_ENTRY)};`,
          `export * from ${JSON.stringify(corePackageName)};`,
          'export const ConfigForm = createDevtoolsConfigFormAdapter({',
          '  ConfigForm: CoreConfigForm,',
          '  collectFieldConfigs,',
          '});',
        ].join('\n')
      }

      return null
    },
    /**
     * 解析 devtools 虚拟模块 id。
     *
     * 使用 `\0` 前缀阻止其他 Vite 插件继续按真实文件路径处理。
     */
    resolveId(id) {
      if (id === VIRTUAL_CLIENT_ID)
        return RESOLVED_VIRTUAL_CLIENT_ID
      if (id === VIRTUAL_CONFIG_FORM_ID)
        return RESOLVED_VIRTUAL_CONFIG_FORM_ID
      return null
    },
    /**
     * 转换业务源码以注入 source 元信息。
     *
     * 非目标文件返回 null，解析或注入失败时由 transformDefineFieldSource 抛错中断编译。
     */
    transform(code, id) {
      if (!shouldTransform(id))
        return null

      return transformDefineFieldSource({
        code,
        id,
        adapterModuleId: VIRTUAL_CONFIG_FORM_ID,
        packageNames: options.packageNames,
      })
    },
    /**
     * 向 HTML 注入 devtools client。
     *
     * pending 标记用于 adapter 在 client 加载前识别 devtools 即将可用。
     */
    transformIndexHtml() {
      return [
        {
          children: 'window.__CONFIG_FORM_DEVTOOLS_PENDING__ = true;',
          injectTo: 'head-prepend',
          tag: 'script',
        },
        {
          attrs: {
            src: PUBLIC_CLIENT_ID,
            type: 'module',
          },
          injectTo: 'head-prepend',
          tag: 'script',
        },
      ]
    },
  }
}

/** 保留给早期调用方的 configFormDevtools(...) 别名。 */
export const configFormDevtoolsVitePlugin = configFormDevtools
