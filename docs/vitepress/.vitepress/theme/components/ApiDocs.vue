<script setup lang="ts">
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

const sectionMeta: Array<{ key: ApiSectionType, label: string }> = [
  { key: 'props', label: 'Props' },
  { key: 'emits', label: 'Emits' },
  { key: 'slots', label: 'Slots' },
  { key: 'expose', label: 'Expose' },
]

const api = apiByName[props.name]
if (!api)
  throw new Error(`Missing generated API contract: ${props.name}`)

const sections = sectionMeta.filter(section => api[section.key].length > 0)
</script>

<template>
  <div class="api-docs">
    <section v-for="section in sections" :key="section.key" class="api-docs-section">
      <h3 :id="`${name}-${section.key}`" tabindex="-1">
        {{ section.label }}
        <a
          class="header-anchor"
          :href="`#${name}-${section.key}`"
          :aria-label="`${section.label} 的永久链接`"
        >&#8203;</a>
      </h3>
      <ApiTable :data="api[section.key]" :type="section.key" />
    </section>
    <p v-if="sections.length === 0" class="api-docs-empty">
      该组件没有公开的组件契约。
    </p>
  </div>
</template>
