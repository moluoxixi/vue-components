// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import type { StudioDiagnostic } from '../types/editor-session'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import StudioIssuesDock from '../components/StudioIssuesDock.vue'

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
})

function render(diagnostics: StudioDiagnostic[]) {
  const wrapper = mount(StudioIssuesDock, { props: { open: true, diagnostics, locale: 'en-US' } })
  wrappers.push(wrapper)
  return wrapper
}

const warning: StudioDiagnostic = { code: 'WARNING', severity: 'warning', origin: 'compiler', message: 'Check this setting.', surfaceId: 'page' }
const error: StudioDiagnostic = { code: 'ERROR', severity: 'error', origin: 'preview', message: 'The preview could not open.' }

describe('studio issue feedback', () => {
  it('reports warnings without implying success and separates filtered emptiness from passed checks', async () => {
    const wrapper = render([warning])
    expect(wrapper.attributes('data-status')).toBe('warning')
    expect(wrapper.get('header small').text()).toBe('1 warning')
    const errors = wrapper.findAll('[aria-pressed]').find(button => button.text().startsWith('Errors'))!
    await errors.trigger('click')
    expect(wrapper.get('.studio-issues-empty').text()).toContain('Other categories still have items to review.')
    expect(wrapper.text()).not.toContain('Checks passed')
    await wrapper.get('.studio-issues-empty button').trigger('click')
    expect(wrapper.findAll('.studio-issue')).toHaveLength(1)
    await wrapper.setProps({ diagnostics: [] })
    expect(wrapper.attributes('data-status')).toBe('success')
    expect(wrapper.get('.studio-issues-empty').text()).toContain('Checks passed')
  })

  it('prioritizes errors and offers location only for actionable targets, including pages', async () => {
    const wrapper = render([warning, error])
    expect(wrapper.findAll('.studio-issue strong').map(message => message.text())).toEqual([error.message, warning.message])
    expect(wrapper.get('header small').text()).toBe('1 error · 1 warning')
    await wrapper.get('div.studio-issue-main').trigger('click')
    expect(wrapper.emitted('locate')).toBeUndefined()
    await wrapper.get('button.studio-issue-main').trigger('click')
    expect(wrapper.emitted('locate')).toEqual([[warning]])
    expect(wrapper.get('button.studio-issue-main small').text()).toBe('Warning · Design check')
  })

  it('keeps an active notes filter reachable when its last item is resolved', async () => {
    const wrapper = render([{ ...warning, severity: 'info' }])
    expect(wrapper.attributes('data-status')).toBe('info')
    await wrapper.findAll('[aria-pressed]').find(button => button.text().startsWith('Notes'))!.trigger('click')
    await wrapper.setProps({ diagnostics: [warning] })
    expect(wrapper.get('[aria-pressed="true"]').text()).toBe('Notes 0')
    expect(wrapper.find('.studio-issues-empty button').exists()).toBe(true)
  })
})
