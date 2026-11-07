import type { ProjectDocument } from '@moluoxixi/config-form-model'

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant' | 'update'
  text: string
}

/** Browser-safe session state. Provider secrets and SDK messages stay on the server. */
export interface LivePreviewSession {
  id: string
  document: ProjectDocument
  surfaceId: string
  revision: number
  savedRevision?: number
  dirty: boolean
  busy: boolean
  canUndo: boolean
  messages: AssistantMessage[]
}

export interface AssistantStatus {
  configured: boolean
  provider?: string
  model?: string
}
