import { ElConfigProvider } from 'element-plus'
import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useData } from 'vitepress'
import { computed, defineAsyncComponent, defineComponent, h } from 'vue'

const VPApp = defineAsyncComponent(() => import('../upstream/vitepress/components/vp-app.vue'))

export default defineComponent({
  name: 'ElementPlusDocsLayout',
  setup() {
    const { lang } = useData()
    const locale = computed(() => lang.value === 'zh-CN' ? zhCn : en)
    return () => h(ElConfigProvider, { locale: locale.value }, () => h(VPApp))
  },
})
