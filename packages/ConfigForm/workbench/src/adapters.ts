import type {
  DesignerLocaleOptions,
  DesignerMaterialCapabilityRegistry,
  DesignerRegistry,
} from '@moluoxixi/config-form-designer'
import type {
  ComponentContract,
  ComponentContractRegistry,
  RegistryContractSnapshot,
} from '@moluoxixi/config-form-model'
import type { VueRuntimeBindingResolver } from '@moluoxixi/config-form-vue-backend'
import type {
  CanonicalSourceBindingResolver,
  CanonicalSourceComponentBinding,
} from './project/export/canonical-bindings'
import {
  createDesignerVueRuntimeResolver,
} from '@moluoxixi/config-form-designer'
import {
  createComponentContractRegistry,
  createRegistryContractSnapshot,
} from '@moluoxixi/config-form-model'

export type WorkbenchAdapterId = 'antd-vue' | 'element-plus'

export interface WorkbenchAdapter {
  componentRegistry: ComponentContractRegistry
  designerRegistry: DesignerRegistry
  locale: DesignerLocaleOptions
  registrySnapshot: RegistryContractSnapshot
  runtimeResolver: VueRuntimeBindingResolver
  sourceResolver: CanonicalSourceBindingResolver
}

export interface WorkbenchRuntimeAdapter {
  runtimeResolver: VueRuntimeBindingResolver
}

const adapterPromises = new Map<WorkbenchAdapterId, Promise<WorkbenchAdapter>>()
const runtimeAdapterPromises = new Map<WorkbenchAdapterId, Promise<WorkbenchRuntimeAdapter>>()

function createWorkbenchComponentRegistry(
  id: WorkbenchAdapterId,
  capabilities: DesignerMaterialCapabilityRegistry,
): ComponentContractRegistry {
  return createComponentContractRegistry(
    capabilities.contracts as readonly ComponentContract[],
    { adapter: id, version: '1' },
  )
}

function createWorkbenchSourceResolver(
  capabilities: DesignerMaterialCapabilityRegistry,
  registrySnapshot: RegistryContractSnapshot,
): CanonicalSourceBindingResolver {
  const contracts = new Map(registrySnapshot.components.map(component => [component.key, component]))
  const bindings = new Map<string, CanonicalSourceComponentBinding>()
  capabilities.capabilities.forEach((capability) => {
    const contract = contracts.get(capability.contract.key)
    if (!contract)
      throw new Error(`Workbench source binding has no component contract: ${capability.contract.key}`)
    const source = capability.source
    if (!source)
      throw new Error(`Workbench material is missing its source binding: ${capability.contract.key}`)
    bindings.set(capability.contract.key, {
      component: capability.contract.key,
      contractFingerprint: contract.fingerprint,
      contractVersion: contract.contractVersion,
      configComponent: source.binding.configComponent,
      tag: source.binding.tag,
      render: source.binding.render,
      ...(source.defaultValue === undefined ? {} : { defaultValue: structuredClone(source.defaultValue) }),
      ...(source.binding.library ? { library: structuredClone(source.binding.library) } : {}),
      ...(source.binding.options ? { options: structuredClone(source.binding.options) } : {}),
      ...(source.binding.staticProps ? { staticProps: structuredClone(source.binding.staticProps) } : {}),
      ...(source.trigger ? { trigger: source.trigger } : {}),
      ...(source.valueProp ? { valueProp: source.valueProp } : {}),
    })
  })
  return Object.freeze({
    adapter: registrySnapshot.adapter,
    adapterVersion: registrySnapshot.adapterVersion,
    registryFingerprint: registrySnapshot.fingerprint,
    resolveBinding: (component: string) => bindings.get(component),
  })
}

