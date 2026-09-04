import type { DesignerPropertyControlRegistry } from '@moluoxixi/config-form-designer'
import { ElementDefaultValueSetter } from '../materials/components'

export const ELEMENT_PLUS_DESIGNER_PROPERTY_CONTROLS: DesignerPropertyControlRegistry = {
  defaultValue: { component: ElementDefaultValueSetter },
  text: { component: 'text' },
  textarea: { component: 'textarea' },
  number: { component: 'number' },
  boolean: { component: 'boolean' },
  select: { component: 'segmented' },
}
