import { MockLanguageModelV3 } from 'ai/test'

interface TranslationPromptEntry {
  id: string
  source: string
}

interface TranslationPrompt {
  entries: TranslationPromptEntry[]
  targetLocale: string
}

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
}

function requestFromPrompt(prompt: Parameters<MockLanguageModelV3['doGenerate']>[0]['prompt']): TranslationPrompt {
  const user = prompt.findLast(message => message.role === 'user')
  if (!user)
    throw new Error('Translation prompt is missing a user message.')
  const text = user.content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')
  return JSON.parse(text) as TranslationPrompt
}

export function createTranslationModel(
  translate: (entry: TranslationPromptEntry) => string = entry => entry.source,
): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async (options) => {
      const request = requestFromPrompt(options.prompt)
      return {
        content: [{
          text: JSON.stringify({
            targetLocale: request.targetLocale,
            translations: request.entries.map(entry => ({ id: entry.id, value: translate(entry) })),
          }),
          type: 'text' as const,
        }],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage: USAGE,
        warnings: [],
      }
    },
  })
}
