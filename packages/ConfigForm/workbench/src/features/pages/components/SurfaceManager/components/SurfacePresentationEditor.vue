<script setup lang="ts">
import type {
  DeepReadonly,
  ProjectDialogSurface,
  ProjectDrawerSurface,
} from '@moluoxixi/config-form-model'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, ref, watch } from 'vue'
import { cloneWorkbenchJson } from '../../../../../utils'

type OverlaySurface = DeepReadonly<ProjectDialogSurface | ProjectDrawerSurface>
type OverlayPresentation = ProjectDialogSurface['presentation'] | ProjectDrawerSurface['presentation']

const props = defineProps<{
  disabled?: boolean
  locale?: DesignerLocaleOptions
  surface: OverlaySurface
}>()

const emit = defineEmits<{
  cancel: []
  save: [presentation: OverlayPresentation]
}>()

const locale = computed(() => createDesignerLocale(props.locale))
const draft = ref<OverlayPresentation>(cloneWorkbenchJson(props.surface.presentation) as OverlayPresentation)
const units = ['px', '%', 'rem', 'vw', 'vh'] as const
const placements = ['left', 'right', 'top', 'bottom'] as const

watch(() => props.surface.presentation, (presentation) => {
  draft.value = cloneWorkbenchJson(presentation) as OverlayPresentation
}, { deep: true })

const size = computed(() => draft.value.kind === 'dialog' ? draft.value.width : draft.value.size)

function ensureMobileSize(): void {
  size.value.mobile ??= { ...size.value.desktop }
}

function removeMobileSize(): void {
  delete size.value.mobile
}

function updateMask(enabled: boolean): void {
  draft.value.mask = enabled
  if (!enabled)
    draft.value.close.mask = false
}

function save(): void {
  emit('save', cloneWorkbenchJson(draft.value))
}
</script>

<template>
  <section class="surface-presentation-editor" :aria-label="locale.t('surface.presentation', 'Surface presentation')">
    <label class="surface-presentation-editor__wide">
      <span>{{ locale.t('surface.title', 'Title') }}</span>
      <ElInput v-model="draft.title" :disabled="disabled" />
    </label>
    <label v-if="draft.kind === 'drawer'">
      <span>{{ locale.t('surface.placement', 'Placement') }}</span>
      <ElSelect v-model="draft.placement" :disabled="disabled" append-to="#workbench-overlays">
        <ElOption v-for="placement in placements" :key="placement" :value="placement" :label="locale.t(`surface.placement.${placement}`, placement)" />
      </ElSelect>
    </label>
    <fieldset>
      <legend>{{ locale.t('surface.desktopSize', 'Desktop size') }}</legend>
      <ElInputNumber v-model="size.desktop.value" :disabled="disabled" :min="1" :max="10000" controls-position="right" />
      <ElSelect v-model="size.desktop.unit" :disabled="disabled" append-to="#workbench-overlays">
        <ElOption v-for="unit in units" :key="unit" :value="unit" :label="unit" />
      </ElSelect>
    </fieldset>
    <fieldset>
      <legend>{{ locale.t('surface.mobileSize', 'Mobile size') }}</legend>
      <template v-if="size.mobile">
        <ElInputNumber v-model="size.mobile.value" :disabled="disabled" :min="1" :max="10000" controls-position="right" />
        <ElSelect v-model="size.mobile.unit" :disabled="disabled" append-to="#workbench-overlays">
          <ElOption v-for="unit in units" :key="unit" :value="unit" :label="unit" />
        </ElSelect>
        <ElButton native-type="button" text :disabled="disabled" @click="removeMobileSize">{{ locale.t('surface.useDesktopSize', 'Use desktop') }}</ElButton>
      </template>
      <ElButton v-else native-type="button" :disabled="disabled" @click="ensureMobileSize">{{ locale.t('surface.addMobileSize', 'Add mobile size') }}</ElButton>
    </fieldset>
    <div class="surface-presentation-editor__switches surface-presentation-editor__wide">
      <label><span>{{ locale.t('surface.mask', 'Mask') }}</span><ElSwitch :model-value="draft.mask" :disabled="disabled" @update:model-value="value => updateMask(Boolean(value))" /></label>
      <label><span>{{ locale.t('surface.close.escape', 'Close with Escape') }}</span><ElSwitch v-model="draft.close.escape" :disabled="disabled" /></label>
      <label><span>{{ locale.t('surface.close.mask', 'Close from mask') }}</span><ElSwitch v-model="draft.close.mask" :disabled="disabled || !draft.mask" /></label>
      <label><span>{{ locale.t('surface.close.button', 'Show close button') }}</span><ElSwitch v-model="draft.close.button" :disabled="disabled" /></label>
    </div>
    <footer class="surface-presentation-editor__wide">
      <ElButton native-type="button" :disabled="disabled" @click="emit('cancel')">{{ locale.t('action.cancel', 'Cancel') }}</ElButton>
      <ElButton native-type="button" type="primary" :disabled="disabled" @click="save">{{ locale.t('action.apply', 'Apply') }}</ElButton>
    </footer>
  </section>
</template>

<style scoped>
.surface-presentation-editor {
  display: grid;
  padding: 12px;
  margin-top: 8px;
  grid-column: 1 / -1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  border: 1px solid var(--wb-separator);
  border-radius: 6px;
  background: var(--wb-surface);
}

.surface-presentation-editor label,
.surface-presentation-editor fieldset {
  display: grid;
  min-width: 0;
  padding: 0;
  margin: 0;
  gap: 6px;
  border: 0;
}

.surface-presentation-editor label > span,
.surface-presentation-editor legend {
  color: var(--wb-muted);
  font-size: 11px;
}

.surface-presentation-editor fieldset {
  grid-template-columns: minmax(0, 1fr) minmax(82px, 0.55fr) auto;
}

.surface-presentation-editor legend {
  grid-column: 1 / -1;
}

.surface-presentation-editor__wide {
  grid-column: 1 / -1;
}

.surface-presentation-editor__switches {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
}

.surface-presentation-editor__switches label {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.surface-presentation-editor footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 680px) {
  .surface-presentation-editor,
  .surface-presentation-editor__switches {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
