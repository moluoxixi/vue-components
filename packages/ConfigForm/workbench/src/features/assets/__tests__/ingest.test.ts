import { describe, expect, it } from 'vitest'
import { collectDatasetPaths, parseDatasetIngest } from '../services/ingest'

describe('explicit dataset ingestion', () => {
  it('preserves leading zeroes and supports BOM, CRLF, quoted newlines and escaped quotes', () => {
    expect(parseDatasetIngest('\uFEFFid,name,notes\r\n001,"Smith, Alice","line 1\r\nline ""2"""\r\n', 'csv')).toEqual([
      { id: '001', name: 'Smith, Alice', notes: 'line 1\r\nline "2"' },
    ])
  })
  it.each(['id,id\n1,2', '__proto__,name\n1,Alice', 'id,name\n1', 'id,name\n1,"Alice', 'id,name\n1,"Alice"tail'])(
    'rejects malformed CSV: %s',
    (text) => {
      expect(() => parseDatasetIngest(text, 'csv')).toThrow()
    },
  )
  it('preserves nested JSON types and rejects envelopes and primitive rows', () => {
    expect(parseDatasetIngest('[{"n":1,"active":false,"meta":{"a":[null]}}]', 'json')).toEqual([
      { n: 1, active: false, meta: { a: [null] } },
    ])
    expect(() => parseDatasetIngest('{"version":1,"dataset":{}}', 'json')).toThrow()
    expect(() => parseDatasetIngest('[1]', 'json')).toThrow()
    expect(() => parseDatasetIngest('[{"meta":{"constructor":1}}]', 'json')).toThrow()
  })
  it('collects nested paths without confusing literal dots or traversing arrays', () => {
    expect(collectDatasetPaths([{ 'a.b': 'text', 'meta': { name: 'A' }, 'tags': ['one'] }])).toEqual([
      ['a.b'],
      ['meta'],
      ['meta', 'name'],
      ['tags'],
    ])
  })
})
