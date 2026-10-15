import type { ProjectRepository } from '@moluoxixi/config-form-model'
import type { RepositoryMethod } from '@moluoxixi/config-form-studio/client'
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { MemoryProjectRepository, ProjectRepositoryError } from '@moluoxixi/config-form-model'
import { mapRepositoryArguments } from '@moluoxixi/config-form-studio/client'

type Mutation = 'create' | 'commit' | 'delete' | 'setVersionLabel' | 'pruneVersions'
interface JournalEntry { method: Mutation, args: unknown[], timestamp: string }
interface Journal { version: 1, entries: JournalEntry[] }
/** One writer per workspace; all clients use the HTTP service to share it. */
export async function openFileProjectRepository(directory: string): Promise<ProjectRepository & { dispose: () => Promise<void> }> {
  await mkdir(resolve(directory), { recursive: true })
  const root = await realpath(resolve(directory))
  const metadata = join(root, '.configform')
  await mkdir(metadata, { recursive: true })
  if ((await lstat(metadata)).isSymbolicLink())
    throw new Error('Workspace metadata directory cannot be a symbolic link.')
  const lockPath = join(metadata, 'writer.lock')
  const lockId = randomUUID()
  const acquireLock = () => open(lockPath, 'wx')
  let lock
  try {
    lock = await acquireLock()
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
      throw error
    const stale = await readFile(lockPath, 'utf8')
    const owner = JSON.parse(stale) as { pid: number }
    let alive = true
    try {
      process.kill(owner.pid, 0)
    }
    catch (failure) {
      alive = (failure as NodeJS.ErrnoException).code !== 'ESRCH'
    }
    if (alive)
      throw new Error('This workspace already has an active local service. Connect to that service instead.')
    if (await readFile(lockPath, 'utf8') !== stale)
      throw new Error('Workspace lock changed; retry opening the workspace.')
    await unlink(lockPath)
    lock = await acquireLock()
  }
  await lock.writeFile(JSON.stringify({ pid: process.pid, id: lockId }))
  await lock.close()
  const file = join(metadata, 'workspace.json')
  let journal: Journal = { version: 1, entries: [] }
  let timestamp = new Date().toISOString()
  let memory = new MemoryProjectRepository({ now: () => timestamp })
  const invoke = async (method: RepositoryMethod, args: unknown[]) => {
    const fn = memory[method] as (...args: unknown[]) => Promise<unknown>
    return await fn.apply(memory, args)
  }
  async function restore(): Promise<void> {
    memory.close()
    memory = new MemoryProjectRepository({ now: () => timestamp })
    for (const entry of journal.entries) {
      timestamp = entry.timestamp
      await invoke(entry.method, mapRepositoryArguments(entry.method, entry.args, 'decode'))
    }
  }
  async function release(): Promise<void> {
    const owner = JSON.parse(await readFile(lockPath, 'utf8')) as { id: string }
    if (owner.id === lockId)
      await unlink(lockPath)
  }
  try {
    try {
      journal = JSON.parse(await readFile(file, 'utf8')) as Journal
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new ProjectRepositoryError('PROJECT_REPOSITORY_CORRUPT', 'Workspace journal cannot be read.')
    }
    const allowed = new Set(['create', 'commit', 'delete', 'pruneVersions', 'setVersionLabel'])
    if (journal.version !== 1 || !Array.isArray(journal.entries) || journal.entries.some(entry => !allowed.has(entry.method) || !Array.isArray(entry.args) || !Number.isFinite(Date.parse(entry.timestamp))))
      throw new ProjectRepositoryError('PROJECT_REPOSITORY_CORRUPT', 'Workspace journal has an invalid format.')
    await restore()
  }
  catch (error) {
    await release()
    throw error
  }
  let queue: Promise<unknown> = Promise.resolve()
  let closed = false
  function run<T>(fn: () => Promise<T>): Promise<T> {
    if (closed)
      return Promise.reject(new Error('Workspace repository is closed.'))
    const pending = queue.then(fn)
    queue = pending.catch(() => {
    })
    return pending
  }
  async function mutate<T>(method: Mutation, args: unknown[]): Promise<T> {
    const snapshot = structuredClone(args)
    return await run(async () => {
      timestamp = new Date().toISOString()
      const result = await invoke(method, snapshot) as T
      if (method === 'commit' && (result as { replayed?: boolean }).replayed)
        return result
      const next: Journal = { version: 1, entries: [...journal.entries, { method, args: mapRepositoryArguments(method, snapshot, 'encode'), timestamp }] }
      const temporary = `${file}.${randomUUID()}.tmp`
      try {
        const handle = await open(temporary, 'wx')
        try {
          await handle.writeFile(`${JSON.stringify(next)}\n`)
          await handle.sync()
        }
        finally {
          await handle.close()
        }
        await rename(temporary, file)
        journal = next
        return result
      }
      catch (error) {
        await unlink(temporary).catch(() => {
        })
        await restore()
        throw error
      }
    })
  }
  let disposal: Promise<void> | undefined
  function dispose(): Promise<void> {
    if (!disposal) {
      closed = true
      disposal = queue.then(async () => {
        memory.close()
        await release()
      })
    }
    return disposal
  }
  return {
    persistence: 'durable',
    dispose,
    close: () => {
      void dispose()
    },
    create: input => mutate('create', [input]),
    commit: input => mutate('commit', [input]),
    delete: id => mutate('delete', [id]),
    setVersionLabel: input => mutate('setVersionLabel', [input]),
    pruneVersions: (id, policy) => mutate('pruneVersions', [id, policy ?? {}]),
    get: id => run(() => memory.get(id)),
    list: () => run(() => memory.list()),
    getVersion: (id, revision) => run(() => memory.getVersion(id, revision)),
    listVersions: id => run(() => memory.listVersions(id)),
    readEmbedded: input => run(() => memory.readEmbedded(input)),
  }
}
