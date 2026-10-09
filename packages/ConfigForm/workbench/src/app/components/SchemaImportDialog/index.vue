<script setup lang="ts">
import type { NodeSubgraph } from '@moluoxixi/config-form-model'
import type { UploadFile } from 'element-plus'
import type { SchemaImportDialogProps, SchemaImportPreview } from '../../../features/schema'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, ref, shallowRef, watch } from 'vue'
import { previewJsonSchema } from '../../../features/schema'

const props = defineProps<SchemaImportDialogProps>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean], 'apply': [subgraph: NodeSubgraph] }>()
const locale = computed(() => createDesignerLocale(props.locale))
const chinese = computed(() => locale.value.locale === 'zh-CN')
const text = ref('')
const preview = shallowRef<SchemaImportPreview>()
const error = ref('')
const applicable = computed(
  () =>
    preview.value
    && preview.value.fields.length > 0
    && !preview.value.diagnostics.some(item => item.severity === 'error'),
)
watch(
  text,
  () => {
    preview.value = undefined
    error.value = ''
  },
  { flush: 'sync' },
)
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      preview.value = undefined
      error.value = ''
    }
  },
)
function analyze(): void {
  try {
    preview.value = previewJsonSchema(JSON.parse(text.value), props.adapter, props.existingFields)
    error.value = ''
  }
  catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    preview.value = undefined
  }
}
async function loadFile(file: UploadFile): Promise<void> {
  if (!file.raw)
    return
  if (file.raw.size > 5 * 1024 * 1024) {
    error.value = chinese.value ? '文件上限为 5 MB' : 'File limit is 5 MB'
    return
  }
  text.value = await file.raw.text()
  analyze()
}
function example(): void {
  text.value = JSON.stringify(
    {
      type: 'object',
      required: ['customer', 'email'],
      properties: {
        customer: {
          type: 'string',
          title: chinese.value ? '客户名称' : 'Customer',
          minLength: 2,
          description: chinese.value ? '填写客户的完整名称' : 'Use the customer’s full name',
        },
        email: { type: 'string', format: 'email', title: chinese.value ? '邮箱' : 'Email' },
        tier: { type: 'string', enum: ['Standard', 'Premium'], default: 'Standard' },
        seats: { type: 'integer', minimum: 1, maximum: 100, default: 1 },
      },
    },
    null,
    2,
  )
}
</script>

<template>
  <ElDialog
    :model-value="modelValue"
    :title="chinese ? '从 JSON Schema 生成字段' : 'Generate fields from JSON Schema'"
    width="min(960px, 94vw)"
    class="schema-import-dialog"
    append-to="#workbench-overlays"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="schema-import-intro">
      {{
        chinese
          ? '离线解析字段、枚举、默认值、必填与校验规则。先检查映射，再作为一个可撤销操作添加到当前表单。'
          : 'Parse fields, enums, defaults, required and validation rules offline. Review the mapping, then add it as one undoable command.'
      }}
    </p>
    <div class="schema-import-actions">
      <ElUpload :auto-upload="false" :show-file-list="false" accept=".json,application/json" :on-change="loadFile">
        <ElButton>{{ chinese ? '读取 JSON 文件' : 'Read JSON file' }}</ElButton>
      </ElUpload><ElButton @click="example">
        {{ chinese ? '填入示例' : 'Use example' }}
      </ElButton>
    </div>
    <div class="schema-import-grid">
      <ElInput
        v-model="text"
        type="textarea"
        :rows="16"
        aria-label="JSON Schema"
        placeholder="{ &quot;type&quot;: &quot;object&quot;, &quot;properties&quot;: { ... } }"
      />
      <div class="schema-import-review">
        <p v-if="error" role="alert" class="schema-import-error">
          {{ error }}
        </p>
        <template v-if="preview">
          <h3>{{ chinese ? '字段映射' : 'Field mapping' }} · {{ preview.fields.length }}</h3>
          <div v-for="field in preview.fields" :key="field.id" class="schema-import-field">
            <strong>{{ field.label }} <span v-if="field.required">*</span></strong><code>{{ field.field }} → {{ field.component }}</code><small>{{
              field.validation?.rules.map((rule) => rule.kind).join(' · ')
                || (chinese ? '基础类型校验' : 'Type validation')
            }}</small>
          </div>
          <p
            v-for="item in preview.diagnostics"
            :key="item.path + item.message"
            :data-severity="item.severity"
            class="schema-import-diagnostic"
          >
            <code>{{ item.path }}</code><span>{{ item.message }}</span>
          </p>
          <p v-if="!preview.diagnostics.length" class="schema-import-success">
            {{ chinese ? '映射检查通过，可以生成。' : 'Mapping checks passed. Ready to generate.' }}
          </p>
        </template>
        <p v-else-if="!error">
          {{
            chinese
              ? '支持扁平对象中的文本、数字、整数、布尔与文本枚举。嵌套对象、数组、$ref 和组合规则会标明为待人工设计。'
              : 'Supports flat objects with text, numbers, integers, booleans and string enums. Nested objects, arrays, $ref and composition require manual design.'
          }}
        </p>
      </div>
    </div>
    <template #footer>
      <ElButton @click="emit('update:modelValue', false)">
        {{ chinese ? '取消' : 'Cancel' }}
      </ElButton><ElButton :disabled="!text.trim()" @click="analyze">
        {{ chinese ? '检查映射' : 'Review mapping' }}
      </ElButton><ElButton
        type="primary"
        :disabled="!applicable"
        data-schema-apply
        @click="preview && emit('apply', preview.subgraph)"
      >
        {{ chinese ? '生成字段' : 'Generate fields' }}
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.schema-import-intro {
  color: var(--wb-muted);
  font-size: 12px;
  line-height: 1.8;
}
.schema-import-actions {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}
.schema-import-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.schema-import-review {
  max-height: 410px;
  overflow: auto;
  font-size: 12px;
}
.schema-import-review h3 {
  font-size: 13px;
  margin: 0 0 12px;
}
.schema-import-field {
  display: grid;
  gap: 5px;
  padding: 12px;
  border: 1px solid var(--wb-separator);
  border-radius: 4px;
  margin-bottom: 8px;
}
.schema-import-field code,
.schema-import-field small {
  color: var(--wb-muted);
  font-size: 11px;
  overflow-wrap: anywhere;
}
.schema-import-field strong span,
.schema-import-error,
.schema-import-diagnostic[data-severity='error'] {
  color: var(--wb-danger);
}
.schema-import-diagnostic {
  display: grid;
  gap: 5px;
  padding: 10px 0;
  overflow-wrap: anywhere;
}
.schema-import-diagnostic[data-severity='warning'] {
  color: var(--wb-warning);
}
.schema-import-success {
  color: var(--wb-positive);
}
@media (max-width: 720px) {
  .schema-import-grid {
    grid-template-columns: 1fr;
  }
}
</style>
