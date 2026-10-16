<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { useDesignerLocale } from '../../../../locale'

defineProps<{
  groups: readonly { key: string, label: string }[]
  unsupported?: boolean
  query?: string
}>()
const locale = useDesignerLocale()
</script>

<template>
  <section v-if="groups.length" class="mx-config-form-designer__visual-style" data-visual-style>
    <header class="mx-config-form-designer__visual-heading">
      <strong>{{ locale.t('visual.title', 'Design') }}</strong>
      <span>{{ locale.t('visual.allViewports', 'All viewports') }}</span>
    </header>
    <p v-if="unsupported" class="mx-config-form-designer__visual-notice" role="status" data-visual-style-restricted>
      {{ locale.t('visual.unsupported', 'This selection contains styles controlled outside this panel. Visual editing is unavailable to preserve them.') }}
    </p>
    <template v-else>
      <p class="mx-config-form-designer__visual-scope">
        {{ locale.t('visual.scope', 'Styles apply to the component root at every viewport size. Clear a value to restore its default.') }}
      </p>
      <details v-for="group in groups" :key="group.key" :open="['size', 'spacing'].includes(group.key) || !!query" :data-visual-group="group.key">
        <summary><ChevronDown :size="13" aria-hidden="true" />{{ group.label }}</summary>
        <slot :name="group.key" />
      </details>
    </template>
  </section>
</template>
