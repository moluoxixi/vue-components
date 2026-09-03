<script setup lang="ts">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ElementKnownValues } from '../types'
import { ElementConfigForm } from '@moluoxixi/config-form-element'
import { ElButton } from 'element-plus'
import { computed, shallowRef } from 'vue'
import { createElementKnownValues, elementContainerFields } from '../services'

const model = shallowRef<ElementKnownValues>(createElementKnownValues('container'))
const submitted = shallowRef<Partial<ElementKnownValues>>({})
const submittedText = computed(() => JSON.stringify(submitted.value, null, 2))

function submit(values: ConfigFormValues): void {
  submitted.value = values as ElementKnownValues
}
</script>

<template>
  <section class="config-form-demo__section" data-testid="element-container-scenario">
    <ElementConfigForm
      v-model="model"
      data-testid="element-container-form"
      :fields="elementContainerFields"
      gap="16px"
      :layout-attrs="{ id: 'element-container-row' }"
      @submit="submit"
    >
      <template #default="{ submit: submitForm }">
        <div class="config-form-demo__actions config-form-demo__actions--plain">
          <ElButton type="primary" data-testid="element-container-submit" @click="submitForm">
            提交容器
          </ElButton>
        </div>
      </template>
    </ElementConfigForm>

    <pre class="config-form-demo__preview" data-testid="element-container-preview">{{ submittedText }}</pre>
  </section>
</template>
