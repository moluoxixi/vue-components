import type { ChatHistoryMessage } from '../shared/protocol'
import { MAX_HISTORY_CHARACTERS, MAX_HISTORY_MESSAGES } from '../shared/protocol'

export interface HistoryTurn {
  question: string
  answer: string
  status: string
}

/**
 * 保留最新的完整问答对，同时满足服务端消息数与字符数边界。
 * 最新一对自身超限时返回空历史，避免跳过近期语境后混入更旧内容。
 */
export function buildChatHistory(turns: readonly HistoryTurn[]): ChatHistoryMessage[] {
  const completed = turns.filter(turn => turn.status === 'done' && turn.answer.trim().length > 0)
  const kept: Array<[ChatHistoryMessage, ChatHistoryMessage]> = []
  let messageCount = 0
  let characterCount = 0

  for (let index = completed.length - 1; index >= 0; index -= 1) {
    const turn = completed[index]
    const pairCharacters = turn.question.length + turn.answer.length
    if (messageCount + 2 > MAX_HISTORY_MESSAGES || characterCount + pairCharacters > MAX_HISTORY_CHARACTERS)
      break

    kept.push([
      { role: 'user', content: turn.question },
      { role: 'assistant', content: turn.answer },
    ])
    messageCount += 2
    characterCount += pairCharacters
  }

  return kept.reverse().flat()
}
