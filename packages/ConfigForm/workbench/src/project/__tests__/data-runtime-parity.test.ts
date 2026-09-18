// @vitest-environment happy-dom
import type { ConfigFormRendererExpose } from '@moluoxixi/config-form'
import type { Component } from 'vue'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { shallowRef } from 'vue'
import { createWorkbenchDataSourceRequest } from '../../app/services/data-source-request'
import { compileDataFixture, DataControl } from './data-runtime-fixture'
import { createGeneratedModuleLoader } from './generated-runtime-module'

type RuntimeDataExpose = ConfigFormRendererExpose & {
  getOptionState: ConfigFormRendererExpose['getOptionState']
  getVariables: ConfigFormRendererExpose['getVariables']
  getDataSourceState: ConfigFormRendererExpose['getDataSourceState']
}

describe('generated Page data-source parity', () => {
  it('shares named options, variables and data-source lifecycle with the direct renderer', async () => {
    const fixture = compileDataFixture()
    const fetchHost = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('[{"label":"A","value":"a"}]', { status: 200 }))
    const base = document.createElement('base')
    base.href = 'https://generated.test/app/'
    document.head.append(base)
    onTestFinished(() => {
      base.remove()
      fetchHost.mockRestore()
    })
    const exported = fixture.exportSource()
    expect(fetchHost).not.toHaveBeenCalled()
    const load = await createGeneratedModuleLoader(Object.fromEntries(Object.entries(exported.files)
      .filter(([, file]) => file.kind === 'text').map(([path, file]) => [path, file.content as string])))
    const Page = load('src/pages/home/Page.vue').default as Component
    const values = shallowRef<Record<string, unknown>>({})
    const direct = mount(ConfigFormRenderer, { props: {
      ...fixture.runtime.artifact.renderer,
      model: createConfigFormModel(values),
      dataSourceHost: { request: createWorkbenchDataSourceRequest((...args) => globalThis.fetch(...args), () => document.baseURI) },
    } })
    const source = mount(Page, { global: { components: { DataControl } } })
    try {
      for (const wrapper of [direct, source]) {
        const api = wrapper.vm as unknown as RuntimeDataExpose
        await vi.waitFor(() => expect(api.getOptionState({ nodeId: 'choice', scope: [] })?.status).toBe('success'))
        expect(api.getVariables()).toEqual({ region: 'US' })
        expect(api.getOptionState({ nodeId: 'choice', scope: [] })?.options).toEqual([{ label: 'A', value: 'a' }])
        await wrapper.get('[data-field="choice"]').findComponent(DataControl).trigger('click')
        await flushPromises()
        expect(api.getVariables()).toEqual({ region: 'US' })
        expect(api.getValues().result).toBe('')
        expect(api.getDataSourceState('choices')).toMatchObject({ status: 'success', data: [{ label: 'A', value: 'a' }] })
      }
      expect(fetchHost).toHaveBeenCalledTimes(2)
      expect(fetchHost.mock.calls.every(([url]) => url === 'https://generated.test/choices?region=US')).toBe(true)
    }
    finally {
      direct.unmount()
      source.unmount()
      base.remove()
      fetchHost.mockRestore()
    }
  })
})
