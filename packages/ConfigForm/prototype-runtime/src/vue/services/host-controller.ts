import type { ConfigFormValueScopeRowIdFactory } from '@moluoxixi/config-form-core'
import type {
  PrimaryUiActionBinding,
  PrototypeDiagnostic,
  PrototypeNodeAddressV1,
  PrototypeProjectContextV1,
  PrototypeSessionV1,
  PrototypeSurfaceContractV1,
  SurfaceInstanceV1,
} from '../../session/types'
import type {
  PrototypeVueActivationInput,
  PrototypeVueActivationResult,
  PrototypeVueHostController,
  PrototypeVueHostOptions,
  PrototypeVueTransitionSnapshot,
  PrototypeVueValuesChangedInput,
} from '../types'
import {
  cloneJson,
  createPrototypeInstanceRuntimeSnapshot,
  createPrototypeRuntimeRowIdFactory,
  deepFreeze,
  initializePrototypeSession,
  readPrototypeProjectContext,
  readPrototypeSession,
  reducePrototypeSession,
  resolvePrototypeFieldAddress,
} from '../../session'
import { createPrototypeVueControllerRegistry } from './controller-registry'
import { createPrototypeVueEffectExecutor } from './effect-executor'

const DEFAULT_HOME_INSTANCE_ID = 'prototype-page-1'

function emptySession(projectId: string): PrototypeSessionV1 {
  return deepFreeze({
    version: 1 as const,
    projectId,
    pageHistory: [],
    overlayStack: [],
    instancesById: {},
  }) as PrototypeSessionV1
}

function snapshot(
  session: PrototypeSessionV1,
  diagnostics: readonly PrototypeDiagnostic[],
): PrototypeVueTransitionSnapshot {
  return deepFreeze({ session, diagnostics: [...diagnostics] }) as PrototypeVueTransitionSnapshot
}

function hostDiagnostic(message: string, context?: Record<string, string>): PrototypeDiagnostic {
  return {
    code: 'prototype_host_invalid',
    message,
    ...(context ? { context } : {}),
  }
}

function primaryBinding(
  surface: PrototypeSurfaceContractV1,
  interactionId: string,
): PrimaryUiActionBinding | undefined {
  return surface.interactions.find((interaction): interaction is PrimaryUiActionBinding => (
    interaction.kind === 'primaryUiAction' && interaction.id === interactionId
  ))
}

function sourceForActivation(
  session: PrototypeSessionV1,
  context: PrototypeProjectContextV1,
  input: PrototypeVueActivationInput,
): {
  instance: SurfaceInstanceV1
  surface: PrototypeSurfaceContractV1
  binding: PrimaryUiActionBinding
} | undefined {
  const instance = session.instancesById[input.sourceInstanceId]
  const surface = instance ? context.surfacesById[instance.surfaceId] : undefined
  const binding = surface ? primaryBinding(surface, input.interactionId) : undefined
  return instance && surface && binding ? { instance, surface, binding } : undefined
}

