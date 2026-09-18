import type {
  ConfigFormJsonObject,
  ConfigFormJsonValue,
  ConfigFormReactionProjection,
  ConfigFormScopePath,
  ConfigFormValueScopeMutationResult,
  ConfigFormValueScopePatch,
  ConfigFormValueScopeRemoveResult,
  ConfigFormValueScopeRowMutationResult,
} from '@moluoxixi/config-form-core'
import type {
  ConfigFormAttrs,
  ConfigFormCondition,
  ConfigFormController,
  ConfigFormControllerDiagnostic,
  ConfigFormControllerOptions,
  ConfigFormErrors,
  ConfigFormFieldAddress,
  ConfigFormFieldChangeRequest,
  ConfigFormFieldInstance,
  ConfigFormFieldInstanceChangeRequest,
  ConfigFormFieldSelector,
  ConfigFormFieldValue,
  ConfigFormLifecycleInput,
  ConfigFormLifecycleKind,
  ConfigFormValuePatch,
  ConfigFormValues,
  ConfigFormValueSchema,
} from '../types'
import type {
  ControllerFieldState,
  ControllerMetaService,
  ControllerNode,
  ControllerScopeService,
} from '../types/controller-internal'
import { createConfigFormValueScopeStore } from '@moluoxixi/config-form-core'
import { collectAllConfigFormFields, resolveConfigFormCondition } from '../utils'
import { resolveControllerFieldStates } from './controller-field-state'
import { createControllerMetaService } from './controller-meta'
import { createControllerResetService } from './controller-reset'
import {
  createControllerModelObserver,
  createControllerScopeService,
  deriveControllerValueSchema,
  resolveControllerValueSchema,
} from './controller-scope'
import { createControllerRowIdFactory, prepareControllerSchemaRefresh } from './controller-scope-refresh'
import { createControllerSubmitService } from './controller-submit'
import { createControllerValidationService } from './controller-validation'
import {
  cloneControllerValue,
  createInitialControllerValues,
  createResetControllerValues,
  equalControllerValues,
  normalizeControllerFieldNames,
  setConfigFormValue,
} from './controller-values'
import { applyConfigFormReactions } from './reactions'

const MAX_LIFECYCLE_REENTRY = 32

interface ScopedCommit<TValues extends ConfigFormValues> {
  invalidatedScopes: ConfigFormScopePath[]
  projection: ConfigFormReactionProjection<TValues>
  values: TValues
}

