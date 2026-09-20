import type { DesignerMaterialCapabilityRegistry, DesignerRegistry } from '@moluoxixi/config-form-designer'
import type {
  ComponentContract,
  ComponentContractRegistry,
  MaterialSemanticTrigger,
  RegistryContractSnapshot,
} from '@moluoxixi/config-form-model'
import type {
  SourceComponentResolution,
  SourceComponentResolver,
  SourceConfigFormBindingResolver,
  SourceSemanticListenerMap,
} from '@moluoxixi/config-form-source/generator'
import type {
  WorkbenchAdapter,
  WorkbenchAdapterId,
  WorkbenchRuntimeAdapter,
} from '../types'
import {
  createComponentContractRegistry,
  createRegistryContractSnapshot,
} from '@moluoxixi/config-form-model'
import {
  WORKBENCH_CONFIG_FORM_BINDING_VERSIONS,
  WORKBENCH_SOURCE_LIBRARY_VERSIONS,
} from '../constants'
import { createWorkbenchVueRuntimeResolver } from './runtime-resolver'

const adapterPromises = new Map<WorkbenchAdapterId, Promise<WorkbenchAdapter>>()
const runtimeAdapterPromises = new Map<WorkbenchAdapterId, Promise<WorkbenchRuntimeAdapter>>()

const providerSemanticListeners: Readonly<Record<
  WorkbenchAdapterId,
  Readonly<Partial<Record<MaterialSemanticTrigger, SourceSemanticListenerMap[MaterialSemanticTrigger]>>>
>> = Object.freeze({
  'antd-vue': Object.freeze({
    activate: Object.freeze({ event: 'click', listenerProp: 'onClick', item: Object.freeze({ kind: 'none' }) }),
    submit: Object.freeze({ event: 'submit', listenerProp: 'onSubmit', item: Object.freeze({ kind: 'none' }) }),
  }),
  'element-plus': Object.freeze({
    activate: Object.freeze({ event: 'click', listenerProp: 'onClick', item: Object.freeze({ kind: 'none' }) }),
    submit: Object.freeze({ event: 'submit', listenerProp: 'onSubmit', item: Object.freeze({ kind: 'none' }) }),
  }),
})

function resolveSemanticListeners(
  id: WorkbenchAdapterId,
  triggers: readonly MaterialSemanticTrigger[],
): SourceSemanticListenerMap {
  const supported = providerSemanticListeners[id]
  return Object.freeze(Object.fromEntries(triggers.flatMap(trigger => (
    supported[trigger] ? [[trigger, supported[trigger]]] : []
  ))))
}

function createWorkbenchComponentRegistry(
  id: WorkbenchAdapterId,
  capabilities: DesignerMaterialCapabilityRegistry,
): ComponentContractRegistry {
  return createComponentContractRegistry(
    capabilities.contracts as readonly ComponentContract[],
    { adapter: id, version: '1' },
  )
}

