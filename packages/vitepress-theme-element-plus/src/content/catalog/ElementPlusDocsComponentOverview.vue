<script setup lang="ts">
import type { ElementPlusDocsOverviewMessages } from '../types'
import type { ElementPlusDocsCatalogGroup } from './types'
import { Search } from '@lucide/vue'
import { ElEmpty, ElInput } from 'element-plus'
import { computed, ref } from 'vue'
import { provideDocsUi } from '../../runtime/provide-docs-ui'
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
provideDocsUi()
</script>

<template>
  <div data-docs-ui class="component-overview">
    <div class="component-overview-search">
      <ElInput
        v-model="query"
        :prefix-icon="Search"
        :placeholder="props.messages.searchPlaceholder"
        :aria-label="props.messages.searchAria"
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

    <ElEmpty v-else class="component-overview-empty" :description="props.messages.noResults" />
  </div>
</template>

<style scoped>
.component-overview {
  margin-top: 24px;
}

.component-overview-search {
  position: sticky;
  top: 60px;
  z-index: 1;
  max-width: 520px;
  margin: 0 0 28px;
  padding: 8px 0;
  background: var(--ep-docs-bg-color);
}

.component-overview-empty {
  margin: 32px 0;
}

.overview-group + .overview-group {
  margin-top: 34px;
}

.overview-group-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--ep-docs-mx-border-light);
}

.overview-group-heading h2,
.overview-group-heading h2 {
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--ep-docs-text-color);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0;
}

.overview-group-heading p {
  margin: 4px 0 0;
  color: var(--ep-docs-text-color-lighter);
  font-size: 12px;
  line-height: 1.5;
}

.overview-group-heading > span {
  color: var(--ep-docs-text-color-lighter);
  font-family: var(--ep-docs-font-family-mono);
  font-size: 12px;
}
</style>