function createWorkbenchRuntimeBindings(
  id: WorkbenchAdapterId,
  designerRegistry: DesignerRegistry,
  capabilities: DesignerMaterialCapabilityRegistry,
): Pick<WorkbenchAdapter, 'componentRegistry' | 'registrySnapshot' | 'runtimeResolver'> {
  const componentRegistry = createWorkbenchComponentRegistry(id, capabilities)
  const registrySnapshot = createRegistryContractSnapshot(componentRegistry)
  return {
    componentRegistry,
    registrySnapshot,
    runtimeResolver: createDesignerVueRuntimeResolver(designerRegistry, registrySnapshot, capabilities),
  }
}

async function createWorkbenchAdapter(id: WorkbenchAdapterId): Promise<WorkbenchAdapter> {
  if (id === 'antd-vue') {
    const [adapter] = await Promise.all([
      import('@moluoxixi/config-form-designer-antd-vue'),
      import('ant-design-vue/dist/reset.css'),
      import('@moluoxixi/config-form-designer-antd-vue/styles'),
      import('@moluoxixi/config-form-antd-vue/styles'),
    ])
    const designerRegistry = adapter.createAntdVueDesignerRegistry()
    const capabilities = adapter.ANTD_VUE_DESIGNER_MATERIAL_REGISTRY
    const runtime = createWorkbenchRuntimeBindings(id, designerRegistry, capabilities)
    return {
      ...runtime,
      designerRegistry,
      locale: adapter.ANTD_VUE_DESIGNER_ZH_CN,
      sourceResolver: createWorkbenchSourceResolver(capabilities, runtime.registrySnapshot),
    }
  }

  const [adapter] = await Promise.all([
    import('@moluoxixi/config-form-designer-element-plus'),
    import('element-plus/dist/index.css'),
    import('@moluoxixi/config-form-designer-element-plus/styles'),
    import('@moluoxixi/config-form-element/styles'),
  ])
  const designerRegistry = adapter.createElementPlusDesignerRegistry()
  const capabilities = adapter.ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY
  const runtime = createWorkbenchRuntimeBindings(id, designerRegistry, capabilities)
  return {
    ...runtime,
    designerRegistry,
    locale: adapter.ELEMENT_PLUS_DESIGNER_ZH_CN,
    sourceResolver: createWorkbenchSourceResolver(capabilities, runtime.registrySnapshot),
  }
}

async function createWorkbenchRuntimeAdapter(id: WorkbenchAdapterId): Promise<WorkbenchRuntimeAdapter> {
  if (id === 'antd-vue') {
    const [adapter] = await Promise.all([
      import('@moluoxixi/config-form-designer-antd-vue'),
      import('ant-design-vue/dist/reset.css'),
      import('@moluoxixi/config-form-antd-vue/styles'),
    ])
    return {
      runtimeResolver: createWorkbenchRuntimeBindings(
        id,
        adapter.createAntdVueDesignerRegistry(),
        adapter.ANTD_VUE_DESIGNER_MATERIAL_REGISTRY,
      ).runtimeResolver,
    }
  }

  const [adapter] = await Promise.all([
    import('@moluoxixi/config-form-designer-element-plus'),
    import('element-plus/dist/index.css'),
    import('@moluoxixi/config-form-element/styles'),
  ])
  return {
    runtimeResolver: createWorkbenchRuntimeBindings(
      id,
      adapter.createElementPlusDesignerRegistry(),
      adapter.ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY,
    ).runtimeResolver,
  }
}

export function loadWorkbenchAdapter(id: WorkbenchAdapterId): Promise<WorkbenchAdapter> {
  const current = adapterPromises.get(id)
  if (current)
    return current
  const pending = createWorkbenchAdapter(id)
  adapterPromises.set(id, pending)
  return pending
}

export function loadWorkbenchRuntimeAdapter(id: WorkbenchAdapterId): Promise<WorkbenchRuntimeAdapter> {
  const current = runtimeAdapterPromises.get(id)
  if (current)
    return current
  const pending = createWorkbenchRuntimeAdapter(id)
  runtimeAdapterPromises.set(id, pending)
  return pending
}
