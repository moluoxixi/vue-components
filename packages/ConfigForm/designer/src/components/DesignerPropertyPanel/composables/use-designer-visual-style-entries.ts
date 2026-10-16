import type { SurfaceNode } from '@moluoxixi/config-form-model'
import type { DesignerPropertyFormEntry, DesignerPropertyFormLayout } from '../types'
import { computed, markRaw } from 'vue'
import {
  isVisualStyleEditable,
  parseVisualStyleValue,
  readVisualStyle,
  VISUAL_STYLE_GROUPS,
  visualStyleValues,
} from '../../../inspector'
import { useDesignerLocale } from '../../../locale'
import DesignerVisualStyleEditor from '../components/DesignerVisualStyleEditor/index.vue'
import DesignerVisualStyleSetter from '../components/DesignerVisualStyleSetter/index.vue'

export function useDesignerVisualStyleEntries(options: {
  nodes: () => readonly SurfaceNode[]
  readonly: () => boolean | undefined
  query: () => string | undefined
  update: (key: string, value: string | undefined) => void
}) {
  const locale = useDesignerLocale()
  const styleControl = markRaw(DesignerVisualStyleSetter)
  const unsupported = computed(() => options.nodes().some(node => !isVisualStyleEditable(node)))
  const groups = computed(() => VISUAL_STYLE_GROUPS.map(group => ({
    key: group.key,
    label: locale.t(`visual.group.${group.key}`, group.label),
    entries: group.fields.map((field): DesignerPropertyFormEntry => {
      const nodes = options.nodes()
      const current = visualStyleValues(nodes, field.key)
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
        sourceValues: nodes.map(node => readVisualStyle(node, field.key)),
        readonly: options.readonly() || unsupported.value || nodes.length === 0,
        onCommit: value => options.update(field.key, value as string | undefined),
        span: field.control === 'color' ? 2 : 1,
        editor: {
          control: {
            component: styleControl,
            trigger: 'update:modelValue',
            props: {
              field,
              label,
              placeholder,
              canReset: nodes.some(node => isVisualStyleEditable(node)
                && (node.props.style as Record<string, unknown> | undefined)?.[field.key] !== undefined),
            },
          },
          commitOn: 'explicit',
          parse: (value) => {
            const parsed = parseVisualStyleValue(field, value)
            return parsed.valid
              ? parsed
              : {
                  valid: false,
                  message: locale.t('visual.invalidLength', 'Use a number with px, %, rem, em, vw or vh.'),
                }
          },
        },
      }
    }),
  })))
  const entries = computed(() => groups.value.flatMap(group => group.entries))
  const visibleGroups = computed(() => {
    const query = options.query()?.trim().toLocaleLowerCase()
    return groups.value.map(group => ({
      ...group,
      entries: group.entries.filter(entry => !query || [
        entry.setter.label,
        group.label,
        locale.t('visual.title', 'Design'),
      ].some(label => label.toLocaleLowerCase().includes(query))),
    })).filter(group => group.entries.length > 0)
  })
  const layout: DesignerPropertyFormLayout = field => [{
    id: 'visual-style',
    component: markRaw(DesignerVisualStyleEditor),
    props: { key: 'visual-style', groups: visibleGroups.value, unsupported: unsupported.value, query: options.query() },
    slots: Object.fromEntries(visibleGroups.value.map(group => [group.key, {
      id: `visual-style-${group.key}`,
      component: 'div',
      props: { key: `visual-style-${group.key}`, class: 'mx-config-form-designer__visual-form mx-config-form-designer__property-grid is-visual' },
      slots: { default: group.entries.map(field) },
    }])),
  }]
  return { entries, layout }
}
