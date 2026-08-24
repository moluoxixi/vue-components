import type { AtomicFileSystem } from './atomic-write'
import { defaultAtomicFileSystem, writeJsonAtomically } from './atomic-write'

export async function collectValidateAndWrite<T>(options: {
  assertSnapshot: (snapshot: T) => void
  collectSnapshot: () => Promise<T>
  fileSystem?: AtomicFileSystem
  outputPath: string
}): Promise<T> {
  const snapshot = await options.collectSnapshot()
  options.assertSnapshot(snapshot)
  writeJsonAtomically(snapshot, options.outputPath, options.fileSystem ?? defaultAtomicFileSystem)
  return snapshot
}

export function formatRepositorySyncError(
  error: unknown,
  token?: string,
  includeQueryEncoding = false,
): string {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  if (!token)
    return message
  const secrets = new Set([token, encodeURIComponent(token)])
  if (includeQueryEncoding) {
    secrets.add(new URLSearchParams({ access_token: token })
      .toString()
      .slice('access_token='.length))
  }
  for (const secret of secrets)
    message = message.replaceAll(secret, '[REDACTED]')
  return message
}
