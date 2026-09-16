import type { DesignerPropertyControlRegistry } from '../../../registry'
import { ElInput, ElInputNumber, ElSegmented, ElSwitch } from 'element-plus'

/**
 * Designer chrome is fixed to Element Plus. The property pane renders the
 * designer's own controls — not the designed form — so simple setter controls
 * never adapt to the canvas provider (Element Plus / Ant Design Vue). Hosts
 * may still override any entry through the `controls` prop or registry
 * layers; these entries are the guaranteed floor.
 */
export const DEFAULT_DESIGNER_PROPERTY_CONTROLS: DesignerPropertyControlRegistry = {
  text: { component: ElInput, trigger: 'update:modelValue' },
  textarea: { component: ElInput, props: { type: 'textarea' }, trigger: 'update:modelValue' },
  number: { component: ElInputNumber, trigger: 'change' },
  boolean: { component: ElSwitch, trigger: 'change' },
  select: { component: ElSegmented, props: { block: true }, trigger: 'change' },
}
