<script setup lang="ts">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ElementLinkedValues } from '../types'
import { ElementConfigForm } from '@moluoxixi/config-form-element'
import { ElButton } from 'element-plus'
import { computed, shallowRef } from 'vue'
import { createElementLinkedValues, elementLinkedFields } from '../services'

const model = shallowRef<ElementLinkedValues>(createElementLinkedValues())
const submitted = shallowRef<Partial<ElementLinkedValues>>({})
const submittedText = computed(() => JSON.stringify(submitted.value, null, 2))

function submit(values: ConfigFormValues): void {
  submitted.value = values as ElementLinkedValues
}
</script>

<template>
  <section class="config-form-demo__section" data-testid="element-linked-scenario">
    <ElementConfigForm
      v-model="model"
      data-testid="element-linked-form"
      :field-span="12"
      :fields="elementLinkedFields"
      gap="16px"
      :layout-attrs="{ id: 'element-linked-row' }"
      @submit="submit"
    >
      <template #default="{ submit: submitForm }">
        <div class="config-form-demo__actions">
          <ElButton type="primary" data-testid="element-linked-submit" @click="submitForm">
            提交联动
          </ElButton>
        </div>
      </template>
    </ElementConfigForm>

    <pre class="config-form-demo__preview" data-testid="element-linked-preview">{{ submittedText }}</pre>
  </section>
</template>
