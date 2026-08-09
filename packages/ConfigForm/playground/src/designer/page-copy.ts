export type DesignerPageLanguage = 'zh-CN' | 'en-US'

interface DesignerPageCopy {
  title: string
  language: string
  framework: string
  elementPlus: string
  antDesignVue: string
  back: string
}

const copies: Record<DesignerPageLanguage, DesignerPageCopy> = {
  'zh-CN': {
    title: '可视化表单设计器',
    language: '语言',
    framework: '组件库',
    elementPlus: 'Element Plus',
    antDesignVue: 'Ant Design Vue',
    back: '返回 Playground',
  },
  'en-US': {
    title: 'Visual Form Designer',
    language: 'Language',
    framework: 'UI library',
    elementPlus: 'Element Plus',
    antDesignVue: 'Ant Design Vue',
    back: 'Back to Playground',
  },
}

export function getDesignerPageCopy(language: DesignerPageLanguage): DesignerPageCopy {
  return copies[language]
}
