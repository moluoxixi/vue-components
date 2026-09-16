import type { DesignerPropertyControlRegistry } from '@moluoxixi/config-form-designer'
import { ElementDefaultValueSetter } from '../materials/components'

/**
 * Simple property controls (text / textarea / number / boolean / select) are
 * fixed to Element Plus inside the designer core; provider adapters no longer
 * re-register them. Only provider-specific controls stay here.
 */
export const ELEMENT_PLUS_DESIGNER_PROPERTY_CONTROLS: DesignerPropertyControlRegistry = {
  defaultValue: { component: ElementDefaultValueSetter },
}
