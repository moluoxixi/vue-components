/**
 * UI SPA 挂载入口。把 App 挂到 #app；由 dist/ui 静态资源经 plugin 提供给浏览器。
 */
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
