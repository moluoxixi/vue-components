<script setup lang="ts">
import type {
  ElementPlusDocsApiDocsMessages,
  ElementPlusDocsApiSection,
  ElementPlusDocsComponentApiContract,
} from './types'
import { computed } from 'vue'
import { formatElementPlusDocsMessage } from '../format-message'
import ElementPlusDocsApiTable from './ElementPlusDocsApiTable.vue'

const props = defineProps<{
  api: ElementPlusDocsComponentApiContract
  messages: ElementPlusDocsApiDocsMessages
}>()

const sectionMeta = computed<Array<{ key: ElementPlusDocsApiSection, label: string }>>(() => [
  { key: 'props', label: props.messages.sections.props },
  { key: 'emits', label: props.messages.sections.emits },
  { key: 'slots', label: props.messages.sections.slots },
  { key: 'expose', label: props.messages.sections.expose },
])
const sections = computed(() => sectionMeta.value.filter(section => props.api[section.key].length > 0))

function permanentLinkLabel(section: string): string {
  return formatElementPlusDocsMessage(props.messages.permanentLink, { section })
}
</script>

<template>
  <div data-docs-ui class="api-docs">
    <section v-for="section in sections" :key="section.key" class="api-docs-section">
      <h3 :id="`${props.api.name}-${section.key}`" tabindex="-1">
        {{ section.label }}
        <a
          class="header-anchor"
          :href="`#${props.api.name}-${section.key}`"
          :aria-label="permanentLinkLabel(section.label)"
        >&#8203;</a>
      </h3>
      <ElementPlusDocsApiTable
        :data="props.api[section.key]"
        :type="section.key"
        :messages="props.messages"
      />
    </section>
    <p v-if="sections.length === 0" class="api-docs-empty">
      {{ props.messages.empty }}
    </p>
  </div>
</template>

<style scoped>
.api-docs-section + .api-docs-section {
  margin-top: 28px;
}

.api-docs-empty {
  color: var(--ep-docs-text-color-lighter);
}
</style>
