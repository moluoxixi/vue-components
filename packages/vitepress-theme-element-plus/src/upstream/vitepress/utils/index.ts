export * from './colors'
export function isExternal(path: string): boolean {
  return /^(?:https?:|mailto:|tel:)/.test(path)
}

export function isActive(currentPath: string, targetPath: string, exact = false): boolean {
  return exact ? currentPath === targetPath : currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
}

export function ensureStartingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

const endingSlashRE = /\/$/
export function utoa(data: string): string {
  return btoa(unescape(encodeURIComponent(data)))
}

export function throttleAndDebounce(fn: () => any, delay: number) {
  let timeout: ReturnType<typeof setTimeout>
  let called = false
  return () => {
    if (timeout) {
      clearTimeout(timeout)
    }
    if (!called) {
      fn()
      called = true
      setTimeout(() => {
        called = false
      }, delay)
    }
    else {
      timeout = setTimeout(fn, delay)
    }
  }
}

export function createGitHubUrl(
  docsRepo: string,
  docsDir: string,
  docsBranch: string,
  path: string,
  folder = 'examples/',
  ext = '.vue',
) {
  const base = isExternal(docsRepo)
    ? docsRepo
    : `https://github.com/${docsRepo}`
  return `${base.replace(endingSlashRE, '')}/edit/${docsBranch}/${
    docsDir ? `${docsDir.replace(endingSlashRE, '')}/` : ''
  }${folder || ''}${path}${ext || ''}`
}
