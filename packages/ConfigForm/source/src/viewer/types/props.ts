import type { SourceFileSetV1 } from '../../generator'

export interface ConfigFormSourceViewerProps {
  files: SourceFileSetV1 | undefined
  selectedPath: string
  theme?: 'dark' | 'light'
}