function createWorkbenchSourceResolvers(
  id: WorkbenchAdapterId,
  capabilities: DesignerMaterialCapabilityRegistry,
  registrySnapshot: RegistryContractSnapshot,
): Pick<WorkbenchAdapter, 'sourceBindingResolver' | 'sourceComponentResolver'> {
  const contracts = new Map(registrySnapshot.components.map(component => [component.key, component]))
  const bindings = new Map<string, {
    contractFingerprint: string
    contractVersion: string
    resolution: SourceComponentResolution
  }>()
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
      contractFingerprint: contract.fingerprint,
      contractVersion: contract.contractVersion,
      resolution: {
        moduleSpecifier: library?.packageName ?? '',
        importName: library?.plugin ?? '',
        configComponent: source.binding.configComponent,
        tag: source.binding.tag,
        render: source.binding.render,
        styleImports: library?.stylesheet ? [library.stylesheet] : [],
        dependencies: library ? { [library.packageName]: libraryVersion! } : {},
        semanticListeners: resolveSemanticListeners(id, capability.contract.semanticTriggers),
        ...(source.defaultValue === undefined ? {} : { defaultValue: structuredClone(source.defaultValue) }),
        ...(library ? { library: { ...structuredClone(library), version: libraryVersion! } } : {}),
        ...(source.binding.options ? { options: structuredClone(source.binding.options) } : {}),
        ...(source.binding.staticProps ? { staticProps: structuredClone(source.binding.staticProps) } : {}),
        ...(source.trigger ? { trigger: source.trigger } : {}),
        ...(source.valueProp ? { valueProp: source.valueProp } : {}),
        ...(capability.runtime.binding.blurTrigger ? { blurTrigger: capability.runtime.binding.blurTrigger } : {}),
      },
    })
  })
  const adapterPackage = id === 'element-plus'
    ? '@moluoxixi/config-form-element'
    : '@moluoxixi/config-form-antd-vue'
  const adapterComponent = id === 'element-plus' ? 'ElementConfigForm' : 'AntdConfigForm'
  const adapterStyle = `${adapterPackage}/styles`
  const adapterVersion = WORKBENCH_CONFIG_FORM_BINDING_VERSIONS.adapter[id]
  const uiVersion = WORKBENCH_SOURCE_LIBRARY_VERSIONS[id === 'element-plus' ? 'element-plus' : 'ant-design-vue']!
  const uiPackage = id === 'element-plus' ? 'element-plus' : 'ant-design-vue'
  const sourceComponentResolver: SourceComponentResolver = {
    adapter: {
      adapter: registrySnapshot.adapter,
      adapterVersion: registrySnapshot.adapterVersion,
      registryFingerprint: registrySnapshot.fingerprint,
    },
    resolveComponent(request) {
      const binding = bindings.get(request.componentKey)
      if (!binding)
        return { success: false, reason: `Unknown component: ${request.componentKey}` }
      if (
        binding.contractVersion !== request.contractVersion
        || binding.contractFingerprint !== request.contractFingerprint
      ) {
        return { success: false, reason: `Locked component contract changed: ${request.componentKey}` }
      }
      return { success: true, value: binding.resolution }
    },
  }
  const sourceBindingResolver: SourceConfigFormBindingResolver = {
    resolveConfigFormBinding() {
      return {
        success: true,
        value: {
          component: { moduleSpecifier: adapterPackage, importName: adapterComponent },
          model: {
            moduleSpecifier: '@moluoxixi/config-form-headless',
            importName: 'createConfigFormModel',
          },
          styleImports: [adapterStyle],
          dependencies: {
            '@moluoxixi/config-form': WORKBENCH_CONFIG_FORM_BINDING_VERSIONS.runtime,
            '@moluoxixi/config-form-headless': WORKBENCH_CONFIG_FORM_BINDING_VERSIONS.headless,
            [adapterPackage]: adapterVersion,
            [uiPackage]: uiVersion,
            'zod': WORKBENCH_CONFIG_FORM_BINDING_VERSIONS.zod,
          },
        },
      }
    },
  }
  return {
    sourceBindingResolver: Object.freeze(sourceBindingResolver),
    sourceComponentResolver: Object.freeze(sourceComponentResolver),
  }
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
    runtimeResolver: createWorkbenchVueRuntimeResolver(designerRegistry, registrySnapshot, capabilities),
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
      import('./element-plus-inspector'),
    ])
    const designerRegistry = adapter.createAntdVueDesignerRegistry({
      // Designer chrome (property pane) is fixed to Element Plus even when the
      // canvas materials come from Ant Design Vue; only provider-specific
      // controls (defaultValue) still need to be layered in.
      layers: [{
        name: 'workbench-element-plus-inspector',
        propertyControls: inspector.ELEMENT_PLUS_DESIGNER_PROPERTY_CONTROLS,
      }],
    })
    const capabilities = adapter.ANTD_VUE_DESIGNER_MATERIAL_REGISTRY
    const runtime = createWorkbenchRuntimeBindings(id, designerRegistry, capabilities)
    return {
      ...runtime,
      ...createWorkbenchSourceResolvers(id, capabilities, runtime.registrySnapshot),
      designerRegistry,
      locale: adapter.ANTD_VUE_DESIGNER_ZH_CN,
    }
  }

  const [adapter] = await Promise.all([
    import('@moluoxixi/config-form-designer-element-plus'),
    import('./element-plus-inspector'),
    import('@moluoxixi/config-form-designer-element-plus/styles'),
    import('@moluoxixi/config-form-element/styles'),
  ])
  const designerRegistry = adapter.createElementPlusDesignerRegistry()
  const capabilities = adapter.ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY
  const runtime = createWorkbenchRuntimeBindings(id, designerRegistry, capabilities)
  return {
    ...runtime,
    ...createWorkbenchSourceResolvers(id, capabilities, runtime.registrySnapshot),
    designerRegistry,
    locale: adapter.ELEMENT_PLUS_DESIGNER_ZH_CN,
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
    import('./element-plus-runtime'),
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
