import type { LanguageModel } from 'ai'
import type { createPreviewSessions } from '../services/preview-sessions'

export interface WorkspaceAssistantOptions {
  /** Use an official AI SDK provider model, including gateway or test models. */
  model?: Exclude<LanguageModel, string>
}

export type PreviewSessions = ReturnType<typeof createPreviewSessions>
