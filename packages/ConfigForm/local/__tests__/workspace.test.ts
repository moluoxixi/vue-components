import type { PersistedProjectEnvelope } from '@moluoxixi/config-form-model'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createStudioProject } from '@moluoxixi/config-form-studio'
import { openHttpProjectRepository, WORKSPACE_API_PATH, workspaceRequest } from '@moluoxixi/config-form-studio/client'
import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { startLocalWorkspace } from '../src/services/server'
import { cleanup, temporaryWorkspace } from './helpers'

describe('shared workspace HTTP and MCP', () => {
  it('shares browser repository contracts, resource encoding and revision conflicts between clients', async () => {
    const directory = await temporaryWorkspace()
    const service = await startLocalWorkspace({ directory, port: 0 })
    cleanup(() => service.close())
    const left = await openHttpProjectRepository({ url: service.url })
    const right = await openHttpProjectRepository({ url: service.url })
    cleanup(async () => {
      left.close()
      right.close()
    })
    const document = createStudioProject({ id: 'cross-browser', name: 'Shared', preset: 'element-plus' })
    await left.create({ document, embeddedContents: [] })
    expect((await right.list())[0]?.id).toBe(document.id)
    const current = (await right.get(document.id))!
    const changed = await right.commit({ id: document.id, commandId: 'other-client', expectedRepositoryRevision: 0, document: { ...current.document, name: 'Edited' }, metadata: { source: 'manual' } })
    expect((await left.get(document.id))?.document.name).toBe('Edited')
    await expect(left.commit({ id: document.id, commandId: 'stale', expectedRepositoryRevision: 0, document, metadata: { source: 'manual' } })).rejects.toMatchObject({ code: 'PROJECT_REVISION_CONFLICT' })
    await left.pruneVersions(document.id)
    expect(changed.project.repositoryRevision).toBe(1)
    const denied = await fetch(`${service.url}${WORKSPACE_API_PATH}/repository`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': 'https://example.com' }, body: JSON.stringify({ method: 'list', args: [] }) })
    expect(denied.status).toBe(403)
    const noHeader = await fetch(`${service.url}${WORKSPACE_API_PATH}/health`, { method: 'POST', body: '{}' })
    expect(noHeader.status).toBe(403)
  })
  it('supports the actual stdio MCP handshake, authoring, validation, revision preview and immutable source exports', async () => {
    const directory = await temporaryWorkspace()
    const service = await startLocalWorkspace({ directory, port: 0 })
    cleanup(() => service.close())
    const client = new Client({ name: 'config-form-test', version: '1' })
    const transport = new StdioClientTransport({ command: process.execPath, args: [resolve(import.meta.dirname, '../dist/cli.js'), 'mcp', '--url', service.url], stderr: 'pipe' })
    await client.connect(transport)
    cleanup(() => client.close())
    const tools = await client.listTools()
    expect(tools.tools.map(tool => tool.name)).toEqual(expect.arrayContaining(['create_project', 'create_node', 'apply_operations', 'generate_source', 'export_source']))
    async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
      const result = await client.callTool({ name, arguments: args })
      const text = (result.content as Array<{ type: string, text: string }>)[0]!.text
      if (result.isError)
        throw new Error(text)
      return JSON.parse(text) as T
    }
    expect((await call<unknown[]>('list_materials', { preset: 'element-plus' })).length).toBeGreaterThan(20)
    await call('create_project', { id: 'mcp-account', name: 'Account', preset: 'element-plus', templateId: 'element-profile' })
    const initial = await call<PersistedProjectEnvelope>('get_project', { projectId: 'mcp-account' })
    const home = initial.document.homeSurfaceId
    const edit = { projectId: initial.document.id, expectedRepositoryRevision: 0, commandId: 'ai-label', label: 'Rename page', operations: [{ type: 'surface.rename', surfaceId: home, name: '用户资料' }] }
    await call('apply_operations', edit)
    expect(await call('apply_operations', edit)).toMatchObject({ replayed: true })
    expect(await call('validate_project', { projectId: initial.document.id, expectedRepositoryRevision: 1 })).toMatchObject({ valid: true })
    const preview = await call<{ previewUrl: string }>('preview_surface', { projectId: initial.document.id, expectedRepositoryRevision: 1 })
    expect(preview.previewUrl).toContain(`/1/${home}`)
    const artifact = await call<{ artifactId: string, files: Array<{ path: string }> }>('generate_source', { projectId: initial.document.id, expectedRepositoryRevision: 1, styleTarget: 'tailwind-v4' })
    const generatedPage = await call<{ file: { content: string } }>('read_source_file', { artifactId: artifact.artifactId, path: `src/surfaces/${home}/Surface.vue` })
    expect(generatedPage.file.content).toContain('Name')
    // A human client advances the project; the source artifact and preview stay at revision 1.
    const repository = await openHttpProjectRepository({ url: service.url })
    cleanup(async () => repository.close())
    const latest = (await repository.get(initial.document.id))!
    await repository.commit({ id: initial.document.id, expectedRepositoryRevision: 1, commandId: 'human-name', document: { ...latest.document, name: 'Human edit' }, metadata: { source: 'manual' } })
    const stale = await client.callTool({ name: 'generate_source', arguments: { projectId: initial.document.id, expectedRepositoryRevision: 1 } })
    expect(stale.isError).toBe(true)
    const zip = await call<{ downloadUrl: string, repositoryRevision: number }>('export_source', { artifactId: artifact.artifactId, format: 'zip' })
    expect(zip.repositoryRevision).toBe(1)
    const archive = unzipSync(new Uint8Array(await (await fetch(zip.downloadUrl)).arrayBuffer()))
    expect(Object.keys(archive)).toContain('package.json')
    const exported = await call<{ directory: string }>('export_source', { artifactId: artifact.artifactId, format: 'directory', name: 'vue-account' })
    expect(JSON.parse(await readFile(join(exported.directory, 'package.json'), 'utf8')).dependencies).not.toHaveProperty('@moluoxixi/config-form')
    const overwrite = await client.callTool({ name: 'export_source', arguments: { artifactId: artifact.artifactId, format: 'directory', name: 'vue-account' } })
    expect(overwrite.isError).toBe(true)
    const traversal = await client.callTool({ name: 'export_source', arguments: { artifactId: artifact.artifactId, format: 'directory', name: '../escape' } })
    expect(traversal.isError).toBe(true)
    expect(await workspaceRequest(`${service.url}${WORKSPACE_API_PATH}/repository`, { method: 'getVersion', args: [initial.document.id, 1] })).toMatchObject({ repositoryRevision: 1, document: { name: 'Account' } })
  })
})
