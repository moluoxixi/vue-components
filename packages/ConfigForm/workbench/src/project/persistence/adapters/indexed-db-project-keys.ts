const PROJECT_PREFIX = 'project-document:'

function encoded(value: string): string {
  return encodeURIComponent(value)
}

export function projectStoragePrefix(id: string): string {
  return `${PROJECT_PREFIX}${encoded(id)}:`
}

export function projectManifestKey(id: string): string {
  return `${projectStoragePrefix(id)}manifest`
}

export function projectPageKey(projectId: string, pageId: string, revision: number): string {
  return `${projectStoragePrefix(projectId)}page:${encoded(pageId)}:${revision}`
}

export function projectResourceKey(projectId: string, resourceId: string, revision: number): string {
  return `${projectStoragePrefix(projectId)}resource:${encoded(resourceId)}:${revision}`
}

export function isProjectManifestStorageKey(key: string): boolean {
  return key.startsWith(PROJECT_PREFIX) && key.endsWith(':manifest')
}

export function projectIdFromManifestStorageKey(key: string): string {
  return decodeURIComponent(key.slice(PROJECT_PREFIX.length, -':manifest'.length))
}
