import type {
  ContractResult,
  ModelDiagnostic,
  ProjectDocument,
  ProjectEmbeddedResource,
  ProjectResource,
  ProjectTransferEnvelopeV1,
  ProjectTransferReadResultV1,
  ProjectTransferWriteInputV1,
  RegistryLock,
  ResourceTransferContentV1,
  SurfaceTransferEnvelopeV1,
  SurfaceTransferReadResultV1,
  SurfaceTransferWriteInputV1,
} from '../types'
import { z } from 'zod'
import {
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  PROJECT_TRANSFER_VERSION,
  SURFACE_GRAPH_VERSION,
  SURFACE_TRANSFER_VERSION,
} from '../constants'
import {
  parseProjectDocument,
  projectDatasetSchema,
  projectResourceSchema,
  projectSurfaceSchema,
  registryLockSchema,
} from '../schemas'
import { identifierSchema } from '../schemas/identity'
import { registryLockFingerprint } from '../schemas/registry-identity'
import { collectSurfaceDependencyClosure } from './reference-integrity'

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const CANONICAL_BASE64 = /^(?:[A-Z0-9+/]{4})*(?:[A-Z0-9+/]{2}==|[A-Z0-9+/]{3}=)?$/i
const MAX_EMBEDDED_RESOURCE_BYTES = 10 * 1024 * 1024
const MAX_EMBEDDED_RESOURCE_COUNT = 256
const MAX_EMBEDDED_TOTAL_BYTES = 50 * 1024 * 1024

const transferContentSchema: z.ZodType<ResourceTransferContentV1> = z.object({
  encoding: z.literal('base64'),
  data: z.string(),
}).strict()
const embeddedContentSchema = z.object({
  resourceId: identifierSchema,
  content: transferContentSchema,
}).strict()
const projectTransferEnvelopeSchema = z.object({
  kind: z.literal('config-form-project'),
  version: z.literal(PROJECT_TRANSFER_VERSION),
  document: z.unknown(),
  embeddedContents: z.array(embeddedContentSchema),
}).strict()
const surfaceTransferEnvelopeSchema = z.object({
  kind: z.literal('config-form-surface'),
  version: z.literal(SURFACE_TRANSFER_VERSION),
  rootSurfaceId: identifierSchema,
  surfaceOrder: z.array(identifierSchema).min(1),
  surfacesById: z.record(identifierSchema, projectSurfaceSchema),
  datasetOrder: z.array(identifierSchema),
  datasetsById: z.record(identifierSchema, projectDatasetSchema),
  resources: z.record(identifierSchema, projectResourceSchema),
  embeddedContents: z.array(embeddedContentSchema),
  registryLock: registryLockSchema,
}).strict()

export async function writeProjectTransfer(
  input: ProjectTransferWriteInputV1,
): Promise<ContractResult<ProjectTransferEnvelopeV1>> {
  const parsed = parseProjectDocument(input.document)
  if (!parsed.success)
    return parsed
  const embeddedContents = await writeEmbeddedContents(parsed.data, input.readEmbedded)
  if (!embeddedContents.success)
    return embeddedContents
  return success({
    kind: 'config-form-project',
    version: PROJECT_TRANSFER_VERSION,
    document: structuredClone(parsed.data),
    embeddedContents: embeddedContents.data,
  })
}

export async function readProjectTransfer(
  input: unknown,
): Promise<ContractResult<ProjectTransferReadResultV1>> {
  let versionFailure: ModelDiagnostic | undefined
  try {
    versionFailure = validateEnvelopeVersion(input, 'ProjectTransfer', PROJECT_TRANSFER_VERSION)
  }
  catch {
    return projectStructureInspectionFailure()
  }
  if (versionFailure)
    return failure(versionFailure)
  let envelope: ReturnType<typeof projectTransferEnvelopeSchema.safeParse>
  try {
    envelope = projectTransferEnvelopeSchema.safeParse(input)
  }
  catch {
    return projectStructureInspectionFailure()
  }
  if (!envelope.success)
    return zodFailure('project_structure_invalid', envelope.error.issues)
  let document: ReturnType<typeof parseProjectDocument>
  try {
    document = parseProjectDocument(envelope.data.document)
  }
  catch {
    return projectStructureInspectionFailure()
  }
  if (!document.success)
    return document
  const bytes = await readEmbeddedContents(document.data.resources, envelope.data.embeddedContents)
  if (!bytes.success)
    return bytes
  return success({
    document: structuredClone(document.data),
    embeddedBytesByResourceId: bytes.data,
  })
}

