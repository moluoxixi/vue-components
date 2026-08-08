export type DesignerPageLanguage = 'zh-CN' | 'en-US'

interface DesignerPageCopy {
  title: string
  language: string
  back: string
}

const copies: Record<DesignerPageLanguage, DesignerPageCopy> = {
  'zh-CN': {
    title: '可视化表单设计器',
    language: '语言',
    back: '返回 Playground',
  },
  'en-US': {
    title: 'Visual Form Designer',
    language: 'Language',
    back: 'Back to Playground',
  },
}

export function getDesignerPageCopy(language: DesignerPageLanguage): DesignerPageCopy {
  return copies[language]
}
