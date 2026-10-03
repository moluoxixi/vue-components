import type { StructuredSourceArchiveInput } from '../types'
import { zip } from 'fflate'
import { safeProjectSlug } from '../../utils'
import { sourceFileBytes } from './file-content'

/** Build the standard Vue project layout for project and page source exports. */
export async function createStructuredSourceArchive(
  input: StructuredSourceArchiveInput,
): Promise<Uint8Array> {
  const { projectStructuredSourceFiles } = await import('./structured-projection')
  const root = safeProjectSlug(input.name)
  const projected = projectStructuredSourceFiles(input)
  const entries: Record<string, Uint8Array> = Object.fromEntries(
    projected.map(file => [`${root}/${file.path}`, sourceFileBytes(file)] as const),
  )

  return await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, { level: 6 }, (error, data) => {
      if (error)
        reject(error)
      else
        resolve(data)
    })
  })
}
