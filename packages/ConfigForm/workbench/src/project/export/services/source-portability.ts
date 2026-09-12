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
  const eventNames = new Set(definition.events.map(event => event.name))
  for (const [eventName, actions] of Object.entries(node.events)) {
    if (!eventNames.has(eventName))
      throw new Error(`Node "${node.id}" uses unregistered event "${eventName}".`)
    if (actions.some(action => typeof action.action !== 'string' || !action.action.trim()))
      throw new Error(`Node "${node.id}" event "${eventName}" contains an invalid action ref.`)
  }
  const unknownFlowEvent = node.flowEvents.find(eventName => !eventNames.has(eventName))
  if (unknownFlowEvent)
    throw new Error(`Node "${node.id}" Flow uses unregistered event "${unknownFlowEvent}".`)

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
