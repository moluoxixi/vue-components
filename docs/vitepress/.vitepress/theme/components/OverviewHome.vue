<script setup lang="ts">
import { ArrowRight, BookOpen } from '@lucide/vue'
import { withBase } from 'vitepress'
import { documentedComponents } from '../../component-manifest'
import ComponentOverview from './ComponentOverview.vue'

const logoSrc = withBase('/logo.svg')
const gettingStartedHref = withBase('/guide/getting-started.html')
</script>

<template>
  <main class="overview-page">
    <header class="overview-header">
      <div class="overview-brand-lockup">
        <img :src="logoSrc" width="56" height="56" alt="MX Components">
        <div>
          <p class="overview-kicker">Vue 3 Component Library</p>
          <h1>MX Components</h1>
        </div>
      </div>
      <p class="overview-intro">
        基于 Element Plus 的业务组件库，覆盖高频表单、数据展示与内容编辑场景。
      </p>
      <div class="overview-actions">
        <a class="overview-action is-primary" :href="gettingStartedHref">
          <BookOpen :size="17" aria-hidden="true" />
          快速开始
        </a>
        <a class="overview-action" href="#component-catalog">
          浏览组件
          <ArrowRight :size="17" aria-hidden="true" />
        </a>
      </div>
    </header>

    <div class="overview-facts" aria-label="组件库概况">
      <div><strong>{{ documentedComponents.length }}</strong><span>组件文档</span></div>
      <div><strong>Vue 3.5</strong><span>运行基础</span></div>
      <div><strong>TypeScript</strong><span>完整契约</span></div>
      <div><strong>Element Plus</strong><span>视觉与交互</span></div>
    </div>

    <section id="component-catalog" class="overview-catalog">
      <div class="overview-catalog-heading">
        <p>Component Overview</p>
        <h2>组件总览</h2>
      </div>
      <ComponentOverview />
    </section>
  </main>
</template>
