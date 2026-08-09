import type {
  ApiContractRow,
  ApiContractSection,
  ComponentApiContract,
} from '@moluoxixi/ai-doc-assistant/api-contract'

export type ElementPlusDocsApiSection = ApiContractSection

export type ElementPlusDocsApiRow = ApiContractRow

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

export interface ElementPlusDocsApiDocsMessages extends ElementPlusDocsApiMessages {
  empty: string
  permanentLink: string
}

export type ElementPlusDocsComponentApiContract = ComponentApiContract
