import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const docsRoot = fileURLToPath(new URL('../../../', import.meta.url))
export const docsGeneratedRoot = resolve(docsRoot, '.generated')
export const docsGeneratedApiDirectory = resolve(docsGeneratedRoot, 'api')
export const docsGeneratedRepositoryDirectory = resolve(docsGeneratedRoot, 'repository')
export const docsGeneratedTypesDirectory = resolve(docsGeneratedRoot, 'types')
export const docsGeneratedPrepareLockPath = resolve(docsGeneratedRoot, 'prepare.lock')
export const docsGeneratedAutoImportsDeclaration = resolve(docsGeneratedTypesDirectory, 'auto-imports.d.ts')
export const docsGeneratedComponentsDeclaration = resolve(docsGeneratedTypesDirectory, 'components.d.ts')

export function ensureDocsGeneratedDirectories(): void {
  for (const directory of [
    docsGeneratedApiDirectory,
    docsGeneratedRepositoryDirectory,
    docsGeneratedTypesDirectory,
  ]) {
    mkdirSync(directory, { recursive: true })
  }
}

export function ensureDocsGeneratedTypeDeclarations(): void {
  ensureDocsGeneratedDirectories()
  for (const declaration of [
    docsGeneratedAutoImportsDeclaration,
    docsGeneratedComponentsDeclaration,
  ]) {
    if (!existsSync(declaration))
      writeFileSync(declaration, '// Generated during the documentation lifecycle.\nexport {}\n', 'utf8')
  }
}
