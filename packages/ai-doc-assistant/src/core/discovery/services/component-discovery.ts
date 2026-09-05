import type { ExportCandidate } from './component-export-resolution'
import type { DiscoveryContext, WorkspacePackage } from './workspace-resolution'
import { glob } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { dedupeCandidates, discoverEntryExports } from './component-export-resolution'
import {
  fileExists,
  findNearestPackageName,
  loadWorkspacePackages,
  normalizePath,
  resolvePath,
} from './workspace-resolution'

/** 组件源码发现结果：只代表公共入口导出的 SFC。 */
export interface ComponentSource {
  filePath: string
  packageName: string
  /** 公共入口上的导出名，用于 displayName 不可靠时兜底。 */
  exportName?: string
}

export interface ComponentDiscoveryOptions {
  /** 显式组件库入口文件（相对 root 或绝对路径）。 */
  componentEntries?: string[]
  /** legacy 显式 SFC glob；配置后不做入口解析。 */
  componentGlobs?: string[]
  /** 项目根目录。 */
  root: string
}

async function discoverFromEntries(ctx: DiscoveryContext, entries: string[]): Promise<ComponentSource[]> {
  const candidates: ExportCandidate[] = []

  for (const entry of entries) {
    const entryPath = resolvePath(ctx.root, entry)
    if (!fileExists(entryPath))
      throw new Error(`component entry not found: ${entry}`)

    const packageName = findNearestPackageName(ctx, entryPath)
    candidates.push(...await discoverEntryExports(ctx, entryPath, packageName, new Set()))
  }

  const components = dedupeCandidates(candidates)
  if (!components.length)
    throw new Error(`no public Vue components exported from configured entries: ${entries.join(', ')}`)

  return components
}

async function discoverFromGlobs(ctx: DiscoveryContext, globs: string[]): Promise<ComponentSource[]> {
  const candidates: ComponentSource[] = []

  for (const pattern of globs) {
    for await (const entry of glob(pattern, { cwd: ctx.root })) {
      const filePath = resolve(ctx.root, entry)
      if (extname(filePath) !== '.vue')
        continue
      candidates.push({
        filePath,
        packageName: findNearestPackageName(ctx, filePath),
      })
    }
  }

  if (!candidates.length)
    throw new Error(`componentGlobs matched no Vue component files: ${globs.join(', ')}`)

  return candidates
}

function autoEntries(packages: Map<string, WorkspacePackage>): WorkspacePackage[] {
  return Array.from(packages.values())
    .filter(pkg => pkg.entryPath)
    .sort((a, b) => normalizePath(a.entryPath!).localeCompare(normalizePath(b.entryPath!), 'en'))
}

async function discoverAuto(ctx: DiscoveryContext): Promise<ComponentSource[]> {
  const rootPackage = Array.from(ctx.workspacePackages.values()).find(pkg =>
    normalizePath(pkg.packageDir) === normalizePath(ctx.root) && pkg.entryPath,
  )

  if (rootPackage?.entryPath) {
    const components = dedupeCandidates(await discoverEntryExports(ctx, rootPackage.entryPath, rootPackage.name, new Set()))
    if (!components.length) {
      throw new Error(
        `component entry auto-discovery failed: no public Vue components exported from root package entry ${rootPackage.entryPath}`,
      )
    }
    return components
  }

  const discovered: { components: ComponentSource[], pkg: WorkspacePackage }[] = []
  const entries = autoEntries(ctx.workspacePackages)
  if (!entries.length)
    throw new Error('component entry auto-discovery failed: no package public source entry found')

  for (const pkg of entries) {
    const components = dedupeCandidates(await discoverEntryExports(ctx, pkg.entryPath!, pkg.name, new Set()))
    if (components.length)
      discovered.push({ components, pkg })
  }

  if (!discovered.length)
    throw new Error('component entry auto-discovery failed: no public Vue components exported from package entries')

  if (discovered.length > 1) {
    const names = discovered.map(item => `${item.pkg.name}:${normalizePath(item.pkg.entryPath!)}`).join(', ')
    throw new Error(`multiple component package entries found (${names}); configure componentEntries`)
  }

  return discovered[0].components
}

/**
 * 发现组件库公共组件源码。
 *
 * 规则：
 * - componentEntries 与 componentGlobs 都是显式配置，二者同时出现即配置冲突。
 * - 未配置时仅从 package public entry 自动识别；识别或解析不到组件即失败。
 * - 不从入口解析失败降级到 glob，避免把内部实现组件误当公共契约。
 */
export async function discoverComponentSources(options: ComponentDiscoveryOptions): Promise<ComponentSource[]> {
  if (options.componentEntries?.length && options.componentGlobs?.length) {
    throw new Error('componentEntries and componentGlobs cannot be used together')
  }

  const workspacePackages = await loadWorkspacePackages(options.root)
  const ctx: DiscoveryContext = { root: options.root, workspacePackages }

  if (options.componentEntries?.length)
    return discoverFromEntries(ctx, options.componentEntries)

  if (options.componentGlobs?.length)
    return discoverFromGlobs(ctx, options.componentGlobs)

  return discoverAuto(ctx)
}
