<script setup lang="ts">
import type { ModelJsonObject } from '@moluoxixi/config-form-model'
import type { UploadFile, UploadInstance } from 'element-plus'
import { computed, ref } from 'vue'
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
      <ElSelect v-model="format" :aria-label="chinese ? '格式' : 'Format'" append-to="#workbench-overlays">
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
        <ElButton>{{ chinese ? '选择文件' : 'Choose file' }}</ElButton>
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
      :rows="10"
    />
    <p v-if="error || preview.error" role="alert" class="dataset-editor-error">
      {{ error || preview.error }}
    </p>
    <template v-else-if="text.trim()">
      <strong>{{ chinese ? '预览' : 'Preview' }} · {{ preview.rows.length }} {{ chinese ? '行' : 'rows' }}</strong>
      <pre>{{ JSON.stringify(preview.rows.slice(0, 3), null, 2) }}</pre>
      <ElButton type="primary" data-dataset-ingest-apply @click="emit('apply', preview.rows)">
        {{ chinese ? '应用数据' : 'Apply data' }}
      </ElButton>
    </template>
  </section>
</template>
