import type { SourceFileSetV1 } from '../../generator'

export interface SourceViewerLabels {
  files: string
  code: string
  openFiles: string
  closeFile: string
}

export interface ConfigFormSourceViewerProps {
  files: SourceFileSetV1 | undefined
  selectedPath: string
  theme?: 'dark' | 'light'
  wrapLines?: boolean
  labels?: Partial<SourceViewerLabels>
}
