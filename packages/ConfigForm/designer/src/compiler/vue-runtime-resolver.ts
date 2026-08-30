import type { RegistryContractSnapshot } from '@moluoxixi/config-form-model'
import type {
  CanonicalRuntimeFieldNode,
  VueRuntimeBindingResolver,
} from '@moluoxixi/config-form-vue-backend'
import type {
  DesignerFieldNode,
  DesignerJsonObject,
} from '../document'
import type { DesignerRegistry } from '../registry'

function toDesignerReadonlyNode(node: CanonicalRuntimeFieldNode): DesignerFieldNode {
  const span = node.placement.props.span
  return {
    id: node.id,
    material: node.component,
    kind: 'field',
    field: node.field,
    props: structuredClone(node.props) as DesignerJsonObject,
    ...(Object.keys(node.events).length > 0
      ? { events: structuredClone(node.events) as DesignerFieldNode['events'] }
      : {}),
    ...(Object.keys(node.bindings).length > 0
      ? { bindings: structuredClone(node.bindings) as DesignerFieldNode['bindings'] }
      : {}),
    ...(node.extensions
      ? { extensions: structuredClone(node.extensions) as DesignerFieldNode['extensions'] }
      : {}),
    ...(typeof span === 'number' ? { span } : {}),
    ...(node.conditions
      ? { conditions: structuredClone(node.conditions) as DesignerFieldNode['conditions'] }
      : {}),
    ...(node.reactions
      ? { reactions: structuredClone(node.reactions) as DesignerFieldNode['reactions'] }
      : {}),
    ...(node.label === undefined ? {} : { label: node.label }),
    ...(node.defaultValue === undefined
      ? {}
      : {
          defaultValue: structuredClone(node.defaultValue) as DesignerFieldNode['defaultValue'],
        }),
    ...(node.validation === undefined
      ? {}
      : { validation: structuredClone(node.validation) as DesignerFieldNode['validation'] }),
    ...(node.validateOn === undefined
      ? {}
      : { validateOn: structuredClone(node.validateOn) as DesignerFieldNode['validateOn'] }),
  }
}

/**
 * Compatibility bridge while adapter packages still co-locate Runtime and
 * Design bindings in DesignerMaterialDefinition.
 */
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
        kind: material.kind === 'container' ? 'layout' : 'field',
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
                  node: toDesignerReadonlyNode(node),
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
