import type { WorkspaceProject } from '../types'
import { safeProjectSlug } from '../path'
import { createProjectArchive } from './archive'

export async function downloadProjectArchive(project: WorkspaceProject): Promise<string> {
  if (typeof document === 'undefined')
    throw new Error('[config-form-workbench] project downloads require a browser document')
  const filename = `${safeProjectSlug(project.name)}.zip`
  const data = await createProjectArchive(project)
  const bytes = Uint8Array.from(data)
  const url = URL.createObjectURL(new Blob([bytes.buffer], { type: 'application/zip' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return filename
}
