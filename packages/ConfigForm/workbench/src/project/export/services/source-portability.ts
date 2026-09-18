import type { ModelJsonObject } from '@moluoxixi/config-form-model'
import type { StandaloneSourceNode, StandaloneSourceRegistry } from '../types/source'
import { resolveSourceComponentDefinition } from './source-registry'

const DOM_SINK_PROPS = new Set(['dangerouslySetInnerHTML', 'innerHTML', 'innerText', 'outerHTML', 'textContent'])

function assertPortableProps(node: StandaloneSourceNode, props: ModelJsonObject): void {
  for (const key of Object.keys(props)) {
    if (DOM_SINK_PROPS.has(key))
      throw new Error(`Node "${node.id}" uses blocked DOM sink prop "${key}" in standalone Source.`)
  }
}

export function assertPortableNode(node: StandaloneSourceNode, registry: StandaloneSourceRegistry): void {
  const definition = resolveSourceComponentDefinition(node, registry)
  assertPortableProps(node, node.props)
  const bindingNames = new Set(definition.bindings.map(binding => binding.name))
  for (const [bindingName, binding] of Object.entries(node.bindings)) {
    if (!bindingNames.has(bindingName))
      throw new Error(`Node "${node.id}" uses unregistered binding "${bindingName}".`)
    if (typeof binding.source !== 'string' || !binding.source.trim())
      throw new Error(`Node "${node.id}" binding "${bindingName}" contains an invalid source ref.`)
  }
  if (node.kind === 'layout')
    Object.values(node.slots).forEach(children => children.forEach(child => assertPortableNode(child, registry)))
}
