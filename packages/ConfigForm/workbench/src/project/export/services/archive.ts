import type { SourceArchiveInput } from '../types'
import { zip } from 'fflate'
import { safeProjectSlug } from '../../utils'
import { sourceFileBytes } from './file-content'

export async function createSourceArchive(input: SourceArchiveInput): Promise<Uint8Array> {
  const root = safeProjectSlug(input.name)
  const entries = Object.fromEntries(input.files.map(file => [
    `${root}/${file.path}`,
    sourceFileBytes(file),
  ]))

  return await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, { level: 6 }, (error, data) => {
      if (error)
        reject(error)
      else
        resolve(data)
    })
  })
}
