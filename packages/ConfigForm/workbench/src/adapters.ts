import type {
  DesignerLocaleOptions,
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
  designerRegistry: DesignerRegistry,
): ComponentContractRegistry {
  const contracts: ComponentContract[] = designerRegistry.listMaterials().map((material) => {
    const subgraph = designerRegistry.createSubgraph(material.key, {
      id: '__registry_default__',
      ...(material.kind === 'field' ? { field: '__registry_field__' } : {}),
    })
    const root = subgraph.root[0]
    const defaults = root ? subgraph.nodesById[root.nodeId] : undefined
    if (!defaults)
      throw new Error(`Workbench material factory returned no root node: ${material.key}`)
    const properties = new Map<string, ComponentContract['props'][number]>()
    material.setters.forEach((setter) => {
      if (setter.path[0] !== 'props')
        return
      properties.set(setter.key, {
        key: setter.key,
        path: [...setter.path],
        ...(setter.valueKind ? { valueKind: setter.valueKind } : {}),
      })
    })
    const valueProp = material.runtime.valueProp ?? 'modelValue'
    const trigger = material.runtime.trigger ?? `update:${valueProp}`
    const events = new Map<string, { name: string }>()
    if (material.kind === 'field')
      events.set(trigger, { name: trigger })
    material.events?.forEach(event => events.set(event.name, { name: event.name }))
    return {
      key: material.key,
      version: String(material.version),
      kind: material.kind,
      props: [...properties.values()],
      events: [...events.values()],
      bindings: material.kind === 'field'
        ? [{ name: 'value', valueProp, trigger }]
        : [],
      slots: (material.kind === 'layout' ? material.slots : []).map(slot => ({
        name: slot.name,
        ...(slot.accepts ? { accepts: [...slot.accepts] } : {}),
        ...(slot.materials ? { components: [...slot.materials] } : {}),
      })),
      allowedParents: (material.allowedParents ?? []).map(parent => ({
        component: parent.material,
        slot: parent.slot,
      })),
      defaults: structuredClone(defaults.props),
    }
  })
  return createComponentContractRegistry(contracts, { adapter: id, version: '1' })
}

function createWorkbenchSourceResolver(
  designerRegistry: DesignerRegistry,
  registrySnapshot: RegistryContractSnapshot,
): CanonicalSourceBindingResolver {
  const contracts = new Map(registrySnapshot.components.map(component => [component.key, component]))
  const bindings = new Map<string, CanonicalSourceComponentBinding>()
  designerRegistry.listMaterials().forEach((material) => {
    const contract = contracts.get(material.key)
    if (!contract)
      throw new Error(`Workbench source binding has no component contract: ${material.key}`)
    const source = material.source
    if (!source)
      throw new Error(`Workbench material is missing its source binding: ${material.key}`)
    const subgraph = designerRegistry.createSubgraph(material.key, {
      id: '__source_default__',
      ...(material.kind === 'field' ? { field: '__source_field__' } : {}),
    })
    const root = subgraph.root[0]
    const defaults = root ? subgraph.nodesById[root.nodeId] : undefined
    bindings.set(material.key, {
      component: material.key,
      contractFingerprint: contract.fingerprint,
      contractVersion: contract.contractVersion,
      configComponent: source.configComponent,
      tag: source.tag,
      render: source.render,
      ...(defaults?.kind !== 'field' || defaults.defaultValue === undefined
        ? {}
        : { defaultValue: structuredClone(defaults.defaultValue) }),
      ...(source.library ? { library: structuredClone(source.library) } : {}),
      ...(source.options ? { options: structuredClone(source.options) } : {}),
      ...(source.staticProps ? { staticProps: structuredClone(source.staticProps) } : {}),
      ...(material.runtime.trigger ? { trigger: material.runtime.trigger } : {}),
      ...(material.runtime.valueProp ? { valueProp: material.runtime.valueProp } : {}),
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
): Pick<WorkbenchAdapter, 'componentRegistry' | 'registrySnapshot' | 'runtimeResolver'> {
  const componentRegistry = createWorkbenchComponentRegistry(id, designerRegistry)
  const registrySnapshot = createRegistryContractSnapshot(componentRegistry)
  return {
    componentRegistry,
    registrySnapshot,
    runtimeResolver: createDesignerVueRuntimeResolver(designerRegistry, registrySnapshot),
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
    const runtime = createWorkbenchRuntimeBindings(id, designerRegistry)
    return {
      ...runtime,
      designerRegistry,
      locale: adapter.ANTD_VUE_DESIGNER_ZH_CN,
      sourceResolver: createWorkbenchSourceResolver(designerRegistry, runtime.registrySnapshot),
    }
  }

  const [adapter] = await Promise.all([
    import('@moluoxixi/config-form-designer-element-plus'),
    import('element-plus/dist/index.css'),
    import('@moluoxixi/config-form-designer-element-plus/styles'),
    import('@moluoxixi/config-form-element/styles'),
  ])
  const designerRegistry = adapter.createElementPlusDesignerRegistry()
  const runtime = createWorkbenchRuntimeBindings(id, designerRegistry)
  return {
    ...runtime,
    designerRegistry,
    locale: adapter.ELEMENT_PLUS_DESIGNER_ZH_CN,
    sourceResolver: createWorkbenchSourceResolver(designerRegistry, runtime.registrySnapshot),
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
