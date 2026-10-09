<script setup lang="ts">
import type { SurfaceFieldNode } from '@moluoxixi/config-form-model'
import { useDesignerLocale } from '@designer/locale'
import { FlaskConical } from '@lucide/vue'
import { createConfigFormController } from '@moluoxixi/config-form-headless'
import { compileRules } from '@moluoxixi/zod3-to-rule'
import { computed, ref, watch } from 'vue'

const props = defineProps<{ node: SurfaceFieldNode }>()
const locale = useDesignerLocale()
const input = ref('')
const kind = ref<'text' | 'json' | 'empty'>('text')
const otherValues = ref('{}')
const result = ref<{ success: boolean, messages: string[] }>()
const pending = ref(false)
let sequence = 0
const rules = computed(() => props.node.validation)
watch(
  () => props.node,
  () => {
    sequence++
    pending.value = false
    result.value = undefined
  },
  { deep: true },
)
async function run(): Promise<void> {
  const request = ++sequence
  pending.value = true
  result.value = undefined
  try {
    let value: unknown
      = kind.value === 'empty' ? undefined : kind.value === 'json' ? JSON.parse(input.value) : input.value
    const compiled = rules.value ? compileRules(rules.value) : undefined
    if (compiled?.diagnostics.some(item => item.severity === 'error'))
      throw new TypeError(compiled.diagnostics.map(item => item.message).join('; '))
    if (rules.value?.base.type === 'date' && typeof value === 'string')
      value = new Date(value)
    const context: unknown = JSON.parse(otherValues.value)
    if (!context || typeof context !== 'object' || Array.isArray(context))
      throw new TypeError(locale.t('validation.labContextInvalid', 'Other field values must be a JSON object.'))
    const values: Record<string, unknown> = { ...context, [props.node.field]: value }
    const controller = createConfigFormController({
      model: { read: () => values, write: () => {} },
      fields: () => [
        {
          id: props.node.id,
          field: props.node.field,
          component: 'input',
          required: props.node.required,
          requiredMessage: props.node.requiredMessage,
          schema: compiled?.schema,
          validator: compiled?.validator,
        },
      ],
    })
    const success = await controller.validate()
    if (request === sequence)
      result.value = { success, messages: Object.values(controller.getErrors()).flat() }
    controller.clearValidate()
  }
  catch (error) {
    if (request === sequence)
      result.value = { success: false, messages: [error instanceof Error ? error.message : String(error)] }
  }
  finally {
    if (request === sequence)
      pending.value = false
  }
}
</script>

<template>
  <details class="mx-config-form-designer__validation-lab">
    <summary><FlaskConical :size="14" />{{ locale.t('validation.lab', 'Validation lab') }}</summary>
    <p>
      {{
        locale.t(
          'validation.labHint',
          'Try a value against the current required setting and rules without changing the form.',
        )
      }}
    </p>
    <label>{{ locale.t('validation.labType', 'Input type')
    }}<select v-model="kind" :aria-label="locale.t('validation.labType', 'Input type')">
      <option value="text">{{ locale.t('valueType.text', 'Text') }}</option>
      <option value="json">JSON</option>
      <option value="empty">{{ locale.t('validation.labEmpty', 'Missing value') }}</option>
    </select></label>
    <textarea
      v-if="kind !== 'empty'"
      v-model="input"
      rows="2"
      :aria-label="locale.t('validation.labValue', 'Test value')"
    />
    <details>
      <summary>{{ locale.t('validation.labContext', 'Other field values (JSON)') }}</summary>
      <textarea
        v-model="otherValues"
        rows="4"
        :aria-label="locale.t('validation.labContext', 'Other field values (JSON)')"
      />
    </details>
    <button type="button" class="mx-config-form-designer__interaction-command" :disabled="pending" @click="run">
      {{ locale.t('validation.labRun', 'Test validation') }}
    </button>
    <output v-if="result" :data-success="result.success" aria-live="polite"><strong>{{
      result.success
        ? locale.t('validation.labPassed', 'Validation passed')
        : locale.t('validation.labFailed', 'Validation failed')
    }}</strong><span v-for="message in result.messages" :key="message">{{ message }}</span></output>
  </details>
</template>
