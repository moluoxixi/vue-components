import type { WorkspaceFile } from '../../types'
import type { DownloadWorkspaceFileInput, WorkspaceArchiveInput } from '../types'
import { safeProjectSlug } from '../../utils'
import { createWorkspaceArchive } from './archive'

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

export function workspaceFileBlob(file: Readonly<WorkspaceFile>, mime?: string): Blob {
  if (file.kind === 'text')
    return new Blob([file.content], { type: mime ?? 'text/plain;charset=utf-8' })
  const bytes = Uint8Array.from(file.content)
  return new Blob([bytes.buffer], { type: mime ?? 'application/octet-stream' })
}

export function downloadWorkspaceFile(input: DownloadWorkspaceFileInput): string {
  return downloadBlob(workspaceFileBlob(input.file, input.mime), input.filename)
}

async function downloadArchive(input: WorkspaceArchiveInput, data: Uint8Array): Promise<string> {
  const filename = `${safeProjectSlug(input.name)}.zip`
  const bytes = Uint8Array.from(data)
  return downloadBlob(new Blob([bytes.buffer], { type: 'application/zip' }), filename)
}

export async function downloadWorkspaceArchive(input: WorkspaceArchiveInput): Promise<string> {
  return downloadArchive(input, await createWorkspaceArchive(input))
}
