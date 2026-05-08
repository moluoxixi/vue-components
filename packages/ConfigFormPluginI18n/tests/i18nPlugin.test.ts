import type { NormalizedFieldConfig } from '@moluoxixi/config-form/plugins'
import type * as PublicApi from '../src'
import { defineField } from '@moluoxixi/config-form'
import { createFormRuntime } from '@moluoxixi/config-form/plugins'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createI18nPlugin } from '../src'

describe('i18n plugin package', () => {
  it('translates field labels, props, nested props, and slots during transformField', () => {
    const runtime = createFormRuntime({
      plugins: [
        createI18nPlugin({
          locale: 'zh-CN',
          messages: {
            'zh-CN': {
              'field.name': '姓名 {name}',
              'field.name.placeholder': '请输入 {name}',
              'role.admin': '管理员',
              'role.user': '普通用户',
              'slot.help': '帮助 {name}',
            },
          },
          fields: {
            name: {
              label: { key: 'field.name', params: { name: 'Ada' } },
              props: {
                options: [
                  { label: { key: 'role.admin' }, value: 'admin' },
                  { label: { key: 'role.user' }, value: 'user' },
                ],
                placeholder: { key: 'field.name.placeholder', params: { name: 'Ada' } },
              },
              slots: {
                default: { key: 'slot.help', params: { name: 'Ada' } },
              },
            },
          },
        }),
      ],
    })

    const resolved = runtime.transformField(defineField({
      component: 'input',
      field: 'name',
    })) as NormalizedFieldConfig

    expect(resolved.label).toBe('姓名 Ada')
    expect(resolved.props.placeholder).toBe('请输入 Ada')
    expect(resolved.props.options).toEqual([
      { label: '管理员', value: 'admin' },
      { label: '普通用户', value: 'user' },
    ])
    expect(resolved.slots?.default).toBe('帮助 Ada')
  })

  it('keeps explicit field values above plugin translations', () => {
    const runtime = createFormRuntime({
      plugins: [
        createI18nPlugin({
          locale: 'zh-CN',
          messages: {
            'zh-CN': {
              label: '插件标签',
              placeholder: '插件占位',
              tooltip: '插件提示',
              width: '44px',
            },
          },
          fields: {
            name: {
              label: { key: 'label' },
              props: {
                placeholder: { key: 'placeholder' },
                style: {
                  color: { key: 'tooltip' },
                  width: { key: 'width' },
                },
              },
            },
          },
        }),
      ],
    })

    const resolved = runtime.transformField(defineField({
      component: 'input',
      field: 'name',
      label: '用户标签',
      props: {
        placeholder: '用户占位',
        style: {
          width: '80px',
        },
      },
    })) as NormalizedFieldConfig

    expect(resolved.label).toBe('用户标签')
    expect(resolved.props).toEqual({
      placeholder: '用户占位',
      style: {
        color: '插件提示',
        width: '80px',
      },
    })
  })

  it('uses default messages and active locale messages without token fallbacks', () => {
    const runtime = createFormRuntime({
      plugins: [
        createI18nPlugin({
          locale: 'zh-CN',
          messages: {
            'en-US': {
              email: 'Email',
            },
            'zh-CN': {
              name: '姓名 {name}',
            },
          },
          fields: {
            name: {
              label: { key: 'name', defaultMessage: 'Name', params: { name: 'Ada' } },
              props: {
                placeholder: { key: 'email', defaultMessage: 'Email default' },
              },
            },
            email: {
              label: { key: 'email' },
            },
          },
        }),
      ],
    })

    const name = runtime.transformField(defineField({
      component: 'input',
      field: 'name',
    })) as NormalizedFieldConfig

    expect(name.label).toBe('姓名 Ada')
    expect(name.props.placeholder).toBe('Email default')
    expect(() => runtime.transformField(defineField({
      component: 'input',
      field: 'email',
    }))).toThrow(/Missing i18n message: email/)
  })

  it('supports dynamic locale getters, custom translators, and function messages', () => {
    let locale = 'en-US'
    const runtime = createFormRuntime({
      plugins: [
        createI18nPlugin({
          locale: () => locale,
          messages: {
            'en-US': {
              greeting: (params, currentLocale) => `${currentLocale}:${String(params?.name)}`,
              status: 'Status',
            },
            'zh-CN': {
              greeting: (params, currentLocale) => `${currentLocale}:${String(params?.name)}`,
              status: '状态',
            },
          },
          translate: (key, params, defaultMessage, currentLocale) => {
            if (key === 'runtime.locale')
              return `${currentLocale}:${String(params?.value)}`
            return defaultMessage
          },
          fields: {
            status: {
              label: { key: 'status' },
              props: {
                title: { key: 'runtime.locale', defaultMessage: 'default', params: { value: 'active' } },
                placeholder: { key: 'greeting', params: { name: 'Ada' } },
              },
            },
          },
        }),
      ],
    })

    const en = runtime.transformField(defineField({
      component: 'input',
      field: 'status',
    })) as NormalizedFieldConfig

    expect(en.label).toBe('Status')
    expect(en.props.title).toBe('en-US:active')
    expect(en.props.placeholder).toBe('en-US:Ada')

    locale = 'zh-CN'
    const zh = runtime.transformField(defineField({
      component: 'input',
      field: 'status',
    })) as NormalizedFieldConfig

    expect(zh.label).toBe('状态')
  })

  it('notifies missing handlers but still throws missing message errors', () => {
    let missingKey: string | undefined
    const plugin = createI18nPlugin({
      fields: {
        name: {
          label: { key: 'missing.key' },
        },
      },
      missing: (key) => {
        missingKey = key
      },
    })
    const runtime = createFormRuntime({ plugins: [plugin] })

    expect(plugin.name).toBe('i18n')
    expect(plugin).not.toHaveProperty('tokens')
    expect(plugin).not.toHaveProperty('priority')
    expect(() => runtime.transformField(defineField({
      component: 'input',
      field: 'name',
    }))).toThrow(/Missing i18n message: missing\.key/)
    expect(missingKey).toBe('missing.key')
  })

  it('throws invalid translation declarations instead of silently skipping them', () => {
    expect(() => createFormRuntime({
      plugins: [
        createI18nPlugin({
          fields: {
            name: {
              label: { key: '' },
            },
          },
        }),
      ],
    }).transformField(defineField({ component: 'input', field: 'name' })))
      .toThrow(/i18n key must be a non-empty string/)

    expect(() => createFormRuntime({
      plugins: [
        createI18nPlugin({
          fields: {
            name: {
              label: { key: 'bad.default', defaultMessage: 123 as never },
            },
          },
        }),
      ],
    }).transformField(defineField({ component: 'input', field: 'name' })))
      .toThrow(/i18n defaultMessage must be a string/)

    expect(() => createFormRuntime({
      plugins: [
        createI18nPlugin({
          fields: {
            name: {
              label: { key: 'bad.params', params: [] as never },
            },
          },
        }),
      ],
    }).transformField(defineField({ component: 'input', field: 'name' })))
      .toThrow(/fields\.name\.label\.params must be an object/)
  })

  it('does not swallow errors from locale, translate, message, or missing handlers', () => {
    expect(() => {
      const runtime = createFormRuntime({
        plugins: [
          createI18nPlugin({
            fields: { status: { label: { key: 'status' } } },
            locale: () => { throw new Error('locale failed') },
          }),
        ],
      })
      runtime.transformField(defineField({ component: 'input', field: 'status' }))
    }).toThrow('locale failed')

    expect(() => {
      const runtime = createFormRuntime({
        plugins: [
          createI18nPlugin({
            fields: { status: { label: { key: 'status' } } },
            translate: () => { throw new Error('translate failed') },
          }),
        ],
      })
      runtime.transformField(defineField({ component: 'input', field: 'status' }))
    }).toThrow('translate failed')

    expect(() => {
      const runtime = createFormRuntime({
        plugins: [
          createI18nPlugin({
            fields: { status: { label: { key: 'status' } } },
            locale: 'zh-CN',
            messages: {
              'zh-CN': {
                status: () => { throw new Error('message failed') },
              },
            },
          }),
        ],
      })
      runtime.transformField(defineField({ component: 'input', field: 'status' }))
    }).toThrow('message failed')

    expect(() => {
      const runtime = createFormRuntime({
        plugins: [
          createI18nPlugin({
            fields: { status: { label: { key: 'status' } } },
            missing: () => { throw new Error('missing failed') },
          }),
        ],
      })
      runtime.transformField(defineField({ component: 'input', field: 'status' }))
    }).toThrow('missing failed')
  })

  it('removes the old token-oriented public API', () => {
    type HasI18nTokenFactory = 'i18n' extends keyof typeof PublicApi ? true : false
    type HasIsI18nToken = 'isI18nToken' extends keyof typeof PublicApi ? true : false
    type PluginHasTokens = 'tokens' extends keyof ReturnType<typeof createI18nPlugin> ? true : false

    expectTypeOf<HasI18nTokenFactory>().toEqualTypeOf<false>()
    expectTypeOf<HasIsI18nToken>().toEqualTypeOf<false>()
    expectTypeOf<PluginHasTokens>().toEqualTypeOf<false>()
  })
})
