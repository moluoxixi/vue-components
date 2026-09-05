import type {
  StandaloneSourceComponentDefinition,
  StandaloneSourceNode,
  StandaloneSourceRegistry,
} from '../types/source'

export function resolveSourceComponentDefinition(
  node: StandaloneSourceNode,
  registry: StandaloneSourceRegistry,
): StandaloneSourceComponentDefinition {
  const definition = registry.get(node.component)
  if (!definition)
    throw new Error(`Component "${node.component}" is not registered and cannot be exported.`)
  return definition
}
