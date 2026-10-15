import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { WORKSPACE_API_PATH, workspaceRequest } from '@moluoxixi/config-form-studio/client'
import { z } from 'zod'
/** The AI client owns its model; these tools operate on the shared local service. */
export function createWorkspaceMcpServer(url: string): McpServer {
  const server = new McpServer({ name: 'config-form', version: '0.1.0' }, {
    instructions: 'Create editable Vue interfaces using the same projects as the visual designer. First inspect materials/templates, then create a project or apply atomic Model operations. Use get_project to obtain the current repositoryRevision before edits or generation. Preserve user changes on revision conflicts. Use generate_source, read_source_file and export_source for standalone Vue output. Never overwrite hand-edited source. Local data are static prototype datasets.',
  })
  const preset = z.enum(['element-plus', 'antd-vue'])
  const projectId = z.string().min(1)
  const expectedRepositoryRevision = z.number().int().nonnegative()
  const artifactId = z.string().regex(/^[0-9a-f]{64}$/)
  function register(name: string, description: string, inputSchema: z.ZodRawShape, path: string, readOnlyHint: boolean) {
    server.registerTool(name, { description, inputSchema, annotations: { readOnlyHint, destructiveHint: false, openWorldHint: false } }, async (input) => {
      try {
        const data = await workspaceRequest(`${url.replace(/\/$/, '')}${WORKSPACE_API_PATH}${path}`, input)
        return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
      }
      catch (error) {
        const failure = error as { code?: string, message?: string, diagnostics?: unknown[] }
        return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ code: failure.code ?? 'WORKSPACE_UNAVAILABLE', message: failure.message, diagnostics: failure.diagnostics }) }] }
      }
    })
  }
  register('list_materials', 'List supported component keys, kinds, editable properties, slots, dataset bindings and interactions.', { preset }, '/materials', true)
  register('get_material', 'Get a component contract, default node subtree, property controls and source mapping. Use this instead of guessing props or slots.', { preset, component: z.string() }, '/materials', true)
  register('list_templates', 'List built-in page, dialog and drawer templates for a preset.', { preset }, '/templates', true)
  register('create_node', 'Build a valid default node subtree for node.insert. Field components require field; object/array scopes also accept field to name their value group. This helper does not save a project.', { preset, component: z.string(), id: z.string(), field: z.string().optional(), label: z.string().optional(), props: z.record(z.unknown()).optional() }, '/node', true)
  register('create_project', 'Create a project with automatically locked component contracts. Supply a templateId or complete Model Surfaces; omitted Surfaces create a blank home page.', { id: projectId, name: z.string().min(1), preset, templateId: z.string().optional(), surfaces: z.array(z.record(z.unknown())).optional(), datasets: z.array(z.record(z.unknown())).optional() }, '/create', false)
  server.registerTool('list_projects', { description: 'List shared workspace projects and current revisions.', inputSchema: {}, annotations: { readOnlyHint: true, openWorldHint: false } }, async () => {
    try {
      const data = await workspaceRequest(`${url.replace(/\/$/, '')}${WORKSPACE_API_PATH}/repository`, { method: 'list', args: [] })
      return { content: [{ type: 'text', text: JSON.stringify(data) }] }
    }
    catch (error) {
      return { isError: true, content: [{ type: 'text', text: (error as Error).message }] }
    }
  })
  server.registerTool('get_project', { description: 'Read the canonical project configuration and its repositoryRevision before making edits.', inputSchema: { projectId }, annotations: { readOnlyHint: true, openWorldHint: false } }, async ({ projectId }) => {
    try {
      const data = await workspaceRequest(`${url.replace(/\/$/, '')}${WORKSPACE_API_PATH}/repository`, { method: 'get', args: [projectId] })
      if (!data)
        throw new Error(`Project does not exist: ${projectId}`)
      return { content: [{ type: 'text', text: JSON.stringify(data) }] }
    }
    catch (error) {
      return { isError: true, content: [{ type: 'text', text: (error as Error).message }] }
    }
  })
  register('apply_operations', 'Atomically apply Model operations. Each operation uses type. node.insert: {type:"node.insert",surfaceId,subgraph:<create_node result>,target:{parentId:null}}; layout children use target:{parentId:<layout id>,slot:"default"}. node.props: {type:"node.props",surfaceId,nodeId,props:<complete props>}. node.settings replaces ALL settings (not props): copy current node excluding id/props/slots, preserve component/kind/field and change label/required/etc. surface.add: {type:"surface.add",surface:<complete Surface>}; surface.interactions replaces the interaction array. dataset.add: {type:"dataset.add",dataset:{id,name,rows:[<objects>]}}; dataset.replaceRows:{type:"dataset.replaceRows",datasetId,rows}. project.rename:{type:"project.rename",name}. IDs and sibling fields must be unique. expectedRepositoryRevision prevents overwriting newer edits; retry the same payload with the same commandId after a network failure.', { projectId, expectedRepositoryRevision, commandId: z.string().min(1), label: z.string().min(1).max(80), operations: z.array(z.record(z.unknown())).min(1).max(500) }, '/operations', false)
  const generation = { projectId, expectedRepositoryRevision, surfaceId: z.string().optional(), styleTarget: z.enum(['css', 'tailwind-v4']).optional() }
  register('validate_project', 'Validate configuration, locked materials, compilation, resource bytes and standalone source support. Return structured diagnostics.', generation, '/validate', true)
  register('preview_surface', 'Get a real designer preview URL pinned to a saved project revision. The preview stays on that revision after later edits.', { projectId, expectedRepositoryRevision, surfaceId: z.string().optional() }, '/preview', true)
  register('generate_source', 'Generate an immutable standalone Vue source artifact at the expected revision; returns entry and file manifest. The output does not depend on ConfigForm.', generation, '/generate', false)
  register('read_source_file', 'Read one generated file from an immutable artifact; binary files are base64.', { artifactId, path: z.string() }, '/source-file', true)
  register('export_source', 'Get a ZIP download URL or write the artifact into a new generated/name directory inside the workspace. Existing directories are rejected.', { artifactId, format: z.enum(['zip', 'directory']), name: z.string().regex(/^[\w-]{1,100}$/).optional() }, '/export', false)
  return server
}
export async function startWorkspaceMcp(url: string): Promise<McpServer> {
  const server = createWorkspaceMcpServer(url)
  await server.connect(new StdioServerTransport())
  return server
}
