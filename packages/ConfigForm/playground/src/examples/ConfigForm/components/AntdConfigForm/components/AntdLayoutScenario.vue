<script setup lang="ts">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { AntdKnownValues } from '../types'
import { defineFields } from '@moluoxixi/config-form-headless'
import { AntdConfigForm } from '@moluoxixi/config-form-antd-vue'
import { Button as AButton, Switch as ASwitch } from 'ant-design-vue'
import { computed, shallowRef } from 'vue'
import { createAntdKnownFields, createAntdKnownValues } from '../services'

const { defineField } = defineFields<AntdKnownValues>()
const gridMode = shallowRef(false)
const modeLabel = computed(() => gridMode.value ? 'grid' : 'inline')
const inlineModel = shallowRef<AntdKnownValues>(createAntdKnownValues('inline'))
const gridModel = shallowRef<AntdKnownValues>(createAntdKnownValues('grid'))
const inlineSubmitted = shallowRef<Partial<AntdKnownValues>>({})
const gridSubmitted = shallowRef<Partial<AntdKnownValues>>({})
const inlineFields = createAntdKnownFields('antd-inline', true, defineField)
const gridFields = createAntdKnownFields('antd-grid', true, defineField)
const submittedText = computed(() => JSON.stringify({
  grid: gridSubmitted.value,
  inline: inlineSubmitted.value,
}, null, 2))

function submitInline(values: ConfigFormValues): void {
  inlineSubmitted.value = values as AntdKnownValues
}

function submitGrid(values: ConfigFormValues): void {
  gridSubmitted.value = values as AntdKnownValues
}
</script>

<template>
  <section class="config-form-demo__section" data-testid="antd-layout-scenario">
    <div class="config-form-demo__toolbar">
      <span class="config-form-demo__mode" data-testid="antd-layout-mode-label">{{ modeLabel }}</span>
      <ASwitch
        v-model:checked="gridMode"
        checked-children="grid"
        data-testid="antd-layout-mode-switch"
        un-checked-children="inline"
      />
    </div>

    <AntdConfigForm
      v-if="!gridMode"
      v-model="inlineModel"
      data-testid="antd-layout-inline"
      :field-span="12"
      :fields="inlineFields"
      inline
      :layout-attrs="{ id: 'antd-layout-inline-row' }"
      @submit="submitInline"
    >
      <template #default="{ submit }">
        <div class="config-form-demo__actions">
          <AButton type="primary" data-testid="antd-layout-inline-submit" @click="submit">
            提交 inline
          </AButton>
        </div>
      </template>
    </AntdConfigForm>

    <AntdConfigForm
      v-else
      v-model="gridModel"
      data-testid="antd-layout-grid-form"
      :field-span="12"
      :fields="gridFields"
      gap="16px"
      :layout-attrs="{ id: 'antd-layout-grid' }"
      @submit="submitGrid"
    >
      <template #default="{ submit }">
        <div class="config-form-demo__actions">
          <AButton type="primary" data-testid="antd-layout-grid-submit" @click="submit">
            提交 grid
          </AButton>
        </div>
      </template>
    </AntdConfigForm>

    <pre class="config-form-demo__preview" data-testid="antd-layout-preview">{{ submittedText }}</pre>
  </section>
</template>
