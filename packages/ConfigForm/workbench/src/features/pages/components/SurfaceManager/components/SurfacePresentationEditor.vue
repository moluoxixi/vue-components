<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type {
  DeepReadonly,
  ProjectDialogSurface,
  ProjectDrawerSurface,
} from '@moluoxixi/config-form-model'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, ref, watch } from 'vue'
import ControlHint from '../../../../../components/ControlHint.vue'
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
const busyReason = computed(() => props.disabled ? locale.value.t('action.processing', 'An operation is in progress. Wait for it to finish.') : undefined)
const draft = ref<OverlayPresentation>(cloneWorkbenchJson(props.surface.presentation) as OverlayPresentation)
const maskReason = computed(() => busyReason.value || (!draft.value.mask ? locale.value.t('surface.maskRequired', 'Enable the mask before allowing clicks on it to close the surface.') : undefined))
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
      <ControlHint :reason="busyReason"><ElInput v-model="draft.title" :aria-label="locale.t('surface.title', 'Title')" :disabled="props.disabled" /></ControlHint>
    </label>
    <label v-if="draft.kind === 'drawer'">
      <span>{{ locale.t('surface.placement', 'Placement') }}</span>
      <ControlHint :reason="busyReason"><ElSelect v-model="draft.placement" :aria-label="locale.t('surface.placement', 'Placement')" :disabled="props.disabled" append-to="#workbench-overlays">
        <ElOption v-for="placement in placements" :key="placement" :value="placement" :label="locale.t(`surface.placement.${placement}`, placement)" />
      </ElSelect></ControlHint>
    </label>
    <fieldset>
      <legend>{{ locale.t('surface.desktopSize', 'Desktop size') }}</legend>
      <ControlHint :reason="busyReason">
        <ElInputNumber v-model="size.desktop.value" :aria-label="locale.t('surface.desktopSize', 'Desktop size')" :disabled="props.disabled" :min="1" :max="10000" controls-position="right" />
      </ControlHint>
      <ControlHint :reason="busyReason">
        <ElSelect v-model="size.desktop.unit" :aria-label="locale.t('surface.desktopUnit', 'Desktop size unit')" :disabled="props.disabled" append-to="#workbench-overlays">
          <ElOption v-for="unit in units" :key="unit" :value="unit" :label="unit" />
        </ElSelect>
      </ControlHint>
    </fieldset>
    <fieldset>
      <legend>{{ locale.t('surface.mobileSize', 'Mobile size') }}</legend>
      <template v-if="size.mobile">
        <ControlHint :reason="busyReason">
          <ElInputNumber v-model="size.mobile.value" :aria-label="locale.t('surface.mobileSize', 'Mobile size')" :disabled="props.disabled" :min="1" :max="10000" controls-position="right" />
        </ControlHint>
        <ControlHint :reason="busyReason">
          <ElSelect v-model="size.mobile.unit" :aria-label="locale.t('surface.mobileUnit', 'Mobile size unit')" :disabled="props.disabled" append-to="#workbench-overlays">
            <ElOption v-for="unit in units" :key="unit" :value="unit" :label="unit" />
          </ElSelect>
        </ControlHint>
        <ControlHint class="surface-presentation-size-action" :reason="busyReason">
          <ElButton native-type="button" text :disabled="props.disabled" @click="removeMobileSize">
            {{ locale.t('surface.useDesktopSize', 'Use desktop') }}
          </ElButton>
        </ControlHint>
      </template>
      <ControlHint v-else class="surface-presentation-size-action" :reason="busyReason">
        <ElButton native-type="button" :disabled="props.disabled" @click="ensureMobileSize">
          {{ locale.t('surface.addMobileSize', 'Add mobile size') }}
        </ElButton>
      </ControlHint>
    </fieldset>
    <div class="surface-presentation-editor__switches surface-presentation-editor__wide">
      <label><span>{{ locale.t('surface.mask', 'Mask') }}</span><ControlHint :reason="busyReason"><ElSwitch :model-value="draft.mask" :aria-label="locale.t('surface.mask', 'Mask')" :disabled="props.disabled" @update:model-value="value => updateMask(Boolean(value))" /></ControlHint></label>
      <label><span>{{ locale.t('surface.close.escape', 'Close with Escape') }}</span><ControlHint :reason="busyReason"><ElSwitch v-model="draft.close.escape" :aria-label="locale.t('surface.close.escape', 'Close with Escape')" :disabled="props.disabled" /></ControlHint></label>
      <label><span>{{ locale.t('surface.close.mask', 'Close from mask') }}</span><ControlHint :reason="maskReason"><ElSwitch v-model="draft.close.mask" :aria-label="locale.t('surface.close.mask', 'Close from mask')" :disabled="props.disabled || !draft.mask" /></ControlHint></label>
      <label><span>{{ locale.t('surface.close.button', 'Show close button') }}</span><ControlHint :reason="busyReason"><ElSwitch v-model="draft.close.button" :aria-label="locale.t('surface.close.button', 'Show close button')" :disabled="props.disabled" /></ControlHint></label>
    </div>
    <footer class="surface-presentation-editor__wide">
      <ControlHint :reason="busyReason">
        <ElButton native-type="button" :disabled="props.disabled" @click="emit('cancel')">
          {{ locale.t('action.cancel', 'Cancel') }}
        </ElButton>
      </ControlHint>
      <ControlHint :reason="busyReason">
        <ElButton native-type="button" type="primary" :disabled="props.disabled" @click="save">
          {{ locale.t('action.apply', 'Apply') }}
        </ElButton>
      </ControlHint>
    </footer>
  </section>
</template>

<style scoped>
@reference "../../../../../styles/tailwind.css";

.surface-presentation-editor {
  display: grid;
  @apply p-3 mt-2;
  grid-column: 1 / -1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  @apply gap-3;
  border: 1px solid var(--wb-separator);
  border-radius: 6px;
  background: var(--wb-surface);
}

.surface-presentation-editor label,
.surface-presentation-editor fieldset {
  display: grid;
  min-width: 0;
  @apply p-0 m-0 gap-1;
  border: 0;
}

.surface-presentation-editor label > span,
.surface-presentation-editor legend {
  color: var(--wb-muted);
  font-size: 12px;
}

.surface-presentation-editor fieldset {
  grid-template-columns: minmax(0, 1fr) minmax(72px, 0.55fr);
  align-items: center;
  @apply gap-1;
}

.surface-presentation-editor .el-input-number,
.surface-presentation-editor .el-select {
  width: 100%;
  min-width: 0;
}

.surface-presentation-editor fieldset > .surface-presentation-size-action {
  grid-column: 1 / -1;
  justify-self: start;
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
  @apply gap-y-2 gap-x-4;
}

.surface-presentation-editor__switches label {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  @apply gap-2;
}

.surface-presentation-editor footer {
  display: flex;
  justify-content: flex-end;
  @apply gap-2;
}

@media (max-width: 680px) {
  .surface-presentation-editor,
  .surface-presentation-editor__switches {
    grid-template-columns: minmax(0, 1fr);
  }
}
@container (max-width: 380px) {
  .surface-presentation-editor,
  .surface-presentation-editor__switches {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
