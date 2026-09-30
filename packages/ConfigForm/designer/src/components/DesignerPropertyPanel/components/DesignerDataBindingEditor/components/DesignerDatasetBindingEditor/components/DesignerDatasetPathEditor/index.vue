<script setup lang="ts">
import type { CascaderOption } from 'element-plus'
import { projectDatasetSchema } from '@moluoxixi/config-form-model'
import { ElCascader, ElInput } from 'element-plus'
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useDesignerLocale } from '../../../../../../../../locale'

const props = withDefaults(defineProps<{
  label: string
  modelValue?: readonly string[]
  options: CascaderOption[]
  readonly: boolean
  required?: boolean
}>(), { required: true })

const emit = defineEmits<{
  change: [path: string[] | undefined]
  validation: [id: string, valid: boolean]
}>()

const locale = useDesignerLocale()
const id = useId()
const errorId = `${id}-error`
const cascaderProps = { checkStrictly: true, emitPath: true } as const
const draft = ref(props.modelValue === undefined ? '' : JSON.stringify(props.modelValue))
const edited = ref(false)
const parsed = computed(() => parsePath(draft.value))
const manual = computed(() => props.options.length === 0 || (edited.value && !parsed.value.valid))

watch(() => props.modelValue, (value) => {
  if (parsed.value.valid && JSON.stringify(parsed.value.path) === JSON.stringify(value))
    return
  draft.value = value === undefined ? '' : JSON.stringify(value)
  edited.value = false
}, { deep: true })

watch(() => !manual.value || parsed.value.valid, valid => emit('validation', id, valid), { immediate: true })
onBeforeUnmount(() => emit('validation', id, true))

function parsePath(text: string): { valid: true, path: string[] | undefined } | { valid: false } {
  if (!text.trim())
    return props.required ? { valid: false } : { valid: true, path: undefined }
  try {
    const path: unknown = JSON.parse(text)
    if (!Array.isArray(path) || (props.required && path.length === 0))
      return { valid: false }
    // Use the public Dataset schema so segment limits and forbidden keys remain Model-owned.
    const result = projectDatasetSchema.safeParse({
      id: 'path',
      name: 'Path',
      rows: [],
      defaultProjection: { kind: 'list', itemKeyPath: path },
    })
    if (!result.success || result.data.defaultProjection?.kind !== 'list')
      return { valid: false }
    return { valid: true, path: path.length ? result.data.defaultProjection.itemKeyPath : undefined }
  }
  catch {
    return { valid: false }
  }
}

function updateDraft(value: string): void {
  if (props.readonly)
    return
  draft.value = value
  edited.value = true
  if (parsed.value.valid)
    emit('change', parsed.value.path)
}

function selectPath(value: unknown): void {
  if (props.readonly)
    return
  updateDraft(value == null ? '' : JSON.stringify(value))
}
</script>

<template>
  <div class="mx-config-form-designer__data-binding-field">
    <ElInput
      v-if="manual"
      :model-value="draft"
      :disabled="readonly"
      :aria-label="label"
      :aria-required="required"
      :aria-invalid="!parsed.valid"
      :aria-describedby="!parsed.valid ? errorId : undefined"
      :clearable="!required"
      placeholder="[&quot;address&quot;,&quot;city&quot;]"
      data-manual-dataset-path
      @update:model-value="updateDraft"
    />
    <ElCascader
      v-else
      :model-value="modelValue"
      :options="options"
      :props="cascaderProps"
      filterable
      :clearable="!required"
      :disabled="readonly"
      :aria-label="label"
      @change="selectPath"
    />
    <p v-if="manual && !parsed.valid" :id="errorId" class="mx-config-form-designer__data-binding-error" role="alert">
      {{ locale.t('data.path.invalid', 'Enter a JSON array with 1–32 non-empty string segments, at most 128 characters each. __proto__, constructor and prototype are not allowed.') }}
    </p>
  </div>
</template>
