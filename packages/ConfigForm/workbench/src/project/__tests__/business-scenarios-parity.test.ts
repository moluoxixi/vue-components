// @vitest-environment happy-dom
import type { ConfigFormRendererExpose } from '@moluoxixi/config-form'
import type { VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import type { BusinessScenario, BusinessScenariosFixture } from './business-scenarios-fixture'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { createConfigFormBuiltinFlowActions, createConfigFormFlowActionRegistry } from '@moluoxixi/config-form-core'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import AntDesignVue from 'ant-design-vue'
import ElementPlus from 'element-plus'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { createWorkbenchDataSourceRequest } from '../../app/services/data-source-request'
import {
  BUSINESS_ORIGIN,
  BUSINESS_PROVIDERS,
  BUSINESS_SCENARIOS,
  createBusinessScenariosFixture,
  declaredOrderValues,
  loadBusinessConfig,
  loadBusinessSource,
  populatedOrderValues,
} from './business-scenarios-fixture'

interface BusinessOptionState {
  status?: string
  options?: unknown
}
/**
 * The parity assertions read the data-runtime projections loosely, so the data members
 * are re-declared here after removing the strict runtime signatures they would conflict with.
 */
interface BusinessRendererExpose
  extends Omit<ConfigFormRendererExpose, 'getDataSourceState' | 'getOptionState'> {
  getVariables: () => Readonly<Record<string, unknown>>
  getOptionState: (address: Parameters<ConfigFormRendererExpose['getInstanceValue']>[0]) => BusinessOptionState | undefined
  getDataSourceState: (sourceId: string) => unknown
}

const PATHS = ['Direct', 'Config', 'Source'] as const
type RuntimePath = typeof PATHS[number]
const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).reverse().forEach(dispose => dispose())
  vi.unstubAllGlobals()
})

function controlledHost() {
  const decisions = { confirmed: true }
  const audit: unknown[] = []
  const pending: Array<{ signal: AbortSignal | null | undefined, resolve: (response: Response) => void }> = []
  const confirm = vi.fn((_message?: string) => decisions.confirmed)
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.origin !== BUSINESS_ORIGIN)
      throw new Error(`Unexpected business endpoint: ${url.href}`)
    if (url.pathname === '/cities') {
      const country = url.searchParams.get('country')
      const cities = country === 'US'
        ? [{ label: 'Boston', value: 'BOS' }]
        : country === 'CA' ? [{ label: 'Toronto', value: 'TOR' }] : []
      return new Response(JSON.stringify({ cities }), { status: 200 })
    }
    if (url.pathname === '/submit') {
      // Intentionally ignore AbortSignal so the test can deliver a stale success after disposal.
      return new Promise<Response>(resolve => pending.push({ signal: init?.signal, resolve }))
    }
    throw new Error(`Unexpected business request: ${url.href}`)
  })
  const flowActions = createConfigFormFlowActionRegistry(
    createConfigFormBuiltinFlowActions({ fetch, confirm: input => confirm(input.message) }),
    {
      'host.businessAudit': {
        descriptor: {
          ref: 'host.businessAudit',
          title: 'Business audit',
          category: 'test',
          parameters: [],
          outputs: [{ name: 'receipt', title: 'Receipt' }],
          capabilities: [],
        },
        execute: (input) => {
          audit.push(input)
          return input
        },
      },
    },
  )
  return {
    decisions,
    audit,
    pending,
    confirm,
    fetch,
    flowActions,
    dataSourceHost: { request: createWorkbenchDataSourceRequest(fetch, () => `${BUSINESS_ORIGIN}/`) },
  }
}

