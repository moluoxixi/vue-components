<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { WorkspaceTemplate } from '../../project'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, useTemplateRef } from 'vue'
import { useWorkbenchDialogFocus } from '../../components/use-dialog-focus'

const props = defineProps<{
  busy?: boolean
  locale?: DesignerLocaleOptions
  open: boolean
  templates: WorkspaceTemplate[]
}>()

const emit = defineEmits<{
  close: []
  select: [templateId: string]
}>()

const dialog = useTemplateRef<HTMLElement>('dialog')
const locale = computed(() => createDesignerLocale(props.locale))
const { handleKeydown } = useWorkbenchDialogFocus(
  () => props.open,
  dialog,
  () => emit('close'),
)
</script>

<template>
  <div v-if="open" class="template-overlay" @click.self="emit('close')">
    <section ref="dialog" role="dialog" aria-modal="true" aria-labelledby="template-dialog-title" @keydown="handleKeydown">
      <header>
        <h2 id="template-dialog-title">
          {{ locale.t('template.newPage', 'New page') }}
        </h2>
        <button type="button" @click="emit('close')">
          {{ locale.t('template.close', 'Close') }}
        </button>
      </header>
      <div class="template-list">
        <button
          v-for="template in templates"
          :key="template.id"
          type="button"
          :disabled="busy"
          @click="emit('select', template.id)"
        >
          <strong>{{ template.title }}</strong>
          <span>{{ template.adapter }}</span>
        </button>
      </div>
    </section>
  </div>
</template>
