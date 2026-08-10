import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import process from 'node:process'

const repositoryRoot = resolve(import.meta.dirname, '..')
const changesetDirectory = resolve(repositoryRoot, '.changeset')
const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]

function normalizePath(path) {
  return path.replaceAll('\\', '/')
}

function runGit(args, options = {}) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.allowFailure ? 'ignore' : 'inherit'],
  }).trim()
}

function runPnpm(args) {
  const pnpmScript = process.env.npm_execpath
  const command = pnpmScript
    ? process.execPath
    : process.platform === 'win32'
      ? 'pnpm.cmd'
      : 'pnpm'
  const commandArgs = pnpmScript ? [pnpmScript, ...args] : args

  return execFileSync(command, commandArgs, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
}

function parseArguments(args) {
  const options = { dryRun: false }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (argument === '--base' || argument === '--head') {
      const value = args[index + 1]
      if (value === undefined)
        throw new Error(`${argument} requires a git ref`)
      options[argument.slice(2)] = value
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }

  return options
}

function resolveRefs(options) {
  const head = options.head || process.env.AUTO_CHANGESET_HEAD || process.env.GITHUB_SHA || 'HEAD'
  const requestedBase = options.base || process.env.AUTO_CHANGESET_BASE || process.env.GITHUB_EVENT_BEFORE
  const base = requestedBase && !/^0+$/.test(requestedBase)
    ? requestedBase
    : `${head}^`

  runGit(['rev-parse', '--verify', `${head}^{commit}`])
  runGit(['rev-parse', '--verify', `${base}^{commit}`])

  return { base, head }
}

function collectWorkspacePackages() {
  const workspacePackages = JSON.parse(runPnpm(['list', '-r', '--depth', '-1', '--json']))

  return workspacePackages
    .filter(pkg => !pkg.private && pkg.name && pkg.version)
    .map(pkg => ({
      name: pkg.name,
      relativeDirectory: normalizePath(relative(repositoryRoot, pkg.path)),
    }))
    .sort((left, right) => left.relativeDirectory.localeCompare(right.relativeDirectory))
}

function collectPendingPackageNames(directory = changesetDirectory) {
  const packageNames = new Set()

  if (!existsSync(directory))
    return packageNames

  for (const entry of readdirSync(directory)) {
    if (!entry.endsWith('.md') || entry === 'README.md')
      continue

    const content = readFileSync(resolve(directory, entry), 'utf8')
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1]
    if (!frontmatter)
      continue

    for (const line of frontmatter.split(/\r?\n/)) {
      const separatorIndex = line.lastIndexOf(':')
      if (separatorIndex === -1)
        continue

      const releaseType = line.slice(separatorIndex + 1).trim()
      if (!['major', 'minor', 'patch'].includes(releaseType))
        continue

      const packageName = line.slice(0, separatorIndex).trim().replace(/^["']|["']$/g, '')
      if (packageName)
        packageNames.add(packageName)
    }
  }

  return packageNames
}

function isGeneratedPackageFile(relativePackagePath) {
  return relativePackagePath === 'CHANGELOG.md'
    || relativePackagePath === '.npmrc'
    || relativePackagePath.endsWith('.tsbuildinfo')
    || /^(?:coverage|dist|node_modules)\//.test(relativePackagePath)
    || /^(?:\.turbo|\.vite)\//.test(relativePackagePath)
}

export function normalizeManifestForChangeDetection(manifest, workspacePackageNames) {
  const normalized = structuredClone(manifest)
  delete normalized.version

  for (const field of dependencyFields) {
    if (!normalized[field])
      continue
    for (const packageName of workspacePackageNames)
      delete normalized[field][packageName]
  }

  return normalized
}

function readManifestAtRef(ref, manifestPath) {
  try {
    return JSON.parse(runGit(['show', `${ref}:${manifestPath}`], { allowFailure: true }))
  }
  catch {
    return undefined
  }
}

function hasMeaningfulManifestChange(packageInfo, base, head, workspacePackageNames) {
  const manifestPath = `${packageInfo.relativeDirectory}/package.json`
  const before = readManifestAtRef(base, manifestPath)
  const after = readManifestAtRef(head, manifestPath)

  if (!before || !after)
    return before !== after

  return JSON.stringify(normalizeManifestForChangeDetection(before, workspacePackageNames))
    !== JSON.stringify(normalizeManifestForChangeDetection(after, workspacePackageNames))
}

export function findPackagesNeedingChangesets({
  packages,
  changedFiles,
  pendingPackageNames,
  hasManifestChange = () => true,
}) {
  return packages.filter((packageInfo) => {
    if (pendingPackageNames.has(packageInfo.name))
      return false

    const prefix = `${packageInfo.relativeDirectory}/`
    return changedFiles.some((file) => {
      if (!file.startsWith(prefix))
        return false

      const relativePackagePath = file.slice(prefix.length)
      if (relativePackagePath === 'package.json')
        return hasManifestChange(packageInfo)

      return !isGeneratedPackageFile(relativePackagePath)
    })
  })
}

export function renderPatchChangeset(packageNames, revision) {
  const releases = [...packageNames]
    .sort((left, right) => left.localeCompare(right))
    .map(packageName => `"${packageName}": patch`)
    .join('\n')

  return `---\n${releases}\n---\n\nAutomatically release packages changed in ${revision}.\n`
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  const refs = resolveRefs(options)
  const resolvedHead = runGit(['rev-parse', refs.head])
  const changedFiles = runGit([
    'diff',
    '--name-only',
    '--diff-filter=ACMRT',
    refs.base,
    refs.head,
    '--',
  ]).split(/\r?\n/).filter(Boolean).map(normalizePath)
  const packages = collectWorkspacePackages()
  const workspacePackageNames = new Set(packages.map(pkg => pkg.name))
  const pendingPackageNames = collectPendingPackageNames()
  const packagesNeedingChangesets = findPackagesNeedingChangesets({
    packages,
    changedFiles,
    pendingPackageNames,
    hasManifestChange: packageInfo => hasMeaningfulManifestChange(
      packageInfo,
      refs.base,
      refs.head,
      workspacePackageNames,
    ),
  })
  const packageNames = packagesNeedingChangesets.map(pkg => pkg.name)
  const result = {
    base: refs.base,
    head: resolvedHead,
    packages: packageNames,
  }

  if (options.dryRun) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (packageNames.length === 0) {
    console.log('No changed publishable packages require an automatic changeset.')
    return
  }

  const shortRevision = resolvedHead.slice(0, 12)
  const changesetPath = resolve(changesetDirectory, `auto-${shortRevision}.md`)
  writeFileSync(changesetPath, renderPatchChangeset(packageNames, shortRevision))
  console.log(`Created ${relative(repositoryRoot, changesetPath)} for: ${packageNames.join(', ')}`)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename))
  main()
