const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

export function safeProjectSlug(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const slug = normalized || 'config-form-project'
  return WINDOWS_RESERVED_NAME.test(slug) ? `project-${slug}` : slug
}
