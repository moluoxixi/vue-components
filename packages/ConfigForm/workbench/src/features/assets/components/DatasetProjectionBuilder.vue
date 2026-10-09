<script setup lang="ts">
import type { DatasetProjection, DeepReadonly, ProjectDataset, SafeExpression } from '@moluoxixi/config-form-model'
import { projectDatasetSchema, queryDatasetView } from '@moluoxixi/config-form-model'
import { computed, ref } from 'vue'
import { collectDatasetPaths } from '../services/ingest'

const props = defineProps<{ json: string, dataset: DeepReadonly<ProjectDataset>, locale: string }>()
const emit = defineEmits<{ 'update:json': [value: string] }>()
const chinese = computed(() => props.locale === 'zh-CN')
const sortPath = ref('')
const filterPath = ref('')
const filterValue = ref('')
const direction = ref<'asc' | 'desc'>('asc')
const paths = computed(() => collectDatasetPaths(props.dataset.rows))
const parsedProjection = computed(() => {
  if (!props.json.trim())
    return { value: undefined, error: '' }
  try {
    const result = projectDatasetSchema.safeParse({ ...props.dataset, defaultProjection: JSON.parse(props.json) })
    if (!result.success) {
      return {
        value: undefined,
        error: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      }
    }
    return { value: result.data.defaultProjection, error: '' }
  }
  catch (error) {
    return { value: undefined, error: error instanceof Error ? error.message : String(error) }
  }
})
const projection = computed(() => parsedProjection.value.value)
const kind = computed(() => projection.value?.kind ?? 'options')
const mappingKeys = computed(() =>
  kind.value === 'options'
    ? ['labelPath', 'valuePath', 'disabledPath']
    : kind.value === 'list'
      ? ['itemKeyPath', 'titlePath', 'descriptionPath']
      : ['rowKeyPath'],
)
const labels = computed<Record<string, string>>(() =>
  chinese.value
    ? {
        labelPath: '显示文案',
        valuePath: '选项值',
        disabledPath: '禁用标记（可选）',
        itemKeyPath: '条目标识',
        titlePath: '标题（可选）',
        descriptionPath: '描述（可选）',
        rowKeyPath: '行标识',
      }
    : {
        labelPath: 'Label',
        valuePath: 'Value',
        disabledPath: 'Disabled (optional)',
        itemKeyPath: 'Item key',
        titlePath: 'Title (optional)',
        descriptionPath: 'Description (optional)',
        rowKeyPath: 'Row key',
      },
)
function pathValue(key: string): string {
  const value = (projection.value as unknown as Record<string, unknown> | undefined)?.[key]
  return Array.isArray(value) ? JSON.stringify(value) : ''
}
function commit(value: DatasetProjection): void {
  emit('update:json', JSON.stringify(value, null, 2))
}
function selectKind(value: unknown): void {
  const next = String(value)
  const first = paths.value[0] ?? ['id']
  if (next === 'options') {
    commit({ kind: 'options', labelPath: paths.value[1] ?? first, valuePath: first })
  }
  else if (next === 'list') {
    commit({ kind: 'list', itemKeyPath: first, titlePath: paths.value[1] ?? first })
  }
  else {
    commit({
      kind: 'table',
      rowKeyPath: first,
      columns: paths.value
        .filter(path => path.length === 1)
        .slice(0, 8)
        .map(path => ({ key: path[0]!, valuePath: path })),
    })
  }
}
function updatePath(key: string, value: unknown): void {
  const raw = String(value)
  const next = { ...(projection.value ?? { kind: 'options', labelPath: [], valuePath: [] }) } as unknown as Record<
    string,
    unknown
  >
  if (raw)
    next[key] = JSON.parse(raw)
  else delete next[key]
  commit(next as unknown as DatasetProjection)
}
function updateColumn(index: number, raw: unknown): void {
  if (projection.value?.kind !== 'table')
    return
  const value = JSON.parse(String(raw)) as string[]
  const columns = projection.value.columns.map((column, i) => (i === index ? { ...column, valuePath: value } : column))
  commit({ ...projection.value, columns })
}
function renameColumn(index: number, raw: string | number): void {
  if (projection.value?.kind !== 'table')
    return
  commit({
    ...projection.value,
    columns: projection.value.columns.map((column, i) => (i === index ? { ...column, key: String(raw) } : column)),
  })
}
function addColumn(): void {
  if (projection.value?.kind !== 'table')
    return
  const keys = new Set(projection.value.columns.map(column => column.key))
  let index = keys.size + 1
  while (keys.has(`column${index}`)) index++
  commit({
    ...projection.value,
    columns: [...projection.value.columns, { key: `column${index}`, valuePath: paths.value[0] ?? ['id'] }],
  })
}
const preview = computed(() => {
  if (!projection.value) {
    return {
      success: false as const,
      diagnostics: [
        {
          message:
            parsedProjection.value.error
            || (chinese.value ? '选择映射类型开始配置' : 'Choose a projection type to begin'),
        },
      ],
    }
  }
  let filter: SafeExpression | undefined
  if (filterPath.value && filterValue.value) {
    filter = {
      version: 1,
      ast: {
        kind: 'call',
        callee: 'includes',
        args: [
          { kind: 'reference', scope: 'item', path: JSON.parse(filterPath.value) },
          { kind: 'literal', value: filterValue.value },
        ],
      },
    }
  }
  return queryDatasetView(props.dataset, projection.value, {
    ...(filter ? { filter } : {}),
    ...(sortPath.value ? { sort: [{ path: JSON.parse(sortPath.value), direction: direction.value }] } : {}),
    page: { index: 0, size: 5 },
  })
})
</script>

