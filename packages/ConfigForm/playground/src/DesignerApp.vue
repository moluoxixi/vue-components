<script setup lang="ts">
import { ELEMENT_PLUS_DESIGNER_ZH_CN } from '@moluoxixi/config-form-designer-element-plus'
import { computed, ref, watchEffect } from 'vue'
import DesignerConfigForm from './examples/components/DesignerConfigForm.vue'

const language = ref<'zh-CN' | 'en-US'>('zh-CN')
const designerLocale = computed(() => language.value === 'zh-CN'
  ? ELEMENT_PLUS_DESIGNER_ZH_CN
  : { locale: 'en-US' })
const copy = computed(() => language.value === 'zh-CN'
  ? {
      title: '可视化表单设计器',
      description: '使用 Element Plus 物料编辑表单结构，预览与导出共用同一份 JSON 文档。',
      language: '语言',
      back: '返回 Playground',
    }
  : {
      title: 'Visual Form Designer',
      description: 'Build forms with Element Plus materials using one JSON document for editing, preview, and export.',
      language: 'Language',
      back: 'Back to Playground',
    })

watchEffect(() => {
  document.documentElement.lang = language.value
})
</script>

<template>
  <main class="designer-app">
    <header class="designer-app__header">
      <div>
        <p class="designer-app__eyebrow">ConfigForm</p>
        <h1>{{ copy.title }}</h1>
        <p>{{ copy.description }}</p>
      </div>
      <div class="designer-app__actions">
        <div class="designer-app__language" role="group" :aria-label="copy.language">
          <span class="designer-app__language-label">{{ copy.language }}</span>
          <button type="button" :aria-pressed="language === 'zh-CN'" @click="language = 'zh-CN'">中文</button>
          <button type="button" :aria-pressed="language === 'en-US'" @click="language = 'en-US'">English</button>
        </div>
        <a class="designer-app__back" href="/">{{ copy.back }}</a>
      </div>
    </header>
    <DesignerConfigForm :locale="designerLocale" :show-header="false" />
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
  width: min(1480px, 100%);
  min-height: 100vh;
  margin: 0 auto;
  padding: clamp(16px, 3vw, 36px);
}

.designer-app__header {
  display: flex;
  min-width: 0;
  margin-bottom: 20px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.designer-app__eyebrow {
  margin: 0 0 4px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.designer-app h1,
.designer-app p {
  margin: 0;
}

.designer-app h1 {
  font-size: 30px;
  line-height: 1.2;
}

.designer-app__header > div > p:last-child {
  max-width: 720px;
  margin-top: 8px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
}

.designer-app__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.designer-app__language {
  display: flex;
  height: 34px;
  padding: 2px 3px 2px 8px;
  align-items: center;
  gap: 3px;
  color: #64748b;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
}

.designer-app__language-label {
  padding-inline: 2px 4px;
  font-size: 12px;
  font-weight: 650;
}

.designer-app__language button {
  height: 28px;
  padding: 0 8px;
  color: #475569;
  border: 0;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
}

.designer-app__language button[aria-pressed="true"] {
  color: #1d4ed8;
  background: #eff6ff;
  font-weight: 650;
}

.designer-app__back {
  flex: 0 0 auto;
  padding: 8px 10px;
  color: #334155;
  font-size: 13px;
  text-decoration: none;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
}

.designer-app__back:hover {
  color: #2563eb;
  border-color: #93c5fd;
}

@media (max-width: 640px) {
  .designer-app__header {
    flex-direction: column;
  }

  .designer-app h1 {
    font-size: 24px;
  }

  .designer-app__actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .designer-app__back,
  .designer-app__language {
    align-self: flex-start;
  }
}
</style>
