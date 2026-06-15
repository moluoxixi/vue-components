/**
 * UI SPA 挂载入口。把 App 挂到 #app；由 dist/ui 静态资源经 plugin 提供给浏览器。
 */
import ElementPlus from 'element-plus'
import { createApp } from 'vue'
import App from './App.vue'
import 'element-plus/dist/index.css'
import '@moluoxixi/components/styles'

createApp(App)
  .use(ElementPlus)
  .mount('#app')
