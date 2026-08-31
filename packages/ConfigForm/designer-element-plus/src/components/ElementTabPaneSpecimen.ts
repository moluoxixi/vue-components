import { ElTabPane, ElTabs } from 'element-plus'
import { defineComponent, h } from 'vue'

export default defineComponent({
  name: 'ElementTabPaneSpecimen',
  inheritAttrs: false,
  setup: (_props, { attrs, slots }) => () => {
    const name = typeof attrs.name === 'string' || typeof attrs.name === 'number'
      ? attrs.name
      : 'specimen'
    return h(ElTabs, {
      modelValue: name,
    }, {
      default: () => h(ElTabPane, { ...attrs, name }, slots),
    })
  },
})
