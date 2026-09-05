import type { CanonicalSourceLibraryBinding } from '../types'
import type { StandaloneSourceNode, StandaloneSourceRegistry } from '../types/source'
import { resolveSourceComponentDefinition } from './source-registry'

export function collectSourceLibraries(
  nodes: StandaloneSourceNode[],
  registry: StandaloneSourceRegistry,
  target = new Map<string, CanonicalSourceLibraryBinding>(),
): Map<string, CanonicalSourceLibraryBinding> {
  for (const node of nodes) {
    const library = resolveSourceComponentDefinition(node, registry).binding.library
    if (library) {
      const existing = target.get(library.packageName)
      if (existing && (
        existing.plugin !== library.plugin
        || existing.stylesheet !== library.stylesheet
        || existing.version !== library.version
      )) {
        throw new Error(`Source library "${library.packageName}" has conflicting plugin bindings.`)
      }
      target.set(library.packageName, structuredClone(library))
    }
    if (node.kind === 'layout')
      Object.values(node.slots).forEach(children => collectSourceLibraries(children, registry, target))
  }
  return target
}
