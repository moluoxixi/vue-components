<script setup lang="ts">
import { computed } from 'vue'
import {
  componentContributorIds,
  contributorProfiles,
} from '../../doc-contributors'

const props = defineProps<{
  name: string
}>()

const contributors = computed(() => (componentContributorIds[props.name] ?? [])
  .map(id => contributorProfiles[id])
  .filter(contributor => contributor !== undefined))
</script>

<template>
  <ul v-if="contributors.length" class="doc-contributors" :aria-label="`${name} 文档贡献者`">
    <li v-for="contributor in contributors" :key="contributor.id">
      <span class="doc-contributor-avatar" aria-hidden="true">{{ contributor.initials }}</span>
      <span class="doc-contributor-copy">
        <strong>{{ contributor.displayName }}</strong>
        <span>{{ contributor.role }}</span>
      </span>
    </li>
  </ul>
  <p v-else class="doc-contributors-empty">
    暂无贡献记录
  </p>
</template>
