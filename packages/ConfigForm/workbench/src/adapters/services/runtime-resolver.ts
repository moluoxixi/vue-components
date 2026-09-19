import type { DesignerMaterialCapabilityRegistry, DesignerRegistry } from '@moluoxixi/config-form-designer'
import type { FieldNode, RegistryContractSnapshot } from '@moluoxixi/config-form-model'
import type { CanonicalRuntimeFieldNode, VueRuntimeBindingResolver } from '@moluoxixi/config-form-vue-backend'

function toFieldNode(node: CanonicalRuntimeFieldNode): FieldNode {
  return {
    id: node.id,
    component: node.component,
    kind: 'field',
    field: node.field,
    props: structuredClone(node.configuredProps) as FieldNode['props'],
    ...(node.datasetBindings
      ? { datasetBindings: structuredClone(node.datasetBindings) as FieldNode['datasetBindings'] }
      : {}),
    ...(node.resourceBindings
      ? { resourceBindings: structuredClone(node.resourceBindings) as FieldNode['resourceBindings'] }
      : {}),
    ...(node.extensions ? { extensions: structuredClone(node.extensions) as FieldNode['extensions'] } : {}),
    ...(node.label === undefined ? {} : { label: node.label }),
    ...(node.defaultValue === undefined ? {} : { defaultValue: structuredClone(node.defaultValue) }),
    ...(node.validation === undefined ? {} : { validation: structuredClone(node.validation) }),
    ...(node.validateOn === undefined ? {} : { validateOn: structuredClone(node.validateOn) }),
  }
}

export function createWorkbenchVueRuntimeResolver(
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
        ...(runtime.getValueFromEvent ? { getValueFromEvent: runtime.getValueFromEvent } : {}),
        ...(capability.runtime.kind === 'field' && runtime.readonlyRender
          ? {
              readonlyRender: ({ componentProps, model, node, value }) => runtime.readonlyRender!({
                componentProps,
                model,
                node: toFieldNode(node),
                value,
              }),
            }
          : {}),
      }
    },
    resolveValidator: key => registry.getValidator(key),
  }
}
