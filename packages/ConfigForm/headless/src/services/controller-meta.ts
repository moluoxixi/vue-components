import type {
  ConfigFormFieldMeta,
  ConfigFormMeta,
  ConfigFormValues,
} from '../types'
import type {
  ControllerMetaService,
  ControllerNode,
} from '../types/controller-internal'
import { collectAllConfigFormFields } from '../utils'
import { normalizeControllerFieldNames } from './controller-values'

interface CreateControllerMetaServiceOptions<TValues extends ConfigFormValues> {
  onMetaChange?: (meta: ConfigFormMeta) => void
  readFields: () => ControllerNode<TValues>[]
  readResetValues: () => TValues
  readValues: () => TValues
}

export function createControllerMetaService<TValues extends ConfigFormValues>(
  options: CreateControllerMetaServiceOptions<TValues>,
): ControllerMetaService {
  const touchedFields = new Set<string>()
  let lastMeta = createMeta()

  function getMeta(): ConfigFormMeta {
    return cloneMeta(createMeta())
  }

  function getFieldMeta(field: string): ConfigFormFieldMeta {
    const values = options.readValues()
    const resetValues = options.readResetValues()
    return {
      dirty: isFieldDirty(field, values, resetValues),
      touched: touchedFields.has(field),
    }
  }

  function refreshMeta(): ConfigFormMeta {
    return commitMeta()
  }

  function setTouched(): void
  function setTouched(touched: boolean): void
  function setTouched(fields: string | string[], touched?: boolean): void
  function setTouched(
    fieldsOrTouched?: string | string[] | boolean,
    touched = true,
  ): void {
    const allFields = fieldsOrTouched === undefined || typeof fieldsOrTouched === 'boolean'
    const nextTouched = typeof fieldsOrTouched === 'boolean' ? fieldsOrTouched : touched
    const fieldNames = allFields
      ? Object.keys(createMeta().fields)
      : normalizeControllerFieldNames(fieldsOrTouched)

    if (allFields && !nextTouched) {
      touchedFields.clear()
    }
    else {
      fieldNames?.forEach(field => nextTouched ? touchedFields.add(field) : touchedFields.delete(field))
    }

    commitMeta()
  }

  function clearTouched(fields?: string[]): void {
    if (fields === undefined) {
      touchedFields.clear()
      return
    }
    fields.forEach(field => touchedFields.delete(field))
  }

  function createMeta(): ConfigFormMeta {
    const values = options.readValues()
    const resetValues = options.readResetValues()
    const fieldNames = new Set([
      ...Object.keys(values),
      ...Object.keys(resetValues),
      ...collectAllConfigFormFields(options.readFields()).map(field => field.field),
      ...touchedFields,
    ])
    const fields: ConfigFormMeta['fields'] = Object.fromEntries(
      [...fieldNames].map(field => [field, {
        dirty: isFieldDirty(field, values, resetValues),
        touched: touchedFields.has(field),
      }]),
    )

    return {
      dirty: Object.values(fields).some(field => field.dirty),
      fields,
      touched: Object.values(fields).some(field => field.touched),
    }
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
    refreshMeta,
    setTouched,
  }
}

function cloneMeta(meta: ConfigFormMeta): ConfigFormMeta {
  return {
    dirty: meta.dirty,
    fields: Object.fromEntries(
      Object.entries(meta.fields).map(([field, fieldMeta]) => [
        field,
        { ...fieldMeta },
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

function isFieldDirty(
  field: string,
  values: ConfigFormValues,
  resetValues: ConfigFormValues,
): boolean {
  const hasValue = Object.hasOwn(values, field)
  const hasResetValue = Object.hasOwn(resetValues, field)
  return hasValue !== hasResetValue
    || (hasValue && !Object.is(values[field], resetValues[field]))
}
