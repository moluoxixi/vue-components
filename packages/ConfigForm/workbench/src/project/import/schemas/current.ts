import type { CanonicalImportPayload, ConfigImportDiagnostic, ConfigImportTarget } from '../types'
import { PROJECT_TRANSFER_VERSION, SURFACE_TRANSFER_VERSION } from '@moluoxixi/config-form-model'
import { appendConfigImportPath } from './guard'

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

function invalid(code: ConfigImportDiagnostic['code'], message: string, path = '$'):
{ success: false, diagnostics: ConfigImportDiagnostic[] } {
  return { success: false, diagnostics: [{ code, message, path }] }
}

export function parseConfigImportPayload(
  input: unknown,
  target: ConfigImportTarget,
):
  | { success: true, payload: CanonicalImportPayload }
  | { success: false, diagnostics: ConfigImportDiagnostic[] } {
  if (!isRecord(input))
    return invalid('IMPORT_FORMAT_UNSUPPORTED', 'Transfer envelope must be an object.')
  const expectedKind = target === 'project' ? 'config-form-project' : 'config-form-surface'
  const expectedVersion = target === 'project' ? PROJECT_TRANSFER_VERSION : SURFACE_TRANSFER_VERSION
  if (input.kind !== expectedKind)
    return invalid('IMPORT_TARGET_MISMATCH', `Expected ${expectedKind} transfer envelope.`, '$.kind')
  if (input.version !== expectedVersion)
    return invalid('IMPORT_VERSION_UNSUPPORTED', `Unsupported ${expectedKind} transfer version: ${String(input.version)}.`, appendConfigImportPath('$', 'version'))
  return { success: true, payload: { target, envelope: structuredClone(input) } }
}
