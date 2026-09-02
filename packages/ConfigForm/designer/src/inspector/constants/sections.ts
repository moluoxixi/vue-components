import type { InspectorSectionId } from '../types'

export const INSPECTOR_SECTION_IDS = [
  'properties',
  'validation',
  'events',
  'bindings',
  'conditions',
  'reactions',
] as const satisfies readonly InspectorSectionId[]
