import type { SourceFile } from '@moluoxixi/config-form-source/generator'
import type { DownloadSourceFileInput, WorkspaceArchiveInput } from '../types'
import { safeProjectSlug } from '../../utils'
import { createWorkspaceArchive } from './archive'
import { sourceFileBytes } from './file-content'

function downloadBlob(blob: Blob, filename: string): string {
  if (typeof document === 'undefined')
    throw new Error('[config-form-workbench] project downloads require a browser document')
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  try {
    anchor.click()
  }
  finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return filename
}

export function sourceFileBlob(file: Readonly<SourceFile>, mime?: string): Blob {
  const bytes = sourceFileBytes(file)
  const type = mime ?? (file.kind === 'text' ? 'text/plain;charset=utf-8' : file.mediaType)
  return new Blob([Uint8Array.from(bytes).buffer], { type })
}

export function downloadSourceFile(input: DownloadSourceFileInput): string {
  return downloadBlob(sourceFileBlob(input.file, input.mime), input.filename)
}

async function downloadArchive(input: WorkspaceArchiveInput, data: Uint8Array): Promise<string> {
  const filename = `${safeProjectSlug(input.name)}.zip`
  const bytes = Uint8Array.from(data)
  return downloadBlob(new Blob([bytes.buffer], { type: 'application/zip' }), filename)
}

export async function downloadWorkspaceArchive(input: WorkspaceArchiveInput): Promise<string> {
  return downloadArchive(input, await createWorkspaceArchive(input))
}
