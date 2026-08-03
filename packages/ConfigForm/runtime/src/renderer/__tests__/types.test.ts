import type { FormHTMLAttributes, HTMLAttributes } from 'vue'
import type {
  ConfigFormRendererCellAttrs,
  ConfigFormRendererEmits,
  ConfigFormRendererExpose,
  ConfigFormRendererFieldAttrs,
  ConfigFormRendererLayoutAttrs,
  ConfigFormRendererProps,
} from '../types'
import { describe, expect, it } from 'vitest'

interface TestValues {
  name: string
}

type AdapterFormAttrs = FormHTMLAttributes
type AdapterDomAttrs = HTMLAttributes

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

    if (false) {
      const emit = null as unknown as ConfigFormRendererEmits<TestValues>
      const expose = null as unknown as ConfigFormRendererExpose<TestValues>
      emit('metaChange', expose.getMeta())
      expose.setTouched('name')
      expose.setTouched(false)
    }
  })
})
