import type {
  PrototypeCommandReadHints,
  PrototypeDiagnostic,
  PrototypeReadResult,
  PrototypeSessionCommand,
} from '../types'
import { cloneJson, deepFreeze, hasExactKeys, isJsonObject, isRecord, isSafeIdentifier } from '../utils'
import { invalidContract, readNodeAddress, readRuntimeSnapshot, readScopePath } from './common'

export function readPrototypeSessionCommand(
  input: unknown,
  hints: PrototypeCommandReadHints = {},
): PrototypeReadResult<PrototypeSessionCommand> {
  const diagnostics: PrototypeDiagnostic[] = []
  if (!isRecord(input) || typeof input.type !== 'string') {
    return { success: false, diagnostics: [invalidContract('prototype_command_invalid', 'Prototype command requires a recognized type.')] }
  }
  let command: PrototypeSessionCommand | undefined
  switch (input.type) {
    case 'instance.valuesChanged': {
      if (!hasExactKeys(input, ['type', 'instanceId', 'values', 'runtime', 'originScope', 'changedAddresses'])
        || !isSafeIdentifier(input.instanceId) || !isJsonObject(input.values) || !Array.isArray(input.changedAddresses)) {
        break
      }
      const runtime = readRuntimeSnapshot(input.runtime, ['runtime'], diagnostics)
      const originScope = readScopePath(input.originScope, ['originScope'], diagnostics)
      const changedAddresses = input.changedAddresses.map((item, index) => readNodeAddress(item, ['changedAddresses', index], diagnostics))
      if (runtime && originScope && changedAddresses.length > 0 && changedAddresses.every(address => address !== undefined)) {
        command = {
          type: 'instance.valuesChanged',
          instanceId: input.instanceId,
          values: cloneJson(input.values),
          runtime,
          originScope,
          changedAddresses: changedAddresses as NonNullable<(typeof changedAddresses)[number]>[],
        }
      }
      break
    }
    case 'interaction.activate': {
      if (!hasExactKeys(input, ['type', 'sourceInstanceId', 'sourceAddress', 'interactionId'], ['nextInstance', 'item'])
        || !isSafeIdentifier(input.sourceInstanceId) || !isSafeIdentifier(input.interactionId)) {
        break
      }
      const sourceAddress = readNodeAddress(input.sourceAddress, ['sourceAddress'], diagnostics)
      let nextInstance: Extract<PrototypeSessionCommand, { type: 'interaction.activate' }>['nextInstance']
      if (input.nextInstance !== undefined) {
        if (!isRecord(input.nextInstance) || !hasExactKeys(input.nextInstance, ['instanceId', 'runtime'])
          || !isSafeIdentifier(input.nextInstance.instanceId)) {
          diagnostics.push(invalidContract('prototype_command_invalid', 'Next instance has an invalid shape.', ['nextInstance']))
        }
        else {
          const runtime = readRuntimeSnapshot(input.nextInstance.runtime, ['nextInstance', 'runtime'], diagnostics)
          if (runtime)
            nextInstance = { instanceId: input.nextInstance.instanceId, runtime }
        }
      }
      const item = input.item === undefined ? undefined : isJsonObject(input.item) ? cloneJson(input.item) : undefined
      if (input.item !== undefined && item === undefined)
        diagnostics.push(invalidContract('prototype_command_invalid', 'Activation item must be a JSON object.', ['item']))

      const needsNext = hints.actionKind === 'open' || hints.actionKind === 'navigate'
      if (hints.actionKind !== undefined && needsNext !== (nextInstance !== undefined)) {
        diagnostics.push(invalidContract('prototype_command_invalid', 'nextInstance is required exactly for open and navigate actions.', ['nextInstance']))
      }
      const needsItem = hints.trigger === 'rowActivate' || hints.trigger === 'itemActivate'
      if (hints.trigger !== undefined && needsItem !== (item !== undefined)) {
        diagnostics.push(invalidContract('prototype_command_invalid', 'item is required exactly for rowActivate and itemActivate.', ['item']))
      }
      if (sourceAddress && diagnostics.length === 0) {
        command = {
          type: 'interaction.activate',
          sourceInstanceId: input.sourceInstanceId,
          sourceAddress,
          interactionId: input.interactionId,
          ...(nextInstance ? { nextInstance } : {}),
          ...(item ? { item } : {}),
        }
      }
      break
    }
    case 'history.back':
      if (hasExactKeys(input, ['type']))
        command = { type: 'history.back' }
      break
    case 'overlay.dismiss':
      if (hasExactKeys(input, ['type', 'instanceId', 'reason'])
        && isSafeIdentifier(input.instanceId)
        && (input.reason === 'escape' || input.reason === 'mask' || input.reason === 'button')) {
        command = { type: 'overlay.dismiss', instanceId: input.instanceId, reason: input.reason }
      }
      break
    case 'overlay.closeAll':
      if (hasExactKeys(input, ['type']))
        command = { type: 'overlay.closeAll' }
      break
  }
  if (!command || diagnostics.length > 0) {
    return {
      success: false,
      diagnostics: diagnostics.length > 0
        ? diagnostics.map(diagnostic => ({ ...diagnostic, code: 'prototype_command_invalid' }))
        : [invalidContract('prototype_command_invalid', 'Prototype command contains unknown, missing, or invalid fields.')],
    }
  }
  return { success: true, data: deepFreeze(command) as PrototypeSessionCommand, diagnostics: [] }
}
