<script setup lang="ts">
import type { ElementPlusDocsOverviewMessages } from '../types'
import type { ElementPlusDocsCatalogGroup } from './types'
import { Search } from '@lucide/vue'
import { ElEmpty, ElInput } from 'element-plus'
import { computed, ref } from 'vue'
import ElementPlusDocsOverviewCard from './ElementPlusDocsOverviewCard.vue'

const props = defineProps<{
  groups: readonly ElementPlusDocsCatalogGroup[]
  messages: ElementPlusDocsOverviewMessages
}>()

const query = ref('')
const normalizedQuery = computed(() => query.value.trim().toLowerCase().replace(/-/g, ' '))

function matchesQuery(value: string): boolean {
  return value.toLowerCase().replace(/-/g, ' ').includes(normalizedQuery.value)
}

const filteredGroups = computed(() => {
  if (!normalizedQuery.value)
    return props.groups

  return props.groups
    .map(group => ({
      ...group,
      items: group.items.filter(item =>
        matchesQuery(group.title)
        || matchesQuery(group.description)
        || matchesQuery(item.name)
        || matchesQuery(item.desc)),
    }))
    .filter(group => group.items.length > 0)
})
</script>

<template>
  <div class="component-overview">
    <div class="component-overview-search">
      <ElInput
        v-model="query"
        :prefix-icon="Search"
        :placeholder="messages.searchPlaceholder"
        :aria-label="messages.searchAria"
        clearable
        size="large"
      />
    </div>

    <template v-if="filteredGroups.length">
      <section v-for="group in filteredGroups" :key="group.title" class="overview-group">
        <div class="overview-group-heading">
          <div>
            <h2>{{ group.title }}</h2>
            <p>{{ group.description }}</p>
          </div>
          <span>{{ group.items.length }}</span>
        </div>
        <ElementPlusDocsOverviewCard :items="group.items" />
      </section>
    </template>

    <ElEmpty v-else class="component-overview-empty" :description="messages.noResults" />
  </div>
</template>
