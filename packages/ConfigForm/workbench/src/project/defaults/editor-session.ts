import type { ProjectChangeSet } from '@moluoxixi/config-form-model'

export const EMPTY_PROJECT_CHANGE_SET: ProjectChangeSet = Object.freeze({
  nodeChanges: Object.freeze([]),
  nodeIds: Object.freeze([]),
  pageIds: Object.freeze([]),
  project: false,
})
