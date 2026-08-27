import type { WorkspaceProject, WorkspaceProjectDraft, WorkspaceProjectSummary } from './types'
import { z } from 'zod'
import { WorkspaceProjectError } from './errors'
import { assertUniqueProjectPaths, normalizeProjectPath } from './path'
import { WORKSPACE_PROJECT_SCHEMA_VERSION } from './types'

const identifierSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9-]*$/)
const timestampSchema = z.string().datetime({ offset: true })
const textFileSchema = z.object({
  content: z.string(),
  kind: z.literal('text'),
  language: z.string().min(1).optional(),
}).strict()
const binaryFileSchema = z.object({
  content: z.instanceof(Uint8Array),
  kind: z.literal('binary'),
}).strict()
const workspaceFileSchema = z.discriminatedUnion('kind', [textFileSchema, binaryFileSchema])
const manifestSchema = z.object({
  adapter: z.enum(['antd-vue', 'element-plus']),
  dependencies: z.record(z.string().min(1)),
  designerArtifact: z.string().min(1),
  entry: z.string().min(1),
  framework: z.literal('vue'),
  generatedFormModule: z.string().min(1),
}).strict()

const workspaceProjectSchema = z.object({
  createdAt: timestampSchema,
  files: z.record(workspaceFileSchema),
  id: identifierSchema,
  manifest: manifestSchema,
  name: z.string().trim().min(1).max(120),
  revision: z.number().int().positive(),
  schemaVersion: z.literal(WORKSPACE_PROJECT_SCHEMA_VERSION),
  template: z.object({
    id: identifierSchema,
    version: z.number().int().positive(),
  }).strict(),
  updatedAt: timestampSchema,
}).strict()

const workspaceDraftSchema = z.object({
  baseRevision: z.number().int().positive(),
  files: z.record(z.string()),
  updatedAt: timestampSchema,
}).strict()

function invalidProject(message: string, cause?: unknown): never {
  throw new WorkspaceProjectError(
    'PROJECT_INVALID',
    `[config-form-workbench] ${message}`,
    cause instanceof Error ? { cause } : undefined,
  )
}

export function parseWorkspaceProject(input: unknown): WorkspaceProject {
  const result = workspaceProjectSchema.safeParse(input)
  if (!result.success)
    invalidProject('workspace project is invalid', result.error)

  const paths = assertUniqueProjectPaths(Object.keys(result.data.files))
  const files = Object.fromEntries(paths.map((path, index) => [path, result.data.files[Object.keys(result.data.files)[index]!]]))
  const entry = normalizeProjectPath(result.data.manifest.entry)
  const designerArtifact = normalizeProjectPath(result.data.manifest.designerArtifact)
  const generatedFormModule = normalizeProjectPath(result.data.manifest.generatedFormModule)
  for (const required of [entry, designerArtifact, generatedFormModule]) {
    if (!Object.hasOwn(files, required))
      invalidProject(`manifest references missing file "${required}"`)
  }

  return {
    ...result.data,
    files,
    manifest: {
      ...result.data.manifest,
      designerArtifact,
      entry,
      generatedFormModule,
    },
  } as WorkspaceProject
}

export function parseWorkspaceProjectDraft(input: unknown): WorkspaceProjectDraft {
  const result = workspaceDraftSchema.safeParse(input)
  if (!result.success)
    invalidProject('workspace draft is invalid', result.error)

  const paths = assertUniqueProjectPaths(Object.keys(result.data.files))
  return {
    ...result.data,
    files: Object.fromEntries(paths.map((path, index) => [path, result.data.files[Object.keys(result.data.files)[index]!]])),
  }
}

export function summarizeWorkspaceProject(project: WorkspaceProject): WorkspaceProjectSummary {
  return {
    adapter: project.manifest.adapter,
    id: project.id,
    name: project.name,
    revision: project.revision,
    templateId: project.template.id,
    updatedAt: project.updatedAt,
  }
}
