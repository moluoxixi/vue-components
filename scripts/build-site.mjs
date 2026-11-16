import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pagesOutput = resolve(repositoryRoot, 'dist/pages')
const siteOutput = resolve(repositoryRoot, 'out')

// Reuse the exact documentation, workbench and playground builds used by Pages.
// Only the deployment base and the final static output directory differ.
const result = spawnSync(process.execPath, [resolve(repositoryRoot, 'scripts/build-pages.mjs')], {
  cwd: repositoryRoot,
  env: { ...process.env, PAGES_BASE_PATH: '/' },
  stdio: 'inherit',
})

if (result.error) {
  throw result.error
}
if (result.status !== 0) {
  throw new Error(`Site build failed with ${result.signal ?? `exit code ${result.status}`}`)
}
if (!existsSync(resolve(pagesOutput, 'index.html'))) {
  throw new Error('The Pages build did not produce a site entry.')
}

rmSync(siteOutput, { force: true, recursive: true })
cpSync(pagesOutput, siteOutput, { recursive: true })
console.log('Site artifact ready at out/ with base /')
