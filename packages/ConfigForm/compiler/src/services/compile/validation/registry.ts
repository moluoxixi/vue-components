import type { ProjectDocument, ProjectPage, RegistryContractSnapshot } from '@moluoxixi/config-form-model'
import type { SemanticCompilerDiagnostic } from '../../../types'

export function validateRegistryLock(
  project: ProjectDocument,
  registry: RegistryContractSnapshot,
  diagnostics: SemanticCompilerDiagnostic[],
  pages: readonly ProjectPage[] = Object.values(project.pagesById),
): void {
  if (project.registryLock.adapter !== registry.adapter) {
    diagnostics.push({
      code: 'COMPILER_REGISTRY_ADAPTER_MISMATCH',
      message: 'Project registry adapter does not match the compiler registry snapshot.',
      path: ['registryLock', 'adapter'],
    })
    return
  }

  const contracts = new Map(registry.components.map(component => [component.key, component]))
  const usedComponents = new Map<string, { nodeId: string, pageId: string }>()
  pages.forEach((page) => {
    Object.values(page.graph.nodesById).forEach((node) => {
      if (!usedComponents.has(node.component))
        usedComponents.set(node.component, { nodeId: node.id, pageId: page.id })
    })
  })
  for (const [component, location] of [...usedComponents].sort(([left], [right]) => left.localeCompare(right))) {
    const expected = project.registryLock.components[component]
    const actual = contracts.get(component)
    if (!expected) {
      diagnostics.push({
        code: 'COMPILER_REGISTRY_COMPONENT_LOCK_MISSING',
        message: `Project registry lock does not contain component: ${component}`,
        ...location,
        path: ['registryLock', 'components', component],
      })
      continue
    }
    if (!actual) {
      diagnostics.push({
        code: 'COMPILER_COMPONENT_UNKNOWN',
        message: `Component is not present in the registry snapshot: ${component}`,
        ...location,
        path: ['registryLock', 'components', component],
      })
      continue
    }
    if (expected.contractVersion !== actual.contractVersion) {
      diagnostics.push({
        code: 'COMPILER_REGISTRY_COMPONENT_VERSION_MISMATCH',
        message: `Component contract version does not match for ${component}: expected ${expected.contractVersion}, received ${actual.contractVersion}.`,
        ...location,
        path: ['registryLock', 'components', component, 'contractVersion'],
      })
    }
    if (expected.fingerprint !== actual.fingerprint) {
      diagnostics.push({
        code: 'COMPILER_REGISTRY_COMPONENT_FINGERPRINT_MISMATCH',
        message: `Component contract fingerprint does not match for ${component}.`,
        ...location,
        path: ['registryLock', 'components', component, 'fingerprint'],
      })
    }
  }
}
