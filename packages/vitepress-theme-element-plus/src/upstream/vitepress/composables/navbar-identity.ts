export interface NavbarIdentity {
  logo: string
  siteTitle: string
}

export function resolveNavbarIdentity(
  logo: unknown,
  configuredSiteTitle: unknown,
  fallbackSiteTitle: unknown,
): NavbarIdentity {
  return {
    logo: typeof logo === 'string' ? logo.trim() : '',
    siteTitle: String(configuredSiteTitle || fallbackSiteTitle || ''),
  }
}
