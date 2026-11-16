<script setup lang="ts">
import { ArrowRight, BookOpen, Boxes, CodeXml, PanelsTopLeft } from '@lucide/vue'
import { withBase } from 'vitepress'
import { computed } from 'vue'
import { docsSite } from '../../site/config'
import { useDocsLocale } from '../composables'
import { docsContent } from '../integration'

const { locale, link } = useDocsLocale()
const ComponentOverview = docsContent.components.ComponentOverview

const copy = computed(() => locale.value === 'en-US'
  ? {
      title: 'Your component workspace',
      intro: 'Design a form, explore the docs, or try an idea. Everything starts here.',
      navLabel: 'Workspace applications',
      catalog: 'Component catalog',
      catalogIntro: 'Find the component you need, then explore its examples and API.',
      allDocs: 'Browse documentation',
      source: 'View source on GitHub',
      entries: [
        { title: 'ConfigForm Designer', label: 'DESIGN', description: 'Create a project, design your forms visually, preview the result, and export your work.', action: 'Open designer' },
        { title: 'Component documentation', label: 'DOCS', description: 'Explore component examples, props, events, and integration guides.', action: 'Read the docs' },
        { title: 'Component playground', label: 'EXAMPLES', description: 'Try the components in action and explore their interactive examples.', action: 'Explore examples' },
        { title: 'Vue Playground', label: 'CODE', description: 'Edit Vue single-file components and see your changes in the live preview.', action: 'Start coding' },
      ],
    }
  : {
      title: '组件与设计工作台',
      intro: '设计表单、查阅文档、验证组件。从这里，开始你的下一步。',
      navLabel: '工作台应用入口',
      catalog: '组件总览',
      catalogIntro: '找到需要的组件，查看使用示例与 API。',
      allDocs: '查看全部文档',
      source: '在 GitHub 查看源码',
      entries: [
        { title: 'ConfigForm 设计器', label: 'DESIGN', description: '创建项目，可视化设计表单，预览效果并导出成果。', action: '进入设计器' },
        { title: '组件库文档', label: 'DOCS', description: '查阅组件用法、属性与事件，结合示例快速接入项目。', action: '阅读文档' },
        { title: '组件演示', label: 'EXAMPLES', description: '体验组件的实际交互，浏览不同场景下的运行示例。', action: '打开组件演示' },
        { title: 'Vue Playground', label: 'CODE', description: '在线编辑 Vue 单文件组件，实时预览代码运行效果。', action: '开始编写代码' },
      ],
    })

const destinations = [
  { id: 'designer', icon: PanelsTopLeft, path: '/config-form-playground/designer.html#/projects', application: true },
  { id: 'docs', icon: BookOpen, path: '/components/', application: false },
  { id: 'examples', icon: Boxes, path: '/components-playground/', application: true },
  { id: 'playground', icon: CodeXml, path: '/vue-playground/', application: true },
] as const

const entries = computed(() => destinations.map((destination, index) => ({
  ...destination,
  ...copy.value.entries[index],
  href: destination.application ? withBase(destination.path) : link(destination.path),
})))
</script>

<template>
  <div data-docs-ui class="site-home">
    <header class="workspace-header">
      <div class="workspace-brand">
        <img :src="withBase(docsSite.logo.src)" width="32" height="32" :alt="docsSite.logo.alt">
        <span>{{ docsSite.siteTitle }}</span>
        <span class="workspace-brand-divider" aria-hidden="true" />
        <span class="workspace-kicker">WORKSPACE</span>
      </div>
      <h1>{{ copy.title }}</h1>
      <p class="workspace-intro">
        {{ copy.intro }}
      </p>
      <div class="workspace-technologies" aria-label="Vue 3, TypeScript, Element Plus">
        <span>Vue 3</span>
        <span>TypeScript</span>
        <span>Element Plus</span>
      </div>
    </header>

    <nav class="workspace-grid" :aria-label="copy.navLabel">
      <a
        v-for="entry in entries"
        :key="entry.id"
        class="workspace-card"
        :class="{ 'workspace-card-featured': entry.id === 'designer' }"
        :href="entry.href"
        :target="entry.application ? '_self' : undefined"
        :data-no-router="entry.application ? '' : undefined"
      >
        <div class="workspace-card-top">
          <span class="workspace-card-icon">
            <component :is="entry.icon" :size="25" :stroke-width="1.6" aria-hidden="true" />
          </span>
          <span class="workspace-card-label">{{ entry.label }}</span>
        </div>
        <h2>{{ entry.title }}</h2>
        <p>{{ entry.description }}</p>
        <span class="workspace-card-action">
          {{ entry.action }}
          <ArrowRight :size="17" aria-hidden="true" />
        </span>
      </a>
    </nav>

    <section id="component-catalog" class="workspace-catalog" aria-labelledby="catalog-title">
      <div class="workspace-section-heading">
        <div>
          <h2 id="catalog-title">
            {{ copy.catalog }}
          </h2>
          <p>{{ copy.catalogIntro }}</p>
        </div>
        <a :href="link('/components/')" class="workspace-inline-link">
          {{ copy.allDocs }}
          <ArrowRight :size="16" aria-hidden="true" />
        </a>
      </div>
      <ComponentOverview />
    </section>

    <footer class="workspace-footer">
      <span>MX Components</span>
      <a href="https://github.com/moluoxixi/vue-components" target="_blank" rel="noreferrer" class="workspace-inline-link">
        <CodeXml :size="16" aria-hidden="true" />
        {{ copy.source }}
      </a>
    </footer>
  </div>
