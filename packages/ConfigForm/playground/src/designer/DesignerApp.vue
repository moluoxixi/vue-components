<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import { ANTD_VUE_DESIGNER_ZH_CN } from '@moluoxixi/config-form-designer-antd-vue'
import { ELEMENT_PLUS_DESIGNER_ZH_CN } from '@moluoxixi/config-form-designer-element-plus'
import { ArrowLeft } from '@lucide/vue'
import { computed, ref, watchEffect } from 'vue'
import DesignerExample from './DesignerExample.vue'
import { getDesignerPageCopy } from './page-copy'
import type { DesignerAdapter } from './sample-document'

const language = ref<'zh-CN' | 'en-US'>('zh-CN')
const adapter = ref<DesignerAdapter>('element-plus')
const designerLocale = computed<DesignerLocaleOptions>(() => {
  if (language.value !== 'zh-CN')
    return { locale: 'en-US' }
  const adapterLocale = adapter.value === 'element-plus'
    ? ELEMENT_PLUS_DESIGNER_ZH_CN
    : ANTD_VUE_DESIGNER_ZH_CN
  return {
    locale: 'zh-CN',
    messages: ELEMENT_PLUS_DESIGNER_ZH_CN.messages,
    materials: adapterLocale.materials,
  }
})
const copy = computed(() => getDesignerPageCopy(language.value))

watchEffect(() => {
  document.documentElement.lang = language.value
})
</script>

<template>
  <main class="designer-app">
    <header class="designer-app__header">
      <div class="designer-app__identity">
        <span class="designer-app__eyebrow">ConfigForm</span>
        <h1>{{ copy.title }}</h1>
      </div>
      <div class="designer-app__actions">
        <div class="designer-app__framework" role="group" :aria-label="copy.framework">
          <span class="designer-app__control-label">{{ copy.framework }}</span>
          <button type="button" :aria-pressed="adapter === 'element-plus'" @click="adapter = 'element-plus'">{{ copy.elementPlus }}</button>
          <button type="button" :aria-pressed="adapter === 'antd-vue'" @click="adapter = 'antd-vue'">{{ copy.antDesignVue }}</button>
        </div>
        <div class="designer-app__language" role="group" :aria-label="copy.language">
          <span class="designer-app__control-label">{{ copy.language }}</span>
          <button type="button" :aria-pressed="language === 'zh-CN'" @click="language = 'zh-CN'">中文</button>
          <button type="button" :aria-pressed="language === 'en-US'" @click="language = 'en-US'">English</button>
        </div>
        <a class="designer-app__back" href="/">
          <ArrowLeft :size="15" aria-hidden="true" />
          <span>{{ copy.back }}</span>
        </a>
      </div>
    </header>
    <div class="designer-app__body">
      <DesignerExample :adapter="adapter" :locale="designerLocale" :show-header="false" :show-export-preview="false" />
    </div>
  </main>
</template>

<style>
:root {
  color: #17202a;
  background: #f3f6fa;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  min-width: 0;
  margin: 0;
}

button,
input,
textarea,
select {
  font: inherit;
}

.designer-app {
  display: flex;
  width: 100%;
  height: 100vh;
  min-height: 620px;
  flex-direction: column;
  overflow: hidden;
  background: #f3f6fa;
}

.designer-app__header {
  display: flex;
  min-width: 0;
  padding: 12px 20px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid #d9dee7;
  background: #fff;
}

.designer-app__identity {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 12px;
}

.designer-app__eyebrow {
  margin: 0;
  color: #2563eb;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.designer-app h1 {
  margin: 0;
  overflow: hidden;
  color: #17202a;
  font-size: 20px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.designer-app__actions {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.designer-app__framework,
.designer-app__language {
  display: flex;
  max-width: 100%;
  min-height: 32px;
  padding: 2px 3px 2px 8px;
  align-items: center;
  gap: 3px;
  color: #64748b;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
}

.designer-app__control-label {
  padding-inline: 2px 4px;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.designer-app__framework button,
.designer-app__language button {
  min-width: 0;
  min-height: 26px;
  padding: 0 8px;
  color: #475569;
  border: 0;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
}

.designer-app__framework button[aria-pressed="true"],
.designer-app__language button[aria-pressed="true"] {
  color: #1d4ed8;
  background: #eff6ff;
  font-weight: 650;
}

.designer-app__back {
  display: inline-flex;
  min-height: 32px;
  padding: 0 9px;
  align-items: center;
  gap: 5px;
  color: #334155;
  font-size: 13px;
  text-decoration: none;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
  white-space: nowrap;
}

.designer-app__back:hover {
  color: #2563eb;
  border-color: #93c5fd;
}

.designer-app__body {
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  flex: 1 1 auto;
  padding: 16px;
}

.designer-app__body > .designer-example {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

@media (max-width: 800px) {
  .designer-app__header {
    padding: 10px 12px;
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .designer-app__identity {
    align-items: center;
    gap: 8px;
  }

  .designer-app__actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .designer-app__framework {
    flex: 1 1 320px;
  }

  .designer-app__framework button {
    flex: 1 1 0;
  }

  .designer-app__language {
    flex: 1 1 210px;
  }

  .designer-app__body {
    padding: 8px;
  }
}
</style>
