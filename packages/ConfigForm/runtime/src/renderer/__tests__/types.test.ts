import type { ConfigFormDataAttributes } from '@moluoxixi/config-form-headless'
import type { FormHTMLAttributes, HTMLAttributes } from 'vue'
import type {
  ConfigFormRendererCellAttrs,
  ConfigFormRendererFieldAttrs,
  ConfigFormRendererLayoutAttrs,
  ConfigFormRendererProps,
} from '../types'
import { describe, expect, it } from 'vitest'

interface TestValues {
  name: string
}

type AdapterFormAttrs = FormHTMLAttributes
type AdapterDomAttrs = HTMLAttributes & ConfigFormDataAttributes

const rendererAttrs: Pick<
  ConfigFormRendererProps<TestValues>,
  'cellAttrs' | 'formAttrs' | 'layoutAttrs'
> = {} as {
  cellAttrs?: AdapterDomAttrs
  formAttrs?: AdapterFormAttrs
  layoutAttrs?: AdapterDomAttrs
}

const rendererCellAttrs: ConfigFormRendererCellAttrs = {} as AdapterDomAttrs
const rendererFieldAttrs: ConfigFormRendererFieldAttrs = {} as AdapterDomAttrs
const rendererLayoutAttrs: ConfigFormRendererLayoutAttrs = {} as AdapterDomAttrs

describe('config form renderer attr types', () => {
  it('接受适配器收窄后的原生 DOM attrs 类型', () => {
    expect(rendererAttrs).toEqual({})
    expect(rendererCellAttrs).toEqual({})
    expect(rendererFieldAttrs).toEqual({})
    expect(rendererLayoutAttrs).toEqual({})
  })
})
