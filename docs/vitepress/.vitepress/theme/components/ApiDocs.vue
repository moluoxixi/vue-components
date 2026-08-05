<script setup lang="ts">
import ApiTable from './ApiTable.vue'
import type { ApiRow } from './ApiTable.vue'

type ApiSectionType = 'props' | 'emits' | 'expose' | 'slots'

interface ComponentApi {
  name: string
  description: string
  props: ApiRow[]
  emits: ApiRow[]
  expose: ApiRow[]
  slots: ApiRow[]
}

import { formatDocsMessage } from '../../docs-i18n'
import { useDocsLocale } from '../use-docs-locale'
import { computed } from 'vue'

const apiModules = import.meta.glob<ComponentApi>('../../api/*.json', {
  eager: true,
  import: 'default',
})

const apiByName = Object.fromEntries(
  Object.values(apiModules).map(api => [api.name, api]),
) as Record<string, ComponentApi>

const props = defineProps<{
  name: string
}>()

const { messages } = useDocsLocale()

const sectionMeta = computed<Array<{ key: ApiSectionType, label: string }>>(() => [
  { key: 'props', label: messages.value.api.sections.props },
  { key: 'emits', label: messages.value.api.sections.emits },
  { key: 'slots', label: messages.value.api.sections.slots },
  { key: 'expose', label: messages.value.api.sections.expose },
])

const api = apiByName[props.name]
if (!api)
  throw new Error(`Missing generated API contract: ${props.name}`)

const sections = computed(() => sectionMeta.value.filter(section => api[section.key].length > 0))
</script>

<template>
  <div class="api-docs">
    <section v-for="section in sections" :key="section.key" class="api-docs-section">
      <h3 :id="`${name}-${section.key}`" tabindex="-1">
        {{ section.label }}
        <a
          class="header-anchor"
          :href="`#${name}-${section.key}`"
          :aria-label="formatDocsMessage(messages.api.permanentLink, { section: section.label })"
        >&#8203;</a>
      </h3>
      <ApiTable :data="api[section.key]" :type="section.key" />
    </section>
    <p v-if="sections.length === 0" class="api-docs-empty">
      {{ messages.api.empty }}
    </p>
  </div>
</template>
