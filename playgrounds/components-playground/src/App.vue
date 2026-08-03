<script setup lang="ts">
import type { Component } from 'vue'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

interface ExampleMeta {
  name: string
  title: string
  category: string
  description: string
  order: number
}

interface ExampleModule {
  default: Component
  exampleMeta: ExampleMeta
}

interface ExampleItem extends ExampleMeta {
  component: Component
}

interface ExampleGroup {
  category: string
  examples: ExampleItem[]
}

const exampleModules = import.meta.glob<ExampleModule>([
  './examples/*.vue',
  './examples/*/index.vue',
], { eager: true })

const examples = Object
  .values(exampleModules)
  .map((module): ExampleItem => ({
    ...module.exampleMeta,
    component: module.default,
  }))
  .sort((current, next) => current.order - next.order)

const searchQuery = ref('')
const activeExampleName = shallowRef<string | null>(null)

function groupExamples(items: ExampleItem[]): ExampleGroup[] {
  const groups = new Map<string, ExampleItem[]>()

  items.forEach((example) => {
    const groupExamples = groups.get(example.category)

    if (groupExamples) {
      groupExamples.push(example)
      return
    }

    groups.set(example.category, [example])
  })

  return Array.from(groups, ([category, groupItems]) => ({
    category,
    examples: groupItems,
  }))
}

const allExampleGroups = groupExamples(examples)

const exampleGroups = computed<ExampleGroup[]>(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  const visibleExamples = examples.filter((example) => {
    const searchableText = [
      example.title,
      example.name,
      example.category,
      example.description,
    ].join(' ').toLocaleLowerCase()

    return !query || searchableText.includes(query)
  })

  return groupExamples(visibleExamples)
})

const visibleExampleCount = computed(() => {
  return exampleGroups.value.reduce((count, group) => count + group.examples.length, 0)
})

const activeExample = computed<ExampleItem | undefined>(() => {
  return examples.find(example => example.name === activeExampleName.value)
})

function syncExampleFromHash(): void {
  const name = decodeURIComponent(window.location.hash.replace(/^#\/?/, ''))
  activeExampleName.value = examples.some(example => example.name === name) ? name : null
}

function openExample(name: string): void {
  window.location.hash = `/${encodeURIComponent(name)}`
}

function showOverview(): void {
  window.history.pushState(null, '', window.location.pathname + window.location.search)
  activeExampleName.value = null
}

onMounted(() => {
  syncExampleFromHash()
  window.addEventListener('hashchange', syncExampleFromHash)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncExampleFromHash)
})
</script>

<template>
  <div class="components-playground">
    <template v-if="!activeExample">
      <header class="overview-header">
        <button class="brand" type="button" aria-label="返回组件总览" @click="showOverview">
          <span class="brand__mark">M</span>
          <span>Components</span>
        </button>
        <span class="overview-header__meta">Vue Component Playground</span>
      </header>

      <main class="overview">
        <section class="overview-hero">
          <p class="overview-hero__eyebrow">
            COMPONENT LIBRARY
          </p>
          <h1 class="overview-hero__title">
            组件总览
          </h1>
          <p class="overview-hero__description">
            浏览并体验组件示例，快速找到适合当前场景的实现。
          </p>

          <label class="overview-search">
            <span class="overview-search__icon" aria-hidden="true" />
            <input
              v-model="searchQuery"
              type="search"
              placeholder="搜索组件名称、分类或功能"
              aria-label="搜索组件"
              autofocus
            >
            <span class="overview-search__count">{{ visibleExampleCount }} 个组件</span>
          </label>
        </section>

        <div v-if="exampleGroups.length" class="overview-groups">
          <section v-for="group in exampleGroups" :key="group.category" class="overview-group">
            <div class="overview-group__heading">
              <h2>{{ group.category }}</h2>
              <span>{{ group.examples.length }}</span>
            </div>

            <div class="component-grid" role="menu" :aria-label="`${group.category} 组件`">
              <button
                v-for="example in group.examples"
                :key="example.name"
                class="component-card"
                type="button"
                role="menuitem"
                :aria-label="example.title"
                @click="openExample(example.name)"
              >
                <span class="component-card__topline">
                  <span class="component-card__icon">{{ example.title.slice(0, 1).toUpperCase() }}</span>
                  <span class="component-card__arrow" aria-hidden="true">→</span>
                </span>
                <strong>{{ example.title }}</strong>
                <span class="component-card__description">{{ example.description }}</span>
              </button>
            </div>
          </section>
        </div>

        <div v-else class="overview-empty">
          <span class="overview-empty__icon" aria-hidden="true">⌕</span>
          <h2>没有找到相关组件</h2>
          <p>试试搜索其他名称、分类或功能关键词。</p>
          <button type="button" @click="searchQuery = ''">
            清除搜索
          </button>
        </div>
      </main>
    </template>

    <ElContainer v-else class="detail-layout">
      <ElAside class="detail-sidebar" width="252px">
        <button class="brand brand--sidebar" type="button" @click="showOverview">
          <span class="brand__mark">M</span>
          <span>Components</span>
        </button>

        <button class="overview-link" type="button" @click="showOverview">
          <span aria-hidden="true">←</span>
          组件总览
        </button>

        <ElMenu
          class="detail-menu"
          :default-openeds="allExampleGroups.map(group => group.category)"
          :default-active="activeExampleName || undefined"
          @select="openExample"
        >
          <ElSubMenu
            v-for="group in allExampleGroups"
            :key="group.category"
            :index="group.category"
          >
            <template #title>
              <span>{{ group.category }}</span>
            </template>
            <ElMenuItem
              v-for="example in group.examples"
              :key="example.name"
              :index="example.name"
            >
              {{ example.title }}
            </ElMenuItem>
          </ElSubMenu>
        </ElMenu>
      </ElAside>

      <ElMain class="detail-main">
        <nav class="detail-breadcrumb" aria-label="面包屑">
          <button type="button" @click="showOverview">
            组件
          </button>
          <span>/</span>
          <span>{{ activeExample.title }}</span>
        </nav>

        <header class="detail-header">
          <p>{{ activeExample.category }}</p>
          <h1>{{ activeExample.title }}</h1>
          <div>{{ activeExample.description }}</div>
        </header>

        <section class="detail-stage">
          <component :is="activeExample.component" />
        </section>
      </ElMain>
    </ElContainer>
  </div>
</template>

<style scoped lang="scss">
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  margin: 0;
}