async function surface(fixture: BusinessScenariosFixture, path: RuntimePath, pageId: BusinessScenario) {
  const host = controlledHost()
  vi.stubGlobal('fetch', host.fetch)
  vi.stubGlobal('confirm', host.confirm)
  const container = document.createElement('div')
  document.body.append(container)
  cleanup.push(() => container.remove())
  let wrapper: VueWrapper
  let audit = () => host.audit
  const direct = fixture.direct(pageId)
  if (path === 'Source') {
    const load = await loadBusinessSource(fixture)
    const Page: Component = load(`src/pages/${pageId}/Page.vue`).default
    const actionModule = load('src/actions/business-audit.ts')
    audit = () => actionModule.calls
    wrapper = mount(Page, { attachTo: container, global: { plugins: [fixture.provider === 'element-plus' ? ElementPlus : AntDesignVue] } })
    const flows = load(`src/pages/${pageId}/flows.ts`)
    expect(flows.flowPlans).toEqual(direct.renderer.plan.flows)
  }
  else {
    let config = direct.renderer
    if (path === 'Config') {
      const generated = await loadBusinessConfig(fixture)
      expect(generated.project.identity).toEqual(fixture.compilation.key)
      const page = generated.pageConfigs[pageId]
      expect(page.pageCompilation.page).toEqual(fixture.compilation.ir.pagesById[pageId])
      expect(page.pageCompilation.snapshotIdentity).toEqual({
        source: 'committed',
        projectId: fixture.snapshot.document.id,
        pageId,
        contentHash: fixture.snapshot.contentHash,
        editVersion: fixture.snapshot.editVersion,
      })
      expect(page.plan).toEqual(direct.renderer.plan)
      config = page.createRendererConfig(fixture.runtimeResolver, host)
    }
    wrapper = mount(ConfigFormRenderer, {
      attachTo: container,
      props: { ...config, ...host, model: createConfigFormModel(shallowRef<Record<string, unknown>>({})) },
    })
  }
  let mounted = true
  function unmount() {
    if (mounted) {
      mounted = false
      wrapper.unmount()
    }
  }
  cleanup.push(unmount)
  const renderer = path === 'Source' ? wrapper.findComponent({ name: 'ConfigFormRenderer' }) : wrapper
  const api = wrapper.vm as unknown as BusinessRendererExpose
  await flushPromises()
  return { wrapper, renderer, api, host, audit, unmount }
}

async function chooseCity(wrapper: VueWrapper, provider: BusinessScenariosFixture['provider'], label: string) {
  const element = provider === 'element-plus'
  const selector = wrapper.get(`[data-field="city"] ${element ? '.el-select__wrapper' : '.ant-select-selector'}`)
  await selector.trigger(element ? 'click' : 'mousedown')
  await flushPromises()
  const options = [...document.body.querySelectorAll(element ? '.el-select-dropdown__item' : '.ant-select-item-option')]
  const option = options.find(item => item.textContent?.trim() === label)
  expect(option, `Actual ${provider} option ${label}`).toBeDefined()
  if (!option)
    throw new Error(`Missing option: ${label}`)
  await new DOMWrapper(option).trigger('click')
  await flushPromises()
}

