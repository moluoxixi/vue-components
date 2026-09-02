import type {
  ElementPlusDocsPlaygroundManifest,
  ElementPlusDocsProject,
} from '../../project/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveElementPlusDocsPlaygroundManifest } from '../../project/config'
import { writeJsonAtomically } from '../utils'

export function elementPlusDocsPlaygroundManifestsPath(generatedRoot: string): string {
  return resolve(generatedRoot, 'markdown', 'playground-manifests.json')
}

export async function synchronizeElementPlusDocsPlaygroundManifests(
  project: ElementPlusDocsProject,
  generatedRoot: string,
): Promise<string> {
  const packages: Record<string, ElementPlusDocsPlaygroundManifest> = {}
  for (const [packageId, profile] of Object.entries(project.packages)) {
    if (!profile.loadPlaygroundManifest)
      continue
    packages[packageId] = resolveElementPlusDocsPlaygroundManifest(
      profile.name,
      await profile.loadPlaygroundManifest(),
    )
  }
  const outputPath = elementPlusDocsPlaygroundManifestsPath(generatedRoot)
  writeJsonAtomically({ packages, schemaVersion: 1 }, outputPath)
  return outputPath
}

export function readElementPlusDocsPlaygroundManifests(
  project: ElementPlusDocsProject,
  path: string,
): Readonly<Record<string, ElementPlusDocsPlaygroundManifest>> {
  const snapshot: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!snapshot || typeof snapshot !== 'object' || (snapshot as { schemaVersion?: unknown }).schemaVersion !== 1)
    throw new TypeError('Element Plus docs playground manifest snapshot has an unsupported schema')
  const packages = (snapshot as { packages?: unknown }).packages
  if (!packages || typeof packages !== 'object' || Array.isArray(packages))
    throw new TypeError('Element Plus docs playground manifest snapshot requires packages')
  const resolved: Record<string, ElementPlusDocsPlaygroundManifest> = {}
  for (const [packageId, loaded] of Object.entries(packages)) {
    const profile = project.packages[packageId]
    if (!profile)
      throw new TypeError(`Playground manifest snapshot contains unknown package profile: ${packageId}`)
    resolved[packageId] = resolveElementPlusDocsPlaygroundManifest(profile.name, loaded)
  }
  for (const [packageId, profile] of Object.entries(project.packages)) {
    if (profile.loadPlaygroundManifest && !resolved[packageId])
      throw new TypeError(`Playground manifest snapshot is missing package profile: ${packageId}`)
  }
  return Object.freeze(resolved)
}
