import type { ProjectChangeSet } from '@moluoxixi/config-form-model'

export const EMPTY_PROJECT_CHANGE_SET: ProjectChangeSet = Object.freeze({
  datasetIds: Object.freeze([]),
  nodeChanges: Object.freeze([]),
  resourceIds: Object.freeze([]),
  surfaceIds: Object.freeze([]),
  project: false,
})
