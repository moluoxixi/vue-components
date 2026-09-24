import { createApp } from 'vue'
import App from './App.vue'
import { createWorkbenchRouter } from './app/router'
import '@moluoxixi/config-form-designer/design-surface/style'
import './styles/index.css'

createApp(App).use(createWorkbenchRouter()).mount('#app')
