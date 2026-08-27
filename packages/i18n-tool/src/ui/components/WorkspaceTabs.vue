<script setup lang="ts">
import type { WorkbenchView } from '../state'
import { nextTick, ref } from 'vue'

const props = defineProps<{
  changesEnabled: boolean
  modelValue: WorkbenchView
}>()

const emit = defineEmits<{
  'update:modelValue': [view: WorkbenchView]
}>()

const tabs = ref<HTMLButtonElement[]>([])
const definitions: Array<{ label: string, view: WorkbenchView }> = [
  { label: 'Resources', view: 'resources' },
  { label: 'Translate', view: 'translate' },
  { label: 'Changes', view: 'changes' },
]

function enabledViews(): WorkbenchView[] {
  return definitions
    .filter(item => item.view !== 'changes' || props.changesEnabled)
    .map(item => item.view)
}

async function select(view: WorkbenchView): Promise<void> {
  if (view === 'changes' && !props.changesEnabled)
    return
  emit('update:modelValue', view)
  await nextTick()
  tabs.value.find(tab => tab.dataset.view === view)?.focus()
}

function handleKeydown(event: KeyboardEvent): void {
  const views = enabledViews()
  const current = Math.max(0, views.indexOf(props.modelValue))
  let next = current
  if (event.key === 'ArrowRight')
    next = (current + 1) % views.length
  else if (event.key === 'ArrowLeft')
    next = (current - 1 + views.length) % views.length
  else if (event.key === 'Home')
    next = 0
  else if (event.key === 'End')
    next = views.length - 1
  else
    return
  event.preventDefault()
  void select(views[next])
}
</script>

<template>
  <nav class="workspace-tabs" aria-label="Workbench views">
    <div role="tablist" aria-orientation="horizontal">
      <button
        v-for="definition in definitions"
        :id="`tab-${definition.view}`"
        :key="definition.view"
        :ref="(element) => { if (element) tabs[definitions.indexOf(definition)] = element as HTMLButtonElement }"
        type="button"
        role="tab"
        :data-view="definition.view"
        :aria-controls="`panel-${definition.view}`"
        :aria-disabled="definition.view === 'changes' && !changesEnabled ? 'true' : undefined"
        :aria-selected="modelValue === definition.view"
        :disabled="definition.view === 'changes' && !changesEnabled"
        :tabindex="modelValue === definition.view ? 0 : -1"
        @click="select(definition.view)"
        @keydown="handleKeydown"
      >
        {{ definition.label }}
      </button>
    </div>
  </nav>
</template>
