export type ExportMode = 'source' | 'config'

export type ConfigViewMode = 'source' | 'json' | 'tree'

export type ConfigJsonScope = 'page' | 'project'

export type MobileFileView = 'tree' | 'code'

export interface ConfigTreeEntry {
  branch: boolean
  depth: number
  label: string
  path: string
  value: string
}
