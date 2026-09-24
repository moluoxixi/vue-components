import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type {
  PrototypeSessionV1,
  SurfaceInstanceV1,
} from '@moluoxixi/config-form-prototype-runtime/session'
import type {
  ExperienceRuntimeHostIdentityEvent,
  RuntimeHostInstanceStatePayloadV7,
} from '../../runtime-host'
import type { PreviewSessionAcceptInput } from '../types/preview'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createCompilerFixture } from '../../runtime-host/__tests__/compiler-fixture'

function previewInstance(instanceId: string, value = instanceId): SurfaceInstanceV1 {
  const address = { nodeId: 'name', scope: [] }
  return {
    instanceId,
    surfaceId: 'home',
    parameters: {},
    values: { name: value },
    runtime: {
      nodeAddresses: [address],
      fieldInstances: [{ address, valuePath: ['name'] }],
    },
    projection: [],
  }
}

export function previewSessionFixture(
  instanceIds: readonly string[] = ['page-1'],
  values: Readonly<Record<string, string>> = {},
): PrototypeSessionV1 {
  return {
    version: 1,
    projectId: 'project',
    pageHistory: [...instanceIds],
    overlayStack: [],
    instancesById: Object.fromEntries(
      instanceIds.map(instanceId => [instanceId, previewInstance(instanceId, values[instanceId])]),
    ),
  }
}

export function previewStateFixture(
  instanceId: string,
  stateRevision = 1,
  value = instanceId,
): RuntimeHostInstanceStatePayloadV7 {
  const instanceKey = `${instanceId}:name`
  return {
    fields: [{
      address: { nodeId: 'name', scope: [] },
      instanceKey,
      valuePath: ['name'],
    }],
    touched: [instanceKey],
    validation: {},
    values: { name: value },
    surfaceId: 'home',
    stateRevision,
    projection: [],
  }
}

export function compilePreviewFixture(
  session = previewSessionFixture(),
  revision = 'revision-1',
  sessionId = 'session-1',
): {
  compilation: ProjectCompilation
  identity: (hostId?: string) => ExperienceRuntimeHostIdentityEvent
  input: PreviewSessionAcceptInput
  session: PrototypeSessionV1
} {
  const result = compileCanonicalProject(createCompilerFixture())
  if (!result.success)
    throw new Error(JSON.stringify(result.diagnostics))
  const compilation = result.compilation
  return {
    compilation,
    identity: (hostId = 'host-1') => ({
      hostId,
      projectId: compilation.key.projectId,
      revision,
      sessionId,
    }),
    input: { compilation, revision, session, sessionId },
    session,
  }
}
