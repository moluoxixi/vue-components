// Spike 主入口：左边两条编译路线各挂一个动态组件，右边一组 Props 控件。
// 改控件 → 响应式驱动两个动态组件实时更新。这就是 Web 调试台的最小内核。

import { createApp, h, reactive, markRaw, type Component } from 'vue'
import { SAMPLE_SFC, BROKEN_SFC } from './fixtures'
import { compileSfcDIY } from './compile-diy'
import { compileSfcLoader } from './compile-loader'

// 外部可调的响应式 Props（模拟调试台的 Props 面板）
const live = reactive({
  label: 'Hello AI',
  count: 1,
})

// 状态：两条路线各自的编译结果与错误
const state = reactive<{
  diyComp: Component | null
  diyErr: string
  loaderComp: Component | null
  loaderErr: string
  brokenDiyErr: string
}>({
  diyComp: null,
  diyErr: '',
  loaderComp: null,
  loaderErr: '',
  brokenDiyErr: '',
})

async function compileAll() {
  // 路线 B：自研管线（同步）
  try {
    const { component, scopedStyles } = compileSfcDIY(SAMPLE_SFC)
    for (const css of scopedStyles) {
      const el = document.createElement('style')
      el.textContent = css
      document.head.appendChild(el)
    }
    state.diyComp = markRaw(component as Component)
    state.diyErr = ''
  }
  catch (e) {
    state.diyErr = String(e)
  }

  // 路线 A：vue3-sfc-loader（异步）
  try {
    const comp = await compileSfcLoader(SAMPLE_SFC)
    state.loaderComp = markRaw(comp as Component)
    state.loaderErr = ''
  }
  catch (e) {
    state.loaderErr = String(e)
  }

  // 边界：坏 SFC 应抛错而非静默
  try {
    compileSfcDIY(BROKEN_SFC, 'Broken.vue')
    state.brokenDiyErr = '⚠️ 未抛错（不符合预期）'
  }
  catch (e) {
    state.brokenDiyErr = `✓ 正确抛错: ${String(e).slice(0, 80)}`
  }
}

const App = {
  setup() {
    compileAll()
    return () => h('div', { style: 'font-family:system-ui;padding:20px;display:grid;grid-template-columns:240px 1fr;gap:24px' }, [
      // Props 控制面板
      h('div', [
        h('h2', 'Props 面板'),
        h('label', { style: 'display:block;margin:8px 0' }, [
          'label: ',
          h('input', {
            'data-testid': 'in-label',
            value: live.label,
            onInput: (e: Event) => { live.label = (e.target as HTMLInputElement).value },
          }),
        ]),
        h('label', { style: 'display:block;margin:8px 0' }, [
          'count: ',
          h('input', {
            'data-testid': 'in-count',
            type: 'number',
            value: live.count,
            onInput: (e: Event) => { live.count = Number((e.target as HTMLInputElement).value) },
          }),
        ]),
        h('p', { 'data-testid': 'broken-result' }, state.brokenDiyErr),
      ]),
      // 两条路线的渲染结果
      h('div', [
        h('section', { style: 'margin-bottom:24px' }, [
          h('h2', '路线 B：@vue/compiler-sfc + sucrase'),
          state.diyErr
            ? h('pre', { 'data-testid': 'diy-error', style: 'color:red' }, state.diyErr)
            : state.diyComp
              ? h('div', { 'data-testid': 'diy-mount' }, [h(state.diyComp, { label: live.label, count: live.count })])
              : h('p', '编译中…'),
        ]),
        h('section', [
          h('h2', '路线 A：vue3-sfc-loader'),
          state.loaderErr
            ? h('pre', { 'data-testid': 'loader-error', style: 'color:red' }, state.loaderErr)
            : state.loaderComp
              ? h('div', { 'data-testid': 'loader-mount' }, [h(state.loaderComp, { label: live.label, count: live.count })])
              : h('p', '编译中…'),
        ]),
      ]),
    ])
  },
}

createApp(App).mount('#app')
