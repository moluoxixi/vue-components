/** Reserved ProjectDocument.settings keys owned by ConfigForm Studio. */
export const PROJECT_IMAGE_RESOURCE_SETTING = 'projectImageResourceId' as const

export function readProjectImageResourceId(settings: Readonly<Record<string, unknown>>): string | undefined {
  const value = settings[PROJECT_IMAGE_RESOURCE_SETTING]
  return typeof value === 'string' && value.trim() ? value : undefined
}
