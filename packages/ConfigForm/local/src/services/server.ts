import type { ProjectOperation, ProjectSurface } from '@moluoxixi/config-form-model'
import type { SourceStyleTarget } from '@moluoxixi/config-form-source/generator'
import type { StudioPresetId } from '@moluoxixi/config-form-studio'
import type { RepositoryMethod, WorkspaceChange } from '@moluoxixi/config-form-studio/client'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { createServer } from 'node:http'
import { basename, extname, isAbsolute, relative, resolve } from 'node:path'
import {
  applyProjectTransaction,
  createComponentContractRegistry,
  ProjectRepositoryError,
} from '@moluoxixi/config-form-model'
import { createStudioNode, createStudioProject, generateProjectSource, getStudioCatalog, getStudioPreset } from '@moluoxixi/config-form-studio'
import { mapRepositoryArguments, mapRepositoryResult, WORKSPACE_API_PATH, WORKSPACE_REQUEST_HEADER } from '@moluoxixi/config-form-studio/client'
import { openFileProjectRepository } from './file-repository'
import { createSourceZip, exportSourceArtifact, readSourceArtifact, saveSourceArtifact, sourceFileBytes } from './source-files'

const methods = new Set<RepositoryMethod>(['create', 'get', 'list', 'commit', 'delete', 'getVersion', 'listVersions', 'pruneVersions', 'readEmbedded', 'setVersionLabel'])
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
class WorkspaceError extends Error {
  constructor(readonly code: string, message: string, readonly diagnostics?: unknown[], readonly status = 400) {
    super(message)
  }
}
function presetId(value: unknown): StudioPresetId {
  if (value !== 'element-plus' && value !== 'antd-vue')
    throw new WorkspaceError('WORKSPACE_PRESET_INVALID', 'Choose element-plus or antd-vue.')
  return value
}
function revision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new WorkspaceError('WORKSPACE_REVISION_REQUIRED', 'A non-negative expectedRepositoryRevision is required. Read the project before editing or generating.')
  return Number(value)
}
async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > 24 * 1024 * 1024)
      throw new WorkspaceError('WORKSPACE_BODY_TOO_LARGE', 'Workspace requests are limited to 24 MiB.', undefined, 413)
    chunks.push(Buffer.from(chunk))
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('JSON body must be an object.')
    return data
  }
  catch {
    throw new WorkspaceError('WORKSPACE_JSON_INVALID', 'Expected a JSON object request.')
  }
}
function json(response: ServerResponse, data: unknown, status = 200): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(data))
}
export async function startLocalWorkspace(options: {
  directory: string
  port?: number
  staticDirectory?: string
  allowOrigins?: string[]
}) {
  const repository = await openFileProjectRepository(options.directory)
  const root = await realpath(options.directory)
  const staticRoot = options.staticDirectory ? await realpath(options.staticDirectory).catch(() => undefined) : undefined
  const subscribers = new Set<ServerResponse>()
  const allowOrigins = new Set(options.allowOrigins ?? [])
  let url = ''
  function publish(change: WorkspaceChange): void {
    const event = `data: ${JSON.stringify(change)}\n\n`
    subscribers.forEach(response => response.write(event))
  }
  async function getProject(id: unknown, expected?: unknown) {
    if (typeof id !== 'string' || !id)
      throw new WorkspaceError('WORKSPACE_PROJECT_REQUIRED', 'projectId is required.')
    const project = await repository.get(id)
    if (!project)
      throw new ProjectRepositoryError('PROJECT_REPOSITORY_NOT_FOUND', `Project does not exist: ${id}`)
    if (expected !== undefined && project.repositoryRevision !== revision(expected))
      throw new ProjectRepositoryError('PROJECT_REVISION_CONFLICT', `Expected revision ${expected}; current revision is ${project.repositoryRevision}. Read the latest project and retry.`)
    return project
  }
  async function handleApi(path: string, input: Record<string, unknown>): Promise<unknown> {
    if (path === '/health')
      return { protocol: 1, workspaceName: basename(root), workspaceId: createHash('sha256').update(root).digest('hex'), persistence: 'durable' }
    if (path === '/repository') {
      const method = input.method as RepositoryMethod
      if (!methods.has(method) || !Array.isArray(input.args) || input.args.length > 2)
        throw new WorkspaceError('WORKSPACE_RPC_INVALID', 'Unknown repository method or invalid arguments.')
      const fn = repository[method] as (...args: unknown[]) => Promise<unknown>
      const args = mapRepositoryArguments(method, input.args, 'decode')
      const result = await fn.apply(repository, args)
      if (method === 'create' || method === 'commit') {
        const committed = method === 'commit' ? (result as { project: { document: { id: string }, repositoryRevision: number }, replayed: boolean }).project : result as { document: { id: string }, repositoryRevision: number }
        if (!(result as { replayed?: boolean }).replayed)
          publish({ kind: 'project', projectId: committed.document.id, repositoryRevision: committed.repositoryRevision, ...(typeof input.clientId === 'string' ? { clientId: input.clientId } : {}) })
      }
      if (method === 'delete')
        publish({ kind: 'delete', projectId: String(args[0]), ...(typeof input.clientId === 'string' ? { clientId: input.clientId } : {}) })
      return mapRepositoryResult(method, result, 'encode') ?? null
    }
    if (path === '/materials') {
      const catalog = getStudioCatalog(presetId(input.preset))
      if (typeof input.component === 'string') {
        const material = catalog.materials.find(material => material.contract.key === input.component)
        if (!material)
          throw new WorkspaceError('WORKSPACE_MATERIAL_MISSING', `Unknown component: ${input.component}`)
        return material
      }
      return catalog.materials.map(material => ({ component: material.contract.key, kind: material.contract.kind, title: material.title, category: material.category, props: material.contract.props, slots: material.contract.slots, datasetBindings: material.contract.datasetBindings, semanticTriggers: material.contract.semanticTriggers }))
    }
    if (path === '/templates')
      return getStudioCatalog(presetId(input.preset)).templates.map(({ surface, ...template }) => ({ ...template, kind: surface.kind }))
    if (path === '/node')
      return createStudioNode({ ...input, preset: presetId(input.preset) } as Parameters<typeof createStudioNode>[0])
    if (path === '/create') {
      const document = createStudioProject({ ...input, preset: presetId(input.preset), surfaces: input.surfaces as ProjectSurface[] | undefined } as Parameters<typeof createStudioProject>[0])
      const project = await repository.create({ document, embeddedContents: [] })
      publish({ kind: 'project', projectId: document.id, repositoryRevision: project.repositoryRevision })
      return project
    }
    if (path === '/operations') {
      const expected = revision(input.expectedRepositoryRevision)
      const current = await getProject(input.projectId)
      // Rebuild retries from their original base so repository receipts can replay them.
      const base = expected === current.repositoryRevision ? current : await repository.getVersion(current.document.id, expected)
      if (!base)
        throw new ProjectRepositoryError('PROJECT_REVISION_CONFLICT', 'The edit base is no longer available. Read the latest project and retry.')
      if (!Array.isArray(input.operations) || input.operations.length < 1 || input.operations.length > 500 || typeof input.commandId !== 'string' || typeof input.label !== 'string')
        throw new WorkspaceError('WORKSPACE_OPERATIONS_INVALID', 'Provide commandId, label, and 1 to 500 Model operations.')
      const preset = getStudioPreset(presetId(base.document.registryLock.adapter))
      const registry = createComponentContractRegistry(getStudioCatalog(presetId(base.document.registryLock.adapter)).materials.map(material => material.contract), { adapter: preset.registry.adapter, version: preset.registry.adapterVersion })
      const applied = applyProjectTransaction(base.document, { id: input.commandId, label: input.label, operations: input.operations as ProjectOperation[] }, { registry })
      if (!applied.success)
        throw new WorkspaceError('WORKSPACE_VALIDATION_FAILED', applied.diagnostics[0]?.message ?? 'Invalid project edit.', applied.diagnostics)
      const result = await repository.commit({ id: base.document.id, document: applied.document, expectedRepositoryRevision: expected, commandId: input.commandId, metadata: { source: 'manual', label: input.label } })
      if (!result.replayed)
        publish({ kind: 'project', projectId: base.document.id, repositoryRevision: result.project.repositoryRevision })
      return result
    }
    if (path === '/validate' || path === '/generate') {
      const project = await getProject(input.projectId, revision(input.expectedRepositoryRevision))
      const generated = await generateProjectSource({
        project: project.document,
        preset: presetId(project.document.registryLock.adapter),
        surfaceId: input.surfaceId as string | undefined,
        styleTarget: input.styleTarget as SourceStyleTarget | undefined,
        resourceReader: { async readEmbedded(request) {
          const bytes = await repository.readEmbedded(request)
          return bytes ? { success: true, data: bytes, diagnostics: [] } : { success: false, diagnostics: [{ code: 'source_resource_read_failed', message: `Missing resource: ${request.resourceId}`, resourceId: request.resourceId }] }
        } },
      })
      if (path === '/validate')
        return { valid: generated.success, repositoryRevision: project.repositoryRevision, diagnostics: generated.diagnostics }
      if (!generated.success)
        throw new WorkspaceError('WORKSPACE_GENERATION_FAILED', 'Source generation failed. No artifact was created.', generated.diagnostics)
      const artifact = await saveSourceArtifact(root, { projectId: project.document.id, repositoryRevision: project.repositoryRevision, source: generated.data })
      return { artifactId: artifact.id, projectId: artifact.projectId, repositoryRevision: artifact.repositoryRevision, entry: artifact.source.entry, files: artifact.source.files.map(file => ({ path: file.path, kind: file.kind, byteLength: sourceFileBytes(file).byteLength })) }
    }
    if (path === '/source-file') {
      const artifact = await readSourceArtifact(root, String(input.artifactId))
      const file = artifact.source.files.find(file => file.path === input.path)
      if (!file)
        throw new WorkspaceError('WORKSPACE_SOURCE_FILE_MISSING', 'File does not belong to this source artifact.')
      return { repositoryRevision: artifact.repositoryRevision, file }
    }
    if (path === '/export') {
      const artifact = await readSourceArtifact(root, String(input.artifactId))
      if (input.format === 'zip')
        return { artifactId: artifact.id, repositoryRevision: artifact.repositoryRevision, downloadUrl: `${url}${WORKSPACE_API_PATH}/artifacts/${artifact.id}.zip` }
      if (input.format !== 'directory')
        throw new WorkspaceError('WORKSPACE_EXPORT_FORMAT_INVALID', 'Choose zip or directory.')
      return { artifactId: artifact.id, repositoryRevision: artifact.repositoryRevision, directory: await exportSourceArtifact(root, artifact, input.name as string | undefined) }
    }
    if (path === '/preview') {
      const expected = revision(input.expectedRepositoryRevision)
      const project = await repository.getVersion(String(input.projectId), expected)
      const surfaceId = input.surfaceId ?? project?.document.homeSurfaceId
      if (!project || typeof surfaceId !== 'string' || !project.document.surfacesById[surfaceId])
        throw new WorkspaceError('WORKSPACE_PREVIEW_MISSING', 'Project version or preview Surface does not exist.')
      return { projectId: project.document.id, repositoryRevision: expected, previewUrl: `${url}/#/preview/${encodeURIComponent(project.document.id)}/${expected}/${encodeURIComponent(surfaceId)}` }
    }
    throw new WorkspaceError('WORKSPACE_ROUTE_MISSING', 'Unknown workspace API endpoint.', undefined, 404)
  }
  const server = createServer(async (request, response) => {
    try {
      const host = request.headers.host
      const origin = request.headers.origin
      if (host !== new URL(url).host && host !== `localhost:${new URL(url).port}`)
        throw new WorkspaceError('WORKSPACE_HOST_REJECTED', 'Host is not the local workspace service.', undefined, 403)
      const localOrigin = `http://${host}`
      if (origin && origin !== url && origin !== localOrigin && !allowOrigins.has(origin))
        throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED', 'This origin is not allowed to access the workspace.', undefined, 403)
      if (origin && allowOrigins.has(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin)
        response.setHeader('Vary', 'Origin')
        response.setHeader('Access-Control-Allow-Headers', `Content-Type, ${WORKSPACE_REQUEST_HEADER}`)
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      }
      response.setHeader('X-Content-Type-Options', 'nosniff')
      const path = new URL(request.url ?? '/', url).pathname
      if (request.method === 'OPTIONS') {
        response.writeHead(204)
        response.end()
        return
      }
      if (request.method === 'GET' && path === '/config-form-workspace.json') {
        json(response, { protocol: 1, url: localOrigin, workspaceName: basename(root) })
        return
      }
      if (path === `${WORKSPACE_API_PATH}/events` && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
        response.write('data: {"kind":"reset"}\n\n')
        subscribers.add(response)
        request.on('close', () => subscribers.delete(response))
        return
      }
      if (path.startsWith(`${WORKSPACE_API_PATH}/artifacts/`) && request.method === 'GET') {
        const id = path.slice(`${WORKSPACE_API_PATH}/artifacts/`.length).replace(/\.zip$/, '')
        const artifact = await readSourceArtifact(root, id)
        response.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="config-form-${id.slice(0, 12)}.zip"` })
        response.end(createSourceZip(artifact))
        return
      }
      if (path.startsWith(`${WORKSPACE_API_PATH}/`) && request.method === 'POST') {
        if (request.headers[WORKSPACE_REQUEST_HEADER.toLowerCase()] !== '1')
          throw new WorkspaceError('WORKSPACE_HEADER_REQUIRED', 'Workspace API requests require X-Config-Form: 1.', undefined, 403)
        json(response, { data: await handleApi(path.slice(WORKSPACE_API_PATH.length), await body(request)) })
        return
      }
      if (request.method !== 'GET' || !staticRoot)
        throw new WorkspaceError('WORKSPACE_ROUTE_MISSING', 'Designer is unavailable. Build the local package with its designer assets.', undefined, 404)
      const target = await realpath(resolve(staticRoot, `.${decodeURIComponent(path === '/' ? '/index.html' : path)}`))
      const local = relative(staticRoot, target)
      if (isAbsolute(local) || local.startsWith('..'))
        throw new WorkspaceError('WORKSPACE_PATH_REJECTED', 'Static asset path is outside the designer.', undefined, 403)
      response.writeHead(200, { 'Content-Type': mime[extname(target)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
      const content = await readFile(target)
      response.end(extname(target) === '.html' ? content.toString('utf8').replace('<head>', `<head><meta name="config-form-workspace" content="${localOrigin}">`) : content)
    }
    catch (error) {
      const failure = error as { code?: string, message?: string, diagnostics?: unknown[], status?: number }
      const status = failure.status ?? (failure.code === 'PROJECT_REVISION_CONFLICT' || failure.code === 'PROJECT_REPOSITORY_EXISTS' || failure.code === 'PROJECT_REPOSITORY_COMMAND_REUSED' ? 409 : failure.code === 'ENOENT' || failure.code === 'PROJECT_REPOSITORY_NOT_FOUND' ? 404 : 400)
      if (!response.headersSent)
        json(response, { error: { code: failure.code ?? 'WORKSPACE_REQUEST_FAILED', message: failure.message ?? 'Workspace request failed.', ...(failure.diagnostics ? { diagnostics: failure.diagnostics } : {}) } }, status)
      else
        response.end()
    }
  })
  try {
    await new Promise<void>((accept, reject) => {
      server.once('error', reject)
      server.listen(options.port ?? 4332, '127.0.0.1', accept)
    })
  }
  catch (error) {
    await repository.dispose()
    throw error
  }
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const heartbeat = setInterval(() => subscribers.forEach(response => response.write(': keepalive\n\n')), 15_000)
  heartbeat.unref()
  return {
    url,
    directory: root,
    repository,
    async close() {
      clearInterval(heartbeat)
      subscribers.forEach(response => response.end())
      subscribers.clear()
      await new Promise<void>((accept, reject) => server.close(error => error ? reject(error) : accept()))
      await repository.dispose()
    },
  }
}