/** 创建与具体 UI 组件库无关的 ConfigForm 状态、校验和提交控制器。 */
export function createConfigFormController<TValues extends ConfigFormValues = ConfigFormValues>(
  options: ConfigFormControllerOptions<TValues>,
): ConfigFormController<TValues> {
  let disposed = false
  let lifecycleDepth = 0
  let operationLifetime = new AbortController()
  let synchronizingModel = false
  let validationService: ReturnType<typeof createControllerValidationService<TValues>> | undefined
  let metaService: ControllerMetaService | undefined

  function readFields(): ControllerNode<TValues>[] {
    return options.fields?.() ?? []
  }

  function readFormReadonly(): ConfigFormCondition<TValues> | undefined {
    return options.readonly?.()
  }

  function reportDiagnostic(diagnostic: ConfigFormControllerDiagnostic): void {
    try {
      options.onDiagnostic?.(diagnostic)
    }
    catch {
      // Diagnostic sinks must never make controller operations reject.
    }
  }

  const initialFields = readFields()
  const valueSchema = resolveControllerValueSchema(
    initialFields as ControllerNode<ConfigFormJsonObject>[],
    options.valueSchema,
  )
  let schemaSnapshot = valueSchema ?? deriveControllerValueSchema(initialFields as ControllerNode<ConfigFormJsonObject>[])
  const createRowId = createControllerRowIdFactory(options.createRowId)
  const scopedInputValues = applyExplicitDefaults(options.model.read(), options.defaultValues)
  let scopeService: ControllerScopeService | undefined = valueSchema
    ? createControllerScopeService(
        valueSchema,
        scopedInputValues as unknown as ConfigFormJsonObject,
        createRowId,
      )
    : undefined

  let initialValues = scopeService
    ? scopeService.store.getValues() as unknown as TValues
    : createInitialControllerValues(options.model.read(), initialFields, options.defaultValues)
  let reactionProjection = cloneProjection(applyConfigFormReactions(readFields(), initialValues))

  if (scopeService && !equalControllerValues(initialValues, reactionProjection.values)) {
    applyProjectionToScope(scopeService, reactionProjection.values)
    reactionProjection = {
      ...reactionProjection,
      values: scopeService.store.getValues() as unknown as TValues,
    }
  }
  const initializedValues = scopeService
    ? scopeService.store.getValues() as unknown as TValues
    : reactionProjection.values
  if (!equalControllerValues(options.model.read(), initializedValues))
    options.model.write(cloneControllerValue(initializedValues))
  if (scopeService)
    initialValues = cloneControllerValue(initializedValues)
  let modelObserver = scopeService ? createControllerModelObserver(scopeService, options.model.read()) : undefined

  function createResetValues(): TValues {
    return scopeService
      ? cloneControllerValue(initialValues)
      : createResetControllerValues(initialValues, readFields())
  }

  function listInternalInstances(nodeId?: string): ConfigFormFieldInstance[] {
    if (scopeService)
      return scopeService.listInstances(nodeId)
    return collectAllConfigFormFields(readFields()).flatMap((field) => {
      if (nodeId !== undefined && field.id !== nodeId)
        return []
      return [{
        address: { nodeId: field.id, scope: [] },
        field: field.field,
        instanceKey: field.field,
        value: cloneControllerValue(options.model.read()[field.field]),
        valuePath: [field.field],
      }]
    })
  }

  function getFlatInstance(address: ConfigFormFieldAddress): ConfigFormFieldInstance {
    if (address.scope.length > 0)
      throw new Error(`Flat ConfigForm field ${address.nodeId} cannot use a row scope.`)
    const field = collectAllConfigFormFields(readFields()).find(item => item.id === address.nodeId)
    if (!field)
      throw new Error(`Unknown ConfigForm field node: ${address.nodeId}`)
    return {
      address: { nodeId: field.id, scope: [] },
      field: field.field,
      instanceKey: field.field,
      value: cloneControllerValue(options.model.read()[field.field]),
      valuePath: [field.field],
    }
  }

  function getInternalInstance(address: ConfigFormFieldAddress): ConfigFormFieldInstance {
    synchronizeScopedModel()
    return scopeService ? scopeService.getInstance(address) : getFlatInstance(address)
  }

  function resolveRootInstance(field: string): ConfigFormFieldInstance | undefined {
    if (scopeService) {
      const definition = scopeService.getRootDefinition(field)
      return definition
        ? scopeService.getInstance({ nodeId: definition.nodeId, scope: [] })
        : undefined
    }
    const node = collectAllConfigFormFields(readFields()).find(item => item.field === field)
    return node ? getFlatInstance({ nodeId: node.id, scope: [] }) : undefined
  }

  function resolveRootInstanceKey(field: string): string {
    return resolveRootInstance(field)?.instanceKey ?? field
  }

  function renewOperationLifetime(reason: string): void {
    operationLifetime.abort(reason)
    operationLifetime = new AbortController()
  }

  function synchronizeScopedModel(): void {
    if (!scopeService || synchronizingModel || disposed)
      return
    const hostValues = options.model.read()
    const observation = modelObserver?.prepare(hostValues)
    const ownedValues = scopeService.store.getValues() as unknown as TValues
    if (!observation?.changed && equalControllerValues(hostValues, ownedValues))
      return

    synchronizingModel = true
    try {
      const mutation = scopeService.store.replaceValues(hostValues as unknown as ConfigFormJsonObject, observation?.retainedArrays)
      if (mutation.invalidatedScopes.length > 0)
        renewOperationLifetime('value scope replaced')
      const next = scopeService.store.getValues() as unknown as TValues
      if (!equalControllerValues(hostValues, next))
        optionsModelWrite(next)
      else
        modelObserver?.observe(hostValues)
      const projection = cloneProjection(applyConfigFormReactions(readFields(), next))
      reactionProjection = { ...projection, values: cloneControllerValue(next) }
      const instances = listInternalInstances()
      validationService?.invalidate('external values replaced')
      validationService?.reconcileInstances(instances)
      metaService?.reconcileInstances(instances)
      metaService?.commitMeta()
    }
    finally {
      synchronizingModel = false
    }
  }

  function getValues(): TValues {
    synchronizeScopedModel()
    return scopeService
      ? cloneControllerValue(scopeService.store.getValues() as unknown as TValues)
      : cloneControllerValue(options.model.read())
  }

  function getValue<TField extends string>(
    field: TField,
  ): ConfigFormFieldValue<TValues, TField> {
    return cloneControllerValue(getValues()[field])
  }

  function getInstanceValue(address: ConfigFormFieldAddress): ConfigFormJsonValue | undefined {
    return cloneControllerValue(getInternalInstance(address).value) as ConfigFormJsonValue | undefined
  }

  function getInstanceKey(address: ConfigFormFieldAddress): string {
    return getInternalInstance(address).instanceKey
  }

  function listFieldInstances(nodeId?: string): readonly ConfigFormFieldInstance[] {
    synchronizeScopedModel()
    return listInternalInstances(nodeId).map(cloneInstance)
  }

  function getFieldStates(
    values: TValues,
    projection?: ConfigFormReactionProjection<TValues>,
  ): ControllerFieldState<TValues>[] {
    const fields = readFields()
    const nextProjection = cloneProjection(projection ?? applyConfigFormReactions(fields, values))
    const formReadonly = resolveConfigFormCondition(readFormReadonly(), nextProjection.values, false)
    const projectedStates = {
      ...nextProjection.states,
      ...(options.reactionStates?.() ?? {}),
    }
    const baseProjection = scopeService
      ? { ...nextProjection, states: {} }
      : { ...nextProjection, states: projectedStates }
    reactionProjection = nextProjection
    const baseStates = resolveControllerFieldStates(
      fields,
      baseProjection,
      formReadonly,
      Boolean(scopeService),
    )
    const stateByNodeId = new Map(baseStates.map(state => [state.field.id, state]))

    return listInternalInstances().flatMap((instance) => {
      const base = stateByNodeId.get(instance.address.nodeId)
      if (!base)
        return []
      const field = base.field.field === instance.field
        ? base.field
        : { ...base.field, field: instance.field }
      if (!scopeService) {
        return [{
          ...base,
          address: cloneAddress(instance.address),
          field,
          instanceKey: instance.instanceKey,
          valuePath: [...instance.valuePath],
        }]
      }

      const overlay = projectedStates[instance.instanceKey]
        ?? projectedStates[instance.address.nodeId]
        ?? (instance.ownerScopeId === undefined ? projectedStates[instance.field] : undefined)
      const visible = overlay?.visible ?? base.visible
      const disabled = overlay?.disabled ?? base.disabled
      const readonly = formReadonly || (overlay?.readonly ?? base.readonly)
      const required = overlay?.required ?? base.required
      return [{
        ...base,
        address: cloneAddress(instance.address),
        disabled,
        field,
        instanceKey: instance.instanceKey,
        readonly,
        required,
        validatable: visible && !disabled && !readonly,
        valuePath: [...instance.valuePath],
        visible,
      }]
    })
  }

  const meta = createControllerMetaService({
    listInstances: listInternalInstances,
    onMetaChange: options.onMetaChange,
    readResetValues: createResetValues,
    readValues: getValues,
    get scoped() { return Boolean(scopeService) },
  })
  metaService = meta

  const validation = createControllerValidationService({
    getFieldStates,
    onErrorsChange: options.onErrorsChange,
    onIssuesChange: options.onIssuesChange,
    onValidatingChange: options.onValidatingChange,
    readValues: getValues,
  })
  validationService = validation

  function hasLifecycle(kind: ConfigFormLifecycleKind): boolean {
    return options.onLifecycle !== undefined && (options.shouldRunLifecycle?.(kind) ?? true)
  }

  async function runLifecycle(
    kind: ConfigFormLifecycleKind,
    input: ConfigFormLifecycleInput<TValues> = {},
  ): Promise<boolean> {
    if (disposed || operationLifetime.signal.aborted)
      return false
    if (lifecycleDepth >= MAX_LIFECYCLE_REENTRY) {
      reportDiagnostic({
        code: 'CONFIG_FORM_LIFECYCLE_REENTRY_LIMIT',
        kind,
        message: `ConfigForm lifecycle reentry exceeded ${MAX_LIFECYCLE_REENTRY} active hooks.`,
      })
      return false
    }

    const lifetime = operationLifetime
    const address = input.address ? cloneAddress(input.address) : undefined
    const scope = input.scope ? cloneScope(input.scope) : address?.scope
    lifecycleDepth += 1
    try {
      const result = await awaitControllerLifecycle(options.onLifecycle?.(kind, {
        kind,
        values: cloneControllerValue(input.values ?? getValues()),
        ...(input.previousValues === undefined
          ? {}
          : { previousValues: cloneControllerValue(input.previousValues) }),
        errors: cloneErrors(input.errors ?? validation.getErrors()),
        ...(input.fields === undefined ? {} : { fields: [...input.fields] }),
        ...(address === undefined ? {} : { address }),
        ...(scope === undefined ? {} : { scope: cloneScope(scope) }),
        signal: lifetime.signal,
      }), lifetime.signal)
      return result !== false
        && !disposed
        && operationLifetime === lifetime
        && !lifetime.signal.aborted
    }
    catch (cause) {
      if (!disposed && operationLifetime === lifetime && !lifetime.signal.aborted) {
        reportDiagnostic({
          cause,
          code: 'CONFIG_FORM_LIFECYCLE_ERROR',
          kind,
          message: cause instanceof Error ? cause.message : String(cause),
        })
      }
      return false
    }
    finally {
      lifecycleDepth = Math.max(0, lifecycleDepth - 1)
    }
  }

  function scheduleValuesChange(
    previousValues: TValues,
    values: TValues,
    input: Pick<ConfigFormLifecycleInput<TValues>, 'address' | 'scope'> = {},
  ): void {
    if (equalControllerValues(previousValues, values) || !hasLifecycle('form.valuesChange'))
      return
    void runLifecycle('form.valuesChange', { ...input, previousValues, values })
  }

  function getReactionProps(field: string): ConfigFormAttrs {
    return { ...(reactionProjection.props[field] ?? {}) }
  }

  function getReactionState(field: string) {
    return { ...(reactionProjection.states[field] ?? {}) }
  }

  function getInstanceReactionProps(address: ConfigFormFieldAddress): ConfigFormAttrs {
    const instance = getInternalInstance(address)
    return {
      ...(reactionProjection.props[instance.instanceKey]
        ?? reactionProjection.props[instance.address.nodeId]
        ?? (instance.ownerScopeId === undefined ? reactionProjection.props[instance.field] : undefined)
        ?? {}),
    }
  }

  function getInstanceReactionState(address: ConfigFormFieldAddress) {
    const instance = getInternalInstance(address)
    const states = {
      ...reactionProjection.states,
      ...(options.reactionStates?.() ?? {}),
    }
    return {
      ...(states[instance.instanceKey]
        ?? states[instance.address.nodeId]
        ?? (instance.ownerScopeId === undefined ? states[instance.field] : undefined)
        ?? {}),
    }
  }

  function reconcileInstanceState(commitMeta = true): void {
    const instances = listInternalInstances()
    validation.reconcileInstances(instances)
    meta.reconcileInstances(instances)
    if (commitMeta)
      meta.commitMeta()
  }

  function finalizeScopedMutation(
    previousValues: TValues,
    mutation: ConfigFormValueScopeMutationResult,
    commitOptions: {
      address?: ConfigFormFieldAddress
      clearInstanceKeys?: readonly string[]
      commitMeta?: boolean
      projection?: ConfigFormReactionProjection<TValues>
      emitFieldChange?: boolean
      field?: string
      notifyValuesChange?: boolean
      scope?: ConfigFormScopePath
    } = {},
  ): ScopedCommit<TValues> {
    if (!scopeService)
      throw new Error('ConfigForm value scopes are not enabled.')
    const candidate = scopeService.store.getValues() as unknown as TValues
    let projection = commitOptions.projection ?? cloneProjection(applyConfigFormReactions(readFields(), candidate))
    let invalidatedScopes = mutation.invalidatedScopes.map(cloneScope)
    if (!equalControllerValues(candidate, projection.values)) {
      const projectedMutation = applyProjectionToScope(scopeService, projection.values)
      invalidatedScopes = mergeInvalidatedScopes(invalidatedScopes, projectedMutation.invalidatedScopes)
    }
    if (invalidatedScopes.length > 0)
      renewOperationLifetime('value scope invalidated')
    const next = scopeService.store.getValues() as unknown as TValues
    projection = { ...projection, values: cloneControllerValue(next) }
    reactionProjection = projection
    optionsModelWrite(next)
    // A commit that leaves the values unchanged (a scoped update re-committing touched
    // roots, for example) must not invalidate work in flight: doing so silently
    // discarded validation that had just produced issues. Comparing is only worth its
    // cost while something is actually in flight; otherwise keep the plain invalidation.
    if (!validation.getValidating() || !equalControllerValues(previousValues, next))
      validation.invalidate('scoped values committed')
    reconcileInstanceState(false)
    if (commitOptions.clearInstanceKeys !== undefined)
      validation.clearErrors(commitOptions.clearInstanceKeys)
    if (commitOptions.commitMeta !== false)
      meta.commitMeta()

    if (commitOptions.emitFieldChange) {
      const instance = commitOptions.address
        ? scopeService.getInstance(commitOptions.address)
        : undefined
      const field = instance?.field ?? commitOptions.field
      if (field !== undefined) {
        optionsOnFieldChange({
          ...(instance
            ? { address: cloneAddress(instance.address), scope: cloneScope(instance.address.scope) }
            : {}),
          field,
          value: cloneControllerValue(instance ? instance.value : next[field]),
          values: cloneControllerValue(next),
        })
      }
    }
    optionsOnChange(next)
    if (commitOptions.notifyValuesChange !== false) {
      scheduleValuesChange(previousValues, next, {
        ...(commitOptions.address ? { address: cloneAddress(commitOptions.address) } : {}),
        ...(commitOptions.scope ? { scope: cloneScope(commitOptions.scope) } : {}),
      })
    }
    return { invalidatedScopes, projection, values: cloneControllerValue(next) }
  }

  function optionsModelWrite(values: TValues): void {
    const wasSynchronizing = synchronizingModel
    synchronizingModel = true
    try {
      options.model.write(cloneControllerValue(values))
      modelObserver?.observe(options.model.read())
    }
    finally {
      synchronizingModel = wasSynchronizing
    }
  }

  function optionsOnChange(values: TValues): void {
    options.onChange?.(cloneControllerValue(values))
  }

  function optionsOnFieldChange(payload: Parameters<NonNullable<typeof options.onFieldChange>>[0]): void {
    options.onFieldChange?.(payload)
  }

  function commitFlatValues(
    values: TValues,
    fieldsToClear?: string[],
    notifyValuesChange = true,
  ): ConfigFormReactionProjection<TValues> {
    if (disposed)
      return reactionProjection
    const previousValues = getValues()
    const projection = cloneProjection(applyConfigFormReactions(readFields(), cloneControllerValue(values)))
    reactionProjection = projection
    const next = cloneControllerValue(projection.values)
    options.model.write(next)
    validation.invalidate('values committed')
    validation.clearErrors(fieldsToClear)
    meta.commitMeta()
    options.onChange?.(cloneControllerValue(next))
    if (notifyValuesChange)
      scheduleValuesChange(previousValues, next)
    return projection
  }

  function patchScopedRootFields(
    values: TValues,
    fieldNames: readonly string[],
  ): ConfigFormValueScopeMutationResult {
    if (!scopeService)
      throw new Error('ConfigForm value scopes are not enabled.')
    const patch = Object.fromEntries(fieldNames
      .filter(field => Object.hasOwn(values, field))
      .map(field => [field, values[field]])) as ConfigFormJsonObject
    return scopeService.store.patchValues(patch, fieldNames.filter(field => !Object.hasOwn(values, field)))
  }

  function commitValues(
    values: TValues,
    fieldsToClear?: string[],
    notifyValuesChange = true,
    patchRootFields = false,
  ): ConfigFormReactionProjection<TValues> {
    if (!scopeService)
      return commitFlatValues(values, fieldsToClear, notifyValuesChange)
    if (disposed)
      return reactionProjection
    const previousValues = getValues()
    const mutation = patchRootFields
      ? patchScopedRootFields(values, fieldsToClear ?? [])
      : scopeService.store.replaceValues(values as unknown as ConfigFormJsonObject)
    return finalizeScopedMutation(previousValues, mutation, {
      clearInstanceKeys: fieldsToClear?.map(resolveRootInstanceKey),
      notifyValuesChange,
    }).projection
  }

  function commitFlatFieldValue(
    field: string,
    value: unknown,
    address?: ConfigFormFieldAddress,
  ): ConfigFormReactionProjection<TValues> {
    if (disposed)
      return reactionProjection
    const previousValues = getValues()
    const values = cloneControllerValue(previousValues)
    setConfigFormValue(values, field, value)

    const projection = cloneProjection(applyConfigFormReactions(readFields(), values))
    reactionProjection = projection
    const next = cloneControllerValue(projection.values)
    options.model.write(next)
    validation.invalidate('field value committed')
    validation.clearErrors([field])
    meta.commitMeta()
    options.onFieldChange?.({
      ...(address ? { address: cloneAddress(address), scope: cloneScope(address.scope) } : {}),
      field,
      value: cloneControllerValue(next[field]),
      values: cloneControllerValue(next),
    })
    options.onChange?.(cloneControllerValue(next))
    scheduleValuesChange(previousValues, next, address ? { address } : {})
    return projection
  }

  function commitRootFieldValue(
    field: string,
    value: unknown,
  ): ConfigFormReactionProjection<TValues> {
    if (!scopeService)
      return commitFlatFieldValue(field, value)
    if (disposed)
      return reactionProjection
    const previousValues = getValues()
    const definition = scopeService.getRootDefinition(field)
    let mutation: ConfigFormValueScopeMutationResult
    let address: ConfigFormFieldAddress | undefined
    if (definition) {
      address = { nodeId: definition.nodeId, scope: [] }
      mutation = scopeService.store.setValue(
        definition.nodeId,
        value as ConfigFormJsonValue,
        [],
      )
    }
    else {
      mutation = scopeService.store.patchValues({ [field]: value as ConfigFormJsonValue })
    }
    return finalizeScopedMutation(previousValues, mutation, {
      ...(address ? { address } : {}),
      clearInstanceKeys: [address ? scopeService.getInstanceKey(address) : field],
      emitFieldChange: true,
      field,
    }).projection
  }

  function applyValuePatch(patch: ConfigFormValuePatch): void {
    if (disposed)
      return
    if (!patch || typeof patch !== 'object' || Array.isArray(patch))
      throw new Error('ConfigForm value patch must be an object.')
    const instances = patch.instances === undefined ? [] : patch.instances
    if (!Array.isArray(instances))
      throw new Error('ConfigForm value patch instances must be an array.')
    const corePatch: ConfigFormValueScopePatch = {
      set: patch.set,
      remove: patch.remove,
      instances: Array.from(instances, (instance) => {
        if (!instance?.address || !Array.isArray(instance.address.scope))
          throw new Error('ConfigForm value patch requires a stable field address.')
        const { address, ...operation } = instance
        return { ...operation, nodeId: address.nodeId, scope: address.scope }
      }),
    }
    const previousValues = getValues()
    if (!scopeService) {
      // Share patch validation without restricting unrelated non-JSON host values.
      const store = createConfigFormValueScopeStore({
        scopes: [],
        fields: collectAllConfigFormFields(readFields()).map(field => ({ nodeId: field.id, field: field.field })),
      })
      const mutation = store.applyPatch(corePatch)
      const next = cloneControllerValue(previousValues)
      Object.entries(mutation.values).forEach(([field, value]) => setConfigFormValue(next, field, value))
      patch.remove?.forEach(field => delete next[field])
      const removedFields = instances.filter(instance => instance.remove)
        .map(instance => store.resolvePath(instance.address.nodeId, instance.address.scope)[0] as string)
      removedFields.forEach(field => delete next[field])
      const projection = commitFlatValues(next, [...Object.keys(mutation.values), ...(patch.remove ?? []), ...removedFields])
      scheduleReactionValidation(projection.validate)
      return
    }

    const service = scopeService
    const clearInstanceKeys = [...new Set([
      ...Object.keys(patch.set ?? {}).map(resolveRootInstanceKey),
      ...(patch.remove ?? []).map(resolveRootInstanceKey),
      ...instances.map(instance => service.getInstanceKey(instance.address)),
    ])]
    const prepared = service.store.transaction((store) => {
      const mutation = store.applyPatch(corePatch)
      let projection = cloneProjection(applyConfigFormReactions(readFields(), mutation.values as unknown as TValues))
      let invalidatedScopes = mutation.invalidatedScopes.map(cloneScope)
      if (!equalControllerValues(mutation.values, projection.values)) {
        const projected = applyProjectionToScope({ ...service, store }, projection.values)
        invalidatedScopes = mergeInvalidatedScopes(invalidatedScopes, projected.invalidatedScopes)
      }
      projection = { ...projection, values: store.getValues() as unknown as TValues }
      return { mutation: { ...mutation, values: projection.values as unknown as ConfigFormJsonObject, invalidatedScopes }, projection }
    })
    const commit = finalizeScopedMutation(previousValues, prepared.mutation, {
      clearInstanceKeys,
      projection: prepared.projection,
    })
    scheduleReactionValidation(commit.projection.validate, undefined, commit.projection)
  }

  function setValue<TField extends string>(
    field: TField,
    value: ConfigFormFieldValue<TValues, NoInfer<TField>>,
  ): void {
    if (disposed)
      return
    const projection = commitRootFieldValue(field, value)
    scheduleReactionValidation(projection.validate)
  }

  function setInstanceValue(address: ConfigFormFieldAddress, value: ConfigFormJsonValue): void {
    if (disposed)
      return
    if (!scopeService) {
      const instance = getFlatInstance(address)
      const projection = commitFlatFieldValue(instance.field, value, address)
      scheduleReactionValidation(projection.validate, instance.instanceKey)
      return
    }
    const previousValues = getValues()
    const instance = scopeService.getInstance(address)
    const mutation = scopeService.store.setValue(address.nodeId, value, address.scope)
    const commit = finalizeScopedMutation(previousValues, mutation, {
      address,
      clearInstanceKeys: [instance.instanceKey],
      emitFieldChange: true,
    })
    scheduleReactionValidation(commit.projection.validate, instance.instanceKey)
  }

  function setValues(values: Partial<TValues>, replace?: false): void
  function setValues(values: TValues, replace: true): void
  function setValues(
    ...args: [values: Partial<TValues>, replace?: false] | [values: TValues, replace: true]
  ): void {
    if (disposed)
      return
    const next = args[1] === true ? cloneControllerValue(args[0]) : getValues()
    if (args[1] !== true) {
      Object.entries(args[0]).forEach(([field, value]) => {
        setConfigFormValue(next, field, value)
      })
    }
    const projection = commitValues(next as TValues, Object.keys(args[0]), true, args[1] !== true)
    scheduleReactionValidation(projection.validate)
  }

  function applyFieldChange(request: ConfigFormFieldChangeRequest<TValues>): void {
    if (disposed)
      return
    const projection = commitRootFieldValue(request.field, request.value)
    const instanceKey = resolveRootInstanceKey(request.field)
    void validation.validateField(instanceKey, 'change', projection)
    scheduleReactionValidation(projection.validate, instanceKey)
  }

  function applyFieldInstanceChange(request: ConfigFormFieldInstanceChangeRequest): void {
    if (disposed)
      return
    if (!scopeService) {
      const instance = getFlatInstance(request.address)
      const projection = commitFlatFieldValue(instance.field, request.value, request.address)
      void validation.validateField(instance.instanceKey, 'change', projection)
      scheduleReactionValidation(projection.validate, instance.instanceKey)
      return
    }
    const previousValues = getValues()
    const instance = scopeService.getInstance(request.address)
    const mutation = scopeService.store.setValue(
      request.address.nodeId,
      request.value,
      request.address.scope,
    )
    const commit = finalizeScopedMutation(previousValues, mutation, {
      address: request.address,
      clearInstanceKeys: [instance.instanceKey],
      emitFieldChange: true,
    })
    void validation.validateField(instance.instanceKey, 'change', commit.projection)
    scheduleReactionValidation(commit.projection.validate, instance.instanceKey)
  }

  function scheduleReactionValidation(
    targets: string[],
    excludedInstanceKey?: string,
    projection?: ConfigFormReactionProjection<TValues>,
  ): void {
    if (disposed)
      return
    targets.flatMap(resolveReactionTargetInstanceKeys)
      .filter(instanceKey => instanceKey !== excludedInstanceKey)
      .forEach(instanceKey => void validation.validateField(instanceKey, 'change', projection))
  }

  function resolveReactionTargetInstanceKeys(target: string): string[] {
    if (!scopeService)
      return [resolveRootInstanceKey(target)]
    const byNodeId = scopeService.listInstances(target)
    if (byNodeId.length > 0)
      return byNodeId.map(instance => instance.instanceKey)
    const root = scopeService.getRootDefinition(target)
    return root ? [scopeService.getInstanceKey({ nodeId: root.nodeId, scope: [] })] : []
  }

  function updateValueSchema(schema?: ConfigFormValueSchema): void {
    if (disposed)
      return
    const nodes = readFields() as ControllerNode<ConfigFormJsonObject>[]
    const resolved = resolveControllerValueSchema(nodes, schema)
    const nextSchema = resolved ?? deriveControllerValueSchema(nodes)
    if (Boolean(resolved) === Boolean(scopeService)
      && equalControllerValues({ schema: schemaSnapshot }, { schema: nextSchema })) {
      return
    }

    const previousValues = cloneControllerValue(options.model.read())
    const candidate = prepareControllerSchemaRefresh({
      createRowId,
      previousSchema: schemaSnapshot,
      previousService: scopeService,
      resetValues: initialValues,
      schema: nextSchema,
      scoped: resolved !== undefined,
      values: previousValues,
    })
    let projection = cloneProjection(applyConfigFormReactions(readFields(), candidate.values))
    if (candidate.scopeService) {
      if (!equalControllerValues(candidate.values, projection.values))
        applyProjectionToScope(candidate.scopeService, projection.values)
      projection = { ...projection, values: candidate.scopeService.store.getValues() as unknown as TValues }
    }
    const instances = candidate.scopeService?.listInstances() ?? candidate.instances
    const surviving = instances.filter(instance => candidate.previousKeys.has(instance.instanceKey))
    const errors = validation.getErrors()
    const remapped = surviving.some(instance => candidate.previousKeys.get(instance.instanceKey) !== instance.instanceKey)

    const currentKeys = new Set(instances.map(instance => instance.instanceKey))
    const unboundInstances: ConfigFormFieldInstance[] = !scopeService && !candidate.scopeService
      ? Object.keys(errors).filter(key => !candidate.previousInstanceKeys.has(key) && !currentKeys.has(key)).map(key => ({
          address: { nodeId: key, scope: [] },
          field: key,
          instanceKey: key,
          value: cloneControllerValue(projection.values[key]),
          valuePath: [key],
        }))
      : []

    scopeService = candidate.scopeService
    schemaSnapshot = nextSchema
    initialValues = candidate.resetValues
    reactionProjection = projection
    modelObserver = scopeService ? createControllerModelObserver(scopeService, options.model.read()) : undefined
    if (!equalControllerValues(previousValues, projection.values))
      optionsModelWrite(projection.values)
    renewOperationLifetime('value schema updated')
    validation.invalidate('value schema updated')
    if (remapped) {
      validation.setErrors(Object.fromEntries(surviving.flatMap((instance) => {
        const messages = errors[candidate.previousKeys.get(instance.instanceKey)!]
        return messages ? [[instance.instanceKey, messages]] : []
      })))
    }
    else {
      validation.reconcileInstances([...surviving, ...unboundInstances])
    }
    meta.refreshSchema(instances, candidate.previousKeys, candidate.defaults, candidate.previousInstanceKeys)
    meta.commitMeta()
    if (!equalControllerValues(previousValues, projection.values))
      optionsOnChange(projection.values)
  }

  function refreshReactions(): void {
    if (disposed)
      return
    const values = getValues()
    const projection = cloneProjection(applyConfigFormReactions(readFields(), values))
    if (scopeService) {
      if (!equalControllerValues(values, projection.values)) {
        const mutation = applyProjectionToScope(scopeService, projection.values)
        const commit = finalizeScopedMutation(values, mutation, { notifyValuesChange: false })
        scheduleReactionValidation(commit.projection.validate, undefined, commit.projection)
        return
      }
      reactionProjection = projection
      validation.invalidate('reactions refreshed')
      reconcileInstanceState()
      scheduleReactionValidation(projection.validate, undefined, projection)
      return
    }

    reactionProjection = projection
    validation.invalidate('reactions refreshed')
    if (!equalControllerValues(values, projection.values)) {
      const next = cloneControllerValue(projection.values)
      options.model.write(next)
      options.onChange?.(cloneControllerValue(next))
    }
    meta.commitMeta()
    scheduleReactionValidation(projection.validate, undefined, projection)
  }

  function beginReset(): void {
    renewOperationLifetime('form reset')
    validation.invalidate('form reset')
  }

  const resetFlat = createControllerResetService({
    beginReset,
    clearTouched: meta.clearTouched,
    commitValues,
    createResetValues,
    readValues: getValues,
    runLifecycle,
  })

  async function resetFields(fields?: ConfigFormFieldSelector<TValues>): Promise<boolean> {
    if (disposed)
      return false
    if (!scopeService)
      return resetFlat(fields as string | string[] | undefined)

    beginReset()
    const fieldNames = normalizeControllerFieldNames(fields as string | string[] | undefined)
    const previousValues = getValues()
    if (fieldNames === undefined) {
      meta.clearTouched()
      const mutation = scopeService.store.replaceValues(createResetValues() as unknown as ConfigFormJsonObject)
      const commit = finalizeScopedMutation(previousValues, mutation, {
        commitMeta: false,
        notifyValuesChange: false,
      })
      validation.clearErrors()
      meta.recaptureBaseline()
      meta.commitMeta()
      return runLifecycle('form.reset', { values: commit.values })
    }

    const instanceKeys = fieldNames.map(resolveRootInstanceKey)
    meta.clearTouched(instanceKeys)
    const next = getValues()
    const resetValues = createResetValues()
    fieldNames.forEach((field) => {
      if (Object.hasOwn(resetValues, field))
        setConfigFormValue(next, field, resetValues[field])
      else
        delete next[field]
    })
    const mutation = patchScopedRootFields(next, fieldNames)
    const commit = finalizeScopedMutation(previousValues, mutation, {
      clearInstanceKeys: instanceKeys,
      notifyValuesChange: false,
    })
    return runLifecycle('form.reset', { fields: fieldNames, values: commit.values })
  }

  async function validate(): Promise<boolean> {
    if (disposed)
      return false
    const values = getValues()
    const result = await validation.validateValues(values)
    if (result.status === 'stale')
      return false
    const errors = validation.getErrors()
    const kind = result.status === 'valid' ? 'form.validationSuccess' : 'form.validationFailure'
    const allowed = !hasLifecycle(kind) || await runLifecycle(kind, { errors, values })
    return allowed
      && result.status === 'valid'
      && equalControllerValues(getValues(), values)
  }

  function validateField(field: string, trigger?: Parameters<typeof validation.validateField>[1]): Promise<boolean> {
    return validation.validateField(resolveRootInstanceKey(field), trigger)
  }

  function validateInstance(
    address: ConfigFormFieldAddress,
    trigger?: Parameters<typeof validation.validateField>[1],
  ): Promise<boolean> {
    return validation.validateField(getInstanceKey(address), trigger)
  }

  function clearValidate(fields?: ConfigFormFieldSelector<TValues>): void {
    renewOperationLifetime('validation cleared')
    const fieldNames = normalizeControllerFieldNames(fields as string | string[] | undefined)
    validation.clearValidate(fieldNames?.map(resolveRootInstanceKey))
  }

  function clearInstanceValidate(
    addresses: ConfigFormFieldAddress | readonly ConfigFormFieldAddress[],
  ): void {
    const list = Array.isArray(addresses) ? addresses : [addresses]
    const instanceKeys = list.map(getInstanceKey)
    renewOperationLifetime('instance validation cleared')
    validation.clearValidate(instanceKeys)
  }

  function getFieldMeta(field: string) {
    return meta.getFieldMeta(resolveRootInstanceKey(field))
  }

  function getInstanceMeta(address: ConfigFormFieldAddress) {
    return meta.getFieldMeta(getInstanceKey(address))
  }

  function setTouched(): void
  function setTouched(touched: boolean): void
  function setTouched(fields: ConfigFormFieldSelector<TValues>, touched?: boolean): void
  function setTouched(
    fieldsOrTouched?: ConfigFormFieldSelector<TValues> | boolean,
    touched = true,
  ): void {
    if (fieldsOrTouched === undefined || typeof fieldsOrTouched === 'boolean') {
      const nextTouched = typeof fieldsOrTouched === 'boolean' ? fieldsOrTouched : true
      if (!nextTouched) {
        meta.clearTouched()
        meta.commitMeta()
      }
      else {
        meta.setTouched(Object.keys(meta.getMeta().fields), true)
      }
      return
    }
    const fieldNames = normalizeControllerFieldNames(fieldsOrTouched as string | string[]) ?? []
    meta.setTouched(fieldNames.map(resolveRootInstanceKey), touched)
  }

  function setInstanceTouched(address: ConfigFormFieldAddress, touched = true): void {
    meta.setTouched([getInstanceKey(address)], touched)
  }

  const submit = createControllerSubmitService({
    getErrors: validation.getErrors,
    getFieldStates,
    getValues,
    hasLifecycle,
    isActive: () => !disposed,
    getOperationToken: () => operationLifetime,
    isOperationCurrent: token => !disposed && token === operationLifetime && !operationLifetime.signal.aborted,
    onError: options.onError,
    onSubmit: options.onSubmit,
    readValues: getValues,
    reportDiagnostic,
    runLifecycle,
    get scoped() { return Boolean(scopeService) },
    setTouched: instanceKeys => meta.setTouched(instanceKeys),
    validateValues: validation.validateValues,
  })

  function requireScopeService(): ControllerScopeService {
    if (!scopeService)
      throw new Error('ConfigForm value scopes are not enabled.')
    return scopeService
  }

  function listRows(scopeId: string, parentScope: ConfigFormScopePath = []) {
    synchronizeScopedModel()
    return requireScopeService().store.listRows(scopeId, parentScope)
  }

  function appendRow(
    scopeId: string,
    value?: ConfigFormJsonObject,
    parentScope: ConfigFormScopePath = [],
  ): ConfigFormValueScopeRowMutationResult {
    const service = requireScopeService()
    const previousValues = getValues()
    const result = service.store.appendRow(scopeId, value, parentScope)
    return finalizeRowMutation(result, previousValues, result.row.scope)
  }

  function insertRow(
    scopeId: string,
    index: number,
    value?: ConfigFormJsonObject,
    parentScope: ConfigFormScopePath = [],
  ): ConfigFormValueScopeRowMutationResult {
    const service = requireScopeService()
    const previousValues = getValues()
    const result = service.store.insertRow(scopeId, index, value, parentScope)
    return finalizeRowMutation(result, previousValues, result.row.scope)
  }

  function duplicateRow(
    scopeId: string,
    rowId: string,
    parentScope: ConfigFormScopePath = [],
  ): ConfigFormValueScopeRowMutationResult {
    const service = requireScopeService()
    const previousValues = getValues()
    const result = service.store.duplicateRow(scopeId, rowId, parentScope)
    return finalizeRowMutation(result, previousValues, result.row.scope)
  }

  function removeRow(
    scopeId: string,
    rowId: string,
    parentScope: ConfigFormScopePath = [],
  ): ConfigFormValueScopeRemoveResult {
    const service = requireScopeService()
    const previousValues = getValues()
    const result = service.store.removeRow(scopeId, rowId, parentScope)
    const commit = finalizeScopedMutation(previousValues, result, { scope: result.removedRow.scope })
    scheduleReactionValidation(commit.projection.validate, undefined, commit.projection)
    return {
      ...result,
      invalidatedScopes: commit.invalidatedScopes,
      values: commit.values as unknown as ConfigFormJsonObject,
    }
  }

  function moveRow(
    scopeId: string,
    rowId: string,
    toIndex: number,
    parentScope: ConfigFormScopePath = [],
  ): ConfigFormValueScopeRowMutationResult {
    const service = requireScopeService()
    const previousValues = getValues()
    const result = service.store.moveRow(scopeId, rowId, toIndex, parentScope)
    return finalizeRowMutation(result, previousValues, result.row.scope)
  }

  function finalizeRowMutation(
    result: ConfigFormValueScopeRowMutationResult,
    previousValues: TValues,
    scope: ConfigFormScopePath,
  ): ConfigFormValueScopeRowMutationResult {
    const commit = finalizeScopedMutation(previousValues, result, { scope })
    scheduleReactionValidation(commit.projection.validate, undefined, commit.projection)
    return {
      ...result,
      invalidatedScopes: commit.invalidatedScopes,
      values: commit.values as unknown as ConfigFormJsonObject,
    }
  }

  function dispose(): void {
    if (disposed)
      return
    disposed = true
    operationLifetime.abort('controller disposed')
    validation.dispose()
  }

  return {
    appendRow,
    applyValuePatch,
    applyFieldChange,
    applyFieldInstanceChange,
    clearInstanceValidate,
    clearValidate,
    dispose,
    duplicateRow,
    getErrors: validation.getErrors,
    getFieldMeta,
    getInstanceErrors: address => validation.getInstanceErrors(getInstanceKey(address)),
    getInstanceKey,
    getInstanceMeta,
    getInstanceValue,
    getIssues: validation.getIssues,
    getMeta: meta.getMeta,
    getReactionProps,
    getInstanceReactionProps,
    getInstanceReactionState,
    getReactionState,
    getValidating: validation.getValidating,
    getValue,
    getValues,
    insertRow,
    isFieldValidating: field => validation.isFieldValidating(resolveRootInstanceKey(field)),
    isInstanceValidating: address => validation.isFieldValidating(getInstanceKey(address)),
    listFieldInstances,
    listRows,
    moveRow,
    refreshMeta: meta.refreshMeta,
    refreshReactions,
    removeRow,
    resetFields,
    runLifecycle,
    setErrors: validation.setErrors,
    setInstanceTouched,
    setInstanceValue,
    setTouched,
    setValue,
    setValues,
    submit,
    updateValueSchema,
    validate,
    validateField,
    validateInstance,
  }
}

