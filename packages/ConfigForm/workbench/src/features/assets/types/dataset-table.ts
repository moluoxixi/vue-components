export type DatasetCellKind = 'text' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'missing'

export interface DatasetTableColumn {
  key: string
  kind: DatasetCellKind | 'mixed'
  width: number
}

export interface DatasetCellAddress {
  index: number
  key: string
}

export interface DatasetTableSort {
  key: string
  direction: 'ascending' | 'descending'
}
