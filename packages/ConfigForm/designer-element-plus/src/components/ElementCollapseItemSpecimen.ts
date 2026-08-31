import { ElCollapse, ElCollapseItem } from 'element-plus'
import { defineComponent, h } from 'vue'

export default defineComponent({
  name: 'ElementCollapseItemSpecimen',
  inheritAttrs: false,
  setup: (_props, { attrs, slots }) => () => {
    const name = typeof attrs.name === 'string' || typeof attrs.name === 'number'
      ? attrs.name
      : 'specimen'
    return h(ElCollapse, {
      modelValue: [name],
    }, {
      default: () => h(ElCollapseItem, { ...attrs, name }, slots),
    })
  },
})