function applyExplicitDefaults<TValues extends ConfigFormValues>(
  values: TValues,
  defaults?: Partial<TValues>,
): TValues {
  const result = cloneControllerValue(values)
  Object.entries(defaults ?? {}).forEach(([field, value]) => setConfigFormValue(result, field, value))
  return result
}

function applyProjectionToScope<TValues extends ConfigFormValues>(
  service: ControllerScopeService,
  projectedValues: TValues,
): ConfigFormValueScopeMutationResult {
  const current = service.store.getValues() as unknown as TValues
  const changedFields = new Set([...Object.keys(current), ...Object.keys(projectedValues)])
  const changed = [...changedFields].filter(field => !equalControllerValues(
    { value: current[field], present: Object.hasOwn(current, field) },
    { value: projectedValues[field], present: Object.hasOwn(projectedValues, field) },
  ))
  if (changed.length === 0) {
    return { invalidatedScopes: [], path: [], values: service.store.getValues() }
  }

  return service.store.applyPatch({
    set: Object.fromEntries(changed.filter(field => Object.hasOwn(projectedValues, field))
      .map(field => [field, projectedValues[field]])) as ConfigFormJsonObject,
    remove: changed.filter(field => !Object.hasOwn(projectedValues, field)),
  })
}

function mergeInvalidatedScopes(
  left: readonly ConfigFormScopePath[],
  right: readonly ConfigFormScopePath[],
): ConfigFormScopePath[] {
  const values = new Map<string, ConfigFormScopePath>()
  ;[...left, ...right].forEach((scope) => {
    values.set(JSON.stringify(scope), cloneScope(scope))
  })
  return [...values.values()]
}

