import type { CanonicalPageIR } from '@moluoxixi/config-form-compiler'
import type {
  CanonicalSourceBindingResolver,
  SourceActionBindingDiagnostic,
  SourceActionBindings,
} from '../types'
import { listWorkbenchRendererBuiltinActionDescriptors } from '../../../flow'
import { listConfigFormBuiltinFlowActionDescriptors } from '@moluoxixi/config-form-core'
import { createStandaloneDataSourceRequestSource } from './source-flow'
import { scriptJson } from './source-serialization'

export class SourceActionBindingError extends Error {
  constructor(readonly diagnostic: SourceActionBindingDiagnostic) {
    super(diagnostic.message)
    this.name = 'SourceActionBindingError'
  }
}

const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
const EXPORT_NAME = /^(?:default|[A-Z_$][\w$]*)$/i
const LOCAL_MODULE = /^src\/actions\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.ts$/i

/** Validate every binding before writing any generated project file. */
export function collectSourceActionBindings(
  pages: readonly Pick<CanonicalPageIR, 'id' | 'flows'>[],
  resolver: CanonicalSourceBindingResolver,
): SourceActionBindings {
  const builtins = new Set([
    ...listConfigFormBuiltinFlowActionDescriptors(),
    ...listWorkbenchRendererBuiltinActionDescriptors(),
  ].map(action => action.ref))
  const files: Record<string, string> = Object.create(null)
  const fileNames = new Map<string, string>()
  const dependencies: Record<string, string> = Object.create(null)
  const refs = new Set<string>()
  const entries: string[] = []
  const imports: string[] = []
  for (const page of pages) {
    for (const { plan } of page.flows) {
      for (const [nodeIndex, node] of plan.nodes.entries()) {
        if (node.type !== 'action' || !node.ref || builtins.has(node.ref) || refs.has(node.ref))
          continue
        function fail(code: string, message: string): never {
          throw new SourceActionBindingError({
            code,
            message,
            pageId: page.id,
            flowId: plan.flowId,
            nodeId: node.id,
            path: ['pagesById', page.id, 'flows', plan.flowId, 'nodes', nodeIndex, 'ref'],
          })
        }
        const binding = resolver.resolveAction?.(node.ref)
        if (!binding)
          fail('SOURCE_ACTION_BINDING_MISSING', `Action "${node.ref}" has no standalone Source binding (page "${page.id}", flow "${plan.flowId}", step "${node.id}").`)
        if (!EXPORT_NAME.test(binding.exportName))
          fail('SOURCE_ACTION_EXPORT_INVALID', `Action "${node.ref}" requires a valid exported function name.`)
        const addDependency = (name: string, version: string): void => {
          if (!PACKAGE_NAME.test(name) || ['__proto__', 'constructor', 'prototype'].includes(name)
            || !version.trim() || /^(?:workspace:|catalog:|file:|link:)/.test(version)) {
            fail('SOURCE_ACTION_DEPENDENCY_INVALID', `Action "${node.ref}" dependency "${name}" requires a portable version.`)
          }
          if (Object.hasOwn(dependencies, name) && dependencies[name] !== version)
            fail('SOURCE_ACTION_DEPENDENCY_CONFLICT', `Actions require conflicting versions of "${name}".`)
          dependencies[name] = version
        }
        let specifier: string
        if (binding.module.kind === 'package') {
          const { packageName, specifier: declaredSpecifier, version } = binding.module
          if ((declaredSpecifier !== packageName && !declaredSpecifier.startsWith(`${packageName}/`))
            || declaredSpecifier.split('/').some(segment => segment === '..' || segment === '.')
            || /[\\\s?#]/.test(declaredSpecifier)) {
            fail('SOURCE_ACTION_MODULE_INVALID', `Action "${node.ref}" module must belong to its declared package.`)
          }
          addDependency(packageName, version)
          specifier = declaredSpecifier
        }
        else {
          const { path, content } = binding.module
          if (!LOCAL_MODULE.test(path) || path.toLowerCase() === 'src/actions/index.ts' || typeof content !== 'string' || !content.trim())
            fail('SOURCE_ACTION_MODULE_INVALID', `Action "${node.ref}" requires a nonempty TypeScript module under src/actions/.`)
          const previousPath = fileNames.get(path.toLowerCase())
          if ((previousPath && previousPath !== path) || (Object.hasOwn(files, path) && files[path] !== content))
            fail('SOURCE_ACTION_MODULE_CONFLICT', `Actions provide conflicting source files for "${path}".`)
          fileNames.set(path.toLowerCase(), path)
          files[path] = content
          specifier = `./${path.slice('src/actions/'.length, -'.ts'.length)}`
        }
        Object.entries(binding.dependencies ?? {}).forEach(([name, version]) => addDependency(name, version))
        const local = `action${entries.length}`
        imports.push(binding.exportName === 'default'
          ? `import ${local} from ${JSON.stringify(specifier)}`
          : `import { ${binding.exportName} as ${local} } from ${JSON.stringify(specifier)}`)
        entries.push(`  ${JSON.stringify(node.ref)}: { execute: ${local} },`)
        refs.add(node.ref)
      }
    }
  }
  return {
    files,
    dependencies,
    refs: [...refs],
    module: [
      "import type { ConfigFormFlowAction, ConfigFormFlowActionHost, ConfigFormFlowActionRegistry } from '../runtime/flow'",
      "import { createConfigFormBuiltinFlowActions, createConfigFormFlowActionRegistry } from '../runtime/flow'",
      ...imports,
      '',
      createStandaloneDataSourceRequestSource(),
      '',
      'export interface SourceFlowActionHost extends ConfigFormFlowActionHost {',
      '  notify?: (message: string, input: unknown) => void | Promise<void>',
      '}',
      '',
      'export const sourceFlowActions: Record<string, ConfigFormFlowAction> = {',
      ...entries,
      '}',
      '',
      'export function createSourceFlowActions(host: SourceFlowActionHost = {}): ConfigFormFlowActionRegistry {',
      "  const notify: ConfigFormFlowAction = { execute: async (input) => {",
      "    const message = typeof input === 'string' ? input : JSON.stringify(input) ?? String(input)",
      "    if (!host.notify) throw new Error('The notify action requires an explicit host capability.')",
      '    await host.notify(message, input)',
      '    return { notified: message }',
      '  } }',
      '  return createConfigFormFlowActionRegistry(',
      '    createConfigFormBuiltinFlowActions(host),',
      "    { notify },",
      '    sourceFlowActions,',
      '  )',
      '}',
      '',
      `export const requiredActionBindings = ${scriptJson([...refs])} as const`,
      '',
    ].join('\n'),
  }
}
