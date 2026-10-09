<script setup lang="ts">
import type { InputInstance } from 'element-plus'
import type { StudioCommand } from '../types/studio-command'
import { Search } from '@lucide/vue'
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{ open: boolean, commands: StudioCommand[], locale: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const query = ref('')
const index = ref(0)
const input = ref<InputInstance>()
const chinese = computed(() => props.locale === 'zh-CN')
const matches = computed(() => {
  const terms = query.value.trim().toLocaleLowerCase().split(/\s+/)
  return props.commands.filter(command =>
    terms.every(term =>
      `${command.label} ${command.group} ${command.detail ?? ''}`.toLocaleLowerCase().includes(term),
    ),
  )
})
function focusSearch(): void {
  const element = input.value?.input
  if (element) {
    element.setAttribute('role', 'combobox')
    element.setAttribute('aria-controls', 'studio-command-results')
    element.setAttribute('aria-expanded', 'true')
    element.setAttribute('aria-autocomplete', 'list')
    if (matches.value.length)
      element.setAttribute('aria-activedescendant', `studio-command-${index.value}`)
    element.focus()
  }
}
watch(query, () => {
  index.value = 0
})
watch([index, matches], () => {
  if (matches.value.length)
    input.value?.input?.setAttribute('aria-activedescendant', `studio-command-${index.value}`)
  else input.value?.input?.removeAttribute('aria-activedescendant')
})
watch(
  () => props.open,
  (open) => {
    if (open) {
      query.value = ''
      index.value = 0
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
  if (event.key === 'Enter') {
    event.preventDefault()
    run(matches.value[index.value])
  }
  else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    index.value
      = (index.value + (event.key === 'ArrowDown' ? 1 : -1) + matches.value.length) % Math.max(matches.value.length, 1)
    void nextTick(() => document.getElementById(`studio-command-${index.value}`)?.scrollIntoView({ block: 'nearest' }))
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
        role="combobox"
        aria-controls="studio-command-results"
        aria-expanded="true"
        aria-autocomplete="list"
        :aria-activedescendant="matches.length ? `studio-command-${index}` : undefined"
        :aria-label="chinese ? '搜索命令、组件和页面' : 'Search commands, materials and surfaces'"
        :placeholder="chinese ? '搜索命令、组件和页面…' : 'Search commands, materials and surfaces…'"
        @keydown="navigate"
      />
      <kbd>ESC</kbd>
    </div>
    <div
      id="studio-command-results"
      class="studio-command-results"
      role="listbox"
      :aria-label="chinese ? '匹配的命令' : 'Matching commands'"
    >
      <button
        v-for="(command, i) in matches"
        :id="`studio-command-${i}`"
        :key="command.id"
        type="button"
        role="option"
        :aria-selected="i === index"
        :aria-disabled="command.disabled || undefined"
        :class="{ 'is-active': i === index }"
        @mouseenter="index = i"
        @click="run(command)"
      >
        <span><small>{{ command.group }}</small><strong>{{ command.label }}</strong><span v-if="command.detail">{{ command.detail }}</span></span>
        <kbd v-if="command.shortcut">{{ command.shortcut }}</kbd>
      </button>
      <p v-if="!matches.length" role="status">
        {{ chinese ? '没有匹配的命令' : 'No matching commands' }}
      </p>
    </div>
    <footer class="studio-command-footer">
      <span>↑ ↓ {{ chinese ? '选择' : 'Select' }} · ↵ {{ chinese ? '执行' : 'Run' }}</span><span>{{ matches.length }} {{ chinese ? '项' : 'results' }}</span>
    </footer>
  </ElDialog>
</template>
