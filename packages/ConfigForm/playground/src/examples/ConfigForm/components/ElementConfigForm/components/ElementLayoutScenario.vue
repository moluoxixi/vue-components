<script setup lang="ts">
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ElementKnownValues } from '../types'
import { defineFields } from '@moluoxixi/config-form-headless'
import { ElementConfigForm } from '@moluoxixi/config-form-element'
import { ElButton, ElSwitch } from 'element-plus'
import { computed, shallowRef } from 'vue'
import { createElementKnownFields, createElementKnownValues } from '../services'
import { ElementStressScenario } from './ElementLayoutScenario/components'

type LayoutMode = 'inline' | 'grid'

const { defineField } = defineFields<ElementKnownValues>()
const layoutMode = shallowRef<LayoutMode>('inline')
const modeLabel = computed(() => layoutMode.value)
const inlineModel = shallowRef<ElementKnownValues>(createElementKnownValues('inline'))
const gridModel = shallowRef<ElementKnownValues>(createElementKnownValues('grid'))
const inlineSubmitted = shallowRef<Partial<ElementKnownValues>>({})
const gridSubmitted = shallowRef<Partial<ElementKnownValues>>({})
const inlineFields = createElementKnownFields('element-inline', true, defineField)
const gridFields = createElementKnownFields('element-grid', true, defineField)
const submittedText = computed(() => JSON.stringify({
  grid: gridSubmitted.value,
  inline: inlineSubmitted.value,
}, null, 2))

function submitInline(values: ConfigFormValues): void {
  inlineSubmitted.value = values as ElementKnownValues
}

function submitGrid(values: ConfigFormValues): void {
  gridSubmitted.value = values as ElementKnownValues
}
</script>

<template>
  <section class="config-form-demo__section" data-testid="element-layout-scenario">
    <div class="config-form-demo__toolbar">
      <span class="config-form-demo__mode" data-testid="element-layout-mode-label">{{ modeLabel }}</span>
      <ElSwitch
        v-model="layoutMode"
        active-text="grid"
        active-value="grid"
        data-testid="element-layout-mode-switch"
        inactive-text="inline"
        inactive-value="inline"
      />
    </div>

    <ElementConfigForm
      v-if="layoutMode === 'inline'"
      v-model="inlineModel"
      data-testid="element-layout-inline"
      :field-span="12"
      :fields="inlineFields"
      inline
      :layout-attrs="{ id: 'element-layout-inline-row' }"
      @submit="submitInline"
    >
      <template #default="{ submit }">
        <div class="config-form-demo__actions">
          <ElButton type="primary" data-testid="element-layout-inline-submit" @click="submit">
            提交 inline
          </ElButton>
        </div>
      </template>
    </ElementConfigForm>

    <ElementConfigForm
      v-else
      v-model="gridModel"
      data-testid="element-layout-grid-form"
      :field-span="12"
      :fields="gridFields"
      gap="16px"
      :layout-attrs="{ id: 'element-layout-grid' }"
      @submit="submitGrid"
    >
      <template #default="{ submit }">
        <div class="config-form-demo__actions">
          <ElButton type="primary" data-testid="element-layout-grid-submit" @click="submit">
            提交 grid
          </ElButton>
        </div>
      </template>
    </ElementConfigForm>

    <pre class="config-form-demo__preview" data-testid="element-layout-preview">{{ submittedText }}</pre>
    <ElementStressScenario />
  </section>
</template>
