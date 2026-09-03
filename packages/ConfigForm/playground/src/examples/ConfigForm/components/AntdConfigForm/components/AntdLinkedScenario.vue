<script setup lang="ts">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { AntdLinkedValues } from '../types'
import { AntdConfigForm } from '@moluoxixi/config-form-antd-vue'
import { Button as AButton } from 'ant-design-vue'
import { computed, shallowRef } from 'vue'
import { antdLinkedFields, createAntdLinkedValues } from '../services'

const model = shallowRef<AntdLinkedValues>(createAntdLinkedValues())
const submitted = shallowRef<Partial<AntdLinkedValues>>({})
const submittedText = computed(() => JSON.stringify(submitted.value, null, 2))

function submit(values: ConfigFormValues): void {
  submitted.value = values as AntdLinkedValues
}
</script>

<template>
  <section class="config-form-demo__section" data-testid="antd-linked-scenario">
    <AntdConfigForm
      v-model="model"
      data-testid="antd-linked-form"
      :field-span="12"
      :fields="antdLinkedFields"
      gap="16px"
      :layout-attrs="{ id: 'antd-linked-row' }"
      @submit="submit"
    >
      <template #default="{ submit: submitForm }">
        <div class="config-form-demo__actions">
          <AButton type="primary" data-testid="antd-linked-submit" @click="submitForm">
            提交联动
          </AButton>
        </div>
      </template>
    </AntdConfigForm>

    <pre class="config-form-demo__preview" data-testid="antd-linked-preview">{{ submittedText }}</pre>
  </section>
</template>
