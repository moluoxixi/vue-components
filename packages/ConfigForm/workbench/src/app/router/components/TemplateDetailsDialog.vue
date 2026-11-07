<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { TemplateDetails } from '../../../features/templates'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, ref, useTemplateRef, watch } from 'vue'
import ControlHint from '../../../components/ControlHint.vue'
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
const busyReason = computed(() => props.busy ? locale.value.t('library.busyReason', 'A template operation is in progress. Try again when it finishes.') : undefined)
const submitReason = computed(() => busyReason.value || (!name.value.trim() ? locale.value.t('library.nameRequired', 'Enter a template name to continue.') : undefined))
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
    :model-value="props.modelValue"
    :title="props.withTypes ? locale.t('library.new', 'New template') : locale.t('pages.saveTemplate', 'Save as template')"
    width="min(580px, calc(var(--wb-viewport-width) - 24px))"
    align-center
    append-to="#workbench-overlays"
    :close-on-click-modal="false"
    :close-on-press-escape="!props.busy"
    :show-close="!props.busy"
    @update:model-value="!props.busy && emit('update:modelValue', $event)"
    @opened="nameInput?.focus()"
  >
    <form class="template-details-form" @submit.prevent="submit">
      <div class="template-details-fields">
        <label>
          <span>{{ locale.t('library.name', 'Template name') }}</span>
          <ControlHint class="w-full" :reason="busyReason">
            <ElInput ref="nameInput" v-model="name" maxlength="100" :disabled="props.busy" :aria-label="locale.t('library.name', 'Template name')" :placeholder="locale.t('library.namePlaceholder', 'For example, customer information')" />
          </ControlHint>
        </label>
        <template v-if="props.withTypes">
          <fieldset>
            <legend>{{ locale.t('library.kind', 'Template type') }}</legend>
            <div class="template-kind-options">
              <ControlHint v-for="item in kinds" :key="item.value" class="w-full" :reason="busyReason">
                <ElButton :class="{ 'is-selected': kind === item.value }" :aria-pressed="kind === item.value" :disabled="props.busy" @click="kind = item.value">
                  <img :src="createPagePreviewDataUrl(createBlankTemplate(adapter, item.value).surface)" alt="">
                  <span>{{ item.label }}</span>
                </ElButton>
              </ControlHint>
            </div>
          </fieldset>
          <label>
            <span>{{ locale.t('library.adapter', 'Component library') }}</span>
            <ControlHint class="w-full" :reason="busyReason">
              <ElSegmented v-model="adapter" block :disabled="props.busy" :aria-label="locale.t('library.adapter', 'Component library')" :options="[{ label: 'Element Plus', value: 'element-plus' }, { label: 'Ant Design Vue', value: 'antd-vue' }]" />
            </ControlHint>
          </label>
        </template>
        <label>
          <span>{{ locale.t('library.description', 'Description') }} <small>{{ locale.t('library.optional', 'Optional') }}</small></span>
          <ControlHint class="w-full" :reason="busyReason">
            <ElInput v-model="description" type="textarea" :rows="2" maxlength="300" :disabled="props.busy" :aria-label="locale.t('library.description', 'Description')" />
          </ControlHint>
        </label>
        <p class="template-details-hint">
          {{ props.withTypes ? locale.t('library.createHint', 'Continue to the designer to build your reusable template.') : locale.t('library.saveHint', 'Save an independent copy to your template library for other projects.') }}
        </p>
        <ElAlert v-if="props.error" type="error" :closable="false" :title="props.error" role="alert" />
      </div>
      <footer>
        <ControlHint :reason="busyReason">
          <ElButton :disabled="props.busy" @click="emit('update:modelValue', false)">
            {{ locale.t('action.cancel', 'Cancel') }}
          </ElButton>
        </ControlHint>
        <ControlHint :reason="submitReason">
          <ElButton native-type="submit" type="primary" :loading="props.busy" :disabled="Boolean(submitReason)">
            {{ props.withTypes ? locale.t('library.startDesign', 'Start designing') : locale.t('library.save', 'Save template') }}
          </ElButton>
        </ControlHint>
      </footer>
    </form>
  </ElDialog>
</template>

<style src="./TemplateDetailsDialog/style/index.css" scoped />
