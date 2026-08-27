<script setup lang="ts">
import type { RequestStatus } from '../state'
import type { SanitizedConfigResponse, ScanResponse } from '../../shared/protocol'
import { computed } from 'vue'
import { FolderSearch, Languages, Rows3 } from '@lucide/vue'

const props = defineProps<{
  config?: SanitizedConfigResponse
  scan?: ScanResponse
  status: RequestStatus
}>()

const totalKeys = computed(() => props.scan?.resources.reduce((total, resource) => total + resource.keyCount, 0) ?? 0)
</script>

<template>
  <section
    id="panel-resources"
    class="workspace-view resources-view"
    role="tabpanel"
    aria-labelledby="tab-resources"
    tabindex="0"
  >
    <header class="view-heading">
      <div>
        <h2 id="resources-heading">Resources</h2>
        <p>Configured locale files and translation coverage.</p>
      </div>
    </header>

    <div v-if="status === 'loading'" class="view-state" role="status">
      <el-skeleton :rows="5" animated />
    </div>

    <div v-else-if="status === 'error'" class="view-state is-error" role="alert">
      Resource scan failed.
    </div>

    <template v-else-if="config && scan">
      <div class="metrics-band" aria-label="Resource summary">
        <div class="metric">
          <FolderSearch :size="18" aria-hidden="true" />
          <span><strong>{{ scan.resources.length }}</strong> files</span>
        </div>
        <div class="metric">
          <Rows3 :size="18" aria-hidden="true" />
          <span><strong>{{ totalKeys }}</strong> messages</span>
        </div>
        <div class="metric">
          <Languages :size="18" aria-hidden="true" />
          <span><strong>{{ config.resources.targetLocales.length }}</strong> targets</span>
        </div>
      </div>

      <section class="config-band" aria-labelledby="config-heading">
        <h3 id="config-heading">Configuration</h3>
        <dl class="config-grid">
          <div><dt>Source</dt><dd>{{ config.resources.sourceLocale }}</dd></div>
          <div><dt>Targets</dt><dd>{{ config.resources.targetLocales.join(', ') }}</dd></div>
          <div><dt>Layout</dt><dd>{{ config.resources.layout }}</dd></div>
          <div><dt>Pattern</dt><dd><code>{{ config.resources.localePattern }}</code></dd></div>
          <div><dt>Model</dt><dd>{{ config.ai.model }}</dd></div>
          <div><dt>Endpoint</dt><dd>{{ config.ai.baseUrl }}</dd></div>
        </dl>
      </section>

      <section class="resource-section" aria-labelledby="files-heading">
        <h3 id="files-heading">Locale files</h3>
        <div class="resource-table" role="table" aria-label="Locale resource files">
          <div class="resource-row resource-header" role="row">
            <span role="columnheader">File</span>
            <span role="columnheader">Locale</span>
            <span role="columnheader">Namespace</span>
            <span role="columnheader">Keys</span>
          </div>
          <div v-for="resource in scan.resources" :key="resource.resourceId" class="resource-row" role="row">
            <code role="cell">{{ resource.relativePath }}</code>
            <span role="cell">{{ resource.locale ?? 'multi-locale' }}</span>
            <span role="cell">{{ resource.namespace ?? 'default' }}</span>
            <span role="cell">{{ resource.keyCount }}</span>
          </div>
        </div>
      </section>

      <section class="coverage-section" aria-labelledby="coverage-heading">
        <h3 id="coverage-heading">Coverage</h3>
        <div class="coverage-grid">
          <article v-for="locale in config.resources.targetLocales" :key="locale" class="coverage-item">
            <strong>{{ locale }}</strong>
            <span>{{ scan.gaps[locale]?.missing ?? 0 }} missing</span>
            <span>{{ scan.gaps[locale]?.empty ?? 0 }} empty</span>
            <span>{{ scan.gaps[locale]?.existing ?? 0 }} translated</span>
          </article>
        </div>
      </section>
    </template>

    <div v-else class="view-state" role="status">No locale resources found.</div>
  </section>
</template>