:global(button),
:global(input) {
  font: inherit;
}

.components-playground {
  min-height: 100vh;
  color: var(--el-text-color-primary);
  background: #fff;
}

.overview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 clamp(24px, 5vw, 72px);
  border-bottom: 1px solid #ebeef5;
}

.brand {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  padding: 0;
  border: 0;
  color: #1f2329;
  font-size: 16px;
  font-weight: 650;
  background: transparent;
  cursor: pointer;
}

.brand__mark {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 9px;
  color: #fff;
  font-size: 14px;
  font-weight: 750;
  background: #409eff;
}

.overview-header__meta {
  color: #909399;
  font-size: 13px;
}

.overview {
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
  padding: 76px 0 96px;
}

.overview-hero {
  max-width: 720px;
  margin-bottom: 64px;
}

.overview-hero__eyebrow {
  margin: 0 0 14px;
  color: #409eff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.overview-hero__title {
  margin: 0;
  font-size: clamp(36px, 5vw, 52px);
  font-weight: 650;
  letter-spacing: -0.04em;
  line-height: 1.15;
}

.overview-hero__description {
  margin: 18px 0 32px;
  color: #606266;
  font-size: 17px;
  line-height: 1.75;
}

.overview-search {
  display: flex;
  align-items: center;
  width: min(100%, 620px);
  height: 52px;
  padding: 0 17px;
  border: 1px solid #dcdfe6;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 28px rgb(31 35 41 / 7%);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.overview-search:focus-within {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgb(64 158 255 / 12%), 0 8px 28px rgb(31 35 41 / 7%);
}

.overview-search__icon {
  position: relative;
  flex: 0 0 auto;
  width: 17px;
  height: 17px;
  margin-right: 12px;
  border: 2px solid #909399;
  border-radius: 50%;
}

.overview-search__icon::after {
  position: absolute;
  right: -5px;
  bottom: -3px;
  width: 6px;
  height: 2px;
  border-radius: 2px;
  background: #909399;
  content: '';
  transform: rotate(45deg);
}

.overview-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  color: #303133;
  font-size: 15px;
  background: transparent;
}

.overview-search input::placeholder {
  color: #a8abb2;
}

.overview-search__count {
  flex: 0 0 auto;
  margin-left: 16px;
  color: #a8abb2;
  font-size: 12px;
}

.overview-groups {
  display: grid;
  gap: 52px;
}

.overview-group__heading {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 18px;
}

.overview-group__heading h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.overview-group__heading span {
  display: grid;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  place-items: center;
  border-radius: 11px;
  color: #909399;
  font-size: 12px;
  background: #f2f3f5;
}

