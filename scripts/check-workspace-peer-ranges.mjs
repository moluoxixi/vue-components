import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const rootDir = resolve(import.meta.dirname, '..')
const packagesDir = resolve(rootDir, 'packages')

function collectPackageManifests(directory) {
  const manifests = []
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry)
    if (!statSync(path).isDirectory() || entry === 'node_modules' || entry === 'dist')
      continue

    const manifestPath = resolve(path, 'package.json')
    try {
      manifests.push(JSON.parse(readFileSync(manifestPath, 'utf8')))
    }
    catch (error) {
      if (error?.code !== 'ENOENT')
        throw error
      manifests.push(...collectPackageManifests(path))
    }
  }
  return manifests
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Z.-]+)?$/i.exec(version)
  if (!match)
    throw new Error(`Unsupported workspace version: ${version}`)
  return match.slice(1).map(Number)
}

function compareVersion(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index])
      return left[index] - right[index]
  }
  return 0
}

function satisfies(version, range) {
  if (range === '*' || range === 'workspace:*')
    return true

  const actual = parseVersion(version)
  if (/^\d/.test(range))
    return compareVersion(actual, parseVersion(range)) === 0

  const operator = range[0]
  if (operator !== '^' && operator !== '~')
    throw new Error(`Unsupported internal peer range: ${range}`)

  const minimum = parseVersion(range.slice(1))
  const maximum = operator === '~'
    ? [minimum[0], minimum[1] + 1, 0]
    : minimum[0] > 0
      ? [minimum[0] + 1, 0, 0]
      : minimum[1] > 0
        ? [0, minimum[1] + 1, 0]
        : [0, 0, minimum[2] + 1]

  return compareVersion(actual, minimum) >= 0 && compareVersion(actual, maximum) < 0
}

const manifests = collectPackageManifests(packagesDir)
const workspaceVersions = new Map(manifests.map(manifest => [manifest.name, manifest.version]))
const mismatches = []

for (const manifest of manifests) {
  for (const [dependency, range] of Object.entries(manifest.peerDependencies ?? {})) {
    const workspaceVersion = workspaceVersions.get(dependency)
    if (workspaceVersion && !satisfies(workspaceVersion, range))
      mismatches.push(`${manifest.name}: ${dependency}@${range} does not accept workspace ${workspaceVersion}`)
  }
}

if (mismatches.length > 0) {
  console.error('Workspace peer dependency ranges are not release-ready:')
  mismatches.forEach(message => console.error(`- ${message}`))
  process.exit(1)
}

console.log('PASS workspace peer dependency ranges')
