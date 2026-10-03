export interface SourceWorkspaceEmits {
  'notice': [notice: { message: string, tone: 'success' | 'error' }]
  'update:mode': [mode: 'source' | 'config']
}
