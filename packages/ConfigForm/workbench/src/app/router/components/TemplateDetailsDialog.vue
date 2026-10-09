<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { TemplateDetails } from '../../../features/templates'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { createPagePreviewDataUrl } from '../../../features/pages'
import { createBlankTemplate } from '../../../project'

const props = defineProps<{
  modelValue: boolean
  busy?: boolean
  error?: string
  initialName?: string
  locale?: DesignerLocaleOptions
  withTypes?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean], 'confirm': [details: TemplateDetails] }>()
const locale = computed(() => createDesignerLocale(props.locale))
const name = ref('')
const description = ref('')
const adapter = ref<TemplateDetails['adapter']>('element-plus')
const kind = ref<TemplateDetails['kind']>('page')
const nameInput = useTemplateRef<{ focus: () => void }>('nameInput')
const kinds = computed(() => [
  { value: 'page' as const, label: locale.value.t('surface.kind.page', 'Page') },
  { value: 'dialog' as const, label: locale.value.t('surface.kind.dialog', 'Dialog') },
  { value: 'drawer' as const, label: locale.value.t('surface.kind.drawer', 'Drawer') },
])

watch(() => props.modelValue, (open) => {
  if (!open)
    return
  name.value = props.initialName ?? ''
  description.value = ''
  adapter.value = 'element-plus'
  kind.value = 'page'
}, { immediate: true })

function submit(): void {
  if (!name.value.trim() || props.busy)
    return
  emit('confirm', { name: name.value.trim(), description: description.value.trim(), adapter: adapter.value, kind: kind.value })
}
</script>

<template>
  <ElDialog
    class="template-details-dialog"
    :model-value="modelValue"
    :title="withTypes ? locale.t('library.new', 'New template') : locale.t('pages.saveTemplate', 'Save as template')"
    width="min(580px, calc(100vw - 24px))"
    align-center
    append-to="#workbench-overlays"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    :show-close="!busy"
    @update:model-value="!busy && emit('update:modelValue', $event)"
    @opened="nameInput?.focus()"
  >
    <form class="template-details-form" @submit.prevent="submit">
      <label>
        <span>{{ locale.t('library.name', 'Template name') }}</span>
        <ElInput ref="nameInput" v-model="name" maxlength="100" :disabled="busy" :aria-label="locale.t('library.name', 'Template name')" :placeholder="locale.t('library.namePlaceholder', 'For example, customer information')" />
      </label>
      <template v-if="withTypes">
        <fieldset>
          <legend>{{ locale.t('library.kind', 'Template type') }}</legend>
          <div class="template-kind-options">
            <ElButton v-for="item in kinds" :key="item.value" :class="{ 'is-selected': kind === item.value }" :aria-pressed="kind === item.value" :disabled="busy" @click="kind = item.value">
              <img :src="createPagePreviewDataUrl(createBlankTemplate(adapter, item.value).surface)" alt="">
              <span>{{ item.label }}</span>
            </ElButton>
          </div>
        </fieldset>
        <label>
          <span>{{ locale.t('library.adapter', 'Component library') }}</span>
          <ElSegmented v-model="adapter" block :disabled="busy" :aria-label="locale.t('library.adapter', 'Component library')" :options="[{ label: 'Element Plus', value: 'element-plus' }, { label: 'Ant Design Vue', value: 'antd-vue' }]" />
        </label>
      </template>
      <label>
        <span>{{ locale.t('library.description', 'Description') }} <small>{{ locale.t('library.optional', 'Optional') }}</small></span>
        <ElInput v-model="description" type="textarea" :rows="2" maxlength="300" :disabled="busy" :aria-label="locale.t('library.description', 'Description')" />
      </label>
      <p class="template-details-hint">
        {{ withTypes ? locale.t('library.createHint', 'Continue to the designer to build your reusable template.') : locale.t('library.saveHint', 'Save an independent copy to your template library for other projects.') }}
      </p>
      <ElAlert v-if="error" type="error" :closable="false" :title="error" role="alert" />
      <footer>
        <ElButton :disabled="busy" @click="emit('update:modelValue', false)">
          {{ locale.t('action.cancel', 'Cancel') }}
        </ElButton>
        <ElButton native-type="submit" type="primary" :loading="busy" :disabled="!name.trim()">
          {{ withTypes ? locale.t('library.startDesign', 'Start designing') : locale.t('library.save', 'Save template') }}
        </ElButton>
      </footer>
    </form>
  </ElDialog>
</template>

<style src="./TemplateDetailsDialog/style/index.css" scoped />
