import 'virtual:uno.css'
import './style.css'

const app = document.querySelector('#app')

if (!app) {
  throw new Error('real styles fixture root not found')
}

app.textContent = 'real style addon'
