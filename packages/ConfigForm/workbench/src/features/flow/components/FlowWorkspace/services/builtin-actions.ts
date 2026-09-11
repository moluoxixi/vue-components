import type { ConfigFormJsonObject } from '@moluoxixi/config-form-core'

interface WorkbenchFlowActionPreset {
  ref: string
  label: string
  input: ConfigFormJsonObject
}

/**
 * Built-in action presets surfaced by the action node inspector. Picking a
 * preset seeds config.input with an editable skeleton; refs stay free-form so
 * host-registered custom actions keep working.
 */
export const WORKBENCH_FLOW_ACTION_PRESETS: readonly WorkbenchFlowActionPreset[] = [
  { input: { method: 'GET', url: 'https://' }, label: 'HTTP request', ref: 'builtin.http.request' },
  { input: { message: '', type: 'info' }, label: 'Show message', ref: 'builtin.ui.message' },
  { input: { message: '', title: '' }, label: 'Confirm dialog', ref: 'builtin.ui.confirm' },
  { input: { target: '_blank', url: 'https://' }, label: 'Open link', ref: 'builtin.nav.open' },
  { input: { ms: 300 }, label: 'Delay', ref: 'builtin.delay' },
  { input: {}, label: 'Notify (debug)', ref: 'notify' },
]