export function createPrototypeVueHostController(
  options: PrototypeVueHostOptions,
): PrototypeVueHostController {
  const registry = options.registry ?? createPrototypeVueControllerRegistry()
  const executor = createPrototypeVueEffectExecutor({
    registry,
    ...(options.scheduleFocus ? { scheduleFocus: options.scheduleFocus } : {}),
    ...(options.onEffect ? { onEffect: options.onEffect } : {}),
  })
  const contextRead = readPrototypeProjectContext(options.context)
  const context = contextRead.success ? contextRead.data : undefined
  let current = snapshot(
    emptySession(options.context.projectId),
    contextRead.success ? [] : contextRead.diagnostics,
  )
  let revision = 0
  let nextInstance = 0
  let disposed = false
  const rowCounters = new Map<string, number>()

  function notify(): void {
    options.onSnapshot?.(current)
  }

  function publishDiagnostics(diagnostics: readonly PrototypeDiagnostic[]): PrototypeVueTransitionSnapshot {
    current = snapshot(current.session, diagnostics)
    notify()
    return current
  }

  function ensureActive(): void {
    if (disposed)
      throw new Error('Prototype Vue host controller is disposed.')
  }

  function reconcileRegistry(session: PrototypeSessionV1): void {
    executor.reset()
    const liveIds = [...session.pageHistory, ...session.overlayStack]
    const liveIdSet = new Set(liveIds)
    registry.ids().forEach((instanceId) => {
      if (liveIdSet.has(instanceId))
        return
      registry.dispose(instanceId)
      rowCounters.delete(instanceId)
    })
    liveIds.forEach((instanceId) => {
      const instance = session.instancesById[instanceId]!
      const mounted = registry.get(instanceId)
      if (mounted && mounted.surfaceId !== instance.surfaceId) {
        registry.dispose(instanceId)
        rowCounters.delete(instanceId)
      }
      if (!registry.has(instanceId)) {
        registry.mount(instance)
        return
      }
      registry.replaceValues(instanceId, {
        values: instance.values,
        changedAddresses: [],
      })
      registry.replaceProjection(instanceId, instance.projection)
    })
  }

  function replaceSession(sessionInput: unknown): PrototypeVueTransitionSnapshot {
    ensureActive()
    if (!context)
      return publishDiagnostics(current.diagnostics)
    if (sessionInput === current.session)
      return current
    const sessionRead = readPrototypeSession(sessionInput, context)
    if (!sessionRead.success)
      return publishDiagnostics(sessionRead.diagnostics)
    current = snapshot(sessionRead.data, [])
    revision += 1
    reconcileRegistry(sessionRead.data)
    notify()
    return current
  }

  function boundRowFactory(instanceId: string): ConfigFormValueScopeRowIdFactory {
    return (rowContext) => {
      if (options.createRowId)
        return options.createRowId({ ...rowContext, instanceId })
      const ordinal = (rowCounters.get(instanceId) ?? 0) + 1
      rowCounters.set(instanceId, ordinal)
      return `${instanceId}-row-${ordinal}`
    }
  }

  function createRuntime(
    surface: PrototypeSurfaceContractV1,
    instanceId: string,
  ) {
    try {
      const input = {
        instanceId,
        surface,
        values: cloneJson(surface.initialValues),
        createRowId: boundRowFactory(instanceId),
      }
      return options.createRuntimeSnapshot
        ? options.createRuntimeSnapshot(input)
        : createPrototypeInstanceRuntimeSnapshot(surface, input.values, input.createRowId)
    }
    catch (error) {
      return {
        success: false as const,
        diagnostics: [hostDiagnostic(
          error instanceof Error ? error.message : 'Prototype runtime snapshot creation failed.',
          { instanceId, surfaceId: surface.id },
        )],
      }
    }
  }

  function applyTransition(transition: ReturnType<typeof reducePrototypeSession>): PrototypeVueTransitionSnapshot {
    const previous = current.session
    current = snapshot(transition.session, transition.diagnostics)
    if (transition.session !== previous)
      revision += 1
    executor.execute(transition)
    notify()
    return current
  }

  function dispatch(command: unknown): PrototypeVueTransitionSnapshot {
    ensureActive()
    if (!context)
      return publishDiagnostics(current.diagnostics)
    return applyTransition(reducePrototypeSession(current.session, command, context))
  }

  async function validateActivation(
    source: NonNullable<ReturnType<typeof sourceForActivation>>,
    input: PrototypeVueActivationInput,
  ): Promise<'valid' | 'validation-failed' | 'controller-unavailable'> {
    const gate = source.binding.validate
    if (!gate)
      return 'valid'
    const controller = registry.get(source.instance.instanceId)?.controller
    if (!controller)
      return 'controller-unavailable'
    if (gate.scope === 'surface')
      return await controller.validateSurface() ? 'valid' : 'validation-failed'
    const addresses = (gate.fieldIds ?? []).map(fieldId => resolvePrototypeFieldAddress(
      source.surface,
      source.instance.runtime,
      input.sourceAddress,
      fieldId,
    ))
    if (addresses.some(address => !address))
      return 'validation-failed'
    return await controller.validateFields(addresses as PrototypeNodeAddressV1[])
      ? 'valid'
      : 'validation-failed'
  }

  async function activate(input: PrototypeVueActivationInput): Promise<PrototypeVueActivationResult> {
    ensureActive()
    if (!context)
      return { status: 'invalid', snapshot: current }
    const source = sourceForActivation(current.session, context, input)
    if (!source) {
      const next = dispatch({
        type: 'interaction.activate',
        sourceInstanceId: input.sourceInstanceId,
        sourceAddress: input.sourceAddress,
        interactionId: input.interactionId,
        ...(input.item ? { item: input.item } : {}),
      })
      return { status: 'invalid', snapshot: next }
    }

    const validationRevision = revision
    let validation: Awaited<ReturnType<typeof validateActivation>>
    try {
      validation = await validateActivation(source, input)
    }
    catch {
      validation = 'validation-failed'
    }
    if (disposed || validationRevision !== revision || current.session.instancesById[input.sourceInstanceId] !== source.instance)
      return { status: 'stale', snapshot: current }
    if (validation !== 'valid')
      return { status: validation, snapshot: current }

    let item: PrototypeVueActivationInput['item']
    try {
      item = input.item === undefined ? undefined : cloneJson(input.item)
    }
    catch {
      return {
        status: 'invalid',
        snapshot: publishDiagnostics([hostDiagnostic('Prototype activation item must be JSON-safe.')]),
      }
    }
    const command: Record<string, unknown> = {
      type: 'interaction.activate',
      sourceInstanceId: input.sourceInstanceId,
      sourceAddress: input.sourceAddress,
      interactionId: input.interactionId,
      ...(item === undefined ? {} : { item }),
    }
    if (source.binding.action.kind === 'navigate' || source.binding.action.kind === 'open') {
      const target = context.surfacesById[source.binding.action.targetSurfaceId]
      if (!target) {
        return {
          status: 'invalid',
          snapshot: publishDiagnostics([hostDiagnostic(
            'Prototype activation target Surface does not exist.',
            { targetSurfaceId: source.binding.action.targetSurfaceId },
          )]),
        }
      }
      let instanceId: string
      try {
        if (options.createInstanceId) {
          instanceId = options.createInstanceId({
              parentInstanceId: source.instance.instanceId,
              sourceAddress: input.sourceAddress,
              surfaceId: target.id,
            })
        }
        else {
          do instanceId = `prototype-instance-${++nextInstance}`
          while (current.session.instancesById[instanceId])
        }
      }
      catch (error) {
        return {
          status: 'invalid',
          snapshot: publishDiagnostics([hostDiagnostic(
            error instanceof Error ? error.message : 'Prototype instance ID creation failed.',
          )]),
        }
      }
      const runtime = createRuntime(target, instanceId)
      if (!runtime.success)
        return { status: 'invalid', snapshot: publishDiagnostics(runtime.diagnostics) }
      command.nextInstance = { instanceId, runtime: runtime.data }
    }
    const next = dispatch(command)
    return { status: next.diagnostics.length > 0 ? 'invalid' : 'dispatched', snapshot: next }
  }

  if (context && options.initialSession !== undefined) {
    const sessionRead = readPrototypeSession(options.initialSession, context)
    if (!sessionRead.success) {
      current = snapshot(current.session, sessionRead.diagnostics)
    }
    else {
      current = snapshot(sessionRead.data, [])
      revision = 1
      reconcileRegistry(sessionRead.data)
    }
  }
  else if (context) {
    const home = context.surfacesById[context.homeSurfaceId]
    const homeInstanceId = options.homeInstanceId ?? DEFAULT_HOME_INSTANCE_ID
    const runtime = home ? createRuntime(home, homeInstanceId) : undefined
    if (!home || !runtime?.success) {
      current = snapshot(current.session, runtime && !runtime.success
        ? runtime.diagnostics
        : [hostDiagnostic('Prototype home Surface does not exist.')])
    }
    else {
      const initialized = initializePrototypeSession({
        projectId: context.projectId,
        homeInstance: { instanceId: homeInstanceId, runtime: runtime.data },
      }, context)
      current = snapshot(initialized.session, initialized.diagnostics)
      if (initialized.session.pageHistory.length > 0)
        revision = 1
      executor.execute(initialized)
    }
  }
  notify()

  return {
    registry,
    getSnapshot: () => current,
    getRevision: () => revision,
    replaceSession,
    dispatch,
    activate,
    valuesChanged: (input: PrototypeVueValuesChangedInput) => dispatch({
      type: 'instance.valuesChanged',
      instanceId: input.instanceId,
      values: input.values,
      runtime: input.runtime,
      originScope: input.originScope,
      changedAddresses: input.changedAddresses,
    }),
    back: () => dispatch({ type: 'history.back' }),
    closeAll: () => dispatch({ type: 'overlay.closeAll' }),
    dismiss: (instanceId, reason) => dispatch({ type: 'overlay.dismiss', instanceId, reason }),
    createRowIdFactory: (instanceId) => {
      const instance = current.session.instancesById[instanceId]
      if (!instance)
        throw new Error(`Prototype instance does not exist: ${instanceId}.`)
      return createPrototypeRuntimeRowIdFactory(instance.runtime, boundRowFactory(instanceId))
    },
    dispose: () => {
      if (disposed)
        return
      disposed = true
      registry.disposeAll()
      executor.reset()
      rowCounters.clear()
    },
  }
}