</template>

<style scoped>
.site-home {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: 56px 0 32px;
  color: var(--ep-docs-text-color);
}

.workspace-header {
  margin-bottom: 32px;
}

.workspace-brand {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
}

.workspace-brand img {
  border-radius: 7px;
}

.workspace-brand-divider {
  width: 1px;
  height: 15px;
  margin: 0 2px;
  background: var(--ep-docs-mx-border);
}

.workspace-kicker {
  color: var(--ep-docs-text-color-lighter);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1.4px;
}

.workspace-header h1 {
  margin: 24px 0 14px;
  font-size: clamp(30px, 4vw, 44px);
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.5px;
}

.workspace-intro {
  margin: 0;
  color: var(--ep-docs-text-color-light);
  font-size: 16px;
  line-height: 1.8;
}

.workspace-technologies {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;
}

.workspace-technologies span {
  padding: 3px 9px;
  border: 1px solid var(--ep-docs-mx-border-light);
  border-radius: 4px;
  color: var(--ep-docs-text-color-lighter);
  font-size: 11px;
  line-height: 1.6;
}

.workspace-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.workspace-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  padding: 24px;
  border: 1px solid var(--ep-docs-mx-border);
  border-radius: 10px;
  background: var(--ep-docs-bg-color);
  color: var(--ep-docs-text-color);
  text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.workspace-card-featured {
  border-color: color-mix(in srgb, var(--ep-docs-brand-color) 44%, var(--ep-docs-mx-border));
  background: color-mix(in srgb, var(--ep-docs-brand-color) 5%, var(--ep-docs-bg-color));
}

.workspace-card:hover {
  border-color: var(--ep-docs-brand-color);
  box-shadow: 0 5px 18px color-mix(in srgb, var(--ep-docs-brand-color) 9%, transparent);
  text-decoration: none;
}

.site-home a:focus-visible {
  outline: 2px solid var(--ep-docs-brand-color);
  outline-offset: 4px;
}

.workspace-card-top {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.workspace-card-icon {
  display: flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ep-docs-mx-border-light);
  border-radius: 9px;
  color: var(--ep-docs-brand-color);
}

.workspace-card-label {
  color: var(--ep-docs-text-color-lighter);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
}

.workspace-card h2 {
  margin: 23px 0 10px;
  padding: 0;
  border: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.5;
}

.workspace-card p {
  flex: 1;
  margin: 0;
  color: var(--ep-docs-text-color-light);
  font-size: 13px;
  line-height: 1.8;
}

.workspace-card-action {
  display: inline-flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 26px;
  color: var(--ep-docs-brand-color);
  font-size: 13px;
  font-weight: 600;
}

.workspace-catalog {
  margin-top: 56px;
  padding-top: 32px;
  border-top: 1px solid var(--ep-docs-mx-border-light);
  scroll-margin-top: 80px;
}

.workspace-section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.workspace-section-heading h2 {
  margin: 0;
  padding: 0;
  border: 0;
  font-size: 24px;
  font-weight: 600;
}

.workspace-section-heading p {
  margin: 8px 0 0;
  color: var(--ep-docs-text-color-light);
  font-size: 13px;
  line-height: 1.7;
}

.workspace-inline-link {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 7px;
  color: var(--ep-docs-brand-color);
  font-size: 13px;
  text-decoration: none;
}

.workspace-inline-link:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.workspace-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--ep-docs-mx-border-light);
  color: var(--ep-docs-text-color-lighter);
  font-size: 12px;
}

@media (max-width: 1080px) {
  .workspace-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 639px) {
  .site-home {
    width: calc(100% - 32px);
    padding-top: 32px;
  }

  .workspace-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .workspace-card {
    padding: 20px;
  }

  .workspace-card h2 {
    margin-top: 18px;
  }

  .workspace-section-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .workspace-catalog {
    margin-top: 36px;
    padding-top: 26px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-card {
    transition: none;
  }
}
</style>
