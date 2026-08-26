<script setup lang="ts">
import type { ExampleBlock, IndexState, SourceRef } from '../../shared/protocol'
import { ArrowDown, MessageSquarePlus, Square } from '@lucide/vue'
import { ElTooltip } from 'element-plus'
import { computed, defineAsyncComponent, nextTick, onUnmounted, reactive, ref, shallowRef, useTemplateRef } from 'vue'
import { splitAnswerSegments } from '../../core'
import { streamQuery } from '../api'
import { buildChatHistory } from '../chat-history'
import MarkdownContent from '../components/MarkdownContent.vue'

const DemoPreview = defineAsyncComponent(() =>
  import('../components/DemoPreview.vue').then(module => module.default),
)

type TurnStatus = 'streaming' | 'done' | 'stopped' | 'error'

interface ChatTurn {
  id: number
  question: string
  answer: string
  sources: SourceRef[]
  exampleBlocks: ExampleBlock[]
  errorMsg: string
  status: TurnStatus
}

const question = defineModel<string>('question', { required: true })
const props = defineProps<{ indexReady: boolean, indexState: IndexState }>()
const emit = defineEmits<{
  'open-source': [name: string]
}>()

const questionInput = useTemplateRef<HTMLInputElement>('questionInput')
const chatBody = useTemplateRef<HTMLElement>('chatBody')
const turns = ref<ChatTurn[]>([])
const activeController = shallowRef<AbortController | null>(null)
const activeTurnId = ref<number | null>(null)
const autoFollow = ref(true)
let nextTurnId = 1

const AUTO_FOLLOW_THRESHOLD = 96

const streaming = computed(() => activeController.value !== null)
const canAsk = computed(() =>
  question.value.trim().length > 0 && !streaming.value && props.indexReady,
)

const indexHint = computed(() => {
  if (props.indexState === 'building')
    return '知识库正在准备，完成后即可提问。'
  return '知识库尚未就绪，请先构建知识库。'
})

function focusQuestion(): void {
  questionInput.value?.focus()
}

defineExpose({ focusQuestion })

function normalizeSource(source: string): string {
  return source.trim()
}

function blockForSource(turn: ChatTurn, source: string): ExampleBlock | undefined {
  const normalized = normalizeSource(source)
  return turn.exampleBlocks.find(block => normalizeSource(block.ts) === normalized)
}

function jsForSource(turn: ChatTurn, source: string): string | undefined {
  return blockForSource(turn, source)?.js
}

function renderableForSource(turn: ChatTurn, source: string, fallback: boolean): boolean {
  return blockForSource(turn, source)?.renderable ?? fallback
}

function reasonForSource(turn: ChatTurn, source: string, fallback?: string): string | undefined {
  return blockForSource(turn, source)?.reason ?? fallback
}

function segmentsFor(turn: ChatTurn): ReturnType<typeof splitAnswerSegments> {
  return splitAnswerSegments(turn.answer)
}

function fallbackExampleBlocksFor(turn: ChatTurn): ExampleBlock[] {
  const inlineSources = new Set(
    segmentsFor(turn)
      .filter(segment => segment.kind === 'vue')
      .map(segment => normalizeSource(segment.source)),
  )
  return turn.exampleBlocks.filter(block => !inlineSources.has(normalizeSource(block.ts)))
}

function historyForRequest() {
  return buildChatHistory(turns.value)
}

function isNearLatest(body: HTMLElement): boolean {
  return body.scrollHeight - body.scrollTop - body.clientHeight <= AUTO_FOLLOW_THRESHOLD
}

function onChatScroll(): void {
  const body = chatBody.value
  if (body)
    autoFollow.value = isNearLatest(body)
}

async function scrollToLatest(force = false): Promise<void> {
  if (!force && !autoFollow.value)
    return
  await nextTick()
  const body = chatBody.value
  if (body) {
    body.scrollTop = body.scrollHeight
    autoFollow.value = true
  }
}

function openSource(source: SourceRef): void {
  emit('open-source', source.knowledgeKey ?? source.component)
}

