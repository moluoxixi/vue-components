import type { DesignerPropertyFormEntry, DesignerPropertyParseResult } from '../types'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { computed, nextTick, shallowRef, watch } from 'vue'
import { areDesignerJsonValuesEqual } from '../../../graph'

/** Inspector drafts are local; only validated commits can reach Model commands. */
export function useDesignerPropertyFormState(options: {
  entries: () => readonly DesignerPropertyFormEntry[]
  identity: () => unknown
  readonly: () => boolean | undefined
  project: (entry: DesignerPropertyFormEntry) => unknown
  parse: (entry: DesignerPropertyFormEntry, value: unknown) => DesignerPropertyParseResult
  commit: (value: unknown, entry: DesignerPropertyFormEntry) => void
}) {
  function fieldKey(entry: DesignerPropertyFormEntry): string {
    return JSON.stringify([entry.setter.path, entry.setter.key])
  }

  const model = shallowRef<Record<string, unknown>>({})
  const modelPort = createConfigFormModel(computed({
    get: () => model.value,
    set: (next) => {
      if (!options.readonly()) {
        model.value = Object.fromEntries(options.entries().map(entry => [
          fieldKey(entry),
          entry.readonly || !Object.hasOwn(next, fieldKey(entry)) ? model.value[fieldKey(entry)] : next[fieldKey(entry)],
        ]))
      }
    },
  }))
  const errors = shallowRef<Record<string, string | undefined>>({})
  const projection = computed(() => Object.fromEntries(options.entries().map(entry => [fieldKey(entry), {
    displayValue: options.project(entry),
    value: entry.value,
    inheritedValue: entry.inheritedValue,
    mixed: entry.mixed === true,
    sourceValues: entry.sourceValues,
    readonly: entry.readonly === true,
  }])))
  const entriesByField = computed(() => new Map(options.entries().map(entry => [fieldKey(entry), entry])))

  watch([projection, options.identity, options.readonly], ([next, identity, readonly], previous) => {
    const [before, previousIdentity, previousReadonly] = previous ?? []
    const reset = !before || identity !== previousIdentity || readonly !== previousReadonly
    model.value = Object.fromEntries(Object.entries(next).map(([key, state]) => [
      key,
      !reset && Object.hasOwn(before, key) && areDesignerJsonValuesEqual(before[key], state)
        ? model.value[key]
        : state.displayValue,
    ]))
    errors.value = reset
      ? {}
      : Object.fromEntries(Object.entries(errors.value)
          .filter(([key]) => Object.hasOwn(next, key) && areDesignerJsonValuesEqual(before[key], next[key])))
  }, { immediate: true, deep: true })

  function reconcile(key: string): void {
    model.value = { ...model.value, [key]: projection.value[key]?.displayValue }
  }

  function commit(entry: DesignerPropertyFormEntry, value: unknown): void {
    const key = fieldKey(entry)
    const currentEntry = entriesByField.value.get(key)
    if (!currentEntry)
      return
    const identity = options.identity()
    const unchanged = !currentEntry.mixed && areDesignerJsonValuesEqual(value, options.project(currentEntry))
    if (!options.readonly() && !currentEntry.readonly) {
      const parsed = options.parse(currentEntry, value)
      errors.value = { ...errors.value, [key]: parsed.valid ? undefined : parsed.message }
      if (parsed.valid && !unchanged && (currentEntry.mixed || !areDesignerJsonValuesEqual(parsed.value, currentEntry.value)))
        options.commit(parsed.value, currentEntry)
    }
    // Model commands can reject without changing the authoritative projection.
    // Restore this field only, leaving unrelated drafts intact.
    void nextTick(() => {
      if (options.identity() === identity && entriesByField.value.has(key))
        reconcile(key)
    })
  }

  function captureCommit(entry: DesignerPropertyFormEntry): (value: unknown) => void {
    const identity = options.identity()
    return (value) => {
      if (options.identity() === identity)
        commit(entry, value)
    }
  }

  return { captureCommit, commit, entriesByField, errors, fieldKey, model, modelPort }
}
