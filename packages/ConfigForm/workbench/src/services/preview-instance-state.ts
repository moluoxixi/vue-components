import type {
  PrototypeSessionV1,
  SurfaceInstanceId,
} from '@moluoxixi/config-form-prototype-runtime/session'
import type { RuntimeHostInstanceStatePayloadV7 } from '../runtime-host'
import type { PreviewInstanceStateMap } from '../session/types/preview'
import { cloneWorkbenchJson } from '../utils'

export function emptyPreviewInstanceStates(): PreviewInstanceStateMap {
  return Object.create(null) as PreviewInstanceStateMap
}

export function retainLivePreviewInstanceStates(
  states: PreviewInstanceStateMap,
  session: PrototypeSessionV1,
): PreviewInstanceStateMap {
  const retained: Record<SurfaceInstanceId, RuntimeHostInstanceStatePayloadV7> = Object.create(null)
  for (const [instanceId, state] of Object.entries(states)) {
    const instance = session.instancesById[instanceId]
    if (instance?.surfaceId === state.surfaceId)
      retained[instanceId] = state
  }
  return retained
}

export function updatePreviewInstanceState(
  states: PreviewInstanceStateMap,
  session: PrototypeSessionV1,
  instanceId: SurfaceInstanceId,
  payload: RuntimeHostInstanceStatePayloadV7,
): PreviewInstanceStateMap {
  const instance = session.instancesById[instanceId]
  const previous = states[instanceId]
  if (!instance
    || instance.surfaceId !== payload.surfaceId
    || !Number.isSafeInteger(payload.stateRevision)
    || payload.stateRevision < 0
    || (previous !== undefined && payload.stateRevision <= previous.stateRevision)) {
    return states
  }
  return {
    ...states,
    [instanceId]: cloneWorkbenchJson(payload),
  }
}
