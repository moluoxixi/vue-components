<script setup lang="ts">
import { computed } from 'vue'
import {
  componentContributors,
  contributorProfiles,
} from '../../doc-contributors'

const props = defineProps<{
  name: string
}>()

const contributors = computed(() => (componentContributors[props.name] ?? [])
  .map((contribution) => {
    const profile = contributorProfiles[contribution.login]
    return profile ? { ...profile, contributions: contribution.contributions } : undefined
  })
  .filter(contributor => contributor !== undefined))
</script>

<template>
  <ul v-if="contributors.length" class="doc-contributors" :aria-label="`${name} 文档贡献者`">
    <li v-for="contributor in contributors" :key="contributor.login">
      <ElTooltip
        :trigger="['hover', 'focus']"
        :enterable="true"
        :show-after="120"
        :hide-after="100"
        placement="top"
        effect="dark"
        popper-class="doc-contributor-tooltip"
        :teleported="true"
      >
        <template #content>
          <span class="doc-contributor-tooltip-content">
            <strong>{{ contributor.name }}</strong>
            <span>GitHub @{{ contributor.login }}</span>
            <span>为 {{ name }} 贡献 {{ contributor.contributions }} 次提交</span>
          </span>
        </template>
        <a
          class="doc-contributor-link"
          :href="contributor.profileUrl"
          target="_blank"
          rel="noreferrer"
          :aria-label="`${contributor.name}，GitHub @${contributor.login}，为 ${name} 贡献 ${contributor.contributions} 次提交`"
        >
          <img
            class="doc-contributor-avatar"
            :src="contributor.avatarUrl"
            width="40"
            height="40"
            alt=""
            loading="lazy"
            decoding="async"
          >
        </a>
      </ElTooltip>
    </li>
  </ul>
  <p v-else class="doc-contributors-empty">
    暂无贡献记录
  </p>
</template>
