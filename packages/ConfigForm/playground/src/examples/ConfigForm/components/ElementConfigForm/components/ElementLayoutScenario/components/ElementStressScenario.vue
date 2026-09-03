<script setup lang="ts">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ElementStressValues } from '../../../types'
import { ElementConfigForm } from '@moluoxixi/config-form-element'
import { ElButton } from 'element-plus'
import { computed, shallowRef } from 'vue'
import { createElementStressValues, elementStressFields } from '../../../services'

const model = shallowRef<ElementStressValues>(createElementStressValues())
const submitted = shallowRef<Partial<ElementStressValues>>({})
const submittedText = computed(() => JSON.stringify({
  count: elementStressFields.length,
  sample: {
    stressField1: submitted.value.stressField1,
    stressField200: submitted.value.stressField200,
  },
  submitted: Object.keys(submitted.value).length,
}, null, 2))

function submit(values: ConfigFormValues): void {
  submitted.value = values as ElementStressValues
}
</script>

<template>
  <section class="config-form-demo__stress" data-testid="element-layout-stress">
    <div class="config-form-demo__stress-header">
      <strong>布局压测</strong>
      <span data-testid="element-layout-stress-count">{{ elementStressFields.length }} fields</span>
    </div>
    <ElementConfigForm
      v-model="model"
      data-testid="element-layout-stress-form"
      :field-span="6"
      :fields="elementStressFields"
      gap="12px"
      :layout-attrs="{ id: 'element-layout-stress-grid' }"
      @submit="submit"
    >
      <template #default="{ submit: submitForm }">
        <div class="config-form-demo__actions">
          <ElButton type="primary" data-testid="element-layout-stress-submit" @click="submitForm">
            提交压测
          </ElButton>
        </div>
      </template>
    </ElementConfigForm>
    <pre class="config-form-demo__preview" data-testid="element-layout-stress-preview">{{ submittedText }}</pre>
  </section>
</template>
