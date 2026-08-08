<script setup lang="ts">
import { computed } from 'vue'
import ElementPlusDocsTypeCell from './ElementPlusDocsTypeCell.vue'
import type {
  ElementPlusDocsApiMessages,
  ElementPlusDocsApiRow,
  ElementPlusDocsApiSection,
} from './types'

const props = defineProps<{
  data: ElementPlusDocsApiRow[]
  messages: ElementPlusDocsApiMessages
  type: ElementPlusDocsApiSection
}>()

function formatMessage(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}

const typeColumnLabel = computed(() => ({
  props: props.messages.type,
  emits: props.messages.parameters,
  expose: props.messages.type,
  slots: props.messages.scope,
}[props.type]))
const tableAriaLabel = computed(() => formatMessage(props.messages.tableAria, {
  section: props.messages.sections[props.type],
}))

function typeDetailsLabel(type: string): string {
  return formatMessage(props.messages.typeDetails, { type })
}
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
          <th scope="col">{{ messages.name }}</th>
          <th scope="col">{{ typeColumnLabel }}</th>
          <th v-if="type === 'props'" scope="col">{{ messages.defaultValue }}</th>
          <th v-if="type === 'props'" scope="col">{{ messages.required }}</th>
          <th scope="col">{{ messages.description }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in data" :key="row.name">
          <td><span class="prop-name">{{ row.name }}</span></td>
          <td>
            <ElementPlusDocsTypeCell
              :type="row.type"
              :detail="row.typeDetail"
              :type-details-label="typeDetailsLabel(row.type)"
            />
          </td>
          <td v-if="type === 'props'">
            <span class="prop-default">{{ row.default ?? '—' }}</span>
          </td>
          <td v-if="type === 'props'">
            <span v-if="row.required" class="prop-required" :aria-label="messages.required">{{ messages.yes }}</span>
            <span v-else class="prop-empty">—</span>
          </td>
          <td><span class="prop-desc">{{ row.description }}</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.api-table-wrapper {
  margin: 12px 0 18px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  border: 1px solid var(--mx-border, var(--border-color));
  border-radius: 6px;
}

.api-table {
  display: table;
  width: 100%;
  min-width: 720px;
  margin: 0;
  overflow: visible;
  border: 0;
  border-collapse: collapse;
  font-size: 14px;
}

.api-table th {
  padding: 10px 14px;
  border: 0;
  border-bottom: 1px solid var(--mx-border, var(--border-color));
  background: var(--mx-fill, var(--bg-color-soft));
  color: var(--text-color);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
}

.api-table td {
  padding: 10px 14px;
  border: 0;
  border-bottom: 1px solid var(--mx-border-light, var(--border-color-lighter));
  color: var(--text-color);
  vertical-align: top;
}

.api-table tr:last-child td {
  border-bottom: 0;
}

.api-table tbody tr:hover td {
  background: var(--mx-fill-light, var(--bg-color-soft));
}

.prop-name,
.prop-default {
  font-family: var(--font-family-mono);
}

.prop-name {
  color: var(--brand-color);
  font-size: 13px;
  font-weight: 500;
}

.prop-default,
.prop-empty {
  color: var(--text-color-light);
  font-size: 12px;
}

.prop-required {
  color: var(--mx-danger, #f56c6c);
  font-size: 12px;
  font-weight: 600;
}

.prop-desc {
  color: var(--text-color-light);
  font-size: 13px;
  line-height: 1.6;
}
</style>
