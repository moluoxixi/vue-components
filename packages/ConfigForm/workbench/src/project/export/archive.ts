import type { WorkspaceProject } from '../types'
import { strToU8, zip } from 'fflate'
import { assertUniqueProjectPaths, safeProjectSlug } from '../path'
import { parseWorkspaceProject } from '../schema'

export async function createProjectArchive(input: WorkspaceProject): Promise<Uint8Array> {
  const project = parseWorkspaceProject(input)
  const root = safeProjectSlug(project.name)
  const paths = assertUniqueProjectPaths(Object.keys(project.files))
  const entries = Object.fromEntries(paths.map((path) => {
    const file = project.files[path]!
    return [`${root}/${path}`, file.kind === 'text' ? strToU8(file.content) : file.content]
  }))

  return await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, { level: 6 }, (error, data) => {
      if (error)
        reject(error)
      else
        resolve(data)
    })
  })
}
