import { createApp } from 'vue'
import DesignerApp from './DesignerApp.vue'
import 'ant-design-vue/dist/reset.css'
import 'element-plus/dist/index.css'
import '@moluoxixi/config-form-designer/styles'
import '@moluoxixi/config-form-designer-antd-vue/styles'
import '@moluoxixi/config-form-designer-element-plus/styles'
import '@moluoxixi/config-form-antd-vue/styles'
import '@moluoxixi/config-form-element/styles'

createApp(DesignerApp).mount('#app')
