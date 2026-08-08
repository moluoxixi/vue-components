export type ElementPlusDocsApiSection = 'props' | 'emits' | 'expose' | 'slots'

export interface ElementPlusDocsApiRow {
  name: string
  type: string
  typeDetail?: string
  required?: boolean
  default?: string
  description: string
}

export interface ElementPlusDocsApiMessages {
  defaultValue: string
  description: string
  name: string
  parameters: string
  required: string
  scope: string
  sections: Record<ElementPlusDocsApiSection, string>
  tableAria: string
  type: string
  typeDetails: string
  yes: string
}