<template>
  <section class="dataset-projection-builder">
    <div class="dataset-projection-grid">
      <label>{{ chinese ? '映射类型' : 'Projection type' }}
        <ElSelect
          :model-value="kind"
          :aria-label="chinese ? '映射类型' : 'Projection type'"
          append-to="#workbench-overlays"
          @update:model-value="selectKind"
        >
          <ElOption value="options" :label="chinese ? '选项' : 'Options'" />
          <ElOption value="table" :label="chinese ? '表格' : 'Table'" />
          <ElOption value="list" :label="chinese ? '列表' : 'List'" />
        </ElSelect>
      </label>
      <label v-for="key in mappingKeys" :key="key">{{ labels[key] }}
        <ElSelect
          :model-value="pathValue(key)"
          :disabled="!!parsedProjection.error"
          :aria-label="labels[key]"
          append-to="#workbench-overlays"
          @update:model-value="updatePath(key, $event)"
        >
          <ElOption value="" label="—" />
          <ElOption
            v-for="path in paths"
            :key="JSON.stringify(path)"
            :value="JSON.stringify(path)"
            :label="path.join(' / ')"
          />
        </ElSelect>
      </label>
    </div>
    <div v-if="projection?.kind === 'table'" class="dataset-projection-columns">
      <div v-for="(column, index) in projection.columns" :key="index">
        <ElInput
          :model-value="column.key"
          :aria-label="chinese ? `第 ${index + 1} 列输出键` : `Column ${index + 1} output key`"
          @change="renameColumn(index, $event)"
        />
        <ElSelect
          :model-value="JSON.stringify(column.valuePath)"
          :aria-label="`${column.key} path`"
          append-to="#workbench-overlays"
          @update:model-value="updateColumn(index, $event)"
        >
          <ElOption
            v-for="path in paths"
            :key="JSON.stringify(path)"
            :value="JSON.stringify(path)"
            :label="path.join(' / ')"
          />
        </ElSelect>
        <button
          type="button"
          :aria-label="chinese ? '删除映射列' : 'Remove column'"
          @click="commit({ ...projection, columns: projection.columns.filter((_, i) => i !== index) })"
        >
          ×
        </button>
      </div>
      <button type="button" @click="addColumn">
        + {{ chinese ? '添加映射列' : 'Add column' }}
      </button>
    </div>
    <details class="dataset-projection-query">
      <summary>{{ chinese ? '本地查询预览' : 'Local query preview' }}</summary>
      <div class="dataset-projection-grid">
        <label>{{ chinese ? '排序路径' : 'Sort path' }}
          <ElSelect v-model="sortPath" :aria-label="chinese ? '排序路径' : 'Sort path'" append-to="#workbench-overlays"><ElOption value="" label="—" /><ElOption
            v-for="path in paths"
            :key="JSON.stringify(path)"
            :value="JSON.stringify(path)"
            :label="path.join(' / ')"
          /></ElSelect>
        </label>
        <label>{{ chinese ? '方向' : 'Direction' }}
          <ElSelect
            v-model="direction"
            :aria-label="chinese ? '排序方向' : 'Sort direction'"
            append-to="#workbench-overlays"
          ><ElOption value="asc" :label="chinese ? '升序 ↑' : 'Ascending ↑'" /><ElOption
            value="desc"
            :label="chinese ? '降序 ↓' : 'Descending ↓'"
          /></ElSelect>
        </label>
        <label>{{ chinese ? '包含文本的路径' : 'Text filter path' }}
          <ElSelect
            v-model="filterPath"
            :aria-label="chinese ? '文本筛选路径' : 'Text filter path'"
            append-to="#workbench-overlays"
          ><ElOption value="" label="—" /><ElOption
            v-for="path in paths"
            :key="JSON.stringify(path)"
            :value="JSON.stringify(path)"
            :label="path.join(' / ')"
          /></ElSelect>
        </label>
        <label>{{ chinese ? '包含' : 'Contains'
        }}<ElInput v-model="filterValue" :aria-label="chinese ? '包含文本' : 'Contains text'" /></label>
      </div>
    </details>
    <div class="dataset-projection-preview">
      <strong>{{ chinese ? '映射结果' : 'Projected result' }}</strong>
      <template v-if="preview.success">
        <small>{{ preview.data.total }} {{ chinese ? '项 · 显示前 5 项' : 'items · first 5' }}</small>
        <pre data-dataset-projection-preview>{{ JSON.stringify(preview.data.items, null, 2) }}</pre>
      </template>
      <p v-else role="status" class="dataset-editor-error">
        {{ preview.diagnostics[0]?.message }}
      </p>
    </div>
    <details>
      <summary>{{ chinese ? '高级 JSON' : 'Advanced JSON' }}</summary>
      <ElInput
        type="textarea"
        :model-value="json"
        :rows="8"
        :aria-label="chinese ? '数据默认映射 JSON' : 'Dataset default projection JSON'"
        @update:model-value="emit('update:json', $event)"
      />
    </details>
  </section>
</template>
