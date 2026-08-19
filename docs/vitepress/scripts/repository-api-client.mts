export function resolveTrustedApiUrl(
  apiBaseUrl: string,
  pathOrUrl: string,
  providerName: string,
): string {
  const normalizedBase = apiBaseUrl.replace(/\/+$/, '')
  const base = new URL(`${normalizedBase}/`)
  const candidate = /^https?:\/\//.test(pathOrUrl)
    ? new URL(pathOrUrl)
    : new URL(`${normalizedBase}${pathOrUrl}`)
  const basePath = base.pathname.replace(/\/+$/, '')
  const insideApiPath = candidate.pathname === basePath || candidate.pathname.startsWith(`${basePath}/`)
  if (candidate.origin !== base.origin || !insideApiPath)
    throw new TypeError(`${providerName} pagination URL escaped the configured API base`)
  return candidate.toString()
}
