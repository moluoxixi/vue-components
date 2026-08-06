import { defineComponent } from 'vue'

export const ConfigTableRenderNode = defineComponent({
  name: 'ConfigTableRenderNode',
  props: {
    params: { type: Object, required: true },
    render: { type: Function, required: true },
  },
  setup(props) {
    return () => (props.render as (params: any) => any)(props.params)
  },
})
