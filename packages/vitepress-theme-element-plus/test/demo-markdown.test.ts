import { describe, expect, it } from 'vitest'
import { createElementPlusDocsDemoId } from '../markdown'

describe('createElementPlusDocsDemoId', () => {
  it('is stable for the same title and source', () => {
    const source = '<template><div>Hello</div></template>'
    expect(createElementPlusDocsDemoId('Basic', source)).toBe(createElementPlusDocsDemoId('Basic', source))
    expect(createElementPlusDocsDemoId('Basic', source)).toMatch(/^demo-[a-f0-9]{16}$/)
  })

  it('changes when the title or source changes', () => {
    const source = '<template><div>Hello</div></template>'
    expect(createElementPlusDocsDemoId('Basic', source)).not.toBe(createElementPlusDocsDemoId('Advanced', source))
    expect(createElementPlusDocsDemoId('Basic', source)).not.toBe(createElementPlusDocsDemoId('Basic', `${source}\n`))
  })
})
