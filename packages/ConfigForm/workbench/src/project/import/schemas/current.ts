import type { ModelDiagnostic, RegistryLock } from '@moluoxixi/config-form-model'
import type {
  CanonicalImportPayload,
  ConfigImportDiagnostic,
  ConfigImportTarget,
  PageTransferDocument,
} from '../types'
import {
  parseProjectDocument,
  PROJECT_DOCUMENT_VERSION,
  projectPageSchema,
} from '@moluoxixi/config-form-model'
import { z } from 'zod'
import { PAGE_TRANSFER_VERSION } from '../constants'
import { appendConfigImportPath } from './guard'

const registryComponentLockSchema = z.object({
  contractVersion: z.string().trim().min(1),
  fingerprint: z.string().trim().min(1),
}).strict()

const registryLockSchema: z.ZodType<RegistryLock> = z.object({
  adapter: z.string().trim().min(1),
  version: z.string().trim().min(1),
  fingerprint: z.string().trim().min(1),
  components: z.record(registryComponentLockSchema),
}).strict()

const pageTransferDocumentSchema: z.ZodType<PageTransferDocument> = z.object({
  kind: z.literal('config-form-page'),
  version: z.literal(PAGE_TRANSFER_VERSION),
  registryLock: registryLockSchema,
  page: projectPageSchema,
}).strict()

function pathFromModel(path: ModelDiagnostic['path'], root = '$'): string {
  return (path ?? []).reduce<string>(
    (result, segment) => appendConfigImportPath(result, segment),
    root,
  )
}

function invalid(
  code: ConfigImportDiagnostic['code'],
  message: string,
  path = '$',
): { success: false, diagnostics: ConfigImportDiagnostic[] } {
  return { success: false, diagnostics: [{ code, message, path }] }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

function parseCurrentProject(input: unknown):
  | { success: true, payload: CanonicalImportPayload }
  | { success: false, diagnostics: ConfigImportDiagnostic[] } {
  if (!isRecord(input))
    return invalid('IMPORT_FORMAT_UNSUPPORTED', 'Project JSON must be an object.')
  if (input.version !== PROJECT_DOCUMENT_VERSION) {
    return invalid('IMPORT_VERSION_UNSUPPORTED', `Unsupported Project version: ${String(input.version)}.`, '$.version')
  }
  const parsed = parseProjectDocument(input)
  return parsed.success
    ? { success: true, payload: { target: 'project', document: parsed.data } }
    : {
        success: false,
        diagnostics: parsed.diagnostics.map(item => ({
          code: 'IMPORT_PROJECT_INVALID',
          message: item.message,
          path: pathFromModel(item.path),
        })),
      }
}

function parseCurrentPage(input: unknown):
  | { success: true, payload: CanonicalImportPayload }
  | { success: false, diagnostics: ConfigImportDiagnostic[] } {
  if (!isRecord(input) || input.kind !== 'config-form-page') {
    return invalid('IMPORT_FORMAT_UNSUPPORTED', 'Page JSON must be a config-form-page transfer document.', '$.kind')
  }
  if (input.version !== PAGE_TRANSFER_VERSION) {
    return invalid('IMPORT_VERSION_UNSUPPORTED', `Unsupported Page transfer version: ${String(input.version)}.`, '$.version')
  }
  const parsed = pageTransferDocumentSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      diagnostics: parsed.error.issues.map(issue => ({
        code: 'IMPORT_PAGE_INVALID',
        message: issue.message,
        path: pathFromModel(issue.path),
      })),
    }
  }
  return {
    success: true,
    payload: {
      target: 'page',
      page: structuredClone(parsed.data.page),
      registryLock: structuredClone(parsed.data.registryLock),
    },
  }
}

export function parseConfigImportPayload(
  input: unknown,
  target: ConfigImportTarget,
):
  | { success: true, payload: CanonicalImportPayload }
  | { success: false, diagnostics: ConfigImportDiagnostic[] } {
  return target === 'project' ? parseCurrentProject(input) : parseCurrentPage(input)
}
