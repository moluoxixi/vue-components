import type { ElementPlusDocsProject, ElementPlusDocsProjectInput } from '../../project'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { createJiti } from 'jiti'
import { resolveElementPlusDocsProject } from '../../project'

const CONFIG_NAMES = [
  'element-plus-docs.config.ts',
  'element-plus-docs.config.mts',
  'element-plus-docs.config.js',
  'element-plus-docs.config.mjs',
] as const

export interface LoadedElementPlusDocsProject {
  configPath: string
  docsRoot: string
  generatedRoot: string
  project: ElementPlusDocsProject
  projectRoot: string
}

function findConfig(startDirectory: string, explicitPath?: string): string {
  if (explicitPath) {
    const path = isAbsolute(explicitPath) ? explicitPath : resolve(startDirectory, explicitPath)
    if (!existsSync(path))
      throw new Error(`Element Plus docs config does not exist: ${path}`)
    return path
  }

  let directory = resolve(startDirectory)
  while (true) {
    for (const name of CONFIG_NAMES) {
      const path = resolve(directory, name)
      if (existsSync(path))
        return path
    }
    const parent = dirname(directory)
    if (parent === directory)
      break
    directory = parent
  }
  throw new Error(`Unable to find ${CONFIG_NAMES[0]} from ${startDirectory}`)
}

function inferGitRoot(directory: string): string | undefined {
  try {
    return execFileSync('git', ['-C', directory, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim() || undefined
  }
  catch {
    return undefined
  }
}

export async function loadElementPlusDocsProject(options: {
  configPath?: string
  cwd?: string
} = {}): Promise<LoadedElementPlusDocsProject> {
  const cwd = resolve(options.cwd ?? process.cwd())
  const configPath = findConfig(cwd, options.configPath)
  const docsRoot = dirname(configPath)
  const jiti = createJiti(import.meta.url, { interopDefault: true })
  const input = await jiti.import<ElementPlusDocsProjectInput>(configPath, { default: true })
  if (!input || typeof input !== 'object')
    throw new TypeError(`Element Plus docs config must export a project object: ${configPath}`)
  const project = resolveElementPlusDocsProject(input)
  const projectRoot = project.rootDirectory
    ? resolve(docsRoot, project.rootDirectory)
    : (inferGitRoot(docsRoot) ?? docsRoot)
  return {
    configPath,
    docsRoot,
    generatedRoot: resolve(docsRoot, project.generatedDirectory ?? '.generated'),
    project,
    projectRoot,
  }
}
