import type { ElementOption } from '../types'

export function createFlatOptions(suffix: string): ElementOption[] {
  return [
    { label: `${suffix} 草稿`, value: `${suffix}-draft` },
    { label: `${suffix} 启用`, value: `${suffix}-enabled` },
  ]
}

export function createSelectV2Options(suffix: string): ElementOption[] {
  return [
    { label: `${suffix} 小型`, value: `${suffix}-small` },
    { label: `${suffix} 大型`, value: `${suffix}-large` },
  ]
}

export function createNestedOptions(suffix: string): ElementOption[] {
  return [{
    label: `${suffix} 华东`,
    value: `${suffix}-east`,
    children: [
      { label: `${suffix} 杭州`, value: `${suffix}-hangzhou` },
      { label: `${suffix} 上海`, value: `${suffix}-shanghai` },
    ],
  }]
}

export function createTreeOptions(suffix: string): ElementOption[] {
  return [{
    label: `${suffix} 根节点`,
    value: `${suffix}-root-a`,
    children: [{ label: `${suffix} 叶子节点`, value: `${suffix}-leaf-a` }],
  }]
}

export function createCheckOptions(suffix: string): ElementOption[] {
  return [
    { label: `${suffix} 邮件`, value: 'mail' },
    { label: `${suffix} 短信`, value: 'sms' },
  ]
}

export function createRadioOptions(): ElementOption[] {
  return [
    { label: '标准', value: 'standard' },
    { label: '企业', value: 'enterprise' },
  ]
}

export function createNotifyOptions(): ElementOption[] {
  return [
    { label: '立即通知', value: 'immediate' },
    { label: '预约通知', value: 'scheduled' },
  ]
}
