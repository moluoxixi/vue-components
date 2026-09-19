const PROJECT_PREFIX = 'project-document:'
const PROJECT_RECOVERY_PREFIX = 'project-recovery-draft:'

function encoded(value: string): string {
  return encodeURIComponent(value)
}

export function projectStoragePrefix(id: string): string {
  return `${PROJECT_PREFIX}${encoded(id)}:`
}

export function projectRecoveryStoragePrefix(id: string): string {
  return `${PROJECT_RECOVERY_PREFIX}${encoded(id)}:`
}

export function projectManifestKey(id: string): string {
  return `${projectStoragePrefix(id)}manifest`
}

export function projectSurfaceKey(projectId: string, surfaceId: string, revision: number): string {
  return `${projectStoragePrefix(projectId)}surface:${encoded(surfaceId)}:${revision}`
}

export function projectDatasetKey(projectId: string, datasetId: string, revision: number): string {
  return `${projectStoragePrefix(projectId)}dataset:${encoded(datasetId)}:${revision}`
}

export function projectResourceKey(projectId: string, resourceId: string, revision: number): string {
  return `${projectStoragePrefix(projectId)}resource:${encoded(resourceId)}:${revision}`
}

export function projectResourceBytesKey(
  projectId: string,
  resourceId: string,
  contentHash: string,
): string {
  return `${projectStoragePrefix(projectId)}resource-bytes:${encoded(resourceId)}:${encoded(contentHash)}`
}

export function isProjectManifestStorageKey(key: string): boolean {
  return key.startsWith(PROJECT_PREFIX) && key.endsWith(':manifest')
}

export function projectIdFromManifestStorageKey(key: string): string {
  return decodeURIComponent(key.slice(PROJECT_PREFIX.length, -':manifest'.length))
}
