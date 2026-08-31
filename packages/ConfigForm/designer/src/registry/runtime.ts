import type { FieldNode, RegistryContractSnapshot } from '@moluoxixi/config-form-model'
import type {
  CanonicalRuntimeFieldNode,
  VueRuntimeBindingResolver,
} from '@moluoxixi/config-form-vue-backend'
import type { DesignerMaterialCapabilityRegistry, DesignerRegistry } from './types'

function toFieldNode(node: CanonicalRuntimeFieldNode): FieldNode {
  return {
    id: node.id,
    component: node.component,
    kind: 'field',
    field: node.field,
    props: structuredClone(node.configuredProps) as FieldNode['props'],
    events: structuredClone(node.events) as FieldNode['events'],
    bindings: structuredClone(node.bindings) as FieldNode['bindings'],
    ...(node.extensions ? { extensions: structuredClone(node.extensions) as FieldNode['extensions'] } : {}),
    ...(node.conditions ? { conditions: structuredClone(node.conditions) as FieldNode['conditions'] } : {}),
    ...(node.reactions ? { reactions: structuredClone(node.reactions) as FieldNode['reactions'] } : {}),
    ...(node.label === undefined ? {} : { label: node.label }),
    ...(node.defaultValue === undefined ? {} : { defaultValue: structuredClone(node.defaultValue) }),
    ...(node.validation === undefined ? {} : { validation: structuredClone(node.validation) }),
    ...(node.validateOn === undefined ? {} : { validateOn: structuredClone(node.validateOn) }),
  } as FieldNode
}

export function createDesignerVueRuntimeResolver(
  registry: DesignerRegistry,
  contractSnapshot: RegistryContractSnapshot,
  capabilities: DesignerMaterialCapabilityRegistry,
): VueRuntimeBindingResolver {
  const contracts = new Map(contractSnapshot.components.map(component => [component.key, component]))
  return {
    components: registry.components,
    resolveBinding(component) {
      const capability = capabilities.get(component)
      const contract = contracts.get(component)
      if (!capability || !contract)
        return undefined
      const runtime = capability.runtime.binding
      return {
        component: runtime.component,
        contractFingerprint: contract.fingerprint,
        contractVersion: contract.contractVersion,
        kind: capability.runtime.kind,
        ...(runtime.valueProp ? { valueProp: runtime.valueProp } : {}),
        ...(runtime.trigger ? { trigger: runtime.trigger } : {}),
        ...(runtime.blurTrigger ? { blurTrigger: runtime.blurTrigger } : {}),
        ...(runtime.getValueFromEvent
          ? { getValueFromEvent: runtime.getValueFromEvent }
          : {}),
        ...(capability.runtime.kind === 'field' && runtime.readonlyRender
          ? {
              readonlyRender: ({ componentProps, model, node, value }) => (
                runtime.readonlyRender!({
                  componentProps,
                  model,
                  node: toFieldNode(node),
                  value,
                })
              ),
            }
          : {}),
      }
    },
    resolveValidator: key => registry.getValidator(key),
  }
}
