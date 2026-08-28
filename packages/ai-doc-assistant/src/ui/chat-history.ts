import type { AiDocUIMessage } from '../shared/protocol'
import { MAX_HISTORY_CHARACTERS, MAX_HISTORY_MESSAGES } from '../shared/protocol'

function textOnly(message: AiDocUIMessage): AiDocUIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: [{
      type: 'text',
      text: message.parts
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join(''),
    }],
  }
}

/**
 * Select completed historical pairs and append the current user message.
 * Stopped/error assistants remain visible locally but never enter model history.
 */
export function buildChatRequestMessages(
  messages: readonly AiDocUIMessage[],
  completedAssistantIds: ReadonlySet<string>,
): AiDocUIMessage[] {
  const current = messages.at(-1)
  if (!current || current.role !== 'user')
    return []

  const completedPairs: Array<[AiDocUIMessage, AiDocUIMessage]> = []
  for (let index = 0; index < messages.length - 1; index += 2) {
    const user = messages[index]
    const assistant = messages[index + 1]
    if (user?.role === 'user' && assistant?.role === 'assistant' && completedAssistantIds.has(assistant.id))
      completedPairs.push([textOnly(user), textOnly(assistant)])
  }

  const kept: Array<[AiDocUIMessage, AiDocUIMessage]> = []
  let messageCount = 0
  let characterCount = 0
  for (let index = completedPairs.length - 1; index >= 0; index -= 1) {
    const pair = completedPairs[index]
    const pairCharacters = pair.flatMap(message => message.parts)
      .filter(part => part.type === 'text')
      .reduce((total, part) => total + part.text.length, 0)
    if (messageCount + 2 > MAX_HISTORY_MESSAGES || characterCount + pairCharacters > MAX_HISTORY_CHARACTERS)
      break
    kept.push(pair)
    messageCount += 2
    characterCount += pairCharacters
  }

  return [...kept.reverse().flat(), textOnly(current)]
}
