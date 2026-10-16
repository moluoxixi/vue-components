<script setup lang="ts">
import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form-headless'
import type { SurfaceNode } from '@moluoxixi/config-form-model'
import type { Component } from 'vue'
import type { VisualStyleField } from '../../../../inspector'
import type { DesignerPropertySetterDefinition } from '../../../../registry'
import type { DesignerPropertyFormEntry } from '../../types'
import { ChevronDown } from '@lucide/vue'
import { computed, markRaw } from 'vue'
import {
  isVisualStyleEditable,
  parseVisualStyleValue,
  readVisualStyle,
  VISUAL_STYLE_GROUPS,
  visualStyleValues,
} from '../../../../inspector'
import { useDesignerLocale } from '../../../../locale'
import DesignerPropertyForm from '../DesignerPropertyForm/index.vue'
import { DesignerVisualStyleSetter } from './components'

const props = defineProps<{
  nodes: readonly SurfaceNode[]
  renderer: Component
  components?: ConfigFormComponentRegistry
  identity?: string
  readonly?: boolean
  query?: string
}>()
const emit = defineEmits<{ update: [key: string, value: string | undefined] }>()
const locale = useDesignerLocale()
const styleControl = markRaw(DesignerVisualStyleSetter)
const unsupported = computed(() => props.nodes.some(node => !isVisualStyleEditable(node)))
const disabled = computed(() => props.readonly || unsupported.value || props.nodes.length === 0)
const identity = computed(() => props.identity ?? JSON.stringify(props.nodes.map(node => [node.id, node.component, node.kind])))

function entry(field: VisualStyleField): DesignerPropertyFormEntry {
  const current = visualStyleValues(props.nodes, field.key)
  const label = locale.t(`visual.${field.key}`, field.label)
  const placeholder = current.mixed
    ? locale.t('visual.mixed', 'Mixed')
    : field.control === 'length'
      ? field.allowPercentage === false ? 'px / rem / em' : field.allowAuto ? 'auto / px / %' : 'px / % / rem'
      : locale.t('visual.default', 'Default')
  return {
    setter: { key: field.key, label, path: ['props', 'style', field.key], control: 'custom' },
    value: current.mixed || (typeof current.value !== 'string' && typeof current.value !== 'number') ? undefined : current.value,
    mixed: current.mixed,
    sourceValues: props.nodes.map(node => readVisualStyle(node, field.key)),
    span: field.control === 'color' ? 2 : 1,
    editor: {
      control: {
        component: styleControl,
        trigger: 'update:modelValue',
        props: {
          field,
          label,
          placeholder,
          canReset: props.nodes.some(node => isVisualStyleEditable(node)
            && (node.props.style as Record<string, unknown> | undefined)?.[field.key] !== undefined),
        },
      },
      commitOn: 'explicit',
      parse: (value) => {
        const parsed = parseVisualStyleValue(field, value)
        return parsed.valid ? parsed : {
          valid: false,
          message: locale.t('visual.invalidLength', 'Use a number with px, %, rem, em, vw or vh.'),
        }
      },
    },
  }
}

const groups = computed(() => {
  const query = props.query?.trim().toLocaleLowerCase()
  return VISUAL_STYLE_GROUPS.map(group => ({
    key: group.key,
    label: locale.t(`visual.group.${group.key}`, group.label),
    entries: group.fields.filter(field => !query || [
      locale.t(`visual.${field.key}`, field.label),
      locale.t(`visual.group.${group.key}`, group.label),
      locale.t('visual.title', 'Design'),
    ].some(label => label.toLocaleLowerCase().includes(query))).map(entry),
  })).filter(group => group.entries.length > 0)
})

function commit(value: unknown, setter: DesignerPropertySetterDefinition): void {
  emit('update', setter.key, value as string | undefined)
}
</script>

<template>
  <section v-if="groups.length" class="mx-config-form-designer__visual-style" data-visual-style>
    <header class="mx-config-form-designer__visual-heading">
      <strong>{{ locale.t('visual.title', 'Design') }}</strong>
      <span>{{ locale.t('visual.allViewports', 'All viewports') }}</span>
    </header>
    <p v-if="unsupported" class="mx-config-form-designer__visual-notice" role="status" data-visual-style-restricted>
      {{ locale.t('visual.unsupported', 'This selection contains styles controlled outside this panel. Visual editing is unavailable to preserve them.') }}
    </p>
    <template v-else>
      <p class="mx-config-form-designer__visual-scope">
        {{ locale.t('visual.scope', 'Styles apply to the component root at every viewport size. Clear a value to restore its default.') }}
      </p>
      <details v-for="group in groups" :key="group.key" :open="['size', 'spacing'].includes(group.key) || !!query" :data-visual-group="group.key">
        <summary><ChevronDown :size="13" aria-hidden="true" />{{ group.label }}</summary>
        <DesignerPropertyForm
          :entries="group.entries"
          :renderer="renderer"
          :components="components"
          :readonly="disabled"
          :identity="identity"
          :columns="2"
          gap="8px"
          class="mx-config-form-designer__visual-form"
          @commit="commit"
        />
      </details>
    </template>
  </section>
</template>
