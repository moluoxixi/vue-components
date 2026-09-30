import type { DeepReadonly, ProjectDataset } from '@moluoxixi/config-form-model'

export interface AnalyzeDesignGraphOptions {
  datasets?: readonly DeepReadonly<ProjectDataset>[]
  includeDefaultDiagnostics?: boolean
  includeMaterialDiagnostics?: boolean
}
