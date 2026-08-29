<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import WorkbenchShell from './app/WorkbenchShell.vue'
import { provideWorkbenchController } from './app/workbench-context'

const props = defineProps<{
  locale?: DesignerLocaleOptions
}>()

provideWorkbenchController(props)
</script>

<template>
  <WorkbenchShell />
</template>
