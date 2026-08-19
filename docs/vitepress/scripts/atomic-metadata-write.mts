import type { renameSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { renameSync as rename, rmSync as rm, writeFileSync as writeFile } from 'node:fs'
import process from 'node:process'

export interface AtomicFileSystem {
  renameSync: typeof renameSync
  rmSync: typeof rmSync
  writeFileSync: typeof writeFileSync
}

export const defaultAtomicFileSystem: AtomicFileSystem = {
  renameSync: rename,
  rmSync: rm,
  writeFileSync: writeFile,
}

export function writeJsonAtomically(
  value: unknown,
  outputPath: string,
  fileSystem: AtomicFileSystem = defaultAtomicFileSystem,
): void {
  const temporaryPath = `${outputPath}.${process.pid}.${randomUUID()}.tmp`
  try {
    fileSystem.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    fileSystem.renameSync(temporaryPath, outputPath)
  }
  catch (error) {
    fileSystem.rmSync(temporaryPath, { force: true })
    throw error
  }
}
