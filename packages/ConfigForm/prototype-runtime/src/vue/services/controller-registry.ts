import type {
  PrototypeInstanceProjectionV1,
  PrototypeNodeAddressV1,
  SurfaceInstanceId,
  SurfaceInstanceV1,
} from '../../session/types'
import type {
  PrototypeVueControllerRegistry,
  PrototypeVueControllerRegistryEntry,
  PrototypeVueInstanceController,
  PrototypeVueValuesReplacement,
} from '../types'
import { cloneJson, deepFreeze } from '../../session'

interface MutableRegistryEntry {
  instanceId: string
  surfaceId: string
  values: PrototypeVueControllerRegistryEntry['values']
  projection: PrototypeInstanceProjectionV1
  controller?: PrototypeVueInstanceController
  controllerToken?: symbol
  pendingFocus?: PrototypeNodeAddressV1
}

function cloneAddress(address: PrototypeNodeAddressV1): PrototypeNodeAddressV1 {
  return {
    nodeId: address.nodeId,
    scope: address.scope.map(entry => ({ ...entry })),
  }
}

function cloneProjection(
  projection: PrototypeInstanceProjectionV1,
): PrototypeInstanceProjectionV1 {
  return deepFreeze(projection.map(entry => ({
    address: cloneAddress(entry.address),
    states: { ...entry.states },
    properties: entry.properties.map(property => ({
      path: [...property.path],
      value: cloneJson(property.value),
    })),
  }))) as PrototypeInstanceProjectionV1
}

function publicEntry(entry: MutableRegistryEntry): PrototypeVueControllerRegistryEntry {
  return {
    instanceId: entry.instanceId,
    surfaceId: entry.surfaceId,
    values: entry.values,
    projection: entry.projection,
    ...(entry.controller ? { controller: entry.controller } : {}),
  }
}

function missingInstance(instanceId: SurfaceInstanceId): Error {
  return new Error(`Prototype Vue instance is not mounted: ${instanceId}.`)
}

export function createPrototypeVueControllerRegistry(): PrototypeVueControllerRegistry {
  const entries = new Map<SurfaceInstanceId, MutableRegistryEntry>()
  const listeners = new Set<() => void>()

  function notify(): void {
    listeners.forEach(listener => listener())
  }

  function read(instanceId: SurfaceInstanceId): MutableRegistryEntry {
    const entry = entries.get(instanceId)
    if (!entry)
      throw missingInstance(instanceId)
    return entry
  }

  function mount(instance: SurfaceInstanceV1): void {
    if (entries.has(instance.instanceId))
      throw new Error(`Prototype Vue instance is already mounted: ${instance.instanceId}.`)
    entries.set(instance.instanceId, {
      instanceId: instance.instanceId,
      surfaceId: instance.surfaceId,
      values: deepFreeze(cloneJson(instance.values)),
      projection: cloneProjection(instance.projection),
    })
    notify()
  }

  function register(
    instanceId: SurfaceInstanceId,
    controller: PrototypeVueInstanceController,
  ): () => void {
    const entry = read(instanceId)
    const token = Symbol(instanceId)
    if (entry.controller && entry.controller !== controller)
      entry.controller.dispose()
    entry.controller = controller
    entry.controllerToken = token
    controller.replaceValues({ values: cloneJson(entry.values), changedAddresses: [] })
    controller.replaceProjection(entry.projection)
    if (entry.pendingFocus) {
      controller.focus(cloneAddress(entry.pendingFocus))
      delete entry.pendingFocus
    }

    return () => {
      const current = entries.get(instanceId)
      if (!current || current.controllerToken !== token)
        return
      current.controller?.dispose()
      delete current.controller
      delete current.controllerToken
    }
  }

  function replaceValues(
    instanceId: SurfaceInstanceId,
    replacement: PrototypeVueValuesReplacement,
  ): void {
    const entry = read(instanceId)
    entry.values = deepFreeze(cloneJson(replacement.values))
    entry.controller?.replaceValues({
      values: cloneJson(replacement.values),
      changedAddresses: replacement.changedAddresses.map(cloneAddress),
    })
    notify()
  }

  function replaceProjection(
    instanceId: SurfaceInstanceId,
    projection: PrototypeInstanceProjectionV1,
  ): void {
    const entry = read(instanceId)
    entry.projection = cloneProjection(projection)
    entry.controller?.replaceProjection(entry.projection)
    notify()
  }

  function focus(instanceId: SurfaceInstanceId, address: PrototypeNodeAddressV1): void {
    const entry = read(instanceId)
    if (entry.controller)
      entry.controller.focus(cloneAddress(address))
    else
      entry.pendingFocus = cloneAddress(address)
  }

  function dispose(instanceId: SurfaceInstanceId): void {
    const entry = entries.get(instanceId)
    if (!entry)
      throw missingInstance(instanceId)
    entries.delete(instanceId)
    entry.controller?.dispose()
    delete entry.controller
    delete entry.controllerToken
    delete entry.pendingFocus
    notify()
  }

  function disposeAll(): void {
    const mounted = [...entries.values()]
    entries.clear()
    mounted.forEach((entry) => {
      entry.controller?.dispose()
      delete entry.controller
      delete entry.controllerToken
      delete entry.pendingFocus
    })
    if (mounted.length > 0)
      notify()
  }

  return {
    mount,
    register,
    replaceValues,
    replaceProjection,
    focus,
    dispose,
    disposeAll,
    get: (instanceId) => {
      const entry = entries.get(instanceId)
      return entry ? publicEntry(entry) : undefined
    },
    has: instanceId => entries.has(instanceId),
    ids: () => [...entries.keys()],
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
