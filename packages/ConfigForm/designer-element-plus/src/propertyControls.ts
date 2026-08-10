import type { DesignerPropertyControlRegistry } from '@moluoxixi/config-form-designer'

export const ELEMENT_PLUS_DESIGNER_PROPERTY_CONTROLS: DesignerPropertyControlRegistry = {
  text: { component: 'text' },
  textarea: { component: 'textarea' },
  number: { component: 'number' },
  boolean: { component: 'boolean' },
  select: { component: 'segmented' },
}
