<script setup lang="ts">
import { computed } from 'vue'
import { formatDocsMessage } from '../../docs-i18n'
import { useDocsLocale } from '../use-docs-locale'

export interface ApiRow {
  name: string
  type: string
  typeDetail?: string
  required?: boolean
  default?: string
  description: string
}

const props = defineProps<{
  data: ApiRow[]
  type: 'props' | 'emits' | 'expose' | 'slots'
}>()

const { messages } = useDocsLocale()
const typeColumnLabel = computed(() => ({
  props: messages.value.api.type,
  emits: messages.value.api.parameters,
  expose: messages.value.api.type,
  slots: messages.value.api.scope,
}[props.type]))
const tableAriaLabel = computed(() => formatDocsMessage(messages.value.api.tableAria, {
  section: messages.value.api.sections[props.type],
}))
</script>

<template>
  <div class="api-table-wrapper">
    <table class="api-table" :aria-label="tableAriaLabel">
      <colgroup>
        <col style="width: 160px">
        <col style="width: 240px">
        <col v-if="type === 'props'" style="width: 120px">
        <col v-if="type === 'props'" style="width: 88px">
        <col>
      </colgroup>
      <thead>
        <tr>
          <th scope="col">{{ messages.api.name }}</th>
          <th scope="col">{{ typeColumnLabel }}</th>
          <th v-if="type === 'props'" scope="col">{{ messages.api.defaultValue }}</th>
          <th v-if="type === 'props'" scope="col">{{ messages.api.required }}</th>
          <th scope="col">{{ messages.api.description }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in data" :key="row.name">
          <td>
            <span class="prop-name">{{ row.name }}</span>
          </td>
          <td>
            <TypeCell :type="row.type" :detail="row.typeDetail" />
          </td>
          <td v-if="type === 'props'">
            <span v-if="row.default !== undefined" class="prop-default">{{ row.default }}</span>
            <span v-else class="prop-default">—</span>
          </td>
          <td v-if="type === 'props'">
            <span v-if="row.required" class="prop-required" :aria-label="messages.api.required">{{ messages.api.yes }}</span>
            <span v-else style="color: var(--vp-c-text-3)">—</span>
          </td>
          <td>
            <span class="prop-desc">{{ row.description }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
