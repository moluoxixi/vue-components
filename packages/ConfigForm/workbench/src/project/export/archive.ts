import type { ProjectPath, WorkspaceFile, WorkspaceProject } from '../types'
import { strToU8, zip } from 'fflate'
import { assertUniqueProjectPaths, safeProjectSlug } from '../path'
import { parseWorkspaceProject } from '../schema'

export interface WorkspaceArchiveInput {
  files: Readonly<Record<ProjectPath, Readonly<WorkspaceFile>>>
  name: string
}

export async function createWorkspaceArchive(input: WorkspaceArchiveInput): Promise<Uint8Array> {
  const root = safeProjectSlug(input.name)
  const paths = assertUniqueProjectPaths(Object.keys(input.files))
  const entries = Object.fromEntries(paths.map((path) => {
    const file = input.files[path]!
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

export async function createProjectArchive(input: WorkspaceProject): Promise<Uint8Array> {
  const project = parseWorkspaceProject(input)
  return createWorkspaceArchive(project)
}