export async function writeSurfaceTransfer(
  input: SurfaceTransferWriteInputV1,
): Promise<ContractResult<SurfaceTransferEnvelopeV1>> {
  const parsed = parseProjectDocument(input.document)
  if (!parsed.success)
    return parsed
  const document = parsed.data
  if (!Object.hasOwn(document.surfacesById, input.rootSurfaceId)) {
    return failure({
      code: 'surface_reference_invalid',
      message: `Root Surface does not exist: ${input.rootSurfaceId}.`,
      path: ['rootSurfaceId'],
      surfaceId: input.rootSurfaceId,
    })
  }
  const closure = collectSurfaceDependencyClosure(document, input.rootSurfaceId)
  const surfacesById = Object.fromEntries(closure.surfaceIds.map(id => [id, structuredClone(document.surfacesById[id]!)]))
  const datasetsById = Object.fromEntries(closure.datasetIds.map(id => [id, structuredClone(document.datasetsById[id]!)]))
  const resources = Object.fromEntries(closure.resourceIds.map(id => [id, structuredClone(document.resources[id]!)]))
  const registryLockResult = createRegistrySubsetLock(document.registryLock, Object.values(surfacesById))
  if (!registryLockResult.success)
    return registryLockResult
  const embeddedContents = await writeEmbeddedContentsForResources(document.id, resources, input.readEmbedded)
  if (!embeddedContents.success)
    return embeddedContents
  return success({
    kind: 'config-form-surface',
    version: SURFACE_TRANSFER_VERSION,
    rootSurfaceId: input.rootSurfaceId,
    surfaceOrder: closure.surfaceIds,
    surfacesById,
    datasetOrder: closure.datasetIds,
    datasetsById,
    resources,
    embeddedContents: embeddedContents.data,
    registryLock: registryLockResult.data,
  })
}

export async function readSurfaceTransfer(
  input: unknown,
): Promise<ContractResult<SurfaceTransferReadResultV1>> {
  let versionFailure: ModelDiagnostic | undefined
  try {
    versionFailure = validateEnvelopeVersion(input, 'SurfaceTransfer', SURFACE_TRANSFER_VERSION)
  }
  catch {
    return failure({
      code: 'surface_graph_invalid',
      message: 'Surface transfer structure cannot be inspected safely.',
      path: [],
    })
  }
  if (versionFailure)
    return failure(versionFailure)
  let parsed: ReturnType<typeof surfaceTransferEnvelopeSchema.safeParse>
  try {
    parsed = surfaceTransferEnvelopeSchema.safeParse(input)
  }
  catch {
    return failure({
      code: 'surface_graph_invalid',
      message: 'Surface transfer structure cannot be inspected safely.',
      path: [],
    })
  }
  if (!parsed.success)
    return zodFailure('surface_graph_invalid', parsed.error.issues)
  const envelope = parsed.data
  const structure = validateSurfaceTransferStructure(envelope)
  if (!structure.success)
    return structure
  const bytes = await readEmbeddedContents(envelope.resources, envelope.embeddedContents)
  if (!bytes.success)
    return bytes
  return success({
    rootSurfaceId: envelope.rootSurfaceId,
    surfaceOrder: [...envelope.surfaceOrder],
    surfacesById: structuredClone(envelope.surfacesById),
    datasetOrder: [...envelope.datasetOrder],
    datasetsById: structuredClone(envelope.datasetsById),
    resources: structuredClone(envelope.resources),
    registryLock: structuredClone(envelope.registryLock),
    embeddedBytesByResourceId: bytes.data,
  })
}

