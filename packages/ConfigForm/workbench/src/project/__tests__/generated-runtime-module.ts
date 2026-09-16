import { posix } from 'node:path'
import { runInThisContext } from 'node:vm'
import * as Lucide from '@lucide/vue'
import { getConfigFormRuntimeSources } from '@moluoxixi/config-form-compiler'
import * as ConfigFormVueBackend from '@moluoxixi/config-form-vue-backend'
import * as Rules from '@moluoxixi/zod3-to-rule'
import { compileScript, parse } from '@vue/compiler-sfc'
import { transformWithEsbuild } from 'vite'
import * as Vue from 'vue'
import * as Zod from 'zod'

/** Compile and execute the actual generated TS/SFC import closure, with only external dependencies supplied by the host. */
export async function createGeneratedModuleLoader(inputs: Readonly<Record<string, string>>) {
  const compiled = new Map(await Promise.all(Object.entries(inputs)
    .filter(([path]) => /\.(?:ts|vue)$/.test(path) && !path.endsWith('.d.ts'))
    .map(async ([path, text]) => {
      let source = text
      if (path.endsWith('.vue')) {
        const { descriptor, errors } = parse(text, { filename: path })
        if (errors.length)
          throw new Error(`Invalid generated SFC ${path}: ${errors.join('; ')}`)
        source = compileScript(descriptor, {
          id: path,
          inlineTemplate: true,
          fs: {
            fileExists: file => Object.hasOwn(inputs, posix.normalize(file.replaceAll('\\', '/'))),
            readFile: file => inputs[posix.normalize(file.replaceAll('\\', '/'))],
          },
        }).content
      }
      const result = await transformWithEsbuild(source, path, { loader: 'ts', format: 'cjs', target: 'es2022' })
      return [path, result.code] as const
    })))
  const externals: Record<string, unknown> = {
    'vue': Vue,
    'zod': Zod,
    '@lucide/vue': Lucide,
    '@moluoxixi/config-form-vue-backend': ConfigFormVueBackend,
    '@moluoxixi/zod3-to-rule': Rules,
  }
  const cache = new Map<string, { exports: Record<string, any> }>()
  function load(path: string): Record<string, any> {
    const existing = cache.get(path)
    if (existing)
      return existing.exports
    const code = compiled.get(path)
    if (!code)
      throw new Error(`Missing generated runtime module: ${path}`)
    const module = { exports: {} }
    cache.set(path, module)
    const require = (specifier: string): unknown => {
      if (Object.hasOwn(externals, specifier))
        return externals[specifier]
      if (!specifier.startsWith('.'))
        throw new Error(`Unexpected generated dependency: ${specifier} in ${path}`)
      const relative = posix.normalize(posix.join(posix.dirname(path), specifier))
      const target = [relative, `${relative}.ts`, `${relative}/index.ts`].find(candidate => compiled.has(candidate))
      if (!target)
        throw new Error(`Unexpected generated import: ${specifier} in ${path}`)
      return load(target)
    }
    runInThisContext(`(function(require, module, exports) {\n${code}\n})`, { filename: path })(require, module, module.exports)
    return module.exports
  }
  return load
}

export async function evaluateGeneratedRuntimeModule(source: string): Promise<Record<string, any>> {
  const load = await createGeneratedModuleLoader({
    'src/pages/home/flows.ts': source,
    ...Object.fromEntries(Object.entries(getConfigFormRuntimeSources()).map(([path, text]) => [`src/runtime/${path}`, text])),
  })
  return { ...load('src/runtime/flow/index.ts'), ...load('src/pages/home/flows.ts') }
}
