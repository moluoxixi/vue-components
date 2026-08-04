<script setup lang="ts">
import type { Component } from 'vue'
import type { ComponentIconName } from '../../component-manifest'
import {
  CalendarRange,
  Copy,
  FilePenLine,
  GitBranch,
  ListFilter,
  PanelTopOpen,
  Rows3,
  ScanText,
  TableProperties,
  TextCursorInput,
  TreePine,
} from '@lucide/vue'
import { componentGroups } from '../../component-manifest'
import OverviewCard from './OverviewCard.vue'

const iconByName: Record<ComponentIconName, Component> = {
  'calendar-range': CalendarRange,
  'copy': Copy,
  'file-pen-line': FilePenLine,
  'git-branch': GitBranch,
  'list-filter': ListFilter,
  'panel-top-open': PanelTopOpen,
  'rows-3': Rows3,
  'scan-text': ScanText,
  'table-properties': TableProperties,
  'text-cursor-input': TextCursorInput,
  'tree-pine': TreePine,
}

const groups = componentGroups.map(group => ({
  ...group,
  items: group.items.map(component => ({
    name: component.name,
    desc: component.description,
    link: `/components/${component.slug}.html`,
    icon: iconByName[component.icon],
  })),
}))
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