function validateSurfaceTransferStructure(
  envelope: z.infer<typeof surfaceTransferEnvelopeSchema>,
): ContractResult<true> {
  const page = envelope.surfaceOrder
    .map(id => envelope.surfacesById[id])
    .find(surface => surface?.kind === 'page')
  const syntheticSurfaceId = uniqueSyntheticSurfaceId(envelope.surfacesById)
  const syntheticRoute = uniqueSyntheticRoute(envelope.surfacesById)
  const surfacesById = page
    ? envelope.surfacesById
    : {
        ...envelope.surfacesById,
        [syntheticSurfaceId]: {
          id: syntheticSurfaceId,
          kind: 'page' as const,
          name: 'Transfer validation page',
          route: syntheticRoute,
          parameters: [],
          outputs: [],
          interactions: [],
          graph: { version: SURFACE_GRAPH_VERSION, props: {}, form: {}, root: [], nodesById: {} },
        },
      }
  const surfaceOrder = page ? envelope.surfaceOrder : [...envelope.surfaceOrder, syntheticSurfaceId]
  const project = parseProjectDocument({
    version: PROJECT_DOCUMENT_VERSION,
    id: 'surface-transfer-validation',
    name: 'Surface transfer validation',
    homeSurfaceId: page?.id ?? syntheticSurfaceId,
    surfaceOrder,
    surfacesById,
    datasetOrder: envelope.datasetOrder,
    datasetsById: envelope.datasetsById,
    resources: envelope.resources,
    theme: { version: PROJECT_THEME_VERSION },
    registryLock: envelope.registryLock,
    settings: {},
  })
  if (!project.success)
    return project
  if (!Object.hasOwn(envelope.surfacesById, envelope.rootSurfaceId)) {
    return failure({
      code: 'surface_reference_invalid',
      message: `Root Surface does not exist: ${envelope.rootSurfaceId}.`,
      path: ['rootSurfaceId'],
      surfaceId: envelope.rootSurfaceId,
    })
  }
  const closureDocument: ProjectDocument = {
    ...project.data,
    homeSurfaceId: page?.id ?? syntheticSurfaceId,
    surfaceOrder: [...envelope.surfaceOrder],
    surfacesById: structuredClone(envelope.surfacesById),
  }
  const closure = collectSurfaceDependencyClosure(closureDocument, envelope.rootSurfaceId)
  if (!sameSequence(closure.surfaceIds, envelope.surfaceOrder)
    || !sameSequence(closure.datasetIds, envelope.datasetOrder)
    || !sameSequence(closure.resourceIds, Object.keys(envelope.resources).sort((left, right) => left.localeCompare(right)))) {
    return failure({
      code: 'surface_reference_invalid',
      message: 'Surface transfer assets must equal the flat dependency closure of the root Surface.',
      path: ['rootSurfaceId'],
      surfaceId: envelope.rootSurfaceId,
    })
  }
  const lock = createRegistrySubsetLock(envelope.registryLock, Object.values(envelope.surfacesById))
  if (!lock.success)
    return lock
  if (!sameRegistryLock(lock.data, envelope.registryLock)) {
    return failure({
      code: 'registry_lock_mismatch',
      message: 'Surface transfer Registry lock must be the exact component subset used by the closure.',
      path: ['registryLock'],
    })
  }
  return success(true)
}

function createRegistrySubsetLock(
  source: RegistryLock,
  surfaces: readonly ProjectDocument['surfacesById'][string][],
): ContractResult<RegistryLock> {
  const keys = [...new Set(surfaces.flatMap(surface => (
    Object.values(surface.graph.nodesById).map(node => node.component)
  )))].sort((left, right) => left.localeCompare(right))
  const components: RegistryLock['components'] = Object.create(null)
  for (const key of keys) {
    const lock = source.components[key]
    if (!lock) {
      return failure({
        code: 'registry_lock_mismatch',
        message: `Registry lock does not contain component used by the Surface closure: ${key}.`,
        path: ['registryLock', 'components', key],
      })
    }
    components[key] = structuredClone(lock)
  }
  return success({
    adapter: source.adapter,
    version: source.version,
    fingerprint: registryLockFingerprint(components),
    components,
  })
}

