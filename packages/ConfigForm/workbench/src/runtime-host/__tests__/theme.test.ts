import { describe, expect, it } from 'vitest'
import { projectThemeStyle } from '../services/theme'

describe('runtime host project theme projection', () => {
  it('projects every structured token family without accepting CSS text', () => {
    expect(projectThemeStyle({
      version: 1,
      colors: { primary: '#336699', text: '#112233', canvas: '#F5F7FA' },
      typography: { family: 'serif', baseSize: 15, lineHeight: 1.6, bodyWeight: 500, headingWeight: 700 },
      spacing: { md: 16 },
      border: { width: 2, style: 'dashed' },
      radius: { md: 8 },
      shadows: { sm: { x: 0, y: 2, blur: 8, spread: 0, color: '#00000033' } },
    })).toMatchObject({
      '--demo-color-primary': '#336699',
      '--demo-color-text': '#112233',
      '--demo-color-canvas': '#F5F7FA',
      '--demo-font-family': 'ui-serif, Georgia, serif',
      '--demo-font-size': '15px',
      '--demo-font-body-weight': '500',
      '--demo-font-heading-weight': '700',
      '--demo-line-height': '1.6',
      '--demo-spacing-md': '16px',
      '--demo-border-width': '2px',
      '--demo-border-style': 'dashed',
      '--demo-radius-md': '8px',
      '--demo-shadow-sm': '0px 2px 8px 0px #00000033',
      '--el-color-primary': '#336699',
      '--el-text-color-primary': '#112233',
      '--el-border-radius-base': '8px',
    })
  })
})
