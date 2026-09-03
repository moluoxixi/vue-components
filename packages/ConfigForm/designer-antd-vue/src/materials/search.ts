import {
  defineDesignerFieldMaterial,
  defineDesignerMaterialModule,
} from '@moluoxixi/config-form-designer'
import * as s from './shared'

export default defineDesignerMaterialModule({
  name: 'search',
  order: 30,
  value: {
    material: defineDesignerFieldMaterial({
      key: 'antd.search',
      source: s.antdSource('text', 'a-input-search'),
      title: 'Search',
      category: 'Fields',
      icon: s.SearchIcon,
      component: s.Input.Search,
      runtime: {
        ...s.valueBinding,
        readonlyProp: 'readonly',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      events: [{ name: 'search', title: 'Search' }],
      value: { kind: 'text' },
      props: {
        placeholder: { label: 'Placeholder', control: 'text', default: '' },
        allowClear: { label: 'Allow clear', control: 'boolean' },
        enterButton: { label: 'Search button', control: 'boolean', default: false },
      },
    }),
    locale: {
      title: '搜索框',
      category: '字段',
      setters: { defaultValue: '默认值', placeholder: '占位文本', allowClear: '可清空', enterButton: '搜索按钮' },
    },
  },
})
