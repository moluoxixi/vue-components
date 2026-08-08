<script setup lang="ts">
import type { Component } from 'vue'
import { ElementPlusDocsOverviewCard } from '@moluoxixi/vitepress-theme-element-plus'
import { computed, ref } from 'vue'
import type { ComponentIconName } from '../../component-manifest'
import {
  Blocks,
  CalendarRange,
  Copy,
  FilePenLine,
  FormInput,
  GitBranch,
  ListFilter,
  PanelTopOpen,
  Rows3,
  ScanText,
  Search,
  TableProperties,
  TextCursorInput,
  TreePine,
} from '@lucide/vue'
import { getLocalizedComponentGroups } from '../../docs-i18n'
import { docsRoutePath } from '../../docs-site'
import { useDocsLocale } from '../composables/use-docs-locale'

const iconByName: Record<ComponentIconName, Component> = {
  'blocks': Blocks,
  'calendar-range': CalendarRange,
  'copy': Copy,
  'file-pen-line': FilePenLine,
  'form-input': FormInput,
  'git-branch': GitBranch,
  'list-filter': ListFilter,
  'panel-top-open': PanelTopOpen,
  'rows-3': Rows3,
  'scan-text': ScanText,
  'table-properties': TableProperties,
  'text-cursor-input': TextCursorInput,
  'tree-pine': TreePine,
}

const { link, locale, messages } = useDocsLocale()
const groups = computed(() => getLocalizedComponentGroups(locale.value).map(group => ({
  ...group,
  items: group.items.map(component => ({
    name: component.name,
    desc: component.description,
    link: link(docsRoutePath('components', `${component.slug}.html`)),
    icon: iconByName[component.icon],
  })),
})))

const query = ref('')
const normalizedQuery = computed(() => query.value.trim().toLowerCase().replace(/-/g, ' '))

function matchesQuery(value: string): boolean {
  return value.toLowerCase().replace(/-/g, ' ').includes(normalizedQuery.value)
}

const filteredGroups = computed(() => {
  const value = normalizedQuery.value
  if (!value)
    return groups.value

  return groups.value
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
      <el-input
        v-model="query"
        :prefix-icon="Search"
        :placeholder="messages.overview.searchPlaceholder"
        :aria-label="messages.overview.searchAria"
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

    <el-empty v-else class="component-overview-empty" :description="messages.overview.noResults" />
  </div>
</template>
