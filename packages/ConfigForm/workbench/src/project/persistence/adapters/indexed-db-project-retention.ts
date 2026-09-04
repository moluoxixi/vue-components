import type { ProjectVersionRetentionPolicy } from '@moluoxixi/config-form-model'
import type { StoredProjectManifest, StoredProjectVersion } from '../types'

export function validateRetentionPolicy(
  policy: ProjectVersionRetentionPolicy,
  fallbackNow: string,
): { keepDailyForDays: number, keepLatestAutosaves: number, now: number } {
  const keepDailyForDays = policy.keepDailyForDays ?? 30
  const keepLatestAutosaves = policy.keepLatestAutosaves ?? 50
  const now = Date.parse(policy.now ?? fallbackNow)
  if (!Number.isInteger(keepDailyForDays) || keepDailyForDays < 0
    || !Number.isInteger(keepLatestAutosaves) || keepLatestAutosaves < 0) {
    throw new RangeError('Project version retention limits must be non-negative integers.')
  }
  if (!Number.isFinite(now))
    throw new RangeError('Project version retention time must be a valid ISO date string.')
  return { keepDailyForDays, keepLatestAutosaves, now }
}

export function retainedVersions(
  manifest: StoredProjectManifest,
  policy: ReturnType<typeof validateRetentionPolicy>,
): StoredProjectVersion[] {
  const keep = new Set<number>([manifest.snapshot.project.repositoryRevision])
  manifest.receipts.forEach(receipt => keep.add(receipt.snapshot.project.repositoryRevision))
  manifest.versions.forEach((version) => {
    if (version.label)
      keep.add(version.repositoryRevision)
    if (version.restoredFromRevision !== undefined)
      keep.add(version.restoredFromRevision)
  })
  const ordinary = manifest.versions
    .filter(version => !version.label)
    .sort((left, right) => right.repositoryRevision - left.repositoryRevision)
  ordinary.slice(0, policy.keepLatestAutosaves)
    .forEach(version => keep.add(version.repositoryRevision))
  const daily = new Set<string>()
  ordinary.forEach((version) => {
    const timestamp = Date.parse(version.createdAt)
    if (!Number.isFinite(timestamp)
      || policy.now - timestamp > policy.keepDailyForDays * 86_400_000) {
      return
    }
    const day = version.createdAt.slice(0, 10)
    if (!daily.has(day)) {
      daily.add(day)
      keep.add(version.repositoryRevision)
    }
  })
  return manifest.versions.filter(version => keep.has(version.repositoryRevision))
}
