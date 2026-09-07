import type * as PublicApi from '../index'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  ConfigForm,
  ConfigFormError,
  ConfigFormRenderer,
  createConfigFormRendererExpose,
  withConfigFormInstall,
} from '../index'

describe('public api', () => {
  it('exposes the canonical Renderer entry and field helpers', () => {
    type RendererProps = PublicApi.ConfigFormProps<{ name: string }>
    type RendererExpose = PublicApi.ConfigFormExpose<{ name: string }>

    expect(ConfigForm).toBeDefined()
    expect(ConfigFormRenderer).toBeDefined()
    expect(createConfigFormRendererExpose).toBeTypeOf('function')
    expect(withConfigFormInstall).toBeTypeOf('function')
    expectTypeOf<RendererProps['fields']>().not.toBeNever()
    expectTypeOf<RendererProps['defaultValues']>().toEqualTypeOf<Partial<{ name: string }> | undefined>()
    expectTypeOf<RendererExpose['scrollToField']>().toBeFunction()
  })

  it('exports the current runtime error contract', () => {
    const error = new ConfigFormError('CONFIG_FORM_TEST', 'test message', { field: 'name' })
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('CONFIG_FORM_TEST')
    expect(error.context).toEqual({ field: 'name' })
  })
})
