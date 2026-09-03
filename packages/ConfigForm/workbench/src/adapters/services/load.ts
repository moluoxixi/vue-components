import type { DesignerMaterialCapabilityRegistry, DesignerRegistry } from '@moluoxixi/config-form-designer'
import type {
  ComponentContract,
  ComponentContractRegistry,
  RegistryContractSnapshot,
} from '@moluoxixi/config-form-model'
import type {
  CanonicalSourceBindingResolver,
  CanonicalSourceComponentBinding,
} from '../../project/export'
import type {
  WorkbenchAdapter,
  WorkbenchAdapterId,
  WorkbenchRuntimeAdapter,
} from '../types'
import {
  createDesignerVueRuntimeResolver,
} from '@moluoxixi/config-form-designer'
import {
  createComponentContractRegistry,
  createRegistryContractSnapshot,
} from '@moluoxixi/config-form-model'
import { WORKBENCH_SOURCE_LIBRARY_VERSIONS } from '../constants'

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
    const library = source.binding.library
    const libraryVersion = library && WORKBENCH_SOURCE_LIBRARY_VERSIONS[library.packageName]
    if (library && !libraryVersion)
      throw new Error(`Workbench source library has no declared current version: ${library.packageName}`)
    bindings.set(capability.contract.key, {
      component: capability.contract.key,
      contractFingerprint: contract.fingerprint,
      contractVersion: contract.contractVersion,
      configComponent: source.binding.configComponent,
      tag: source.binding.tag,
      render: source.binding.render,
      ...(source.defaultValue === undefined ? {} : { defaultValue: structuredClone(source.defaultValue) }),
      ...(library ? { library: { ...structuredClone(library), version: libraryVersion! } } : {}),
      ...(source.binding.options ? { options: structuredClone(source.binding.options) } : {}),
      ...(source.binding.staticProps ? { staticProps: structuredClone(source.binding.staticProps) } : {}),
      ...(source.trigger ? { trigger: source.trigger } : {}),
      ...(source.valueProp ? { valueProp: source.valueProp } : {}),
      ...(capability.runtime.binding.blurTrigger ? { blurTrigger: capability.runtime.binding.blurTrigger } : {}),
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
    const [adapter, inspector] = await Promise.all([
      import('@moluoxixi/config-form-designer-antd-vue'),
      import('@moluoxixi/config-form-designer-element-plus'),
      import('ant-design-vue/dist/reset.css'),
      import('@moluoxixi/config-form-designer-antd-vue/styles'),
      import('@moluoxixi/config-form-antd-vue/styles'),
      import('../styles/element-plus-inspector'),
    ])
    const designerRegistry = adapter.createAntdVueDesignerRegistry({
      layers: [{
        name: 'workbench-element-plus-inspector',
        components: inspector.ELEMENT_PLUS_DESIGNER_COMPONENTS,
        propertyControls: inspector.ELEMENT_PLUS_DESIGNER_PROPERTY_CONTROLS,
      }],
    })
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
    import('../styles/element-plus-inspector'),
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
    import('../styles/element-plus-runtime'),
    import('@moluoxixi/config-form-designer-element-plus/styles'),
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
