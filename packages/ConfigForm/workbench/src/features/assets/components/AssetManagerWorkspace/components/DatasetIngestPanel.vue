<script setup lang="ts">
import type { ModelJsonObject } from '@moluoxixi/config-form-model'
import type { UploadFile, UploadInstance } from 'element-plus'
import { Upload } from '@lucide/vue'
import { computed, ref } from 'vue'
import WorkbenchCommandHint from '../../../../../app/components/WorkbenchCommandHint/index.vue'
import { parseDatasetIngest } from '../../../services/ingest'

const props = defineProps<{ locale: string }>()
const emit = defineEmits<{ apply: [rows: ModelJsonObject[]] }>()
const format = ref<'csv' | 'json'>('csv')
const text = ref('')
const error = ref('')
const upload = ref<UploadInstance>()
const chinese = computed(() => props.locale === 'zh-CN')
const placeholder = computed(() =>
  format.value === 'csv' ? 'id,name\n001,Alice\n002,Bob' : '[{"id":1,"name":"Alice"}]',
)
const preview = computed(() => {
  try {
    return text.value.trim()
      ? { rows: parseDatasetIngest(text.value, format.value), error: '' }
      : { rows: [], error: '' }
  }
  catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : String(error) }
  }
})
const previewColumns = computed(() => [...new Set(preview.value.rows.slice(0, 3).flatMap(row => Object.keys(row)))])
const unavailableReason = computed(() => error.value || preview.value.error
  ? (chinese.value ? '请先修正导入内容中的错误' : 'Correct the import errors first')
  : !text.value.trim() ? (chinese.value ? '粘贴数据或选择文件后即可导入' : 'Paste data or choose a file to import') : undefined)
function displayCell(value: unknown): string {
  return value === undefined ? '—' : typeof value === 'string' ? value : JSON.stringify(value)
}
async function load(uploadFile: UploadFile): Promise<void> {
  const file = uploadFile.raw
  if (!file)
    return
  error.value = ''
  if (file.size > 5 * 1024 * 1024) {
    error.value = chinese.value ? '文件不能超过 5 MB' : 'File must be smaller than 5 MB'
    return
  }
  format.value = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json'
  try {
    text.value = await file.text()
  }
  catch (value) {
    error.value = String(value)
  }
  upload.value?.clearFiles()
}
</script>

<template>
  <section class="dataset-ingest">
    <div class="dataset-editor-toolbar">
      <ElSelect v-model="format" :aria-label="chinese ? '格式' : 'Format'" append-to="#workbench-overlays" @change="error = ''">
        <ElOption value="csv" label="CSV" /><ElOption
          value="json"
          :label="chinese ? 'JSON 对象数组' : 'JSON object array'"
        />
      </ElSelect><ElUpload
        ref="upload"
        accept=".csv,.json,text/csv,application/json"
        :auto-upload="false"
        :show-file-list="false"
        :on-change="load"
      >
        <ElButton tag="span">
          <Upload :size="14" aria-hidden="true" /><span>{{ chinese ? '选择文件' : 'Choose file' }}</span>
        </ElButton>
      </ElUpload>
    </div>
    <p class="dataset-editor-hint">
      {{
        chinese
          ? 'CSV 首行是列名，单元格按文本保留；JSON 必须是对象数组。应用后替换当前数据，可撤销。'
          : 'CSV uses its first row as headers and preserves text. JSON must be an object array. Apply replaces rows in one undoable command.'
      }}
    </p>
    <ElInput
      v-model="text"
      type="textarea"
      :aria-label="chinese ? '待导入数据' : 'Raw data to import'"
      :placeholder="placeholder"
      :rows="7"
      @input="error = ''"
    />
    <p v-if="error || preview.error" role="alert" class="dataset-editor-error">
      {{ error || preview.error }}
    </p>
    <div v-if="text.trim() && !preview.error && !error" class="dataset-ingest-preview">
      <header><strong>{{ chinese ? '内容预览' : 'Preview' }}</strong><span>{{ preview.rows.length }} {{ chinese ? '行 · 仅预览前 3 行' : 'rows · first 3 shown' }}</span></header>
      <div class="dataset-ingest-preview-scroll" tabindex="0" role="region" :aria-label="chinese ? '导入数据预览' : 'Import preview'">
        <table v-if="preview.rows.length">
          <thead>
            <tr>
              <th v-for="key in previewColumns" :key="key" scope="col">
                {{ key }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in preview.rows.slice(0, 3)" :key="index">
              <td v-for="key in previewColumns" :key="key">
                {{ displayCell(row[key]) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="dataset-editor-hint">
          {{ chinese ? '导入后将清空当前数据。' : 'Importing this array will clear the current rows.' }}
        </p>
      </div>
    </div>
    <div class="dataset-ingest-actions">
      <WorkbenchCommandHint detached :label="chinese ? '导入并替换当前数据' : 'Import and replace current rows'" :disabled-reason="unavailableReason">
        <ElButton type="primary" :disabled="!!unavailableReason" data-dataset-ingest-apply @click="emit('apply', preview.rows)">
          {{ chinese ? '应用数据' : 'Apply data' }}
        </ElButton>
      </WorkbenchCommandHint>
    </div>
  </section>
</template>
