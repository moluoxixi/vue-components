import type {
  DesignerLocaleOptions,
  DesignerRegistry,
  LowCodeComponentRegistry,
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
  createLowCodeComponentRegistry,
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
  lowCodeRegistry: LowCodeComponentRegistry
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
  lowCodeRegistry: LowCodeComponentRegistry,
): ComponentContractRegistry {
  const contracts: ComponentContract[] = lowCodeRegistry.list().map((definition) => {
    const material = lowCodeRegistry.designer.getMaterial(definition.component)
    if (!material)
      throw new Error(`Workbench material is missing from the Designer Registry: ${definition.component}`)
    return {
      key: definition.component,
      version: String(material.version),
      kind: definition.kind === 'layout' ? 'layout' : 'field',
      props: definition.props.map(property => ({
        key: property.key,
        path: [...property.path],
        ...(property.valueKind ? { valueKind: property.valueKind } : {}),
      })),
      events: definition.events.map(event => ({ name: event.name })),
      bindings: definition.bindings.map(binding => ({
        name: binding.name,
        valueProp: binding.valueProp,
        trigger: binding.trigger,
      })),
      slots: definition.slots.map(slot => ({
        name: slot.name,
        ...(slot.accepts
          ? { accepts: slot.accepts.map(kind => kind === 'container' ? 'layout' as const : 'field' as const) }
          : {}),
        ...(slot.materials ? { components: [...slot.materials] } : {}),
      })),
      allowedParents: definition.allowedParents.map(parent => ({
        component: parent.material,
        slot: parent.slot,
      })),
      defaults: structuredClone(definition.defaults.props),
    }
  })
  return createComponentContractRegistry(contracts, { adapter: id, version: '1' })
}

function createWorkbenchSourceResolver(
  lowCodeRegistry: LowCodeComponentRegistry,
  registrySnapshot: RegistryContractSnapshot,
): CanonicalSourceBindingResolver {
  const contracts = new Map(registrySnapshot.components.map(component => [component.key, component]))
  const bindings = new Map<string, CanonicalSourceComponentBinding>()
  lowCodeRegistry.list().forEach((definition) => {
    const contract = contracts.get(definition.component)
    if (!contract)
      throw new Error(`Workbench source binding has no component contract: ${definition.component}`)
    const source = definition.source
    bindings.set(definition.component, {
      component: definition.component,
      contractFingerprint: contract.fingerprint,
      contractVersion: contract.contractVersion,
      configComponent: source.configComponent,
      tag: source.tag,
      render: source.render,
      ...(definition.defaults.defaultValue === undefined
        ? {}
        : { defaultValue: structuredClone(definition.defaults.defaultValue) }),
      ...(source.library ? { library: structuredClone(source.library) } : {}),
      ...(source.options ? { options: structuredClone(source.options) } : {}),
      ...(source.staticProps ? { staticProps: structuredClone(source.staticProps) } : {}),
      ...(definition.runtime.trigger ? { trigger: definition.runtime.trigger } : {}),
      ...(definition.runtime.valueProp ? { valueProp: definition.runtime.valueProp } : {}),
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
): Pick<WorkbenchAdapter, 'componentRegistry' | 'lowCodeRegistry' | 'registrySnapshot' | 'runtimeResolver'> {
  const lowCodeRegistry = createLowCodeComponentRegistry(designerRegistry)
  const componentRegistry = createWorkbenchComponentRegistry(id, lowCodeRegistry)
  const registrySnapshot = createRegistryContractSnapshot(componentRegistry)
  return {
    componentRegistry,
    lowCodeRegistry,
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
      sourceResolver: createWorkbenchSourceResolver(runtime.lowCodeRegistry, runtime.registrySnapshot),
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
    sourceResolver: createWorkbenchSourceResolver(runtime.lowCodeRegistry, runtime.registrySnapshot),
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
