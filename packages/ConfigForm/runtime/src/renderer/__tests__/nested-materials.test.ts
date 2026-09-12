import { ANTD_VUE_DESIGNER_MATERIAL_REGISTRY, createAntdVueDesignerRegistry } from '@moluoxixi/config-form-designer-antd-vue'
import { createElementPlusDesignerRegistry, ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY } from '@moluoxixi/config-form-designer-element-plus'
import { testNestedMaterials } from './nested-material-suite'

testNestedMaterials({
  prefix: 'element', createRegistry: createElementPlusDesignerRegistry,
  capabilities: ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY, inputSelector: 'input.el-input__inner',
})
testNestedMaterials({
  prefix: 'antd', createRegistry: createAntdVueDesignerRegistry,
  capabilities: ANTD_VUE_DESIGNER_MATERIAL_REGISTRY, inputSelector: 'input.ant-input',
})
