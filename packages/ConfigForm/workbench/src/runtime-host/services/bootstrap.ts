import { createApp } from 'vue'
import RuntimeHostApp from '../index.vue'
import '@moluoxixi/config-form/styles'
import '@moluoxixi/config-form-prototype-runtime/vue/style'
import '../styles/index.css'

export function mountRuntimeHost(target = '#runtime-host'): void {
  createApp(RuntimeHostApp).mount(target)
}

mountRuntimeHost()
