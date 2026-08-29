import type { WorkspaceProject } from '../types'
import type { WorkspaceArchiveInput } from './archive'
import { safeProjectSlug } from '../path'
import { createProjectArchive, createWorkspaceArchive } from './archive'

async function downloadArchive(input: WorkspaceArchiveInput, data: Uint8Array): Promise<string> {
  if (typeof document === 'undefined')
    throw new Error('[config-form-workbench] project downloads require a browser document')
  const filename = `${safeProjectSlug(input.name)}.zip`
  const bytes = Uint8Array.from(data)
  const url = URL.createObjectURL(new Blob([bytes.buffer], { type: 'application/zip' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return filename
}

export async function downloadProjectArchive(project: WorkspaceProject): Promise<string> {
  return downloadArchive(project, await createProjectArchive(project))
}

export async function downloadWorkspaceArchive(input: WorkspaceArchiveInput): Promise<string> {
  return downloadArchive(input, await createWorkspaceArchive(input))
}
