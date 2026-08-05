import { describe, expect, it } from 'vitest'
import { createDemoId } from './demo'

describe('createDemoId', () => {
  it('is stable for the same title and source', () => {
    const source = '<template><div>Hello</div></template>'
    expect(createDemoId('Basic', source)).toBe(createDemoId('Basic', source))
    expect(createDemoId('Basic', source)).toMatch(/^demo-[a-f0-9]{16}$/)
  })

  it('changes when the title or source changes', () => {
    const source = '<template><div>Hello</div></template>'
    expect(createDemoId('Basic', source)).not.toBe(createDemoId('Advanced', source))
    expect(createDemoId('Basic', source)).not.toBe(createDemoId('Basic', `${source}\n`))
  })
})
