<script setup lang="ts">
import type { InputInstance } from 'element-plus'
import type { StudioCommand } from '../types/studio-command'
import { Search, X } from '@lucide/vue'
import { computed, nextTick, ref, useId, watch } from 'vue'

const props = defineProps<{ open: boolean, commands: StudioCommand[], locale: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const query = ref('')
const activeId = ref<string>()
const input = ref<InputInstance>()
const results = ref<HTMLElement>()
const listId = `${useId()}-studio-commands`
const chinese = computed(() => props.locale === 'zh-CN')
const matches = computed(() => {
  const terms = query.value.trim().toLocaleLowerCase().split(/\s+/)
  return props.commands.filter(command =>
    terms.every(term =>
      `${command.label} ${command.group} ${command.detail ?? ''}`.toLocaleLowerCase().includes(term),
    ),
  )
})
const available = computed(() => matches.value.filter(command => !command.disabled))
const activeIndex = computed(() => matches.value.findIndex(command => command.id === activeId.value))
const activeOptionId = computed(() => activeIndex.value < 0 ? undefined : `${listId}-${activeIndex.value}`)

function focusSearch(): void {
  input.value?.focus()
}

function resetSearch(): void {
  query.value = ''
  focusSearch()
}

watch(matches, (commands) => {
  if (!commands.some(command => command.id === activeId.value && !command.disabled))
    activeId.value = commands.find(command => !command.disabled)?.id
}, { immediate: true })
watch(query, () => {
  activeId.value = available.value[0]?.id
  if (results.value)
    results.value.scrollTop = 0
})
watch(
  () => props.open,
  (open) => {
    if (open) {
      query.value = ''
      activeId.value = available.value[0]?.id
    }
  },
)
function run(command?: StudioCommand): void {
  if (!command || command.disabled)
    return
  emit('update:open', false)
  void nextTick(command.run)
}
function navigate(event: Event | KeyboardEvent): void {
  if (!(event instanceof KeyboardEvent))
    return
  if (event.isComposing) {
    if (event.key === 'Escape')
      event.stopPropagation()
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    run(matches.value[activeIndex.value])
  }
  else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const commands = available.value
    if (!commands.length)
      return
    const current = commands.findIndex(command => command.id === activeId.value)
    const next = current < 0
      ? event.key === 'ArrowDown' ? 0 : commands.length - 1
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + commands.length) % commands.length
    activeId.value = commands[next]?.id
    void nextTick(() => {
      if (activeOptionId.value)
        document.getElementById(activeOptionId.value)?.scrollIntoView({ block: 'nearest' })
    })
  }
}
</script>

<template>
  <ElDialog
    :model-value="open"
    class="studio-command-dialog"
    width="min(620px, calc(100vw - 24px))"
    :title="chinese ? '命令中心' : 'Command center'"
    append-to="#workbench-overlays"
    @update:model-value="emit('update:open', $event)"
    @opened="focusSearch"
  >
    <div class="studio-command-search">
      <Search :size="20" aria-hidden="true" />
      <ElInput
        ref="input"
        v-model="query"
        type="text"
        container-role="combobox"
        autocomplete="off"
        :aria-controls="listId"
        :aria-expanded="open"
        aria-autocomplete="list"
        :aria-activedescendant="activeOptionId"
        :aria-label="chinese ? '搜索命令、组件和页面' : 'Search commands, materials and surfaces'"
        :placeholder="chinese ? '搜索命令、组件和页面…' : 'Search commands, materials and surfaces…'"
        @keydown="navigate"
      />
      <button v-if="query" type="button" :aria-label="chinese ? '清除搜索' : 'Clear search'" @click="resetSearch">
        <X :size="16" aria-hidden="true" />
      </button>
      <button type="button" :aria-label="chinese ? '关闭命令中心' : 'Close command center'" @click="emit('update:open', false)">
        <kbd>Esc</kbd>
      </button>
    </div>
    <div
      :id="listId"
      ref="results"
      class="studio-command-results"
      role="listbox"
      :aria-label="chinese ? '匹配的命令' : 'Matching commands'"
    >
      <button
        v-for="(command, i) in matches"
        :id="`${listId}-${i}`"
        :key="command.id"
        type="button"
        role="option"
        tabindex="-1"
        :aria-selected="command.id === activeId"
        :aria-disabled="command.disabled || undefined"
        :class="{ 'is-active': command.id === activeId }"
        @mouseenter="!command.disabled && (activeId = command.id)"
        @mousedown.prevent
        @click="run(command)"
      >
        <span class="studio-command-copy">
          <small>{{ command.group }}</small><strong>{{ command.label }}</strong>
          <span v-if="command.detail" class="studio-command-detail">{{ command.detail }}</span>
          <span v-if="command.disabled && command.disabledReason" class="studio-command-reason">{{ command.disabledReason }}</span>
        </span>
        <kbd v-if="command.shortcut">{{ command.shortcut }}</kbd>
      </button>
    </div>
    <div v-if="!matches.length" class="studio-command-empty" role="status">
      <Search :size="24" aria-hidden="true" />
      <strong>{{ chinese ? '没有找到相关操作' : 'No matching commands' }}</strong>
      <p>{{ chinese ? '试试组件名称、页面名称或想执行的操作。' : 'Try a component, page name or action.' }}</p>
      <ElButton native-type="button" @click="resetSearch">
        {{ chinese ? '查看全部命令' : 'Show all commands' }}
      </ElButton>
    </div>
    <footer class="studio-command-footer">
      <span>↑ ↓ {{ chinese ? '选择' : 'Select' }} · ↵ {{ chinese ? '执行' : 'Run' }}</span>
      <span aria-live="polite">{{ matches.length }} {{ chinese ? '项' : 'results' }}</span>
    </footer>
  </ElDialog>
</template>
