<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectTemplate } from '../../project'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'

const props = defineProps<{
  busy?: boolean
  locale?: DesignerLocaleOptions
  open: boolean
  templates: ProjectTemplate[]
}>()

const emit = defineEmits<{
  close: []
  select: [templateId: string]
}>()

const locale = computed(() => createDesignerLocale(props.locale))
</script>

<template>
  <ElDialog
    class="template-dialog"
    :model-value="open"
    :title="locale.t('template.newPage', 'New page')"
    width="min(760px, calc(100vw - 24px))"
    append-to="#workbench-overlays"
    transition="none"
    @close="emit('close')"
  >
    <section>
      <div class="template-list">
        <ElButton
          v-for="template in templates"
          :key="template.id"
          native-type="button"
          :disabled="busy"
          @click="emit('select', template.id)"
        >
          <strong>{{ template.title }}</strong>
          <span>{{ template.adapter }}</span>
        </ElButton>
      </div>
    </section>
  </ElDialog>
</template>