function sameRegistryLock(left: RegistryLock, right: RegistryLock): boolean {
  return left.adapter === right.adapter
    && left.version === right.version
    && left.fingerprint === right.fingerprint
    && sameRegistryComponents(left.components, right.components)
}

function sameRegistryComponents(
  left: RegistryLock['components'],
  right: RegistryLock['components'],
): boolean {
  const leftEntries = Object.entries(left).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
  const rightEntries = Object.entries(right).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
  return leftEntries.length === rightEntries.length && leftEntries.every(([key, lock], index) => {
    const candidate = rightEntries[index]
    return candidate?.[0] === key
      && candidate[1].contractVersion === lock.contractVersion
      && candidate[1].fingerprint === lock.fingerprint
  })
}

function projectStructureInspectionFailure(): ContractResult<never> {
  return failure({
    code: 'project_structure_invalid',
    message: 'Project transfer structure cannot be inspected safely.',
    path: [],
  })
}

async function writeEmbeddedContents(
  document: ProjectDocument,
  readEmbedded: ProjectTransferWriteInputV1['readEmbedded'],
) {
  return writeEmbeddedContentsForResources(document.id, document.resources, readEmbedded)
}

async function writeEmbeddedContentsForResources(
  projectId: string,
  resources: Record<string, ProjectResource>,
  readEmbedded: ProjectTransferWriteInputV1['readEmbedded'],
): Promise<ContractResult<ProjectTransferEnvelopeV1['embeddedContents']>> {
  const embedded = embeddedResources(resources)
  const budget = validateResourceCount(embedded.length)
  if (budget)
    return failure(budget)
  const metadataBudget = validateDeclaredResourceBudget(embedded)
  if (metadataBudget)
    return failure(metadataBudget)
  let total = 0
  const contents: ProjectTransferEnvelopeV1['embeddedContents'] = []
  for (const resource of embedded) {
    let source: Uint8Array | undefined
    try {
      source = await readEmbedded({ projectId, resourceId: resource.id, contentHash: resource.contentHash })
    }
    catch (error) {
      return resourceFailure(resource.id, `Resource reader failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    if (!(source instanceof Uint8Array))
      return resourceFailure(resource.id, 'Resource reader returned no bytes.')
    const bytes = new Uint8Array(source)
    total += bytes.byteLength
    const budgetFailure = validateResourceBudget(resource, bytes.byteLength, total)
    if (budgetFailure)
      return failure(budgetFailure)
    if (await sha256ContentHash(bytes) !== resource.contentHash)
      return resourceFailure(resource.id, 'Resource content hash does not match metadata.')
    contents.push({ resourceId: resource.id, content: { encoding: 'base64', data: encodeBase64(bytes) } })
  }
  return success(contents)
}

async function readEmbeddedContents(
  resources: Record<string, ProjectResource>,
  contents: readonly { resourceId: string, content: ResourceTransferContentV1 }[],
): Promise<ContractResult<Readonly<Record<string, Uint8Array>>>> {
  const embedded = embeddedResources(resources)
  const countFailure = validateResourceCount(embedded.length)
  if (countFailure)
    return failure(countFailure)
  const metadataBudget = validateDeclaredResourceBudget(embedded)
  if (metadataBudget)
    return failure(metadataBudget)
  if (contents.length !== embedded.length) {
    return resourceFailure('', 'Embedded Resource metadata and content must form an exact bijection.', ['embeddedContents'])
  }
  const expected = new Map(embedded.map(resource => [resource.id, resource]))
  const seen = new Set<string>()
  const validated: Array<{
    index: number
    item: { resourceId: string, content: ResourceTransferContentV1 }
    resource: ProjectEmbeddedResource
  }> = []
  let previousId: string | undefined
  let total = 0
  for (let index = 0; index < contents.length; index += 1) {
    const item = contents[index]!
    if (previousId !== undefined && previousId.localeCompare(item.resourceId) >= 0)
      return resourceFailure(item.resourceId, 'Embedded Resource contents must be sorted by resourceId.', ['embeddedContents', index, 'resourceId'])
    previousId = item.resourceId
    if (seen.has(item.resourceId))
      return resourceFailure(item.resourceId, 'Embedded Resource content is duplicated.', ['embeddedContents', index, 'resourceId'])
    seen.add(item.resourceId)
    const resource = expected.get(item.resourceId)
    if (!resource)
      return resourceFailure(item.resourceId, 'Embedded Resource content is not declared by metadata.', ['embeddedContents', index, 'resourceId'])
    const byteLength = canonicalBase64ByteLength(item.content.data)
    if (byteLength === undefined)
      return resourceFailure(item.resourceId, 'Resource content must use canonical padded base64.', ['embeddedContents', index, 'content', 'data'])
    total += byteLength
    const budgetFailure = validateResourceBudget(resource, byteLength, total)
    if (budgetFailure)
      return failure(budgetFailure)
    validated.push({ index, item, resource })
  }
  const missing = embedded.find(resource => !seen.has(resource.id))
  if (missing)
    return resourceFailure(missing.id, 'Embedded Resource content is missing.', ['embeddedContents'])
  const result: Record<string, Uint8Array> = Object.create(null)
  for (const { index, item, resource } of validated) {
    const bytes = decodeBase64(item.content.data)
    if (!bytes)
      return resourceFailure(item.resourceId, 'Resource content must use canonical padded base64.', ['embeddedContents', index, 'content', 'data'])
    if (await sha256ContentHash(bytes) !== resource.contentHash)
      return resourceFailure(item.resourceId, 'Resource content hash does not match metadata.', ['embeddedContents', index, 'content', 'data'])
    result[item.resourceId] = new Uint8Array(bytes)
  }
  return success(result)
}

function embeddedResources(resources: Record<string, ProjectResource>): ProjectEmbeddedResource[] {
  return Object.values(resources)
    .filter((resource): resource is ProjectEmbeddedResource => resource.kind === 'embedded')
    .sort((left, right) => left.id.localeCompare(right.id))
}

function validateResourceCount(count: number): ModelDiagnostic | undefined {
  return count > MAX_EMBEDDED_RESOURCE_COUNT
    ? {
        code: 'resource_content_invalid',
        message: `Project transfer cannot contain more than ${MAX_EMBEDDED_RESOURCE_COUNT} embedded Resources.`,
        path: ['embeddedContents'],
        context: { reason: 'resource_count_exceeded' },
      }
    : undefined
}

function validateDeclaredResourceBudget(
  resources: readonly ProjectEmbeddedResource[],
): ModelDiagnostic | undefined {
  let total = 0
  for (const resource of resources) {
    total += resource.byteLength
    const diagnostic = validateResourceBudget(resource, resource.byteLength, total)
    if (diagnostic)
      return diagnostic
  }
}

function validateResourceBudget(
  resource: ProjectEmbeddedResource,
  byteLength: number,
  total: number,
): ModelDiagnostic | undefined {
  if (byteLength !== resource.byteLength) {
    return {
      code: 'resource_content_invalid',
      message: `Resource byte length does not match metadata: ${resource.id}.`,
      resourceId: resource.id,
      context: { reason: 'byte_length_mismatch' },
    }
  }
  if (byteLength > MAX_EMBEDDED_RESOURCE_BYTES) {
    return {
      code: 'resource_content_invalid',
      message: `Embedded Resource exceeds the ${MAX_EMBEDDED_RESOURCE_BYTES} byte limit: ${resource.id}.`,
      resourceId: resource.id,
      context: { reason: 'resource_budget_exceeded' },
    }
  }
  if (total > MAX_EMBEDDED_TOTAL_BYTES) {
    return {
      code: 'resource_content_invalid',
      message: `Embedded Resources exceed the ${MAX_EMBEDDED_TOTAL_BYTES} byte aggregate limit.`,
      resourceId: resource.id,
      context: { reason: 'aggregate_budget_exceeded' },
    }
  }
}

async function sha256ContentHash(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle)
    throw new Error('SHA-256 is unavailable in this runtime.')
  const copy = new Uint8Array(bytes)
  const digest = new Uint8Array(await subtle.digest('SHA-256', copy.buffer))
  return `sha256:${[...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

function encodeBase64(bytes: Uint8Array): string {
  let result = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    result += BASE64_ALPHABET[first >> 2]
    result += BASE64_ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >> 4)]
    result += second === undefined ? '=' : BASE64_ALPHABET[((second & 0x0F) << 2) | ((third ?? 0) >> 6)]
    result += third === undefined ? '=' : BASE64_ALPHABET[third & 0x3F]
  }
  return result
}

function decodeBase64(value: string): Uint8Array | undefined {
  const byteLength = canonicalBase64ByteLength(value)
  if (byteLength === undefined)
    return undefined
  const result = new Uint8Array(byteLength)
  let offset = 0
  for (let index = 0; index < value.length; index += 4) {
    const first = BASE64_ALPHABET.indexOf(value[index]!)
    const second = BASE64_ALPHABET.indexOf(value[index + 1]!)
    const third = value[index + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[index + 2]!)
    const fourth = value[index + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[index + 3]!)
    const combined = (first << 18) | (second << 12) | (third << 6) | fourth
    if (offset < result.length)
      result[offset++] = (combined >> 16) & 0xFF
    if (offset < result.length)
      result[offset++] = (combined >> 8) & 0xFF
    if (offset < result.length)
      result[offset++] = combined & 0xFF
  }
  return encodeBase64(result) === value ? result : undefined
}

function canonicalBase64ByteLength(value: string): number | undefined {
  if (!CANONICAL_BASE64.test(value))
    return undefined
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  return value.length / 4 * 3 - padding
}

function validateEnvelopeVersion(
  input: unknown,
  contract: string,
  expected: number,
): ModelDiagnostic | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !('version' in input) || input.version !== expected) {
    const received = input && typeof input === 'object' && 'version' in input
      ? input.version
      : undefined
    return {
      code: 'unsupported_contract_version',
      message: `${contract} requires version ${expected}.`,
      path: ['version'],
      context: {
        contract,
        expected,
        received: received ?? null,
      },
    }
  }
}

function uniqueSyntheticSurfaceId(surfaces: Record<string, unknown>): string {
  let id = '__surface_transfer_validation__'
  while (Object.hasOwn(surfaces, id))
    id += '_'
  return id
}

function uniqueSyntheticRoute(surfaces: Record<string, ProjectDocument['surfacesById'][string]>): string {
  const routes = new Set(Object.values(surfaces).flatMap(surface => surface.kind === 'page' ? [surface.route] : []))
  let route = '/__surface-transfer-validation__'
  while (routes.has(route))
    route += '-x'
  return route
}

function sameSequence(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function success<T>(data: T): ContractResult<T> {
  return { success: true, data, diagnostics: [] }
}

function failure<T = never>(diagnostic: ModelDiagnostic): ContractResult<T> {
  return { success: false, diagnostics: [diagnostic] }
}

function resourceFailure<T = never>(
  resourceId: string,
  message: string,
  path?: Array<string | number>,
): ContractResult<T> {
  return failure({
    code: 'resource_content_invalid',
    message,
    ...(resourceId ? { resourceId } : {}),
    ...(path ? { path } : {}),
    context: { reason: message },
  })
}

function zodFailure<T>(code: string, issues: z.ZodIssue[]): ContractResult<T> {
  return {
    success: false,
    diagnostics: issues.map(issue => ({ code, message: issue.message, path: issue.path })),
  }
}
