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
  if (node.kind === 'layout')
    Object.values(node.slots).forEach(children => children.forEach(child => assertPortableNode(child, registry)))
}
