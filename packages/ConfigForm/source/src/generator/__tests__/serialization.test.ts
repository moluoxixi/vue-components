import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { sourceAttributeJson, sourceJson } from '../services/serialization'

describe('source serialization', () => {
  it('preserves nested style declarations while sorting ordinary configuration keys', () => {
    const value = {
      layoutAttrs: { title: 'Layout', style: [[{ paddingLeft: '24px', padding: '8px' }]], id: 'layout' },
      formAttrs: { style: { marginLeft: '32px', margin: '4px' }, class: { zebra: true, alpha: true } },
      metadata: { zebra: 2, alpha: { zebra: 1, alpha: 0 } },
    }
    for (const serialized of [JSON.parse(sourceJson(value)), runInNewContext(`(${sourceAttributeJson(value)})`)]) {
      expect(Object.keys(serialized)).toEqual(['formAttrs', 'layoutAttrs', 'metadata'])
      expect(Object.keys(serialized.layoutAttrs)).toEqual(['id', 'style', 'title'])
      expect(Object.keys(serialized.formAttrs.class)).toEqual(['alpha', 'zebra'])
      expect(Object.keys(serialized.metadata)).toEqual(['alpha', 'zebra'])
      expect(Object.keys(serialized.metadata.alpha)).toEqual(['alpha', 'zebra'])
      expect(Object.keys(serialized.formAttrs.style)).toEqual(['marginLeft', 'margin'])
      expect(Object.keys(serialized.layoutAttrs.style[0][0])).toEqual(['paddingLeft', 'padding'])
    }
  })
})