function stopGeneration(): void {
  const controller = activeController.value
  const turnId = activeTurnId.value
  if (!controller || turnId === null)
    return

  const turn = turns.value.find(item => item.id === turnId)
  if (turn?.status === 'streaming')
    turn.status = 'stopped'

  activeController.value = null
  activeTurnId.value = null
  controller.abort()
  void nextTick(focusQuestion)
}

function clearConversation(): void {
  const controller = activeController.value
  activeController.value = null
  activeTurnId.value = null
  controller?.abort()
  turns.value = []
  question.value = ''
  autoFollow.value = true
  void nextTick(focusQuestion)
}

async function onAsk(): Promise<void> {
  if (!canAsk.value)
    return

  const askedQuestion = question.value.trim()
  const history = historyForRequest()
  const turn = reactive<ChatTurn>({
    id: nextTurnId++,
    question: askedQuestion,
    answer: '',
    sources: [],
    exampleBlocks: [],
    errorMsg: '',
    status: 'streaming',
  })
  const controller = new AbortController()

  turns.value.push(turn)
  question.value = ''
  activeController.value = controller
  activeTurnId.value = turn.id
  void scrollToLatest(true)

  try {
    await streamQuery(askedQuestion, 5, history, (event) => {
      if (activeController.value !== controller || activeTurnId.value !== turn.id || controller.signal.aborted)
        return

      switch (event.type) {
        case 'sources':
          turn.sources = event.sources
          break
        case 'token':
          turn.answer += event.text
          break
        case 'example':
          turn.exampleBlocks = event.blocks
          break
        case 'error':
          turn.errorMsg = `${event.error}: ${event.message}`
          turn.status = 'error'
          break
        case 'done':
          turn.status = 'done'
          break
      }
      void scrollToLatest()
    }, controller.signal)

  }
  catch (error) {
    if (!controller.signal.aborted) {
      turn.errorMsg = error instanceof Error ? error.message : String(error)
      turn.status = 'error'
    }
  }
  finally {
    if (activeController.value === controller && activeTurnId.value === turn.id) {
      activeController.value = null
      activeTurnId.value = null
    }
  }
}

onUnmounted(() => {
  const turn = turns.value.find(item => item.id === activeTurnId.value)
  if (turn?.status === 'streaming')
    turn.status = 'stopped'
  activeController.value?.abort()
  activeController.value = null
  activeTurnId.value = null
})
</script>