for (const provider of BUSINESS_PROVIDERS) {
  describe(`${provider} business scenarios`, () => {
    let fixture: BusinessScenariosFixture
    beforeAll(async () => {
      fixture = await createBusinessScenariosFixture(provider)
    })

    it('round-trips one real material ProjectDocument and keeps its snapshot identity without side effects', () => {
      const fetch = vi.fn<typeof globalThis.fetch>()
      vi.stubGlobal('fetch', fetch)
      expect(fixture.snapshot).toEqual(fixture.originalSnapshot)
      expect(fixture.snapshot.document).toEqual(JSON.parse(fixture.persistedJSON))
      expect(fixture.compilation.snapshot).toEqual(fixture.snapshot)
      expect(fixture.snapshot.editVersion).toBe(23)
      for (const pageId of BUSINESS_SCENARIOS) {
        const direct = fixture.direct(pageId)
        expect(direct.compilationKey).toEqual(fixture.compilation.key)
        expect(direct.pageId).toBe(pageId)
        for (const node of Object.values(fixture.snapshot.document.pagesById[pageId]!.graph.nodesById)) {
          expect(fixture.adapter.componentRegistry.get(node.component)).toBeDefined()
          expect(fixture.adapter.sourceResolver.resolveBinding(node.component)).toBeDefined()
        }
      }
      fixture.exportConfig()
      fixture.exportSource()
      expect(fetch).not.toHaveBeenCalled()
      expect(fixture.persistedJSON).not.toContain('rowId')
      expect(fixture.persistedJSON).not.toContain('function record')
    })

    describe.each(PATHS)('%s Renderer parity', (path) => {
      it('a: runs variable chains, named dynamic choices, country cascade and conditional validation before valid submission', async () => {
        const { wrapper, renderer, api, host } = await surface(fixture, path, 'profile')
        const city = { nodeId: 'city', scope: [] }
        await vi.waitFor(() => expect(api.getOptionState(city)?.status).toBe('success'))
        expect(api.getVariables()).toEqual({ base: BUSINESS_ORIGIN, endpoint: `${BUSINESS_ORIGIN}/cities`, locale: 'en', tenant: 'en-tenant' })
        expect(api.getOptionState(city)?.options).toEqual([{ label: 'Boston', value: 'BOS' }])
        expect(wrapper.find('[data-field="company"] input').exists()).toBe(false)
        await wrapper.get('[data-field="name"] input').trigger('blur')
        await flushPromises()
        expect(api.getInstanceErrors({ nodeId: 'name', scope: [] })).toEqual(['Name required'])
        await expect(api.submit()).resolves.toBe(false)
        expect(renderer.emitted('submit')).toBeUndefined()
        await wrapper.get('[data-field="name"] input').setValue('Ada')
        await chooseCity(wrapper, provider, 'Boston')
        expect(api.getValue('city')).toBe('BOS')
        await wrapper.get('[data-field="country"] input').setValue('CA')
        await wrapper.get('[data-field="country"] input').trigger('blur')
        await vi.waitFor(() => expect(api.getOptionState(city)?.options).toEqual([{ label: 'Toronto', value: 'TOR' }]))
        await vi.waitFor(() => expect(api.getValue('city')).toBe(''))
        await chooseCity(wrapper, provider, 'Toronto')
        await wrapper.get('[data-field="membership"] input').setValue('business')
        await wrapper.get('[data-field="company"] input').trigger('blur')
        await flushPromises()
        expect(api.getInstanceErrors({ nodeId: 'company', scope: [] })).toHaveLength(1)
        await expect(api.submit()).resolves.toBe(false)
        expect(renderer.emitted('submit')).toBeUndefined()
        await wrapper.get('[data-field="company"] input').setValue('Acme')
        await expect(api.submit()).resolves.toBe(true)
        expect(renderer.emitted('submit')).toEqual([[{ name: 'Ada', country: 'CA', city: 'TOR', membership: 'business', company: 'Acme' }]])
        expect(api.getErrors()).toEqual({})
        expect(api.getMeta()).toMatchObject({ dirty: true, touched: true })
        expect(api.getDataSourceState('cities')).toMatchObject({ status: 'success', data: [{ label: 'Toronto', value: 'TOR' }] })
        expect(host.fetch.mock.calls.map(([url]) => String(url))).toContain(`${BUSINESS_ORIGIN}/cities?country=US`)
        expect(host.fetch.mock.calls.map(([url]) => String(url))).toContain(`${BUSINESS_ORIGIN}/cities?country=CA`)
        expect(host.fetch.mock.calls.every(([, init]) => new Headers(init?.headers).get('x-tenant') === 'en-tenant')).toBe(true)
        expect(renderer.emitted('flowError')).toBeUndefined()
      })

      it('b: preserves two-level row identities, defaults, scoped calculations, validation and reset through real row controls', async () => {
        const { wrapper, renderer, api } = await surface(fixture, path, 'order')
        expect(api.getValues()).toEqual(declaredOrderValues())
        api.setValues(populatedOrderValues())
        await flushPromises()
        expect(api.getValues()).toEqual(populatedOrderValues())
        expect(api.listFieldInstances('sku').map(instance => instance.valuePath)).toEqual([['orders', 0, 'details', 0, 'sku'], ['orders', 1, 'details', 0, 'sku']])
        await wrapper.get('[data-field="shipping"] input').setValue('20')
        expect(api.getValue('shippingTax')).toBe(2)
        const first = api.listRows('orders')[0]!
        const second = api.listRows('orders')[1]!
        const nested = api.listRows('details', first.scope)[0]!
        const otherNested = api.listRows('details', second.scope)[0]!
        await wrapper.findAll('[data-field="quantity"] input')[0]!.setValue('3')
        await wrapper.findAll('[data-field="quantity"] input')[0]!.trigger('blur')
        await flushPromises()
        expect(api.getInstanceValue({ nodeId: 'total', scope: nested.scope })).toBe(30)
        expect(api.getInstanceValue({ nodeId: 'checked', scope: nested.scope })).toBe('checked:30')
        expect(api.getInstanceValue({ nodeId: 'total', scope: otherNested.scope })).toBe(21)
        expect(api.getInstanceValue({ nodeId: 'checked', scope: otherNested.scope })).toBe('pending')
        const skuAddress = { nodeId: 'sku', scope: nested.scope }
        const skuInput = wrapper.findAll('[data-field="sku"] input')[0]!
        const originalElement = skuInput.element
        await skuInput.setValue('')
        await skuInput.trigger('blur')
        await flushPromises()
        expect(api.getInstanceErrors(skuAddress)).toEqual(['SKU required'])
        expect(api.getInstanceErrors({ nodeId: 'sku', scope: otherNested.scope })).toEqual([])
        await expect(api.submit()).resolves.toBe(false)
        expect(renderer.emitted('submit')).toBeUndefined()
        const tableRows = () => wrapper.findAll('[data-config-form-array="orders"] table > tbody > tr')
        const rowAction = (index: number, action: string) => tableRows()[index]!.get(`td:last-child > [data-config-form-row-actions] [data-config-form-row-action="${action}"]`)
        await rowAction(0, 'move-down').trigger('click')
        expect(api.listRows('orders')[1]!.rowId).toBe(first.rowId)
        expect(api.listFieldInstances('sku').find(instance => instance.instanceKey === api.getInstanceKey(skuAddress))?.valuePath).toEqual(['orders', 1, 'details', 0, 'sku'])
        expect(api.getInstanceErrors(skuAddress)).toEqual(['SKU required'])
        expect(tableRows()[1]!.get('[data-field="sku"] input').element).toBe(originalElement)
        await tableRows()[1]!.get('[data-field="sku"] input').setValue('A-fixed')
        await rowAction(1, 'move-up').trigger('click')
        await wrapper.findAll('[data-config-form-array="details"]')[0]!.get('[data-config-form-array-actions] [data-config-form-row-action="append"]').trigger('click')
        expect(api.listRows('details', first.scope)).toHaveLength(2)
        expect(api.listRows('details', first.scope)[1]!.value).toEqual(declaredOrderValues().orders[0]!.details[0])
        expect(api.listRows('details', second.scope)[0]!.rowId).toBe(otherNested.rowId)
        await rowAction(0, 'duplicate').trigger('click')
        const duplicate = api.listRows('orders')[1]!
        expect(duplicate.value).toEqual(api.listRows('orders')[0]!.value)
        expect(duplicate.rowId).not.toBe(first.rowId)
        expect(api.listRows('details', duplicate.scope)[0]!.rowId).not.toBe(nested.rowId)
        expect(api.getInstanceErrors({ nodeId: 'sku', scope: api.listRows('details', duplicate.scope)[0]!.scope })).toEqual([])
        const append = wrapper.get('[data-config-form-array="orders"] > section > [data-config-form-array-actions] [data-config-form-row-action="append"]')
        expect(append.attributes('disabled')).toBeDefined()
        await rowAction(1, 'remove').trigger('click')
        expect(api.listRows('orders').map(row => row.rowId)).toEqual([first.rowId, second.rowId])
        await append.trigger('click')
        expect(api.listRows('orders')[2]!.value).toEqual(declaredOrderValues().orders[0])
        await expect(api.submit()).resolves.toBe(true)
        expect(renderer.emitted('submit')).toEqual([[api.getValues()]])
        expect(JSON.stringify(api.getValues())).not.toContain('rowId')
        await api.resetFields()
        await flushPromises()
        expect(api.getValues()).toEqual(declaredOrderValues())
        expect(api.getErrors()).toEqual({})
        expect(api.getMeta()).toMatchObject({ dirty: false, touched: false })
        expect(renderer.emitted('flowError')).toBeUndefined()
      })

      it('b: honors persisted form readonly for nested controls, row actions and submission', async () => {
        const readonlyFixture = await createBusinessScenariosFixture(provider, { readonlyOrder: true })
        const { wrapper, renderer, api } = await surface(readonlyFixture, path, 'order')
        expect(wrapper.findAll('input')).toHaveLength(0)
        const actions = wrapper.findAll('[data-config-form-row-action]')
        expect(actions.length).toBeGreaterThan(0)
        expect(actions.every(button => button.attributes('disabled') !== undefined)).toBe(true)
        const initial = api.getValues()
        await wrapper.get('[data-config-form-row-action="duplicate"]').trigger('click')
        expect(api.getValues()).toEqual(initial)
        await expect(api.submit()).resolves.toBe(true)
        expect(renderer.emitted('submit')).toEqual([[declaredOrderValues()]])
      })

      it.each(['accepted', 'declined', 'transport-error'] as const)('c: confirms and waits for controlled HTTP %s with upstream output references', async (outcome) => {
        const { wrapper, renderer, api, host, audit } = await surface(fixture, path, 'submission')
        await wrapper.get('[data-field="reference"] input').setValue('INV-2')
        const submitting = api.submit()
        await vi.waitFor(() => expect(host.pending).toHaveLength(1))
        expect(host.confirm).toHaveBeenCalledExactlyOnceWith('Submit invoice?')
        expect(host.fetch).toHaveBeenCalledExactlyOnceWith(`${BUSINESS_ORIGIN}/submit`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ reference: 'INV-2' }) }))
        expect(renderer.emitted('submit')).toBeUndefined()
        expect(audit()).toEqual([])
        await expect(api.submit()).resolves.toBe(false)
        expect(host.fetch).toHaveBeenCalledOnce()
        host.pending[0]!.resolve(new Response(JSON.stringify({ accepted: outcome === 'accepted', receipt: 'R-2' }), { status: outcome === 'transport-error' ? 503 : 200 }))
        await expect(submitting).resolves.toBe(outcome === 'accepted')
        await flushPromises()
        expect(audit()).toEqual([outcome === 'accepted' ? { outcome: 'accepted', receipt: 'R-2' } : { outcome }])
        expect(api.getVariables()).toEqual({ receipt: outcome === 'accepted' ? 'R-2' : '' })
        expect(renderer.emitted('submit')).toEqual(outcome === 'accepted' ? [[{ reference: 'INV-2', decision: 'allow' }]] : undefined)
        if (outcome === 'transport-error')
          expect(renderer.emitted('flowError')).toEqual([[expect.objectContaining({ code: 'FLOW_ACTION_HTTP_STATUS', nodeId: 'request' })]])
        else
          expect(renderer.emitted('flowError')).toBeUndefined()
        await api.resetFields()
        expect(api.getVariables()).toEqual({ receipt: '' })
        expect(api.getValues()).toEqual({ reference: 'INV-1', decision: 'allow' })
      })

      it.each(['confirmation-cancelled', 'explicitly-blocked', 'invalid'] as const)('c: does not request or submit when %s', async (reason) => {
        const { wrapper, renderer, api, host, audit } = await surface(fixture, path, 'submission')
        host.decisions.confirmed = reason !== 'confirmation-cancelled'
        if (reason === 'explicitly-blocked')
          await wrapper.get('[data-field="decision"] input').setValue('deny')
        if (reason === 'invalid')
          await wrapper.get('[data-field="reference"] input').setValue('')
        await expect(api.submit()).resolves.toBe(false)
        expect(host.confirm).toHaveBeenCalledExactlyOnceWith('Submit invoice?')
        expect(host.fetch).not.toHaveBeenCalled()
        expect(audit()).toEqual([])
        expect(renderer.emitted('submit')).toBeUndefined()
        expect(api.getVariables()).toEqual({ receipt: '' })
        if (reason === 'invalid')
          expect(api.getInstanceErrors({ nodeId: 'reference', scope: [] })).toEqual(['Reference required'])
        else
          expect(api.getErrors()).toEqual({})
      })

      it('c: aborts pending submission on unmount and discards a deliberately late HTTP success', async () => {
        const { renderer, api, host, audit, unmount } = await surface(fixture, path, 'submission')
        const submitting = api.submit()
        await vi.waitFor(() => expect(host.pending).toHaveLength(1))
        const request = host.pending[0]!
        expect(request.signal?.aborted).toBe(false)
        unmount()
        expect(request.signal?.aborted).toBe(true)
        host.pending[0]!.resolve(new Response(JSON.stringify({ accepted: true, receipt: 'TOO-LATE' }), { status: 200 }))
        await expect(submitting).resolves.toBe(false)
        await flushPromises()
        expect(audit()).toEqual([])
        expect(renderer.emitted('submit')).toBeUndefined()
      })
    })
  })
}
