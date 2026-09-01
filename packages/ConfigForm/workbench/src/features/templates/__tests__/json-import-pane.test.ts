// @vitest-environment happy-dom

import type { Component } from 'vue'
import type { ConfigImportMigrationRecord } from '../../../project'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, shallowRef } from 'vue'
import { createWorkbenchLocaleOptions } from '../../../locale'
import { MAX_IMPORT_SOURCE_BYTES } from '../../../project'
import JsonImportPane from '../JsonImportPane.vue'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  clearFiles: vi.fn(),
  prepare: vi.fn(),
  useController: vi.fn(),
  useUi: vi.fn(),
}))

vi.mock('../../../app/workbench-context', () => ({
  useWorkbenchController: mocks.useController,
  useWorkbenchUiStore: mocks.useUi,
}))

const ButtonStub = defineComponent({
  inheritAttrs: false,
  props: { disabled: Boolean, loading: Boolean },
  setup(props, { attrs, slots }) {
    return () => h('button', {
      ...attrs,
      disabled: props.disabled || props.loading,
      type: 'button',
    }, slots.default?.())
  },
})

const InputStub = defineComponent({
  inheritAttrs: false,
  props: { modelValue: String, type: String },
  emits: ['input', 'update:modelValue'],
  setup(props, { attrs, emit, expose }) {
    const input = ref<HTMLTextAreaElement>()
    expose({ focus: () => input.value?.focus() })
    return () => h('textarea', {
      ...attrs,
      ref: input,
      value: props.modelValue,
      onInput: (event: Event) => {
        emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
        emit('input', (event.target as HTMLTextAreaElement).value)
      },
    })
  },
})

const SegmentedStub = defineComponent({
  inheritAttrs: false,
  props: { modelValue: String, options: Array<{ disabled?: boolean, label: string, value: string }> },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () => h('div', { ...attrs, role: 'radiogroup' }, props.options?.map(option => h('button', {
      disabled: option.disabled,
      type: 'button',
      onClick: () => emit('update:modelValue', option.value),
    }, option.label)))
  },
})

const RuntimeStub = defineComponent({
  inheritAttrs: false,
  setup() {
    return () => h('div', { 'data-import-preview': '' })
  },
})

const UploadStub = defineComponent({
  inheritAttrs: false,
  props: {
    onChange: Function,
    onExceed: Function,
  },
  setup(props, { attrs, expose, slots }) {
    expose({ clearFiles: mocks.clearFiles })
    return () => h('button', { ...attrs, class: 'el-upload', tabindex: 0, type: 'button' }, slots.default?.())
  },
})

function prepared(name = 'Imported project') {
  return {
    adapter: 'element-plus',
    diagnostics: [],
    document: { id: 'imported' },
    migrations: [],
    preview: {
      adapter: 'element-plus',
      compilation: { page: { id: 'page' } },
      namespace: 'mx-preview',
      reactionProjection: { props: {}, states: {}, validate: [], values: {} },
      revision: 'import:1',
      runtimeSessionKey: 'imported:page',
      runtimeState: { touched: [], validation: {}, values: {} },
    },
    previewCompilation: { page: { id: 'page' } },
    summary: {
      adapter: 'element-plus',
      flowCount: 0,
      name,
      nodeCount: 3,
      pageCount: 1,
      pageGraphVersion: 2,
      resourceCount: 0,
      schemaVersion: 4,
      target: 'project',
    },
    target: 'project',
  }
}

function mountPane(locale: 'en-US' | 'zh-CN' = 'en-US') {
  return mount(JsonImportPane as Component, {
    attachTo: document.body,
    props: {
      locale: createWorkbenchLocaleOptions(locale, undefined, undefined),
      target: 'project',
    },
    global: {
      stubs: {
        ElButton: ButtonStub,
        ElInput: InputStub,
        ElSegmented: SegmentedStub,
        ElUpload: UploadStub,
        PreviewRuntimeHostFrame: RuntimeStub,
      },
    },
  })
}

