<script setup lang="ts">
import type { PreviewInstanceStateMap } from '../../../../session/types/preview'
import { computed, ref, watch } from 'vue'

const props = defineProps<{ states: PreviewInstanceStateMap, locale: string }>()
const selected = ref('')
const chinese = computed(() => props.locale === 'zh-CN')
const entries = computed(() => Object.entries(props.states))
watch(
  entries,
  (value) => {
    if (!value.some(([id]) => id === selected.value))
      selected.value = value[0]?.[0] ?? ''
  },
  { immediate: true },
)
const state = computed(() => props.states[selected.value])
const errorCount = computed(() =>
  Object.values(state.value?.validation ?? {}).reduce((count, messages) => count + messages.length, 0),
)
</script>

<template>
  <aside class="experience-inspector" :aria-label="chinese ? '体验状态' : 'Experience state'">
    <header>
      <h3>{{ chinese ? '体验状态' : 'Experience state' }}</h3>
      <small>LIVE</small>
    </header>
    <label><span>{{ chinese ? '页面实例' : 'Surface instance' }}</span><ElSelect
      v-model="selected"
      :aria-label="chinese ? '页面实例' : 'Surface instance'"
      append-to="#workbench-overlays"
    ><ElOption
      v-for="[id, entry] in entries"
      :key="id"
      :value="id"
      :label="`${entry.surfaceId} · ${id}`"
    /></ElSelect></label>
    <template v-if="state">
      <dl>
        <div>
          <dt>{{ chinese ? '字段' : 'Fields' }}</dt>
          <dd>{{ state.fields.length }}</dd>
        </div>
        <div>
          <dt>{{ chinese ? '已触达' : 'Touched' }}</dt>
          <dd>{{ state.touched.length }}</dd>
        </div>
        <div>
          <dt>{{ chinese ? '错误' : 'Errors' }}</dt>
          <dd>{{ errorCount }}</dd>
        </div>
      </dl>
      <h3>{{ chinese ? '当前值' : 'Current values' }}</h3>
      <pre data-experience-values>{{ JSON.stringify(state.values, null, 2) }}</pre>
      <template v-if="errorCount">
        <h3>{{ chinese ? '校验结果' : 'Validation' }}</h3>
        <pre>{{ JSON.stringify(state.validation, null, 2) }}</pre>
      </template>
    </template>
    <p v-else role="status">
      {{ chinese ? '等待运行页面…' : 'Waiting for the runtime…' }}
    </p>
  </aside>
</template>