function cloneProjection<TValues extends ConfigFormValues>(
  projection: ConfigFormReactionProjection<TValues>,
): ConfigFormReactionProjection<TValues> {
  return {
    props: Object.fromEntries(Object.entries(projection.props).map(([field, props]) => [field, { ...props }])),
    states: Object.fromEntries(Object.entries(projection.states).map(([field, state]) => [field, { ...state }])),
    validate: [...projection.validate],
    values: cloneControllerValue(projection.values),
  }
}

function cloneInstance(instance: ConfigFormFieldInstance): ConfigFormFieldInstance {
  return {
    ...instance,
    address: cloneAddress(instance.address),
    value: cloneControllerValue(instance.value),
    valuePath: [...instance.valuePath],
  }
}

function cloneAddress(address: ConfigFormFieldAddress): ConfigFormFieldAddress {
  return { nodeId: address.nodeId, scope: cloneScope(address.scope) }
}

function cloneScope(scope: ConfigFormScopePath): ConfigFormScopePath {
  return scope.map(entry => ({ rowId: entry.rowId, scopeId: entry.scopeId }))
}

function cloneErrors(errors: ConfigFormErrors): ConfigFormErrors {
  return Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, [...messages]]))
}

function awaitControllerLifecycle<T>(pending: T | Promise<T>, signal: AbortSignal): Promise<T | false> {
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      signal.removeEventListener('abort', onAbort)
      resolve(false)
    }
    signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve(pending).then((result) => {
      signal.removeEventListener('abort', onAbort)
      resolve(result)
    }, (cause) => {
      signal.removeEventListener('abort', onAbort)
      reject(cause)
    })
    if (signal.aborted)
      onAbort()
  })
}