describe('json import pane', () => {
  beforeEach(() => {
    mocks.create.mockResolvedValue(true)
    mocks.useController.mockReturnValue({
      busy: ref(false),
      createFromJsonImport: mocks.create,
      currentProject: shallowRef(undefined),
      prepareJsonImport: mocks.prepare,
    })
    mocks.useUi.mockReturnValue({ clearMessage: vi.fn(), message: ref('') })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    document.body.replaceChildren()
  })

  it('shows stable diagnostic code, path, and message for invalid JSON', async () => {
    mocks.prepare.mockResolvedValue({
      success: false,
      diagnostics: [{ code: 'IMPORT_JSON_INVALID', message: 'Service-only invalid JSON message.', path: '$' }],
    })
    const wrapper = mountPane()
    await wrapper.get('textarea').setValue('{')
    await wrapper.findAll('button').find(button => button.text().includes('Analyze JSON'))!.trigger('click')
    await flushPromises()

    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('IMPORT_JSON_INVALID')
    expect(alert.text()).toContain('$')
    expect(alert.text()).toContain('The source is not valid JSON.')
    expect(alert.text()).not.toContain('Service-only invalid JSON message.')
    wrapper.unmount()
  })

  it('localizes diagnostic messages in zh-CN without rendering the service message', async () => {
    mocks.prepare.mockResolvedValue({
      success: false,
      diagnostics: [{ code: 'IMPORT_JSON_INVALID', message: 'The source is not valid JSON.', path: '$' }],
    })
    const wrapper = mountPane('zh-CN')
    await wrapper.get('textarea').setValue('{')
    await wrapper.findAll('button').find(button => button.text().includes('分析 JSON'))!.trigger('click')
    await flushPromises()

    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('IMPORT_JSON_INVALID')
    expect(alert.text()).toContain('$')
    expect(alert.text()).toContain('输入内容不是有效的 JSON。')
    expect(alert.text()).not.toContain('The source is not valid JSON.')
    wrapper.unmount()
  })

  it('localizes migration messages while preserving code, versions, and path', async () => {
    const migrations: ConfigImportMigrationRecord[] = [{
      code: 'IMPORT_PROJECT_V3_TO_V4',
      fromVersion: 'Project v3',
      message: 'Service-only migration message.',
      path: '$.pagesById',
      toVersion: 'Project v4',
    }]
    const candidate = { ...prepared('迁移项目'), migrations }
    mocks.prepare.mockResolvedValue({ success: true, prepared: candidate })
    const zhWrapper = mountPane('zh-CN')
    await zhWrapper.get('textarea').setValue('{}')
    await zhWrapper.findAll('button').find(button => button.text().includes('分析 JSON'))!.trigger('click')
    await flushPromises()

    expect(zhWrapper.text()).toContain('IMPORT_PROJECT_V3_TO_V4')
    expect(zhWrapper.text()).toContain('Project v3 → Project v4')
    expect(zhWrapper.text()).toContain('$.pagesById')
    expect(zhWrapper.text()).toContain('已将页面 Flow 归属从 PageGraph 移至 ProjectPage。')
    expect(zhWrapper.text()).not.toContain('Service-only migration message.')
    zhWrapper.unmount()

    mocks.prepare.mockResolvedValue({ success: true, prepared: candidate })
    const enWrapper = mountPane('en-US')
    await enWrapper.get('textarea').setValue('{}')
    await enWrapper.findAll('button').find(button => button.text().includes('Analyze JSON'))!.trigger('click')
    await flushPromises()
    expect(enWrapper.text()).toContain('Moved page Flow ownership from PageGraph to ProjectPage.')
    expect(enWrapper.text()).not.toContain('Service-only migration message.')
    enWrapper.unmount()
  })

  it('renders the full workflow in zh-CN and creates the analyzed instance', async () => {
    mocks.prepare.mockResolvedValue({ success: true, prepared: prepared('导入项目') })
    const wrapper = mountPane('zh-CN')

    expect(wrapper.get('nav').attributes('aria-label')).toBe('导入步骤')
    expect(wrapper.text()).toContain('来源')
    expect(wrapper.text()).toContain('检查')
    expect(wrapper.text()).toContain('预览')
    await wrapper.get('textarea').setValue('{}')
    await wrapper.findAll('button').find(button => button.text().includes('分析 JSON'))!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('导入项目')
    expect(wrapper.find('[data-import-preview]').exists()).toBe(true)

    await wrapper.findAll('button').find(button => button.text().includes('创建导入项目'))!.trigger('click')
    await flushPromises()
    expect(mocks.create).toHaveBeenCalledOnce()
    expect(wrapper.emitted('created')).toHaveLength(1)
    wrapper.unmount()
  })

  it('does not publish an analysis completed for an older source', async () => {
    let resolveFirst!: (value: unknown) => void
    mocks.prepare
      .mockImplementationOnce(() => new Promise(resolve => resolveFirst = resolve))
      .mockResolvedValueOnce({ success: true, prepared: prepared('Current result') })
    const wrapper = mountPane()
    await wrapper.get('textarea').setValue('{"first":true}')
    await wrapper.findAll('button').find(button => button.text().includes('Analyze JSON'))!.trigger('click')
    await wrapper.get('textarea').setValue('{"second":true}')
    await wrapper.findAll('button').find(button => button.text().includes('Analyze JSON'))!.trigger('click')
    await flushPromises()
    resolveFirst({ success: true, prepared: prepared('Stale result') })
    await flushPromises()

    expect(wrapper.text()).toContain('Current result')
    expect(wrapper.text()).not.toContain('Stale result')
    wrapper.unmount()
  })

  it('replaces, clears, and refocuses local files after oversize and read failures', async () => {
    mocks.prepare.mockResolvedValue({ success: true, prepared: prepared() })
    const wrapper = mountPane('zh-CN')
    await wrapper.findAll('[role="radiogroup"] button').find(button => button.text() === 'JSON 文件')!.trigger('click')
    await flushPromises()
    const upload = wrapper.findComponent(UploadStub)
    const oversized = {
      name: 'oversized.json',
      size: MAX_IMPORT_SOURCE_BYTES + 1,
      text: vi.fn(async () => '{}'),
    }
    await upload.props('onChange')!({ raw: oversized })
    await flushPromises()
    expect(wrapper.text()).toContain('JSON 内容超过允许的大小。')
    expect(wrapper.findAll('button').some(button => button.text().includes('重试'))).toBe(false)

    const replacement = {
      name: 'replacement.json',
      size: 2,
      text: vi.fn(async () => '{}'),
    }
    upload.props('onExceed')!([replacement])
    await flushPromises()
    expect(mocks.clearFiles).toHaveBeenCalled()
    expect(wrapper.text()).toContain('replacement.json')
    await wrapper.findAll('button').find(button => button.text().includes('分析 JSON'))!.trigger('click')
    await flushPromises()
    expect(mocks.prepare).toHaveBeenCalledWith('{}', 'project')

    await wrapper.findAll('button').find(button => button.text().includes('清空'))!.trigger('click')
    await flushPromises()
    expect(document.activeElement?.classList.contains('el-upload')).toBe(true)

    await upload.props('onChange')!({
      raw: { name: 'unreadable.json', size: 4, text: vi.fn(async () => { throw new Error('read failed') }) },
    })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('无法读取 JSON 文件')
    wrapper.unmount()
  })

  it('keeps the workspace open when creation fails', async () => {
    mocks.prepare.mockResolvedValue({ success: true, prepared: prepared() })
    mocks.create.mockResolvedValue(false)
    const wrapper = mountPane()
    await wrapper.get('textarea').setValue('{}')
    await wrapper.findAll('button').find(button => button.text().includes('Analyze JSON'))!.trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text().includes('Create imported project'))!.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('created')).toBeUndefined()
    expect(wrapper.find('[data-import-preview]').exists()).toBe(true)
    wrapper.unmount()
  })
})
