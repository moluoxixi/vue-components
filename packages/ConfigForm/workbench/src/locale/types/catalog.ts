import type { WORKBENCH_EN_US_MESSAGES } from '../constants/messages'

export type WorkbenchLocaleId = 'en-US' | 'zh-CN'
export type WorkbenchMessageKey = keyof typeof WORKBENCH_EN_US_MESSAGES
export type WorkbenchMessageCatalog = { [K in WorkbenchMessageKey]: string }
