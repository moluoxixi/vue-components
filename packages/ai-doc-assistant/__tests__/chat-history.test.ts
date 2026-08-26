import { describe, expect, it } from 'vitest'
import { MAX_HISTORY_CHARACTERS, MAX_HISTORY_MESSAGES } from '../src/shared/protocol'
import { buildChatHistory } from '../src/ui/chat-history'

describe('buildChatHistory', () => {
  it('只保留最新十个完整问答对', () => {
    const turns = Array.from({ length: 12 }, (_, index) => ({
      question: `q${index}`,
      answer: `a${index}`,
      status: 'done',
    }))

    const history = buildChatHistory(turns)

    expect(history).toHaveLength(MAX_HISTORY_MESSAGES)
    expect(history[0]).toEqual({ role: 'user', content: 'q2' })
    expect(history.at(-1)).toEqual({ role: 'assistant', content: 'a11' })
  })

  it('按完整问答对裁剪字符数，并排除未完成轮次', () => {
    const history = buildChatHistory([
      { question: 'old', answer: 'x'.repeat(10), status: 'done' },
      { question: 'latest', answer: 'y'.repeat(MAX_HISTORY_CHARACTERS - 'latest'.length), status: 'done' },
      { question: 'ignored', answer: 'partial', status: 'stopped' },
    ])

    expect(history).toEqual([
      { role: 'user', content: 'latest' },
      { role: 'assistant', content: 'y'.repeat(MAX_HISTORY_CHARACTERS - 'latest'.length) },
    ])
  })

  it('最新一对自身超限时不回退到更旧上下文', () => {
    expect(buildChatHistory([
      { question: 'old', answer: 'old answer', status: 'done' },
      { question: 'latest', answer: 'x'.repeat(MAX_HISTORY_CHARACTERS), status: 'done' },
    ])).toEqual([])
  })
})
