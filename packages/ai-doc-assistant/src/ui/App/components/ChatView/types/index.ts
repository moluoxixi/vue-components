import type { ExampleBlock, SourceRef } from '../../../../../shared/protocol'

export type ChatTurnStatus = 'streaming' | 'done' | 'stopped' | 'error'

export interface ChatTurn {
  id: string
  question: string
  answer: string
  sources: SourceRef[]
  exampleBlocks: ExampleBlock[]
  errorMsg: string
  status: ChatTurnStatus
}
