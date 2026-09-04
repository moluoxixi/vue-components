import type { Ref } from 'vue'
import type { AiDocUIMessage, IndexState } from '../../../../../shared/protocol'
import type { ChatTurn, ChatTurnStatus } from '../types'
import { useChat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { API_PREFIX } from '../../../../../shared/protocol'
import { buildChatRequestMessages } from '../../../../chat-history'
import {
  exampleBlocksOf,
  fallbackExampleBlocksFor,
  jsForSource,
  reasonForSource,
  renderableForSource,
  segmentsFor,
  sourcesOf,
  textOf,
} from '../services'

interface TurnOutcome {
  status: Exclude<ChatTurnStatus, 'streaming'>
  errorMessage?: string
}

export interface UseChatWorkspaceOptions {
  chatBody: Readonly<Ref<HTMLElement | null>>
  indexReady: () => boolean
  indexState: () => IndexState
  question: Ref<string>
  questionInput: Readonly<Ref<HTMLInputElement | null>>
}

const AUTO_FOLLOW_THRESHOLD = 96

function isNearLatest(body: HTMLElement): boolean {
  return body.scrollHeight - body.scrollTop - body.clientHeight <= AUTO_FOLLOW_THRESHOLD
}

export function useChatWorkspace(options: UseChatWorkspaceOptions) {
  const autoFollow = ref(true)
  const completedAssistantIds = new Set<string>()
  const outcomes = reactive<Record<string, TurnOutcome>>({})
  let activeUserId: string | null = null
  let userMessageSequence = 0

  const transport = new DefaultChatTransport<AiDocUIMessage>({
    api: `${API_PREFIX}/query`,
    prepareSendMessagesRequest: ({ messages }) => ({
      body: {
        messages: buildChatRequestMessages(messages, completedAssistantIds),
        topK: 5,
      },
    }),
  })

  const {
    clearError,
    error,
    messages,
    sendMessage,
    status,
    stop,
  } = useChat<AiDocUIMessage>({
    transport,
    onError: (requestError) => {
      if (activeUserId) {
        outcomes[activeUserId] = {
          status: 'error',
          errorMessage: requestError.message || 'AI provider request failed',
        }
      }
    },
    onFinish: ({ message, messages: finishedMessages, isAbort, isError }) => {
      const assistantIndex = finishedMessages.findIndex(item => item.id === message.id)
      const user = assistantIndex > 0 && finishedMessages[assistantIndex - 1]?.role === 'user'
        ? finishedMessages[assistantIndex - 1]
        : undefined
      const userId = user?.id ?? activeUserId
      if (!isAbort && !isError) {
        completedAssistantIds.add(message.id)
        if (userId)
          outcomes[userId] = { status: 'done' }
      }
      else if (userId) {
        outcomes[userId] = {
          status: isAbort ? 'stopped' : 'error',
          errorMessage: isError ? (error.value?.message ?? 'AI provider request failed') : undefined,
        }
      }
      activeUserId = null
    },
  })

  const streaming = computed(() => status.value === 'submitted' || status.value === 'streaming')
  const canAsk = computed(() =>
    options.question.value.trim().length > 0 && !streaming.value && options.indexReady(),
  )
  const indexHint = computed(() => {
    if (options.indexState() === 'building')
      return '知识库正在准备，完成后即可提问。'
    return '知识库尚未就绪，请先构建知识库。'
  })

  const turns = computed<ChatTurn[]>(() => {
    const result: ChatTurn[] = []
    for (let index = 0; index < messages.value.length; index += 1) {
      const user = messages.value[index]
      if (user.role !== 'user')
        continue
      const assistant = messages.value[index + 1]?.role === 'assistant'
        ? messages.value[index + 1]
        : undefined
      const isLast = index >= messages.value.length - 2
      const outcome = outcomes[user.id]
      const turnStatus: ChatTurnStatus = outcome?.status
        ?? (isLast && streaming.value
          ? 'streaming'
          : assistant && completedAssistantIds.has(assistant.id)
            ? 'done'
            : isLast && status.value === 'error'
              ? 'error'
              : 'done')
      result.push({
        id: user.id,
        question: textOf(user),
        answer: assistant ? textOf(assistant) : '',
        sources: assistant ? sourcesOf(assistant) : [],
        exampleBlocks: assistant ? exampleBlocksOf(assistant) : [],
        errorMsg: turnStatus === 'error'
          ? (outcome?.errorMessage ?? (isLast ? error.value?.message : undefined) ?? 'AI provider request failed')
          : '',
        status: turnStatus,
      })
    }
    return result
  })

  function focusQuestion(): void {
    options.questionInput.value?.focus()
  }

  function onChatScroll(): void {
    const body = options.chatBody.value
    if (body)
      autoFollow.value = isNearLatest(body)
  }

  async function scrollToLatest(force = false): Promise<void> {
    if (!force && !autoFollow.value)
      return
    await nextTick()
    const body = options.chatBody.value
    if (body) {
      body.scrollTop = body.scrollHeight
      autoFollow.value = true
    }
  }

  function stopGeneration(): void {
    const lastUser = [...messages.value].reverse().find(message => message.role === 'user')
    if (lastUser) {
      outcomes[lastUser.id] = { status: 'stopped' }
      activeUserId = lastUser.id
    }
    void stop()
    void nextTick(focusQuestion)
  }

  function clearConversation(): void {
    void stop()
    messages.value = []
    completedAssistantIds.clear()
    activeUserId = null
    for (const key of Object.keys(outcomes))
      delete outcomes[key]
    clearError()
    options.question.value = ''
    autoFollow.value = true
    void nextTick(focusQuestion)
  }

  async function onAsk(): Promise<void> {
    if (!canAsk.value)
      return

    const askedQuestion = options.question.value.trim()
    options.question.value = ''
    clearError()
    void scrollToLatest(true)
    const userId = `user-${Date.now()}-${++userMessageSequence}`
    activeUserId = userId
    delete outcomes[userId]
    await sendMessage({
      id: userId,
      role: 'user',
      parts: [{ type: 'text', text: askedQuestion }],
    })
  }

  onUnmounted(() => {
    void stop()
  })

  watch([messages, status], () => {
    void scrollToLatest()
  })

  return {
    autoFollow,
    canAsk,
    clearConversation,
    fallbackExampleBlocksFor,
    focusQuestion,
    indexHint,
    jsForSource,
    onAsk,
    onChatScroll,
    reasonForSource,
    renderableForSource,
    scrollToLatest,
    segmentsFor,
    stopGeneration,
    streaming,
    turns,
  }
}
