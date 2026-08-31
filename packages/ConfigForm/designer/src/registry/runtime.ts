import type { FieldNode, RegistryContractSnapshot } from '@moluoxixi/config-form-model'
import type {
  CanonicalRuntimeFieldNode,
  VueRuntimeBindingResolver,
} from '@moluoxixi/config-form-vue-backend'
import type { DesignerRegistry } from './types'

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
): VueRuntimeBindingResolver {
  const contracts = new Map(contractSnapshot.components.map(component => [component.key, component]))
  return {
    components: registry.components,
    resolveBinding(component) {
      const material = registry.getMaterial(component)
      const contract = contracts.get(component)
      if (!material || !contract)
        return undefined
      return {
        component: material.runtime.component,
        contractFingerprint: contract.fingerprint,
        contractVersion: contract.contractVersion,
        kind: material.kind,
        ...(material.runtime.valueProp ? { valueProp: material.runtime.valueProp } : {}),
        ...(material.runtime.trigger ? { trigger: material.runtime.trigger } : {}),
        ...(material.runtime.blurTrigger ? { blurTrigger: material.runtime.blurTrigger } : {}),
        ...(material.runtime.getValueFromEvent
          ? { getValueFromEvent: material.runtime.getValueFromEvent }
          : {}),
        ...(material.kind === 'field' && material.runtime.readonlyRender
          ? {
              readonlyRender: ({ componentProps, model, node, value }) => (
                material.runtime.readonlyRender!({
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
