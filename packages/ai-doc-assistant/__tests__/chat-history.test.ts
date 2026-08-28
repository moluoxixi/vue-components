import type { AiDocUIMessage } from '../src/shared/protocol'
import { describe, expect, it } from 'vitest'
import { MAX_HISTORY_CHARACTERS, MAX_HISTORY_MESSAGES } from '../src/shared/protocol'
import { buildChatRequestMessages } from '../src/ui/chat-history'

function message(id: string, role: 'user' | 'assistant', text: string): AiDocUIMessage {
  return { id, role, parts: [{ type: 'text', text }] }
}

describe('buildChatRequestMessages', () => {
  it('keeps the newest ten completed pairs and appends the current user', () => {
    const messages: AiDocUIMessage[] = []
    const completed = new Set<string>()
    for (let index = 0; index < 12; index += 1) {
      messages.push(message(`u${index}`, 'user', `q${index}`))
      messages.push(message(`a${index}`, 'assistant', `a${index}`))
      completed.add(`a${index}`)
    }
    messages.push(message('current', 'user', 'current question'))

    const request = buildChatRequestMessages(messages, completed)

    expect(request).toHaveLength(MAX_HISTORY_MESSAGES + 1)
    expect(request[0]).toEqual(message('u2', 'user', 'q2'))
    expect(request.at(-2)).toEqual(message('a11', 'assistant', 'a11'))
    expect(request.at(-1)).toEqual(message('current', 'user', 'current question'))
  })

  it('excludes stopped/error assistants and strips data parts from completed history', () => {
    const completed = new Set(['a1'])
    const withData: AiDocUIMessage = {
      id: 'a1',
      role: 'assistant',
      parts: [
        { type: 'data-sources', data: [] },
        { type: 'text', text: 'answer' },
      ],
    }
    const request = buildChatRequestMessages([
      message('u1', 'user', 'kept'),
      withData,
      message('u2', 'user', 'stopped'),
      message('a2', 'assistant', 'partial'),
      message('current', 'user', 'next'),
    ], completed)

    expect(request).toEqual([
      message('u1', 'user', 'kept'),
      message('a1', 'assistant', 'answer'),
      message('current', 'user', 'next'),
    ])
  })

  it('cuts only complete pairs at the character boundary', () => {
    const completed = new Set(['a-old', 'a-latest'])
    const request = buildChatRequestMessages([
      message('u-old', 'user', 'old'),
      message('a-old', 'assistant', 'x'.repeat(10)),
      message('u-latest', 'user', 'latest'),
      message('a-latest', 'assistant', 'y'.repeat(MAX_HISTORY_CHARACTERS - 'latest'.length)),
      message('current', 'user', 'next'),
    ], completed)

    expect(request).toEqual([
      message('u-latest', 'user', 'latest'),
      message('a-latest', 'assistant', 'y'.repeat(MAX_HISTORY_CHARACTERS - 'latest'.length)),
      message('current', 'user', 'next'),
    ])
  })

  it('does not fall back to older context when the newest completed pair is oversized', () => {
    const request = buildChatRequestMessages([
      message('u-old', 'user', 'old'),
      message('a-old', 'assistant', 'old answer'),
      message('u-latest', 'user', 'latest'),
      message('a-latest', 'assistant', 'x'.repeat(MAX_HISTORY_CHARACTERS)),
      message('current', 'user', 'next'),
    ], new Set(['a-old', 'a-latest']))

    expect(request).toEqual([message('current', 'user', 'next')])
  })
})
