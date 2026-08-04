<script setup lang="ts">
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

const typeColumnLabel = {
  props: '类型',
  emits: '参数',
  expose: '类型',
  slots: '作用域',
}[props.type]
</script>

<template>
  <div class="api-table-wrapper">
    <table class="api-table" :aria-label="`${type} API`">
      <colgroup>
        <col style="width: 160px">
        <col style="width: 240px">
        <col v-if="type === 'props'" style="width: 120px">
        <col v-if="type === 'props'" style="width: 88px">
        <col>
      </colgroup>
      <thead>
        <tr>
          <th scope="col">名称</th>
          <th scope="col">{{ typeColumnLabel }}</th>
          <th v-if="type === 'props'" scope="col">默认值</th>
          <th v-if="type === 'props'" scope="col">必填</th>
          <th scope="col">说明</th>
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
            <span v-if="row.required" class="prop-required" aria-label="必填">是</span>
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
