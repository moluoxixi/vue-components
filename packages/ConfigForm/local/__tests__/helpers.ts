import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach } from 'vitest'

const disposers: Array<() => Promise<unknown>> = []
export function cleanup(fn: () => Promise<unknown>): void {
  disposers.push(fn)
}
export async function temporaryWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'config-form-local-test-'))
  cleanup(async () => {
    if (!resolve(root).startsWith(join(resolve(tmpdir()), 'config-form-local-test-')))
      throw new Error('Refusing to remove a path outside the test workspace.')
    await rm(root, { recursive: true, force: true })
  })
  return root
}
afterEach(async () => {
  while (disposers.length)
    await disposers.pop()!()
})
