export type TemplateWorkspaceViewport = 'desktop' | 'medium' | 'mobile'

export type TemplateEligibilityDisplayStatus
  = | 'pending'
    | 'checking'
    | 'eligible'
    | 'ineligible'

export interface TemplateEligibilityCacheEntry {
  request: number
  status: Exclude<TemplateEligibilityDisplayStatus, 'pending'>
}
