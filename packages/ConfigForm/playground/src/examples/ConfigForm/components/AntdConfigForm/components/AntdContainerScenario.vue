<script setup lang="ts">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { AntdKnownValues } from '../types'
import { AntdConfigForm } from '@moluoxixi/config-form-antd-vue'
import { Button as AButton } from 'ant-design-vue'
import { computed, shallowRef } from 'vue'
import { antdContainerFields, createAntdKnownValues } from '../services'

const model = shallowRef<AntdKnownValues>(createAntdKnownValues('container'))
const submitted = shallowRef<Partial<AntdKnownValues>>({})
const submittedText = computed(() => JSON.stringify(submitted.value, null, 2))

function submit(values: ConfigFormValues): void {
  submitted.value = values as AntdKnownValues
}
</script>

<template>
  <section class="config-form-demo__section" data-testid="antd-container-scenario">
    <AntdConfigForm
      v-model="model"
      data-testid="antd-container-form"
      :fields="antdContainerFields"
      gap="16px"
      :layout-attrs="{ id: 'antd-container-row' }"
      @submit="submit"
    >
      <template #default="{ submit: submitForm }">
        <div class="config-form-demo__actions config-form-demo__actions--plain">
          <AButton type="primary" data-testid="antd-container-submit" @click="submitForm">
            提交容器
          </AButton>
        </div>
      </template>
    </AntdConfigForm>

    <pre class="config-form-demo__preview" data-testid="antd-container-preview">{{ submittedText }}</pre>
  </section>
</template>
