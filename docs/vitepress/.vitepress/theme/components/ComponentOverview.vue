<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'
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
  TableProperties,
  TextCursorInput,
  TreePine,
} from '@lucide/vue'
import { getLocalizedComponentGroups } from '../../docs-i18n'
import { docsRoutePath } from '../../docs-site'
import OverviewCard from './OverviewCard.vue'
import { useDocsLocale } from '../use-docs-locale'

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

const { link, locale } = useDocsLocale()
const groups = computed(() => getLocalizedComponentGroups(locale.value).map(group => ({
  ...group,
  items: group.items.map(component => ({
    name: component.name,
    desc: component.description,
    link: link(docsRoutePath('components', `${component.slug}.html`)),
    icon: iconByName[component.icon],
  })),
})))
</script>

<template>
  <div class="component-overview">
    <section v-for="group in groups" :key="group.title" class="overview-group">
      <div class="overview-group-heading">
        <div>
          <h2>{{ group.title }}</h2>
          <p>{{ group.description }}</p>
        </div>
        <span>{{ group.items.length }}</span>
      </div>
      <OverviewCard :items="group.items" />
    </section>
  </div>
</template>
