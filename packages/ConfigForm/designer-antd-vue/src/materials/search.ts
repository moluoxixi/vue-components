import { defineDesignerMaterialModule } from '@moluoxixi/config-form-designer'
import * as s from '../material-shared'

export default defineDesignerMaterialModule({
  name: 'search',
  order: 30,
  value: {
    material: {
      key: 'antd.search',
      source: s.antdSource('text', 'a-input-search'),
      version: 1,
      kind: 'field',
      title: 'Search',
      category: 'Fields',
      icon: s.SearchIcon,
      runtime: {
        component: s.Input.Search,
        ...s.valueBinding,
        readonlyProp: 'readonly',
        readonlyRender: s.renderAntdVueRawReadonly,
      },
      setters: [
        s.defaultValueSetter('text'),
        s.placeholderSetter,
        s.allowClearSetter,
        s.propSetter('enterButton', 'Search button', 'boolean'),
      ],
      createNode: ({ id, field = 'search' }) => ({
        id,
        kind: 'field',
        material: 'antd.search',
        field,
        label: 'Search',
        props: { placeholder: '', enterButton: false },
      }),
    },
    locale: {
      title: '搜索框',
      category: '字段',
      setters: { defaultValue: '默认值', placeholder: '占位文本', allowClear: '可清空', enterButton: '搜索按钮' },
    },
  },
})