.component-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.component-card {
  display: flex;
  min-height: 188px;
  flex-direction: column;
  align-items: stretch;
  padding: 24px;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  color: inherit;
  text-align: left;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.component-card:hover,
.component-card:focus-visible {
  border-color: #a0cfff;
  outline: 0;
  box-shadow: 0 12px 32px rgb(31 35 41 / 8%);
  transform: translateY(-2px);
}

.component-card__topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.component-card__icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 9px;
  color: #337ecc;
  font-size: 16px;
  font-weight: 700;
  background: #ecf5ff;
}

.component-card__arrow {
  color: #c0c4cc;
  font-size: 20px;
  transition: color 0.2s, transform 0.2s;
}

.component-card:hover .component-card__arrow {
  color: #409eff;
  transform: translateX(3px);
}

.component-card strong {
  margin-bottom: 9px;
  font-size: 16px;
  font-weight: 600;
}

.component-card__description {
  display: -webkit-box;
  overflow: hidden;
  color: #606266;
  font-size: 13px;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.overview-empty {
  padding: 72px 24px;
  border: 1px dashed #dcdfe6;
  border-radius: 12px;
  text-align: center;
  background: #fafafa;
}

.overview-empty__icon {
  color: #c0c4cc;
  font-size: 42px;
}

.overview-empty h2 {
  margin: 12px 0 8px;
  font-size: 18px;
}

.overview-empty p {
  margin: 0 0 20px;
  color: #909399;
}

.overview-empty button {
  padding: 8px 15px;
  border: 1px solid #409eff;
  border-radius: 6px;
  color: #409eff;
  background: #fff;
  cursor: pointer;
}

.detail-layout {
  min-height: 100vh;
  background: #f7f8fa;
}

.detail-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  border-right: 1px solid #e4e7ed;
  background: #fff;
}

.brand--sidebar {
  width: 100%;
  height: 64px;
  padding: 0 22px;
  border-bottom: 1px solid #ebeef5;
}

.overview-link {
  display: flex;
  gap: 9px;
  align-items: center;
  width: calc(100% - 24px);
  margin: 14px 12px 8px;
  padding: 9px 12px;
  border: 0;
  border-radius: 7px;
  color: #606266;
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.overview-link:hover {
  color: #409eff;
  background: #ecf5ff;
}

.detail-menu {
  border-right: 0;
}

.detail-main {
  min-width: 0;
  padding: 30px clamp(24px, 4vw, 56px) 56px;
}

.detail-breadcrumb {
  display: flex;
  gap: 9px;
  align-items: center;
  max-width: 1120px;
  margin: 0 auto 30px;
  color: #a8abb2;
  font-size: 13px;
}

.detail-breadcrumb button {
  padding: 0;
  border: 0;
  color: #606266;
  background: transparent;
  cursor: pointer;
}

.detail-breadcrumb button:hover {
  color: #409eff;
}

.detail-header {
  max-width: 1120px;
  margin: 0 auto 24px;
}

.detail-header p {
  margin: 0 0 8px;
  color: #409eff;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.detail-header h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.detail-header div {
  max-width: 760px;
  margin-top: 12px;
  color: #606266;
  line-height: 1.7;
}

.detail-stage {
  max-width: 1120px;
  overflow-x: auto;
  margin: 0 auto;
  padding: 28px;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 4px 18px rgb(31 35 41 / 4%);
}

@media (max-width: 900px) {
  .component-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .overview-header {
    height: 58px;
    padding: 0 18px;
  }

  .overview-header__meta {
    display: none;
  }

  .overview {
    width: calc(100% - 32px);
    padding: 48px 0 64px;
  }

  .overview-hero {
    margin-bottom: 44px;
  }

  .overview-search__count {
    display: none;
  }

  .component-grid {
    grid-template-columns: 1fr;
  }

  .component-card {
    min-height: 170px;
  }

  .detail-layout {
    display: block;
  }

  .detail-sidebar {
    position: static;
    width: 100% !important;
    height: auto;
    border-right: 0;
    border-bottom: 1px solid #e4e7ed;
  }

  .brand--sidebar {
    height: 58px;
  }

  .detail-menu {
    display: none;
  }

  .detail-main {
    padding: 24px 16px 40px;
  }

  .detail-breadcrumb {
    margin-bottom: 22px;
  }

  .detail-header h1 {
    font-size: 27px;
  }

  .detail-stage {
    padding: 18px;
  }

  .detail-stage :deep(.date-range-example .el-form-item) {
    display: block;
  }

  .detail-stage :deep(.date-range-example .el-form-item__label) {
    width: auto !important;
    height: auto;
    margin-bottom: 8px;
    line-height: 1.5;
  }

  .detail-stage :deep(.date-range-example .el-form-item__content),
  .detail-stage :deep(.date-range-example [data-testid^='date-range-']),
  .detail-stage :deep(.date-range-example .el-date-editor) {
    width: 100%;
    min-width: 0;
  }
}
</style>
