import type { FormValues } from '../../../types'
import type { FormValueChange, UseFormValidationOptions } from '../types'
import type { FieldValidationRequest } from '../types/validation'
import type { ValidationSnapshotService } from '../types/validation-internal'
import { toRaw } from 'vue'

type SnapshotOptions = Pick<
  UseFormValidationOptions,
  'getValueChangesSince' | 'getValuesRevision' | 'setValueChangeRetention' | 'values'
>

export function createValidationSnapshotService(
  options: SnapshotOptions,
): ValidationSnapshotService {
  const pendingSnapshotRevisionCounts = new Map<number, number>()

  function retainsValueChanges(request: FieldValidationRequest): boolean {
    return request.trigger !== 'submit' && request.visibilitySnapshot === undefined
  }

  function syncValueChangeRetention(): void {
    const oldestPendingRevision = pendingSnapshotRevisionCounts.keys().next().value
    options.setValueChangeRetention(oldestPendingRevision)
  }

  function retainPendingSnapshot(request: FieldValidationRequest): void {
    if (!retainsValueChanges(request))
      return

    pendingSnapshotRevisionCounts.set(
      request.valuesRevision,
      (pendingSnapshotRevisionCounts.get(request.valuesRevision) ?? 0) + 1,
    )
    syncValueChangeRetention()
  }

  function releasePendingSnapshot(
    request: FieldValidationRequest,
    revision = request.valuesRevision,
  ): void {
    if (!retainsValueChanges(request))
      return

    const count = pendingSnapshotRevisionCounts.get(revision)
    if (count === undefined)
      return
    if (count === 1)
      pendingSnapshotRevisionCounts.delete(revision)
    else
      pendingSnapshotRevisionCounts.set(revision, count - 1)
    syncValueChangeRetention()
  }

  function refreshPendingValuesSnapshot(request: FieldValidationRequest): void {
    const currentRevision = options.getValuesRevision()
    if (request.incrementalSnapshot && request.valuesRevision === currentRevision)
      return

    const changes = options.getValueChangesSince(request.valuesRevision)
    if (
      !request.incrementalSnapshot
      || changes === undefined
      || changes.some(change => change.requiresFullSnapshot)
    ) {
      refreshFullSnapshot(request, currentRevision)
      return
    }

    applyValueChanges(request.valuesSnapshot, changes)
    request.valuesRevision = currentRevision
  }

  function refreshFullSnapshot(
    request: FieldValidationRequest,
    currentRevision: number,
  ): void {
    const nextSnapshot = createValuesSnapshot()
    const revisionAfterSnapshot = options.getValuesRevision()
    request.valuesRevision = currentRevision
    if (revisionAfterSnapshot !== currentRevision) {
      const reentrantChanges = options.getValueChangesSince(currentRevision)
      if (reentrantChanges?.every(change => !change.requiresFullSnapshot)) {
        applyValueChanges(nextSnapshot, reentrantChanges)
        request.valuesRevision = revisionAfterSnapshot
      }
    }
    request.valuesSnapshot = nextSnapshot
    request.incrementalSnapshot = supportsIncrementalSnapshot()
  }

  function createValuesSnapshot(): FormValues {
    return { ...toRaw(options.values) }
  }

  function supportsIncrementalSnapshot(): boolean {
    const rawValues = toRaw(options.values)
    return Reflect.ownKeys(rawValues).every((key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(rawValues, key)
      return descriptor?.enumerable !== true || 'value' in descriptor
    })
  }

  function dispose(): void {
    pendingSnapshotRevisionCounts.clear()
    options.setValueChangeRetention(undefined)
  }

  return {
    createValuesSnapshot,
    dispose,
    refreshPendingValuesSnapshot,
    releasePendingSnapshot,
    retainPendingSnapshot,
    supportsIncrementalSnapshot,
  }
}

function applyValueChanges(
  snapshot: FormValues,
  changes: FormValueChange[],
): void {
  for (const change of changes) {
    if (change.present)
      snapshot[change.fieldName] = change.value
    else
      delete snapshot[change.fieldName]
  }
}
