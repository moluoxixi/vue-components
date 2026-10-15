import type { RawSourceFileSetV1 } from '@moluoxixi/config-form-source/generator'
import { Buffer } from 'node:buffer'
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exportSourceArtifact, readSourceArtifact, saveSourceArtifact, writeSourceDirectory } from '../src/services/source-files'
import { temporaryWorkspace } from './helpers'

const source: RawSourceFileSetV1 = { version: 1, kind: 'raw-source', entry: 'index.html', files: [
  { kind: 'text', language: 'text', path: 'index.html', content: 'Hello' },
  { kind: 'binary', path: 'assets/logo.png', mediaType: 'image/png', encoding: 'base64', contentBase64: 'AAEC' },
] }
describe('source artifact publication', () => {
  it('writes text and binary files and detects artifact tampering', async () => {
    const root = await temporaryWorkspace()
    const artifact = await saveSourceArtifact(root, { projectId: 'project', repositoryRevision: 3, source })
    expect(await readSourceArtifact(root, artifact.id)).toEqual(artifact)
    const exported = await exportSourceArtifact(root, artifact, 'application')
    expect(await readFile(join(exported, 'assets/logo.png'))).toEqual(Buffer.from([0, 1, 2]))
    const path = join(root, '.configform', 'artifacts', `${artifact.id}.json`)
    await writeFile(path, JSON.stringify({ ...artifact, repositoryRevision: 99 }))
    await expect(readSourceArtifact(root, artifact.id)).rejects.toThrow('checksum')
  })
  it('rejects path escapes, duplicate names, overwrites and symbolic output directories', async () => {
    const root = await temporaryWorkspace()
    for (const path of ['../escape', 'C:/escape', '/escape', 'a\\b', 'a/../b'])
      await expect(writeSourceDirectory({ ...source, files: [{ kind: 'text', path, language: 'text', content: 'x' }] }, join(root, 'unsafe'))).rejects.toThrow('Unsafe')
    await expect(writeSourceDirectory({ ...source, files: [...source.files, { kind: 'text', path: 'INDEX.HTML', language: 'text', content: 'x' }] }, join(root, 'duplicate'))).rejects.toThrow('Duplicate')
    const output = await writeSourceDirectory(source, join(root, 'existing'))
    await writeFile(join(output, 'index.html'), 'Human source')
    await expect(writeSourceDirectory(source, output)).rejects.toThrow('already exists')
    expect(await readFile(join(output, 'index.html'), 'utf8')).toBe('Human source')
    const outside = join(root, 'outside')
    await mkdir(outside)
    await symlink(outside, join(root, 'generated'), process.platform === 'win32' ? 'junction' : 'dir')
    await expect(exportSourceArtifact(root, { version: 1, id: 'a'.repeat(64), projectId: 'project', repositoryRevision: 1, source })).rejects.toThrow('symbolic link')
  })
})
