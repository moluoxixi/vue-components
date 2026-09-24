import type { InspectorSectionId } from '../types'

export const INSPECTOR_SECTION_IDS = [
  'properties',
  'validation',
  'interactions',
] as const satisfies readonly InspectorSectionId[]
