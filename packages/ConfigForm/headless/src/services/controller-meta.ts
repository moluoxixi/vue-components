import type {
  ConfigFormFieldInstance,
  ConfigFormFieldMeta,
  ConfigFormMeta,
  ConfigFormValues,
} from '../types'
import type { ControllerMetaService } from '../types/controller-internal'
import { cloneControllerValue, equalControllerValues } from './controller-values'

interface CreateControllerMetaServiceOptions<TValues extends ConfigFormValues> {
  listInstances: () => readonly ConfigFormFieldInstance[]
  onMetaChange?: (meta: ConfigFormMeta) => void
  readResetValues: () => TValues
  readValues: () => TValues
  scoped: boolean
}

interface BaselineEntry {
  hasValue: boolean
  value: unknown
}

export function createControllerMetaService<TValues extends ConfigFormValues>(
  options: CreateControllerMetaServiceOptions<TValues>,
): ControllerMetaService {
  const touchedFields = new Set<string>()
  const baselineByInstance = new Map<string, BaselineEntry>()
  recaptureBaseline()
  let lastMeta = createMeta()

  function getMeta(): ConfigFormMeta {
    return cloneMeta(createMeta())
  }

  function getFieldMeta(instanceKey: string): ConfigFormFieldMeta {
    return cloneFieldMeta(createMeta().fields[instanceKey] ?? {
      dirty: false,
      touched: touchedFields.has(instanceKey),
    })
  }

  function refreshMeta(): ConfigFormMeta {
    return commitMeta()
  }

  function setTouched(instanceKeys: readonly string[], touched = true): void {
    instanceKeys.forEach(instanceKey => touched
      ? touchedFields.add(instanceKey)
      : touchedFields.delete(instanceKey))
    commitMeta()
  }

  function clearTouched(instanceKeys?: readonly string[]): void {
    if (instanceKeys === undefined) {
      touchedFields.clear()
      return
    }
    instanceKeys.forEach(instanceKey => touchedFields.delete(instanceKey))
  }

  function reconcileInstances(instances: readonly ConfigFormFieldInstance[]): void {
    const active = new Set(instances.map(instance => instance.instanceKey))
    for (const instanceKey of touchedFields) {
      if (!active.has(instanceKey))
        touchedFields.delete(instanceKey)
    }
  }

  function refreshSchema(
    instances: readonly ConfigFormFieldInstance[],
    previousKeys: ReadonlyMap<string, string>,
    defaults: ReadonlyMap<string, unknown>,
    previousInstanceKeys: ReadonlySet<string>,
  ): void {
    const previousTouched = new Set(touchedFields)
    const previousBaseline = new Map(baselineByInstance)
    const resetValues = options.readResetValues()
    touchedFields.clear()
    baselineByInstance.clear()
    if (!options.scoped) {
      const currentKeys = new Set(instances.map(instance => instance.instanceKey))
      previousTouched.forEach((key) => {
        if (!previousInstanceKeys.has(key) && !currentKeys.has(key))
          touchedFields.add(key)
      })
    }
    instances.forEach((instance) => {
      const previousKey = previousKeys.get(instance.instanceKey)
      if (previousKey !== undefined) {
        if (previousTouched.has(previousKey))
          touchedFields.add(instance.instanceKey)
        const baseline = previousBaseline.get(previousKey)
        if (baseline) {
          baselineByInstance.set(instance.instanceKey,
            !baseline.hasValue && defaults.has(instance.address.nodeId)
              ? { hasValue: true, value: cloneControllerValue(defaults.get(instance.address.nodeId)) }
              : baseline)
        }
        return
      }
      const baseline = readPath(resetValues, instance.valuePath)
      baselineByInstance.set(instance.instanceKey, baseline.hasValue ? baseline : {
        hasValue: defaults.has(instance.address.nodeId),
        value: cloneControllerValue(defaults.get(instance.address.nodeId)),
      })
    })
  }

  function recaptureBaseline(): void {
    baselineByInstance.clear()
    const values = options.readValues()
    options.listInstances().forEach((instance) => {
      baselineByInstance.set(instance.instanceKey, readPath(values, instance.valuePath))
    })
  }

  function createMeta(): ConfigFormMeta {
    const values = options.readValues()
    const resetValues = options.readResetValues()
    const instanceByKey = new Map(options.listInstances().map(instance => [instance.instanceKey, instance]))
    const fieldKeys = new Set(instanceByKey.keys())
    if (!options.scoped) {
      for (const field of [...Object.keys(values), ...Object.keys(resetValues), ...touchedFields])
        fieldKeys.add(field)
    }
    const fields: ConfigFormMeta['fields'] = Object.fromEntries(
      [...fieldKeys].map(instanceKey => [instanceKey, {
        dirty: isInstanceDirty(
          instanceByKey.get(instanceKey) ?? { instanceKey, valuePath: [instanceKey] },
          values,
          resetValues,
        ),
        touched: touchedFields.has(instanceKey),
      }]),
    )

    return {
      dirty: !equalControllerValues(values, resetValues),
      fields,
      touched: Object.values(fields).some(field => field.touched),
    }
  }

  function isInstanceDirty(
    instance: Pick<ConfigFormFieldInstance, 'instanceKey' | 'valuePath'>,
    values: TValues,
    resetValues: TValues,
  ): boolean {
    const current = readPath(values, instance.valuePath)
    const baseline = baselineByInstance.get(instance.instanceKey)
      ?? (options.scoped ? undefined : readPath(resetValues, instance.valuePath))
    if (!baseline)
      return current.hasValue
    if (current.hasValue !== baseline.hasValue)
      return true
    if (!current.hasValue)
      return false
    return !equalControllerValues(
      { value: current.value },
      { value: baseline.value },
    )
  }

  function commitMeta(): ConfigFormMeta {
    const nextMeta = createMeta()
    if (!equalMeta(lastMeta, nextMeta)) {
      lastMeta = nextMeta
      options.onMetaChange?.(cloneMeta(nextMeta))
    }
    return cloneMeta(nextMeta)
  }

  return {
    clearTouched,
    commitMeta,
    getFieldMeta,
    getMeta,
    recaptureBaseline,
    reconcileInstances,
    refreshMeta,
    refreshSchema,
    setTouched,
  }
}

function readPath(values: ConfigFormValues, path: readonly (number | string)[]): BaselineEntry {
  let current: unknown = values
  for (const segment of path) {
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, segment))
      return { hasValue: false, value: undefined }
    current = (current as Record<number | string, unknown>)[segment]
  }
  return { hasValue: true, value: cloneControllerValue(current) }
}

function cloneFieldMeta(meta: ConfigFormFieldMeta): ConfigFormFieldMeta {
  return { dirty: meta.dirty, touched: meta.touched }
}

function cloneMeta(meta: ConfigFormMeta): ConfigFormMeta {
  return {
    dirty: meta.dirty,
    fields: Object.fromEntries(
      Object.entries(meta.fields).map(([field, fieldMeta]) => [
        field,
        cloneFieldMeta(fieldMeta),
      ]),
    ),
    touched: meta.touched,
  }
}

function equalMeta(left: ConfigFormMeta, right: ConfigFormMeta): boolean {
  const leftFields = Object.keys(left.fields)
  const rightFields = Object.keys(right.fields)
  return left.dirty === right.dirty
    && left.touched === right.touched
    && leftFields.length === rightFields.length
    && leftFields.every((field) => {
      const leftMeta = left.fields[field]
      const rightMeta = right.fields[field]
      return leftMeta?.dirty === rightMeta?.dirty
        && leftMeta?.touched === rightMeta?.touched
    })
}