<template>
  <div class="chat" data-testid="chat-view">
    <div ref="chatBody" class="chat-body" @scroll.passive="onChatScroll">
      <div class="conversation">
        <div v-if="turns.length" class="conversation-tools">
          <ElTooltip content="新对话" placement="bottom">
            <button
              class="icon-button"
              type="button"
              aria-label="清空当前对话"
              data-testid="clear-chat"
              @click="clearConversation"
            >
              <MessageSquarePlus :size="17" />
            </button>
          </ElTooltip>
        </div>
        <div v-if="turns.length === 0" class="empty-answer" data-testid="answer">
          <span class="empty-mark">AI</span>
          <strong>开始一段组件问答</strong>
          <p>输入组件名、使用场景或 API 问题。</p>
        </div>

        <article v-for="turn in turns" :key="turn.id" class="chat-turn" data-testid="chat-turn">
          <section class="user-message">
            <span class="message-role">你</span>
            <p>{{ turn.question }}</p>
          </section>

          <section class="assistant-message" data-testid="answer">
            <div class="assistant-heading">
              <span class="assistant-avatar">AI</span>
              <span>文档助手</span>
              <span v-if="turn.status === 'streaming'" class="turn-status" role="status" aria-live="polite">生成中</span>
              <span v-else-if="turn.status === 'stopped'" class="turn-status" role="status">已停止</span>
              <span v-else-if="turn.status === 'done'" class="visually-hidden" role="status" aria-live="polite">回答已完成</span>
            </div>

            <div v-if="turn.errorMsg" class="hint error" role="alert" data-testid="chat-error">
              {{ turn.errorMsg }}
            </div>

            <div v-if="turn.sources.length" class="sources" data-testid="sources">
              <button
                v-for="source in turn.sources"
                :key="source.knowledgeKey ?? `${source.packageName}:${source.component}`"
                type="button"
                class="source-button"
                data-testid="source-button"
                :title="`打开 ${source.component} 组件详情：${source.docPath}`"
                @click="openSource(source)"
              >
                <strong>{{ source.component }}</strong>
                <span class="source-summary">{{ source.packageName }} · {{ source.score.toFixed(3) }}</span>
                <small class="source-path">{{ source.docPath }}</small>
                <small v-if="source.source" class="source-kind">{{ source.source === 'external' ? '外部' : '项目' }}</small>
              </button>
            </div>

            <div class="answer-content">
              <template v-if="segmentsFor(turn).length || fallbackExampleBlocksFor(turn).length">
                <template v-for="(segment, index) in segmentsFor(turn)" :key="index">
                  <MarkdownContent v-if="segment.kind === 'text'" class="answer-text" :source="segment.text" />
                  <DemoPreview
                    v-else
                    :ts="segment.source"
                    :js="jsForSource(turn, segment.source)"
                    :renderable="renderableForSource(turn, segment.source, segment.renderable)"
                    :reason="reasonForSource(turn, segment.source, segment.reason)"
                  />
                </template>
                <DemoPreview
                  v-for="(block, index) in fallbackExampleBlocksFor(turn)"
                  :key="`fallback-${index}`"
                  :ts="block.ts"
                  :js="block.js"
                  :renderable="block.renderable"
                  :reason="block.reason"
                />
              </template>
              <p v-else-if="turn.status === 'streaming'" class="answer-text pending">
                <span /><span /><span />
              </p>
            </div>
          </section>
        </article>
      </div>
    </div>

    <button
      v-if="turns.length && !autoFollow"
      class="jump-latest"
      type="button"
      data-testid="jump-latest"
      @click="scrollToLatest(true)"
    >
      <ArrowDown :size="15" />
      回到最新
    </button>

    <form class="ask-panel" data-testid="ask-panel" @submit.prevent="onAsk">
      <div v-if="!indexReady" class="hint" data-testid="chat-need-index">
        {{ indexHint }}
      </div>
      <div class="ask-row">
        <input
          ref="questionInput"
          v-model="question"
          type="text"
          aria-label="向 AI 提问"
          data-testid="question-input"
          placeholder="问点什么，比如：RequestSelectV2 怎么用？"
          @keydown.ctrl.enter.prevent="onAsk"
          @keydown.meta.enter.prevent="onAsk"
        >
        <button
          v-if="streaming"
          class="btn stop"
          type="button"
          data-testid="stop-btn"
          @click="stopGeneration"
        >
          <Square :size="14" fill="currentColor" />
          停止
        </button>
        <button
          v-else
          class="btn primary"
          type="submit"
          data-testid="ask-btn"
          :disabled="!canAsk"
        >
          提问
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.chat {
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #f5f7fa;
}
.chat-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 28px 24px 20px;
}
.conversation,
.ask-panel > * {
  width: min(100%, 960px);
  margin-right: auto;
  margin-left: auto;
}
.conversation-tools {
  display: flex;
  justify-content: flex-end;
  min-height: 32px;
  margin-bottom: 8px;
}
.icon-button {
  display: inline-grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  color: #59636e;
  cursor: pointer;
}
.icon-button:hover,
.icon-button:focus-visible { border-color: #409eff; color: #0969da; outline: none; }
.empty-answer {
  display: grid;
  min-height: 260px;
  place-content: center;
  justify-items: center;
  color: #606266;
  text-align: center;
}
.empty-answer strong { margin-top: 14px; color: #303133; font-size: 17px; }
.empty-answer p { margin: 7px 0 0; color: #909399; font-size: 13px; }
.empty-mark,
.assistant-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #409eff;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
.empty-mark { width: 38px; height: 38px; }
.chat-turn + .chat-turn { margin-top: 28px; }
.user-message {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 10px;
}
.user-message p {
  max-width: min(78%, 700px);
  margin: 0;
  padding: 10px 13px;
  border: 1px solid #b3d8ff;
  border-radius: 8px 2px 8px 8px;
  background: #ecf5ff;
  color: #303133;
  font-size: 14px;
  line-height: 1.55;
}
.message-role {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  order: 2;
  border: 1px solid #dcdfe6;
  border-radius: 50%;
  background: #fff;
  color: #606266;
  font-size: 12px;
}
.assistant-message {
  margin-top: 16px;
  padding: 18px 20px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fff;
}
.assistant-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  color: #606266;
  font-size: 12px;
  font-weight: 600;
}
.assistant-avatar { width: 26px; height: 26px; }
.turn-status { margin-left: auto; color: #909399; font-weight: 400; }
.sources {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 14px;
}
.source-button {
  position: relative;
  display: grid;
  min-width: 0;
  max-width: min(100%, 360px);
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 3px 8px;
  padding: 8px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #f5f7fa;
  color: #606266;
  cursor: pointer;
  font-size: 12px;
}
.source-button:hover,
.source-button:focus-visible { border-color: #409eff; color: #409eff; outline: none; }
.source-button strong { color: inherit; font-weight: 600; }
.source-summary { overflow: hidden; color: #7a828c; text-overflow: ellipsis; white-space: nowrap; }
.source-path {
  overflow: hidden;
  grid-column: 1 / 3;
  color: #8b949e;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source-kind {
  grid-column: 3;
  grid-row: 1 / 3;
  padding: 2px 5px;
  border: 1px solid #d8dee6;
  border-radius: 4px;
  color: #59636e;
}
.answer-content { color: #303133; }
.answer-text { margin: 0 0 12px; white-space: pre-wrap; font-size: 14px; line-height: 1.7; }
.answer-text:last-child { margin-bottom: 0; }
.pending { display: flex; gap: 4px; padding: 8px 0; }
.pending span { width: 5px; height: 5px; border-radius: 50%; background: #a8abb2; animation: pending 1.1s infinite ease-in-out; }
.pending span:nth-child(2) { animation-delay: .12s; }
.pending span:nth-child(3) { animation-delay: .24s; }
@keyframes pending { 0%, 60%, 100% { opacity: .35; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
.ask-panel {
  flex: 0 0 auto;
  padding: 14px 24px 18px;
  border-top: 1px solid #e4e7ed;
  background: #fff;
}
.ask-row { display: flex; gap: 8px; }
.ask-row input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  color: #303133;
  font-size: 14px;
}
.ask-row input:focus { border-color: #409eff; outline: 2px solid rgba(64, 158, 255, .14); }
.btn {
  min-width: 68px;
  padding: 8px 14px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  color: #606266;
  cursor: pointer;
  font-size: 13px;
}
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn.primary { border-color: #409eff; background: #409eff; color: #fff; }
.btn.primary:hover { border-color: #79bbff; background: #79bbff; }
.btn.stop { border-color: #f56c6c; color: #f56c6c; }
.btn.stop:hover { background: #fef0f0; }
.hint { margin-bottom: 12px; color: #606266; font-size: 13px; }
.hint.error { color: #f56c6c; }
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}
.jump-latest {
  position: absolute;
  right: 24px;
  bottom: 84px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid #b8c2ce;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(31, 35, 40, .12);
  color: #30363d;
  cursor: pointer;
  font-size: 12px;
}
.jump-latest:hover,
.jump-latest:focus-visible { border-color: #409eff; color: #0969da; outline: none; }

@media (max-width: 640px) {
  .chat-body { padding: 18px 12px 16px; }
  .ask-panel { padding: 12px; }
  .assistant-message { padding: 14px; }
  .user-message p { max-width: calc(100% - 42px); }
  .source-button { max-width: 100%; }
  .jump-latest { right: 12px; bottom: 76px; }
}
</style>
