import { randomUUID } from 'node:crypto'
import { mkdir, open, rename, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'
import { I18nToolError } from './error'

const TRANSIENT_WINDOWS_CODES = new Set(['EACCES', 'EBUSY', 'EPERM'])

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds))
}

async function renameWithRetry(source: string, target: string): Promise<void> {
  return renameWith(source, target, rename)
}

async function removeWithRetry(target: string, removeFile: typeof rm): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await removeFile(target, { force: true })
      return
    }
    catch (error) {
      if (!TRANSIENT_WINDOWS_CODES.has(errorCode(error) ?? '') || attempt === 2)
        throw error
      await delay(20 * (attempt + 1))
    }
  }
}

async function renameWith(
  source: string,
  target: string,
  renameFile: typeof rename,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await renameFile(source, target)
      return
    }
    catch (error) {
      if (!TRANSIENT_WINDOWS_CODES.has(errorCode(error) ?? '') || attempt === 2)
        throw error
      await delay(20 * (attempt + 1))
    }
  }
}

export interface AtomicWriteOptions {
  remove?: typeof rm
  rename?: typeof rename
  validateTarget?: () => Promise<void>
}

export async function writeTextAtomically(
  target: string,
  content: string,
  options: AtomicWriteOptions = {},
): Promise<void> {
  await options.validateTarget?.()
  await mkdir(dirname(target), { recursive: true })
  await options.validateTarget?.()
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`
  try {
    const handle = await open(temporary, 'wx')
    try {
      await options.validateTarget?.()
      await handle.writeFile(content, 'utf8')
      await handle.sync()
    }
    finally {
      await handle.close()
    }
    await options.validateTarget?.()
    if (options.rename)
      await renameWith(temporary, target, options.rename)
    else
      await renameWithRetry(temporary, target)
  }
  catch {
    try {
      await removeWithRetry(temporary, options.remove ?? rm)
    }
    catch {
      throw new I18nToolError('WRITE_FAILED', 'Atomic write failed and temporary cleanup could not complete.', 500)
    }
    throw new I18nToolError('WRITE_FAILED', 'Unable to replace the locale resource atomically.', 500)
  }
}
