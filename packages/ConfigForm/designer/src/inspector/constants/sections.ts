import type { InspectorSectionId } from '../types'

export const INSPECTOR_SECTION_IDS = [
  'properties',
  'validation',
] as const satisfies readonly InspectorSectionId[]
