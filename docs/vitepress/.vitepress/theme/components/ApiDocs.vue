<script setup lang="ts">
import type { ApiRow } from './ApiTable.vue'
import ConfigTable from '../../api/ConfigTable.json'
import CopyText from '../../api/CopyText.json'
import DateRangePicker from '../../api/DateRangePicker.json'
import EnterNextContainer from '../../api/EnterNextContainer.json'
import HeadlessCopyText from '../../api/HeadlessCopyText.json'
import HeadlessTable from '../../api/HeadlessTable.json'
import PopoverTableSelect from '../../api/PopoverTableSelect.json'
import RequestCascader from '../../api/RequestCascader.json'
import RequestSelectV2 from '../../api/RequestSelectV2.json'
import RequestTreeSelect from '../../api/RequestTreeSelect.json'
import RichTextEditor from '../../api/RichTextEditor.json'

type ApiSectionType = 'props' | 'emits' | 'expose' | 'slots'

interface ComponentApi {
  name: string
  description: string
  props: ApiRow[]
  emits: ApiRow[]
  expose: ApiRow[]
  slots: ApiRow[]
}

const apiByName = {
  ConfigTable,
  CopyText,
  DateRangePicker,
  EnterNextContainer,
  HeadlessCopyText,
  HeadlessTable,
  PopoverTableSelect,
  RequestCascader,
  RequestSelectV2,
  RequestTreeSelect,
  RichTextEditor,
} satisfies Record<string, ComponentApi>

const props = defineProps<{
  name: keyof typeof apiByName
}>()

const sectionMeta: Array<{ key: ApiSectionType, label: string }> = [
  { key: 'props', label: 'Props' },
  { key: 'emits', label: 'Emits' },
  { key: 'slots', label: 'Slots' },
  { key: 'expose', label: 'Expose' },
]

const api = apiByName[props.name]
const sections = sectionMeta.filter(section => api[section.key].length > 0)
</script>

<template>
  <div class="api-docs">
    <section v-for="section in sections" :key="section.key" class="api-docs-section">
      <h3 :id="`${name}-${section.key}`" tabindex="-1">
        {{ section.label }}
        <a
          class="header-anchor"
          :href="`#${name}-${section.key}`"
          :aria-label="`${section.label} 的永久链接`"
        >&#8203;</a>
      </h3>
      <ApiTable :data="api[section.key]" :type="section.key" />
    </section>
    <p v-if="sections.length === 0" class="api-docs-empty">
      该组件没有公开的组件契约。
    </p>
  </div>
</template>
